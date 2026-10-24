import type { ChartType } from "../contract";
import type { ChartComponent } from "./types";
import { EChartsChart } from "../components/EChartsChart";
import { KpiCard } from "../components/dom/KpiCard";
import { DataTable } from "../components/dom/DataTable";

export type { ChartComponent, ChartComponentProps } from "./types";

export const chartRegistry: Record<ChartType, ChartComponent> = {
  line: EChartsChart,
  area: EChartsChart,
  bar: EChartsChart,
  hbar: EChartsChart,
  stackedBar: EChartsChart,
  groupedBar: EChartsChart,
  scatter: EChartsChart,
  pie: EChartsChart,
  donut: EChartsChart,
  heatmap: EChartsChart,
  waterfall: EChartsChart,
  gauge: EChartsChart,
  funnel: EChartsChart,
  radar: EChartsChart,
  bubble: EChartsChart,
  kpi: KpiCard,
  table: DataTable,
};

export function getChartComponent(type: ChartType): ChartComponent | undefined {
  return chartRegistry[type];
}
