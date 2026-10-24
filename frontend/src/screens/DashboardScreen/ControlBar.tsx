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
    <section className="flex flex-col items-stretch justify-between gap-4 rounded-2xl border border-outline-variant/60 bg-white p-4 shadow-soft sm:flex-row sm:items-center">
      <div className="flex flex-1 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-primary">
          <span className="material-symbols-outlined text-[20px]">
            tune
          </span>
        </span>
        <div className="w-full">
          <label
            htmlFor="kpi-select"
            className="text-[10px] font-semibold uppercase tracking-wider text-outline"
          >
            Indicateur suivi
          </label>
          <div className="relative mt-1 w-full sm:max-w-xs">
            <select
              id="kpi-select"
              value={value}
              onChange={(event) => onChange(event.target.value)}
              disabled={kpis.length === 0}
              className="w-full cursor-pointer appearance-none rounded-xl border border-outline-variant/70 bg-surface-container-low py-2.5 pl-3.5 pr-9 text-[13px] font-semibold text-on-surface shadow-sm transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {kpis.map((kpi) => (
                <option key={kpi.key} value={kpi.key}>
                  {kpi.label}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-outline">
              expand_more
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        {mocked && (
          <span
            title="Le backend est indisponible : les graphiques affichent des données de démonstration."
            className="flex items-center gap-1 whitespace-nowrap rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-700"
          >
            <span className="material-symbols-outlined text-[14px]">
              experiment
            </span>
            Démo
          </span>
        )}
        <div className="hidden items-center gap-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-low px-2.5 py-2 text-[11px] font-medium text-outline md:flex">
          <span className="material-symbols-outlined text-[15px] text-secondary">
            stacked_line_chart
          </span>
          5 graphiques synchronisés
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2.5 text-[12px] font-semibold text-white shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            className={`material-symbols-outlined text-[16px] ${
              refreshing ? "animate-spin" : ""
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
