import { toEChartsOption } from "../adapter";
import { EChart } from "./EChart";
import type { ChartComponent } from "../registry/types";

/** Every ECharts-backed chart type shares this single component. */
export const EChartsChart: ChartComponent = ({ spec, data, theme, height }) => (
  <EChart option={toEChartsOption(spec, data)} theme={theme} height={height} />
);
