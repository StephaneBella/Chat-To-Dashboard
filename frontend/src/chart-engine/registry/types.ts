import type { ReactElement } from "react";
import type { Row, Spec } from "../contract";

export interface ChartComponentProps {
  spec: Spec;
  data: Row[];
  /** Registered ECharts theme name (see chart-engine/theme.ts). */
  theme?: string;
  /** Rendered chart height in pixels. */
  height?: number;
}

export type ChartComponent = (props: ChartComponentProps) => ReactElement;
