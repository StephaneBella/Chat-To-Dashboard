import type { ChartComponent } from "../registry/types";

/** Honest placeholder for contract chart types not drawn yet (e.g. heatmap). */
export const UnsupportedChart: ChartComponent = ({ spec }) => (
  <div className="flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed border-outline-variant text-outline">
    Chart type “{spec.chartType}” is not implemented yet.
  </div>
);
