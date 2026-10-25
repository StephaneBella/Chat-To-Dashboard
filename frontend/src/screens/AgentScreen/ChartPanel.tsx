import { useEffect } from "react";
import { CHART_THEME, ChartRenderer } from "../../chart-engine";
import { agentChartToEnvelope } from "../../chart-engine/adapter/fromAgentChart";
import type { AgentChartPayload } from "../../api/agentChat";
import type { Row } from "../../chart-engine";

interface ChartPanelProps {
  chart: AgentChartPayload | null;
  rows: Row[];
  onClose: () => void;
  mobile?: boolean;
}

export function ChartPanel({ chart, rows, onClose, mobile = false }: ChartPanelProps) {
  useEffect(() => {
    if (!mobile) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobile, onClose]);

  if (!chart) {
    return (
      <></>
      // <aside className="hidden h-full w-[420px] flex-col border-l border-outline-variant/60 bg-white/80 lg:flex">
      //   <div className="flex items-center justify-between px-4 py-3">
      //     <span className="text-[12px] font-semibold text-on-surface-variant">
      //       Graphique
      //     </span>
      //   </div>
      //   <div className="flex flex-1 items-center justify-center text-center text-[12px] text-outline">
      //     <div>
      //       <span className="material-symbols-outlined mb-1 block text-[28px]">
      //         bar_chart
      //       </span>
      //       Sélectionnez ou générez un graphique
      //     </div>
      //   </div>
      // </aside>
    );
  }

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-outline-variant/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-on-surface">
            {chart.title || "Graphique généré"}
          </p>
          <p className="text-[10px] text-on-surface-variant">
            {chart.chart_type}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-outline hover:bg-surface-container-highest hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {rows.length > 0 ? (
          <ChartRenderer
            response={agentChartToEnvelope(chart, rows)}
            theme={CHART_THEME}
            height={420}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[12px] text-amber-700">
            Données du graphique indisponibles
          </div>
        )}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/30 lg:hidden">
        <div className="flex-1" onClick={onClose} />
        <div className="h-[70vh] rounded-t-3xl bg-white shadow-lift">
          {content}
        </div>
      </div>
    );
  }

  return (
    <aside className="hidden h-full w-[460px] flex-col border-l border-outline-variant/60 bg-white lg:flex">
      {content}
    </aside>
  );
}
