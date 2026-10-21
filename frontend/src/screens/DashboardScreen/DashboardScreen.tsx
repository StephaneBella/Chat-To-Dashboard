import { useEffect, useState } from "react";
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
import { AppHeader } from "./AppHeader";
import { ChatLauncher } from "./ChatLauncher";
import { ChartCell, type CellState } from "./ChartCell";
import { ControlBar } from "./ControlBar";
import { KpiCards } from "./KpiCards";
import { CHART_CELLS, KPI_ACCENT } from "./cells";

const DEFAULT_KPI = "profit_margin";

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
    : "—";

  const timeCell = CHART_CELLS.find((cell) => cell.dimension === "time");
  const otherCells = CHART_CELLS.filter((cell) => cell.dimension !== "time");

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans antialiased">
      <AppHeader />

      <main className="w-full pt-20 pb-12 min-h-screen">
        <div className="w-full p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
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
            <section className="bg-tertiary/5 border border-tertiary/25 rounded-2xl p-3 flex items-center gap-2 text-[12px] text-tertiary">
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
            <section className="bg-error-container/25 border border-error/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-error">
                <span className="material-symbols-outlined text-[18px]">
                  error
                </span>
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant/30 text-[12px] font-medium text-on-surface hover:bg-surface-container-high hover:text-white transition-colors cursor-pointer"
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-outline pt-1 gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-secondary">
                info
              </span>
              <span>
                Survolez les éléments pour afficher les valeurs exactes au format
                français.
              </span>
            </div>
            <span className="font-mono text-[11px] text-outline-variant">
              SOURCE: SUPERSTORE_GLOBAL_MART_2018_2021.PARQUET
            </span>
          </div>
        </div>
      </main>

      <ChatLauncher />
    </div>
  );
};

export default DashboardScreen;
