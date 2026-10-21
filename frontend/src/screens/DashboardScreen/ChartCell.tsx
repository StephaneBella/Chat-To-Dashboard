import {
  ChartRenderer,
  ErrorCard,
  LoadingState,
  STITCH_DARK_THEME,
} from "../../chart-engine";
import type { ContractEnvelope } from "../../chart-engine";
import {
  ACCENT_DOT,
  fillTemplate,
  type Accent,
  type ChartCellConfig,
} from "./cells";

export interface CellState {
  status: "loading" | "success" | "error";
  envelope?: ContractEnvelope;
  message?: string;
}

export function ChartCell({
  config,
  accent,
  kpiLabel,
  benchmark,
  state,
}: {
  config: ChartCellConfig;
  accent: Accent;
  kpiLabel: string;
  benchmark: string;
  state: CellState;
}) {
  const vars = { kpi: kpiLabel, benchmark };

  return (
    <section className="bg-surface-container rounded-2xl p-5 lg:p-6 border border-outline-variant/30 shadow-lg flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
        <div>
          <h2 className="text-base lg:text-lg font-bold text-white tracking-tight">
            {fillTemplate(config.title, vars)}
          </h2>
          <p className="text-[12px] text-outline mt-0.5">
            {fillTemplate(config.caption, vars)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-surface-container-high text-[11px] font-mono text-secondary border border-outline-variant/30 flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${ACCENT_DOT[accent]}`}
            />
            {fillTemplate(config.badge, vars)}
          </span>
        </div>
      </div>

      <div className="w-full relative min-h-[400px] bg-surface-container-lowest/70 rounded-xl p-4 border border-outline-variant/20 flex flex-col justify-center overflow-hidden">
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && (
          <ErrorCard
            title="Graphique indisponible"
            message={state.message ?? "Le chargement de ce graphique a échoué."}
          />
        )}
        {state.status === "success" && state.envelope && (
          <div className="w-full min-h-[380px]">
            <ChartRenderer
              response={state.envelope}
              theme={STITCH_DARK_THEME}
              height={380}
            />
          </div>
        )}
      </div>
    </section>
  );
}
