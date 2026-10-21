import type { KpiCard as KpiCardData } from "../../api/staticDashboard";
import { formatFromUnit, formatValue } from "../../chart-engine";
import { ACCENT_BORDER, ACCENT_DOT, ACCENT_GLOW, KPI_ACCENT } from "./cells";

const METRIC_ICON: Record<string, string> = {
  Total_sales: "point_of_sale",
  total_discount: "percent",
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
    <div className="space-y-4">
      {cards.length === 0 ? (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((slot) => (
            <div
              key={slot}
              className="bg-surface-container rounded-2xl p-5 border border-outline-variant/30 shadow-md flex flex-col justify-between gap-4 min-h-[110px]"
            >
              <div
                className={`h-3 w-2/3 rounded bg-surface-container-high ${loading ? "animate-pulse" : ""}`}
              />
              <div
                className={`h-8 w-1/2 rounded bg-surface-container-high ${loading ? "animate-pulse" : ""}`}
              />
            </div>
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cards.map((card) => {
            const accent = KPI_ACCENT[card.key] ?? "primary";
            return (
              <div
                key={card.key}
                className={`bg-surface-container rounded-2xl p-5 border border-outline-variant/30 shadow-md transition-all group flex flex-col justify-between relative overflow-hidden ${ACCENT_BORDER[accent]}`}
              >
                <div
                  className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-xl transition-colors pointer-events-none ${ACCENT_GLOW[accent]}`}
                />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-on-surface-variant font-medium">
                      {card.label}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${ACCENT_DOT[accent]}`}
                    />
                  </div>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl lg:text-4xl font-bold text-white tracking-tight font-sans tabular-nums">
                      {formatValue(card.value, formatFromUnit(card.unit))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {metrics.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {metrics.map((metric) => (
            <div
              key={metric.key}
              className="bg-surface-container/50 rounded-xl px-4 py-3 border border-outline-variant/20 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[18px] text-primary">
                  {METRIC_ICON[metric.key] ?? "insights"}
                </span>
                <span className="text-[12px] text-on-surface-variant truncate">
                  {metric.label}
                </span>
              </div>
              <span className="text-base font-semibold text-white tabular-nums font-mono whitespace-nowrap">
                {formatValue(metric.value, formatFromUnit(metric.unit))}
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
