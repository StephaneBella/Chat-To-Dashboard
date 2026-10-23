import * as echarts from "echarts";

/** Name of the registered ECharts theme used by every chart. */
export const CHART_THEME = "superstore-green";

let registered = false;

/** Registers the light green theme once, before any chart is created. */
export function registerChartTheme(): void {
  if (registered) return;
  registered = true;

  echarts.registerTheme(CHART_THEME, {
    color: [
      "#0f7a4d",
      "#10b981",
      "#14b8a6",
      "#0ea5e9",
      "#f59e0b",
      "#8b5cf6",
      "#f43f5e",
      "#84cc16",
    ],
    backgroundColor: "transparent",
    textStyle: {
      color: "#0f2419",
      fontFamily: "Inter, sans-serif",
    },
    title: {
      textStyle: { color: "#0b1f15", fontSize: 16, fontWeight: 700 },
      subtextStyle: { color: "#6b8576", fontSize: 12 },
    },
    legend: {
      textStyle: { color: "#44604f", fontSize: 12 },
      pageTextStyle: { color: "#6b8576" },
    },
    tooltip: {
      backgroundColor: "rgba(255, 255, 255, 0.97)",
      borderColor: "#d4e5d9",
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { color: "#0f2419", fontSize: 12 },
      extraCssText:
        "border-radius: 12px; box-shadow: 0 18px 40px -18px rgba(15,36,25,.35);",
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: "#d4e5d9" } },
      axisTick: { lineStyle: { color: "#d4e5d9" } },
      axisLabel: { color: "#6b8576" },
      splitLine: { show: false },
      nameTextStyle: { color: "#6b8576" },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#6b8576" },
      splitLine: { lineStyle: { color: "rgba(15, 36, 25, 0.07)" } },
      nameTextStyle: { color: "#6b8576" },
    },
    line: {
      symbolSize: 7,
      lineStyle: { width: 3 },
      itemStyle: { borderWidth: 2, borderColor: "#ffffff" },
    },
    bar: {
      barMaxWidth: 56,
      itemStyle: { borderRadius: 6 },
    },
    pie: {
      itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
    },
  });
}
