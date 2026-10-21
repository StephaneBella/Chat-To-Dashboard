import type { EChartsOption } from "echarts";
import type { FieldSpec, Row, Spec } from "../contract";
import { asArray, buildCartesian, buildCategorical } from "./reshape";
import { formatValue } from "./format";

export function toEChartsOption(spec: Spec, data: Row[]): EChartsOption {
  switch (spec.chartType) {
    case "pie":
    case "donut":
      return buildPieOption(spec, data);
    case "scatter":
      return buildScatterOption(spec, data);
    default:
      return buildCartesianOption(spec, data);
  }
}

function axisTitle(field?: FieldSpec): string | undefined {
  return field?.title ?? field?.field;
}

function buildCartesianOption(spec: Spec, data: Row[]): EChartsOption {
  const { categories, series } = buildCartesian(spec, data);
  const options = spec.options ?? {};
  const horizontal = options.horizontal ?? false;

  const isArea = spec.chartType === "area";
  const isBar = ["bar", "hbar", "stackedBar", "groupedBar"].includes(
    spec.chartType,
  );
  const stack =
    options.stacked || spec.chartType === "stackedBar" ? "total" : undefined;

  const xSpec = asArray(spec.encoding.x)[0];
  const ySpecs = asArray(spec.encoding.y);

  // Categories always come from encoding.x (see buildCartesian), so the axis
  // names follow x/y regardless of the horizontal swap below.
  const categoryAxis = {
    type: "category" as const,
    data: categories,
    name: axisTitle(xSpec),
  };
  const valueAxis = {
    type: "value" as const,
    name: axisTitle(ySpecs[0]),
    axisLabel: {
      formatter: (value: number) =>
        formatValue(value, ySpecs[0]?.format ?? "number"),
    },
  };

  return {
    title: { text: spec.title, subtext: spec.subtitle },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) =>
        formatValue(value, ySpecs[0]?.format ?? "number"),
    },
    legend: { show: options.legend ?? true, top: 24 },
    grid: { left: 48, right: 24, bottom: 40, top: 64, containLabel: true },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: series.map((s) => ({
      name: s.name,
      type: isBar ? "bar" : "line",
      data: s.values,
      stack,
      smooth: !isBar && (options.smooth ?? isArea),
      connectNulls: false,
      areaStyle: isArea ? {} : undefined,
    })),
  };
}

function buildPieOption(spec: Spec, data: Row[]): EChartsOption {
  const items = buildCategorical(spec, data);
  const isDonut = spec.chartType === "donut";
  const valueSpec = asArray(spec.encoding.value)[0];
  const options = spec.options ?? {};

  return {
    title: { text: spec.title, subtext: spec.subtitle },
    tooltip: {
      trigger: "item",
      valueFormatter: (value) =>
        formatValue(value, valueSpec?.format ?? options.format ?? "number"),
    },
    legend: { show: options.legend ?? true, bottom: 0 },
    series: [
      {
        type: "pie",
        radius: isDonut ? ["40%", "70%"] : "70%",
        data: items,
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.3)" },
        },
      },
    ],
  };
}

function buildScatterOption(spec: Spec, data: Row[]): EChartsOption {
  const xSpec = asArray(spec.encoding.x)[0];
  const ySpec = asArray(spec.encoding.y)[0];
  const seriesSpec = asArray(spec.encoding.series)[0];

  if (!xSpec || !ySpec) return { series: [] };

  if (seriesSpec) {
    const groups = new Map<string, [number, number][]>();
    for (const row of data) {
      const key = String(row[seriesSpec.field] ?? "");
      const point: [number, number] = [
        Number(row[xSpec.field]),
        Number(row[ySpec.field]),
      ];
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(point);
    }
    return {
      title: { text: spec.title },
      tooltip: { trigger: "item" },
      legend: { top: 24 },
      xAxis: { type: "value", name: axisTitle(xSpec) },
      yAxis: { type: "value", name: axisTitle(ySpec) },
      series: [...groups.entries()].map(([name, points]) => ({
        name,
        type: "scatter" as const,
        data: points,
      })),
    };
  }

  return {
    title: { text: spec.title },
    tooltip: { trigger: "item" },
    xAxis: { type: "value", name: axisTitle(xSpec) },
    yAxis: { type: "value", name: axisTitle(ySpec) },
    series: [
      {
        type: "scatter",
        data: data.map((row) => [
          Number(row[xSpec.field]),
          Number(row[ySpec.field]),
        ]),
      },
    ],
  };
}
