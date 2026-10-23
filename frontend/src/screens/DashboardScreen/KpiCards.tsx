import type { KpiCard as KpiCardData } from "../../api/staticDashboard";
import { formatFromUnit, formatValue } from "../../chart-engine";
import {
  ACCENT_BAR,
  ACCENT_BORDER,
  ACCENT_DOT,
  ACCENT_GLOW,
  ACCENT_TILE,
  KPI_ACCENT,
} from "./cells";

const KPI_ICON: Record<string, string> = {
  profit_margin: "trending_up",
  weighted_discount: "percent",
  loss_order_rate: "shield",
};

const KPI_TAG: Record<string, string> = {
  profit_margin: "Rentabilité",
  weighted_discount: "Politique prix",
  loss_order_rate: "Risque",
};

const METRIC_ICON: Record<string, string> = {
  total_sales: "point_of_sale",
  total_discount: "sell",
};

export function KpiCards({
  cards,
  metrics,
  loading,
}: {
  cards: KpiCardData[];
  metrics: KpiCardData[];
  loading: boolean;
}) {
  return (
    <div id="kpis" className="scroll-mt-24 space-y-4">
      {cards.length === 0 ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[0, 1, 2].map((slot) => (
            <div
              key={slot}
              className="flex min-h-[150px] flex-col justify-between gap-4 rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-soft"
            >
              <div
                className={`h-3 w-2/3 rounded-full bg-surface-container-high ${loading ? "shimmer" : ""}`}
              />
              <div
                className={`h-9 w-1/2 rounded-full bg-surface-container-high ${loading ? "shimmer" : ""}`}
              />
            </div>
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {cards.map((card, index) => {
            const accent = KPI_ACCENT[card.key] ?? "primary";
            return (
              <div
                key={card.key}
                className={`animate-fade-up group relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant/60 bg-white p-5 shadow-soft card-lift ${ACCENT_BORDER[accent]}`}
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <span
                  className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${ACCENT_BAR[accent]}`}
                />
                <div
                  className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl transition-colors ${ACCENT_GLOW[accent]}`}
                />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl ${ACCENT_TILE[accent]}`}
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {KPI_ICON[card.key] ?? "insights"}
                      </span>
                    </span>
                    <div>
                      <p className="text-[12px] font-semibold leading-tight text-on-surface-variant">
                        {card.label}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-outline">
                        {KPI_TAG[card.key] ?? "Indicateur"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${ACCENT_DOT[accent]}`}
                  />
                </div>

                <div className="relative mt-4 flex items-end justify-between gap-2">
                  <span className="font-display text-3xl font-extrabold leading-none tracking-tight text-on-surface tabular-nums lg:text-[34px]">
                    {formatValue(card.value, formatFromUnit(card.unit))}
                  </span>
                  <span className="mb-0.5 rounded-lg bg-surface-container-high px-2 py-1 text-[10px] font-semibold text-outline">
                    période
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {metrics.length > 0 && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {metrics.map((metric, index) => (
            <div
              key={metric.key}
              className="animate-fade-up flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/60 bg-white/80 px-4 py-3 shadow-soft"
              style={{ animationDelay: `${200 + index * 70}ms` }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-container text-primary">
                  <span className="material-symbols-outlined text-[18px]">
                    {METRIC_ICON[metric.key] ?? "insights"}
                  </span>
                </span>
                <span className="truncate text-[12px] font-medium text-on-surface-variant">
                  {metric.label}
                </span>
              </div>
              <span className="whitespace-nowrap font-mono text-[15px] font-semibold tabular-nums text-on-surface">
                {formatValue(metric.value, formatFromUnit(metric.unit))}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
