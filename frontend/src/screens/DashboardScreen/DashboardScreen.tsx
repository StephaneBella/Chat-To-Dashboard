import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  errorMessage,
  fetchStaticDashboard,
  type KpiCard,
  type KpiOption,
} from "../../api/staticDashboard";
import {
  formatFromUnit,
  formatValue,
  staticDashboardToEnvelope,
} from "../../chart-engine";
import { AppHeader } from "../../components/AppHeader";
import { ChatLauncher } from "./ChatLauncher";
import { ChartCell, type CellState } from "./ChartCell";
import { ControlBar } from "./ControlBar";
import { KpiCards } from "./KpiCards";
import { CHART_CELLS, KPI_ACCENT } from "./cells";

const DEFAULT_KPI = "profit_margin";

const HERO_BARS = [42, 58, 47, 72, 63, 84, 76, 92, 81, 96];

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function loadingCells(): Record<string, CellState> {
  return Object.fromEntries(
    CHART_CELLS.map((cell) => [cell.dimension, { status: "loading" as const }]),
  );
}

function errorCells(message: string): Record<string, CellState> {
  return Object.fromEntries(
    CHART_CELLS.map((cell) => [cell.dimension, { status: "error" as const, message }]),
  );
}

function Hero({
  kpiLabel,
  benchmark,
  bars,
  barsCaption,
}: {
  kpiLabel: string;
  benchmark: string;
  bars: number[];
  barsCaption: string;
}) {
  return (
    <section className="hero-gradient animate-fade-up relative overflow-hidden rounded-3xl px-6 py-8 text-white shadow-2xl shadow-emerald-900/20 lg:px-10 lg:py-10">
      <div className="animate-float-slow pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-24 right-24 h-56 w-56 rounded-full bg-lime-300/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_-20%,rgba(255,255,255,0.14),transparent_55%)]" />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider backdrop-blur">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-300" />
            Pilotage en temps réel
          </span>
          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight sm:text-4xl lg:text-[42px]">
            Vos données, enfin <span className="text-lime-300">lisibles</span>.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-emerald-50/85">
            Un tableau de bord unique pour suivre la marge, les remises et le
            risque de perte — puis poser vos questions en langage naturel à
            l&apos;agent.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/agent"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-[13px] font-semibold text-emerald-800 shadow-lg shadow-emerald-950/20 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <span className="material-symbols-outlined text-[18px]">
                auto_awesome
              </span>
              Poser une question
            </Link>
            <a
              href="#kpis"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/5 px-4 py-2.5 text-[13px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/15"
            >
              <span className="material-symbols-outlined text-[18px]">
                monitoring
              </span>
              Voir les indicateurs
            </a>
          </div>
        </div>

        <div className="w-full max-w-xs rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-md">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-50/70">
            <span>KPI suivi</span>
            <span className="material-symbols-outlined text-[16px]">
              monitoring
            </span>
          </div>
          <p className="mt-2 text-[13px] font-medium text-emerald-50">
            {kpiLabel}
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold tracking-tight">
            {benchmark}
          </p>
          <div className="mt-5 flex h-16 items-end gap-1.5">
            {bars.map((height, index) => (
              <span
                key={index}
                className="animate-fade-up flex-1 rounded-t bg-gradient-to-t from-lime-300/40 to-lime-200"
                style={{
                  height: `${Math.max(8, Math.min(100, height))}%`,
                  animationDelay: `${index * 45}ms`,
                }}
              />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-emerald-50/60">{barsCaption}</p>
        </div>
      </div>
    </section>
  );
}

const DashboardScreen = () => {
  const [kpis, setKpis] = useState<KpiOption[]>([]);
  const [cards, setCards] = useState<KpiCard[]>([]);
  const [metrics, setMetrics] = useState<KpiCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mocked, setMocked] = useState(false);
  const [mockReason, setMockReason] = useState<string | null>(null);
  const [kpi, setKpi] = useState(DEFAULT_KPI);
  const [cellsSnapshot, setCellsSnapshot] = useState<{
    key: string;
    map: Record<string, CellState>;
  }>({ key: "", map: {} });
  const [reloadToken, setReloadToken] = useState(0);

  const cellsKey = `${kpi}|${reloadToken}`;
  const loading = cellsSnapshot.key !== cellsKey;
  const cells =
    cellsSnapshot.key === cellsKey ? cellsSnapshot.map : loadingCells();

  const handleRefresh = () => setReloadToken((token) => token + 1);

  useEffect(() => {
    const controller = new AbortController();

    fetchStaticDashboard({ kpi, signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setKpis(response.options.kpis);
        setCards(response.kpi_cards);
        setMetrics(response.metrics_cards);
        setMocked(response.mocked);
        setMockReason(response.mockReason ?? null);
        setError(null);
        setCellsSnapshot({
          key: cellsKey,
          map: Object.fromEntries(
            CHART_CELLS.map((cell) => {
              const chart = response.charts[cell.dimension];
              if (!chart) {
                return [
                  cell.dimension,
                  {
                    status: "error" as const,
                    message: "Aucune donnée pour cette dimension.",
                  },
                ];
              }
              return [
                cell.dimension,
                {
                  status: "success" as const,
                  envelope: staticDashboardToEnvelope(chart, kpi),
                },
              ];
            }),
          ),
        });
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || isAbort(cause)) return;
        const message = errorMessage(cause);
        setError(message);
        setCellsSnapshot({ key: cellsKey, map: errorCells(message) });
      });

    return () => controller.abort();
  }, [kpi, reloadToken, cellsKey]);

  const kpiOption = kpis.find((option) => option.key === kpi);
  const kpiLabel = kpiOption?.label ?? kpi;
  const kpiAccent = KPI_ACCENT[kpi] ?? "primary";
  const benchmarkCard = cards.find((card) => card.key === kpi);
  const benchmark = benchmarkCard
    ? formatValue(benchmarkCard.value, formatFromUnit(benchmarkCard.unit))
    : "-";

  const timeCell = CHART_CELLS.find((cell) => cell.dimension === "time");
  const otherCells = CHART_CELLS.filter((cell) => cell.dimension !== "time");

  const timeState = cells["time"];
  const timeValues =
    timeState?.status === "success" && timeState.envelope
      ? timeState.envelope.data
          .map((row) => Number(row.value))
          .filter((value) => Number.isFinite(value))
          .slice(-12)
      : [];
  const hasTrend = timeValues.length >= 2;
  const trendMin = hasTrend ? Math.min(...timeValues) : 0;
  const trendMax = hasTrend ? Math.max(...timeValues) : 1;
  const trendSpan = trendMax - trendMin || 1;
  const heroBars = hasTrend
    ? timeValues.map((value) => 12 + ((value - trendMin) / trendSpan) * 88)
    : HERO_BARS;
  const heroCaption = hasTrend
    ? "12 derniers mois de la période"
    : "Moyenne globale sur la période 2014–2017";

  return (
    <div className="app-bg min-h-screen font-sans text-on-surface antialiased">
      <AppHeader />

      <main className="min-h-screen w-full pb-16 pt-[72px]">
        <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-6 lg:px-8 lg:py-8">
          <Hero
            kpiLabel={kpiLabel}
            benchmark={benchmark}
            bars={heroBars}
            barsCaption={heroCaption}
          />

          <KpiCards cards={cards} metrics={metrics} loading={loading} />

          <ControlBar
            kpis={kpis}
            value={kpi}
            onChange={setKpi}
            onRefresh={handleRefresh}
            refreshing={loading}
            mocked={mocked}
          />

          {mocked && !error && (
            <section className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-medium text-amber-800">
              <span className="material-symbols-outlined text-[18px]">
                experiment
              </span>
              <span>
                Backend indisponible : affichage de données de démonstration.
                {mockReason ? ` (${mockReason})` : ""}
              </span>
            </section>
          )}

          {error && (
            <section className="flex flex-col justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-sm font-medium text-rose-700">
                <span className="material-symbols-outlined text-[18px]">
                  error
                </span>
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="cursor-pointer self-start rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-700 shadow-sm transition-colors hover:bg-rose-100 sm:self-auto"
              >
                Réessayer
              </button>
            </section>
          )}

          {timeCell && (
            <ChartCell
              config={timeCell}
              accent={kpiAccent}
              kpiLabel={kpiLabel}
              benchmark={benchmark}
              state={cells[timeCell.dimension] ?? { status: "loading" }}
            />
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {otherCells.map((cell) => (
              <ChartCell
                key={cell.dimension}
                config={cell}
                accent={cell.accentFromKpi ? kpiAccent : cell.accent}
                kpiLabel={kpiLabel}
                benchmark={benchmark}
                state={cells[cell.dimension] ?? { status: "loading" }}
              />
            ))}
          </div>

          <div className="flex flex-col justify-between gap-2 pt-1 text-[11px] text-outline sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">
                info
              </span>
              <span>
                Survolez les éléments pour afficher les valeurs exactes au format
                français.
              </span>
            </div>
            <span className="font-mono text-[10px] tracking-wide text-outline/70">
              SOURCE : SUPERSTORE_GLOBAL_MART_2018_2021.PARQUET
            </span>
          </div>
        </div>
      </main>

      <ChatLauncher />
    </div>
  );
};

export default DashboardScreen;
