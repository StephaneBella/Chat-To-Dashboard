import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import {
  deleteThread,
  fetchAgentResultRows,
  getThread,
  listThreads,
  postAgentChat,
  type AgentChartPayload,
  type ThreadSummary,
} from "../../api/agentChat";
import { ApiError } from "../../api/http";
import { AppHeader } from "../../components/AppHeader";
import type { Row } from "../../chart-engine";
import { useAuth } from "../../auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { useTypewriter } from "../../hooks/useTypewriter";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ChartCard } from "./ChartCard";
import { ChartPanel } from "./ChartPanel";
import { ThreadsSidebar } from "./ThreadsSidebar";

interface Turn {
  id: number;
  question: string;
  answer: string;
  chart: AgentChartPayload | null;
  rows: Row[];
  failed: boolean;
  animate: boolean;
}

const SUGGESTIONS = [
  "Quel est notre chiffre d'affaires total ?",
  "Comment se répartit le chiffre d'affaires par région ?",
  "Quel segment client est le plus rentable ?",
  "Comment évolue le chiffre d'affaires mois par mois ?",
  "Quelle est la marge par tranche de remise ?",
];

function AgentAvatar() {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-primary/25">
      <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
    </span>
  );
}

function TypewriterAnswer({ text, animate }: { text: string; animate: boolean }) {
  const { displayed, done, skip } = useTypewriter(text, { speed: 16, enabled: animate });
  return (
    <div
      className="max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-tl-md border border-outline-variant/60 bg-white px-4 py-3 text-[13px] leading-relaxed text-on-surface shadow-soft"
      onClick={animate ? skip : undefined}
      role={animate ? "button" : undefined}
      tabIndex={animate ? 0 : -1}
    >
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={{
          p: ({ children }) => (
            <p className="whitespace-pre-wrap [&+p]:mt-2">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold">{children}</strong>
          ),
        }}
      >
        {displayed}
      </ReactMarkdown>
      {animate && !done && <span className="ml-1 inline-block h-4 w-[1px] animate-pulse bg-primary align-middle" />}
    </div>
  );
}

