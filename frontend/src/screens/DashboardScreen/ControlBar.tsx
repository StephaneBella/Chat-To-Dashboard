import type { KpiOption } from "../../api/staticDashboard";

export function ControlBar({
  kpis,
  value,
  onChange,
  onRefresh,
  refreshing,
  mocked,
}: {
  kpis: KpiOption[];
  value: string;
  onChange: (key: string) => void;
  onRefresh: () => void;
  refreshing: boolean;
  mocked: boolean;
}) {
  return (
    <section className="bg-surface-container rounded-2xl p-4 border border-outline-variant/30 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3 flex-1">
        <label
          htmlFor="kpi-select"
          className="text-[12px] font-semibold text-outline uppercase tracking-wider whitespace-nowrap"
        >
          Métrique KPI :
        </label>
        <div className="relative w-full sm:max-w-xs">
          <select
            id="kpi-select"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={kpis.length === 0}
            className="w-full appearance-none bg-surface-container-lowest hover:bg-surface-container-high text-on-surface text-[13px] font-medium py-2.5 pl-3.5 pr-9 rounded-xl border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {kpis.map((kpi) => (
              <option
                key={kpi.key}
                value={kpi.key}
                className="bg-surface-container text-on-surface"
              >
                {kpi.label}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined text-[18px] text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            expand_more
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2">
        {mocked && (
          <span
            title="Le backend est indisponible : les graphiques affichent des données de démonstration."
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-tertiary/10 border border-tertiary/30 text-[11px] font-medium text-tertiary whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[14px]">
              experiment
            </span>
            Données de démo
          </span>
        )}
        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono text-outline-variant">
          <span className="material-symbols-outlined text-[15px]">
            stacked_line_chart
          </span>
          <span>5 graphiques synchronisés</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container-high border border-outline-variant/30 text-[12px] font-medium text-on-surface hover:text-white transition-colors cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <span
            className={`material-symbols-outlined text-[16px] ${
              refreshing ? "animate-spin text-primary" : "text-secondary"
            }`}
          >
            refresh
          </span>
          <span>{refreshing ? "Actualisation…" : "Rafraîchir"}</span>
        </button>
      </div>
    </section>
  );
}
