import type { AgentChartPayload } from "../../api/agentChat";

interface ChartCardProps {
  chart: AgentChartPayload;
  title?: string;
  onOpen: () => void;
}

export function ChartCard({ chart, title, onOpen }: ChartCardProps) {
  const label = title || chart.title || "Graphique généré";
  return (
    <button
      onClick={onOpen}
      className="group mt-2 flex w-full items-center gap-2 rounded-xl border border-outline-variant/60 bg-surface-container-low px-3 py-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary-container/30"
    >
      <span className="material-symbols-outlined text-[18px] text-primary">
        bar_chart
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-on-surface">
          {label}
        </p>
        <p className="text-[10px] text-on-surface-variant">
          {chart.chart_type}
        </p>
      </div>
      <span className="material-symbols-outlined text-[18px] text-outline group-hover:text-primary">
        open_in_new
      </span>
    </button>
  );
}
