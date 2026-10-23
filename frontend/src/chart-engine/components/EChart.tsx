import { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { registerChartTheme } from "../theme";

export interface EChartProps {
  option: EChartsOption;
  height?: number;
  theme?: string;
}

export function EChart({ option, height = 320, theme }: EChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  // (Re)create whenever the theme changes, destroy on unmount.
  useEffect(() => {
    if (!containerRef.current) return;
    registerChartTheme();
    const chart = echarts.init(containerRef.current, theme);
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [theme]);

  // Update whenever the option (or the theme, via a fresh instance) changes.
  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option, theme]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
