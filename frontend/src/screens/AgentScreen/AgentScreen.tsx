import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAgentResultRows,
  postAgentChat,
  type AgentChartPayload,
} from "../../api/agentChart";
import { AppHeader } from "../../components/AppHeader";
import {
  CHART_THEME,
  ChartRenderer,
  agentChartToEnvelope,
} from "../../chart-engine";
import type { Row } from "../../chart-engine";

interface Turn {
  id: number;
  question: string;
  answer: string;
  chart: AgentChartPayload | null;
  rows: Row[];
  failed: boolean;
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
      <span className="material-symbols-outlined text-[18px]">
        auto_awesome
      </span>
    </span>
  );
}

/**
 * The conversational screen: the agent answers with a text, and sometimes
 * with a chart. The chart is described by the payload of the agent; the
 * values are fetched separately, from the result the agent stored.
 */
export default function AgentScreen() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (turns.length === 0 && !pendingQuestion) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, pendingQuestion]);

  const reset = useCallback(() => {
    setTurns([]);
    setThreadId(undefined);
    setInput("");
    setPendingQuestion(null);
    nextId.current = 1;
  }, []);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || pending) return;

      const id = nextId.current++;
      setPending(true);
      setPendingQuestion(trimmed);
      setInput("");

      try {
        const response = await postAgentChat({
          message: trimmed,
          thread_id: threadId,
        });
        if (response.thread_id) setThreadId(response.thread_id);

        let rows: Row[] = [];
        let chart: AgentChartPayload | null = null;
        if (response.chart) {
          chart = response.chart;
          try {
            const fetched = await fetchAgentResultRows(
              chart.result_id,
              response.thread_id ?? threadId,
            );
            rows = fetched.rows;
          } catch {
            rows = [];
          }
        }

        setTurns((previous) => [
          ...previous,
          { id, question: trimmed, answer: response.answer, chart, rows, failed: false },
        ]);
      } catch (error) {
        setTurns((previous) => [
          ...previous,
          {
            id,
            question: trimmed,
            answer:
              error instanceof Error
                ? error.message
                : "La requête a échoué pour une raison inconnue.",
            chart: null,
            rows: [],
            failed: true,
          },
        ]);
      } finally {
        setPending(false);
        setPendingQuestion(null);
      }
    },
    [pending, threadId],
  );

  return (
    <div className="app-bg flex min-h-screen flex-col text-on-surface">
      <AppHeader />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-40 pt-[96px] lg:px-6">
        {(turns.length > 0 || pendingQuestion) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-outline">
              <span className="material-symbols-outlined text-[15px] text-primary">
                history
              </span>
              Conversation en cours
            </span>
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-outline-variant/60 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant shadow-sm transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[15px]">
                add_comment
              </span>
              Nouvelle conversation
            </button>
          </div>
        )}

        {turns.length === 0 && !pendingQuestion && (
          <section className="animate-fade-up relative overflow-hidden rounded-3xl border border-outline-variant/60 bg-white p-6 shadow-soft lg:p-8">
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-secondary/10 blur-3xl" />

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
                  L&apos;agent interroge l&apos;entrepôt (2014–2017), applique les
                  mêmes formules que le tableau de bord, puis dessine le
                  graphique correspondant.
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
                <div className="min-w-0 flex-1 space-y-3">
                  {!turn.failed && (
                    <div className="max-w-[95%] whitespace-pre-wrap rounded-2xl rounded-tl-md border border-outline-variant/60 bg-white px-4 py-3 text-[13px] leading-relaxed text-on-surface shadow-soft">
                      {turn.answer}
                    </div>
                  )}

                  {turn.failed && (
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
                    <div className="w-full rounded-2xl border border-outline-variant/60 bg-white p-3 shadow-soft">
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-outline">
                        <span className="material-symbols-outlined text-[15px] text-primary">
                          bar_chart
                        </span>
                        Visualisation générée
                      </div>
                      <ChartRenderer
                        response={agentChartToEnvelope(turn.chart, turn.rows)}
                        theme={CHART_THEME}
                        height={320}
                      />
                    </div>
                  )}

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
                <div className="flex items-center gap-3 rounded-2xl rounded-tl-md border border-outline-variant/60 bg-white px-4 py-3 shadow-soft">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className="dot-bounce h-1.5 w-1.5 rounded-full bg-primary"
                        style={{ animationDelay: `${dot * 160}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-[12px] text-outline">
                    L&apos;agent analyse l&apos;entrepôt…
                  </span>
                </div>
              </div>
            </article>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <form
        className="fixed inset-x-0 bottom-0 z-30 px-4 pb-4 pt-2"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <div className="mx-auto w-full max-w-4xl">
          <div className="glass flex items-center gap-2 rounded-2xl border border-outline-variant/60 p-2 shadow-lift">
            <span className="material-symbols-outlined ml-1.5 text-[20px] text-primary">
              auto_awesome
            </span>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Posez votre question (ex. : le CA par région en 2017 ?)"
              className="min-w-0 flex-1 bg-transparent py-2 text-[13px] text-on-surface placeholder:text-outline focus:outline-none"
              disabled={pending}
            />
            <button
              type="submit"
              disabled={pending || input.trim().length === 0}
              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2.5 text-[12px] font-semibold text-white shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:px-4"
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
          <p className="mt-2 text-center text-[10px] text-outline">
            {threadId
              ? `Conversation ${threadId.slice(0, 8)} · données Superstore 2014–2017`
              : "Les réponses sont générées à partir de l'entrepôt Superstore."}
          </p>
        </div>
      </form>
    </div>
  );
}
