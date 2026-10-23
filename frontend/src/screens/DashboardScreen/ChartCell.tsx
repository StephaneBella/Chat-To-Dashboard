import {
  CHART_THEME,
  ChartRenderer,
  ErrorCard,
  LoadingState,
  catalogVariant,
} from "../../chart-engine";
import type { ContractEnvelope } from "../../chart-engine";
import {
  ACCENT_DOT,
  ACCENT_TILE,
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
  const variant = catalogVariant(config.variant);

  return (
    <section className="card-lift animate-fade-up flex flex-col space-y-4 rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-soft lg:p-6">
      <div className="flex flex-col justify-between gap-3 border-b border-outline-variant/50 pb-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ACCENT_TILE[accent]}`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {config.icon}
            </span>
          </span>
          <div>
            <h2 className="text-base font-bold leading-tight tracking-tight text-on-surface lg:text-[17px]">
              {fillTemplate(config.title, vars)}
            </h2>
            <p className="mt-0.5 text-[12px] text-outline">
              {fillTemplate(config.caption, vars)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-primary/15 bg-primary-container/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
            <span className={`h-1.5 w-1.5 rounded-full ${ACCENT_DOT[accent]}`} />
            {config.variant}
          </span>
          <span className="rounded-lg border border-outline-variant/60 bg-surface-container-low px-2.5 py-1 font-mono text-[10px] text-outline">
            {fillTemplate(config.badge, vars)}
          </span>
        </div>
      </div>

      <div className="relative flex min-h-[400px] w-full flex-col justify-center overflow-hidden rounded-2xl border border-outline-variant/40 bg-gradient-to-b from-surface-container-low to-white p-2 lg:p-3">
        {variant && (
          <span className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-medium text-outline backdrop-blur">
            {variant.label}
          </span>
        )}
        {state.status === "loading" && <LoadingState />}
        {state.status === "error" && (
          <ErrorCard
            title="Graphique indisponible"
            message={state.message ?? "Le chargement de ce graphique a échoué."}
          />
        )}
        {state.status === "success" && state.envelope && (
          <div className="min-h-[380px] w-full">
            <ChartRenderer
              response={state.envelope}
              theme={CHART_THEME}
              height={380}
            />
          </div>
        )}
      </div>
    </section>
  );
}
