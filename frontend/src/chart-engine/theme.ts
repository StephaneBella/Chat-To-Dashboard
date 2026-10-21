import * as echarts from "echarts";

export const STITCH_DARK_THEME = "stitch-dark";

let registered = false;

export function registerStitchTheme(): void {
  if (registered) return;
  registered = true;

  echarts.registerTheme(STITCH_DARK_THEME, {
    color: [
      "#4edea3",
      "#38bdf8",
      "#a855f7",
      "#ffb95f",
      "#ffb4ab",
      "#adc6ff",
      "#60a5fa",
      "#ec4899",
    ],
    backgroundColor: "transparent",
    textStyle: {
      color: "#dae2fd",
      fontFamily: "Inter, sans-serif",
    },
    title: {
      textStyle: { color: "#ffffff", fontSize: 16, fontWeight: 600 },
      subtextStyle: { color: "#8c909f", fontSize: 12 },
    },
    legend: {
      textStyle: { color: "#c2c6d6", fontSize: 12 },
      pageTextStyle: { color: "#8c909f" },
    },
    tooltip: {
      backgroundColor: "rgba(34, 42, 61, 0.95)",
      borderColor: "#424754",
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: "#dae2fd", fontSize: 12 },
      extraCssText: "border-radius: 8px; backdrop-filter: blur(8px);",
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: "#424754" } },
      axisTick: { lineStyle: { color: "#424754" } },
      axisLabel: { color: "#8c909f" },
      splitLine: { show: false },
      nameTextStyle: { color: "#8c909f" },
    },
    valueAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#8c909f" },
      splitLine: { lineStyle: { color: "rgba(148, 163, 184, 0.08)" } },
      nameTextStyle: { color: "#8c909f" },
    },
    line: {
      symbolSize: 7,
      lineStyle: { width: 3 },
      itemStyle: { borderWidth: 2, borderColor: "#0b1326" },
    },
    bar: {
      barMaxWidth: 56,
      itemStyle: { borderRadius: 4 },
    },
    pie: {
      itemStyle: { borderColor: "#0b1326", borderWidth: 2 },
    },
  });
}