export default function AgentScreen() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [activeChart, setActiveChart] = useState<{
    turnId: number;
    chart: AgentChartPayload;
    rows: Row[];
  } | null>(null);
  const [showMobileChart, setShowMobileChart] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const nextId = useRef(1);
  const conversationVersion = useRef(0);
  const activeSendVersion = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { status } = useAuth();
  const navigate = useNavigate();

  // Auth bypassed for dev

  const loadThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const list = await listThreads();
      setThreads(list.sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1)));
    } catch {
      // ignore
    } finally {
      setThreadsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authed") {
      void loadThreads();
    }
  }, [status, loadThreads]);

  useEffect(() => {
    if (turns.length === 0 && !pendingQuestion) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pendingQuestion]);

  const reset = useCallback(() => {
    conversationVersion.current += 1;
    setTurns([]);
    setThreadId(undefined);
    setInput("");
    setPending(false);
    setPendingQuestion(null);
    setActiveChart(null);
    setShowMobileChart(false);
    nextId.current = 1;
  }, []);

  const openChart = useCallback(
    (turnId: number, chart: AgentChartPayload, rows: Row[]) => {
      setActiveChart({ turnId, chart, rows });
      // setShowMobileChart(false);
    },
    [],
  );

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (
        !trimmed ||
        pending ||
        activeSendVersion.current === conversationVersion.current
      ) {
        return;
      }

      const requestVersion = conversationVersion.current;
      activeSendVersion.current = requestVersion;
      const id = nextId.current++;
      setPending(true);
      setPendingQuestion(trimmed);
      setInput("");

      try {
        const response = await postAgentChat({
          message: trimmed,
          thread_id: threadId,
        });
        if (requestVersion !== conversationVersion.current) return;
        if (response.thread_id) {
          setThreadId(response.thread_id);
        }

        let rows: Row[] = [];
        let chart: AgentChartPayload | null = null;
        if (response.chart) {
          chart = response.chart;
          try {
            const fetched = await fetchAgentResultRows(
              response.thread_id ?? threadId ?? "",
              chart.result_id,
            );
            if (requestVersion !== conversationVersion.current) return;
            rows = fetched.rows;
          } catch {
            rows = [];
          }
        }
        if (requestVersion !== conversationVersion.current) return;

        setTurns((previous) => [
          ...previous,
          {
            id,
            question: trimmed,
            answer: response.answer,
            chart,
            rows,
            failed: false,
            animate: true,
          },
        ]);

        if (chart && rows.length > 0) {
          setActiveChart({ turnId: id, chart, rows });
          setShowMobileChart(true);
        }

        void loadThreads();
      } catch (error) {
        if (requestVersion !== conversationVersion.current) return;
        let message =
          "Désolé, je n’ai pas pu obtenir de réponse du serveur. Vérifiez que le backend est démarré, puis réessayez.";
        if (error instanceof ApiError) {
          message = error.message;
        } else if (error instanceof Error) {
          message = error.message || message;
        }
        setTurns((previous) => [
          ...previous,
          {
            id,
            question: trimmed,
            answer: message,
            chart: null,
            rows: [],
            failed: true,
            animate: true,
          },
        ]);
      } finally {
        if (activeSendVersion.current === requestVersion) {
          activeSendVersion.current = null;
        }
        if (requestVersion === conversationVersion.current) {
          setPending(false);
          setPendingQuestion(null);
        }
      }
    },
    [pending, threadId, loadThreads],
  );

  const selectThread = useCallback(async (id: string) => {
    const requestVersion = ++conversationVersion.current;
    setPending(false);
    setPendingQuestion(null);
    try {
      const detail = await getThread(id);
      if (requestVersion !== conversationVersion.current) return;
      setThreadId(id);
      nextId.current = 1;
      let turnId = 0;
      const loadedTurns: Turn[] = [];
      for (let i = 0; i < detail.messages.length; i += 2) {
        const userMsg = detail.messages[i];
        const assistantMsg = detail.messages[i + 1];
        if (userMsg && userMsg.role === "user") {
          turnId += 1;
          loadedTurns.push({
            id: turnId,
            question: userMsg.content,
            answer: assistantMsg?.content ?? "",
            chart: null,
            rows: [],
            failed: false,
            animate: false,
          });
          }
      }
      setTurns(loadedTurns);
      setActiveChart(null);
      setShowMobileChart(false);
    } catch {
      // ignore
    }
  }, []);

  const handleDeleteThread = useCallback(
    async (id: string) => {
      try {
        await deleteThread(id);
        setThreads((prev) => prev.filter((t) => t.id !== id));
        if (threadId === id) {
          reset();
        }
      } catch {
        // ignore
      }
    },
    [threadId, reset],
  );

  return (
    <div className="app-bg flex h-screen flex-col text-on-surface">
      <AppHeader />

      <div className="flex flex-1 overflow-hidden pt-[72px]">
        {sidebarOpen && (
          <ThreadsSidebar
            threads={threads}
            activeId={threadId}
            onSelect={(id) => void selectThread(id)}
            onNew={reset}
            onDelete={(id) => void handleDeleteThread(id)}
            loading={threadsLoading}
          />
        )}

        <main className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-hidden relative min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="absolute left-2 top-2 z-10 hidden lg:flex items-center justify-center rounded-lg border border-outline-variant/60 bg-white/90 p-1.5 text-outline hover:text-on-surface shadow-sm"
              aria-label={sidebarOpen ? "Masquer les conversations" : "Afficher les conversations"}
            >
              <span className="material-symbols-outlined text-[18px]">
                {sidebarOpen ? "chevron_left" : "menu"}
              </span>
            </button>
            <div className="flex-1 overflow-auto px-4 pb-32 pt-6 lg:px-8">
              <div className="mx-auto w-full max-w-3xl">
                {turns.length === 0 && !pendingQuestion && (
                  <section className="animate-fade-up relative overflow-hidden rounded-3xl border border-outline-variant/60 bg-white p-6 shadow-soft lg:p-8">
                    <div className="relative flex items-start gap-4">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-primary/25">
                        <span className="material-symbols-outlined text-[24px]">
                          neurology
                        </span>
                      </span>
                      <div>
                        <h1 className="font-display text-2xl font-extrabold tracking-tight">
                          Que voulez-vous{" "}
                          <span className="text-gradient">savoir</span> ?
                        </h1>
                        <p className="mt-1.5 text-[13px] leading-relaxed text-on-surface-variant">
                          L&apos;agent interroge l&apos;entrepôt (2014–2017),
                          applique les mêmes formules que le tableau de bord, puis
                          dessine le graphique correspondant.
                        </p>
                      </div>
                    </div>

                    <p className="relative mt-6 text-[10px] font-semibold uppercase tracking-wider text-outline">
                      Exemples de questions
                    </p>
                    <div className="relative mt-2 flex flex-wrap gap-2">
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void send(suggestion)}
                          className="group flex cursor-pointer items-center gap-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-left text-[12px] font-medium text-on-surface-variant transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-container/40 hover:text-primary"
                        >
                          <span className="material-symbols-outlined text-[15px] text-outline group-hover:text-primary">
                            chat_bubble
                          </span>
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                <div className="space-y-7">
                  {turns.map((turn) => (
                    <article key={turn.id} className="animate-fade-up space-y-3">
                      <div className="flex items-start justify-end gap-2">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-emerald-600 to-teal-600 px-4 py-2.5 text-[13px] font-medium text-white shadow-md shadow-primary/20">
                          {turn.question}
                        </div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-outline-variant/60 bg-white text-outline shadow-sm">
                          <span className="material-symbols-outlined text-[18px]">
                            person
                          </span>
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        <AgentAvatar />
                        <div className="min-w-0 flex-1 space-y-2">
                          {!turn.failed ? (
                            <TypewriterAnswer text={turn.answer} animate={turn.animate} />
                          ) : (
                            <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-start gap-2">
                                <span className="material-symbols-outlined text-[18px]">
                                  error
                                </span>
                                <span>{turn.answer}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => void send(turn.question)}
                                disabled={pending}
                                className="flex cursor-pointer items-center gap-1 self-start rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  refresh
                                </span>
                                Réessayer
                              </button>
                            </div>
                          )}

                          {turn.chart && turn.rows.length > 0 && (
                            <ChartCard
                              chart={turn.chart}
                              title={turn.chart.title}
                              onOpen={() => openChart(turn.id, turn.chart!, turn.rows)}
                            />
                          )}
                          {/* {turn.chart && turn.rows.length > 0 && (
                            <button
                              type="button"
                              onClick={() => openChart(turn.id, turn.chart!, turn.rows)}
                              className="flex items-center gap-1.5 rounded-xl border border-outline-variant/60 bg-white px-3 py-2 text-[12px] font-semibold text-on-surface hover:bg-surface-container-low"
                            >
                              <span className="material-symbols-outlined text-[17px]">bar_chart</span>
                              Afficher le graphique
                            </button>
                          )} */}
                          {turn.chart && turn.rows.length === 0 && (
                            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
                              <span className="material-symbols-outlined text-[18px]">
                                warning
                              </span>
                              Le graphique n&apos;a pas pu être tracé : les lignes du
                              résultat sont indisponibles.
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}

                  {pendingQuestion && (
                    <article className="animate-fade-up space-y-3">
                      <div className="flex items-start justify-end gap-2">
                        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-emerald-600 to-teal-600 px-4 py-2.5 text-[13px] font-medium text-white shadow-md shadow-primary/20">
                          {pendingQuestion}
                        </div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-outline-variant/60 bg-white text-outline shadow-sm">
                          <span className="material-symbols-outlined text-[18px]">
                            person
                          </span>
                        </span>
                      </div>

                      <div className="flex items-start gap-3">
                        <AgentAvatar />
                        <ThinkingIndicator />
                      </div>
                    </article>
                  )}

                  <div ref={bottomRef} />
                </div>
              </div>
            </div>

            <div className="border-t border-outline-variant/60 bg-white/80 px-4 py-3">
              <form
                className="mx-auto w-full max-w-3xl"
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(input);
                }}
              >
                <div className="flex items-center gap-2 rounded-2xl border border-outline-variant/60 p-2 shadow-soft">
                  <span className="material-symbols-outlined ml-1.5 text-[20px] text-primary">
                    auto_awesome
                  </span>
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder="Posez votre question..."
                    className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-on-surface placeholder:text-outline focus:outline-none"
                    disabled={pending}
                  />
                  <button
                    type="submit"
                    disabled={pending || input.trim().length === 0}
                    className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2.5 text-[12px] font-semibold text-white shadow-md shadow-primary/20 disabled:opacity-50"
                  >
                    <span
                      className={`material-symbols-outlined text-[17px] ${
                        pending ? "animate-spin" : ""
                      }`}
                    >
                      {pending ? "progress_activity" : "send"}
                    </span>
                    <span className="hidden sm:inline">
                      {pending ? "Analyse…" : "Envoyer"}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          <ChartPanel
            chart={activeChart?.chart ?? null}
            rows={activeChart?.rows ?? []}
            onClose={() => setActiveChart(null)}
          />
        </main>
      </div>

      {showMobileChart && activeChart && (
        <ChartPanel
          chart={activeChart.chart}
          rows={activeChart.rows}
          onClose={() => setShowMobileChart(false)}
          mobile
        />
      )}
    </div>
  );
}
