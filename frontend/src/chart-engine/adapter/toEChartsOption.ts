import type { EChartsOption } from "echarts";
import type { FieldSpec, Row, Spec } from "../contract";
import {
  asArray,
  buildBubble,
  buildCartesian,
  buildCategorical,
  buildMatrix,
  buildRadar,
  toNumber,
} from "./reshape";
import { formatValue } from "./format";

export function toEChartsOption(spec: Spec, data: Row[]): EChartsOption {
  switch (spec.chartType) {
    case "pie":
    case "donut":
      return buildPieOption(spec, data);
    case "scatter":
      return buildScatterOption(spec, data);
    case "heatmap":
      return buildHeatmapOption(spec, data);
    case "waterfall":
      return buildWaterfallOption(spec, data);
    case "gauge":
      return buildGaugeOption(spec, data);
    case "funnel":
      return buildFunnelOption(spec, data);
    case "radar":
      return buildRadarOption(spec, data);
    case "bubble":
      return buildBubbleOption(spec, data);
    default:
      return buildCartesianOption(spec, data);
  }
}

function axisTitle(field?: FieldSpec): string | undefined {
  return field?.title ?? field?.field;
}

/**
 * The dashboard cards and the agent panel already draw their own HTML titles.
 * Keeping a fixed 64px top margin wastes a lot of space when the chart has no
 * title, so the grid only reserves the room it actually uses.
 */
function gridLayout(
  spec: Spec,
  {
    legend = false,
    xName = true,
    topName = false,
  }: { legend?: boolean; xName?: boolean; topName?: boolean } = {},
) {
  const top = spec.title
    ? spec.subtitle
      ? 58
      : 44
    : legend
      ? 32
      : topName
        ? 28
        : 16;
  return {
    // containLabel already reserves room for the tick labels; `left` is only
    // the outer gutter that holds the rotated vertical axis name.
    left: 16,
    right: 16,
    top,
    bottom: xName ? 46 : 30,
    containLabel: true,
  };
}

/** Legend sits under the title, or at the very top when there is no title. */
function legendTop(spec: Spec): number {
  if (!spec.title) return 4;
  return spec.subtitle ? 30 : 24;
}

/**
 * Name a horizontal axis at its centre. The default "end" position puts the
 * name outside the grid, where it is clipped on narrow cards.
 */
function horizontalName(field?: FieldSpec) {
  return {
    name: axisTitle(field),
    nameLocation: "middle" as const,
    nameGap: 26,
  };
}

/**
 * Draw a y-axis name horizontally above the grid, aligned with the axis line.
 * Both the rotated "end" placement (names grow past the top edge) and the
 * centred placement (names sit on top of the tick labels) are unreadable.
 */
function topAxisName(field?: FieldSpec) {
  return {
    name: axisTitle(field),
    nameLocation: "end" as const,
    nameRotate: 0,
    nameGap: 8,
    nameTextStyle: {
      align: "left" as const,
      verticalAlign: "bottom" as const,
    },
  };
}

/**
 * The categorical axis always comes from encoding.x (see buildCartesian), so
 * the axis names follow x/y regardless of the horizontal swap below.
 */
function buildCartesianOption(spec: Spec, data: Row[]): EChartsOption {
  const { categories, series } = buildCartesian(spec, data);
  const options = spec.options ?? {};
  const horizontal = options.horizontal ?? spec.chartType === "hbar";

  const isArea = spec.chartType === "area";
  const isBar = ["bar", "hbar", "stackedBar", "groupedBar"].includes(
    spec.chartType,
  );
  const stack =
    options.stacked || spec.chartType === "stackedBar" ? "total" : undefined;

  const xSpec = asArray(spec.encoding.x)[0];
  const ySpecs = asArray(spec.encoding.y);

  // A second value axis only makes sense on a vertical chart.
  const dualAxis = !horizontal && ySpecs.some((ys) => ys.axis === "right");

  const categoryAxis = {
    type: "category" as const,
    data: categories,
  };

  // The static dashboard has no chart title/legend (the card header plays
  // that role), so there is room for the horizontal y-axis name above the
  // grid. When the agent sends a title or a legend, that space is taken.
  const showYName = !spec.title && options.legend === false;

  const valueAxis = (
    field?: FieldSpec,
    format?: FieldSpec["format"],
    withName = true,
  ) => ({
    type: "value" as const,
    ...(showYName && withName ? topAxisName(field) : {}),
    axisLabel: {
      formatter: (value: number) => formatValue(value, format ?? "number"),
    },
  });

  const axes = dualAxis
    ? [
        valueAxis(ySpecs[0], ySpecs[0]?.format, !horizontal),
        valueAxis(ySpecs[1], ySpecs[1]?.format, false),
      ]
    : [valueAxis(ySpecs[0], ySpecs[0]?.format, !horizontal)];

  const xAxis = horizontal
    ? { ...axes[0], ...horizontalName(ySpecs[0]) }
    : { ...categoryAxis, ...horizontalName(xSpec) };
  const yAxis = horizontal
    ? {
        ...categoryAxis,
        ...(showYName ? topAxisName(xSpec) : {}),
      }
    : axes;

  return {
    title: { text: spec.title, subtext: spec.subtitle },
    tooltip: {
      trigger: "axis",
      valueFormatter: (value) =>
        formatValue(value, ySpecs[0]?.format ?? "number"),
    },
    legend: { show: options.legend ?? true, top: legendTop(spec) },
    grid: gridLayout(spec, {
      legend: options.legend ?? true,
      xName: Boolean(axisTitle(horizontal ? ySpecs[0] : xSpec)),
      topName: showYName,
    }),
    xAxis,
    yAxis,
    series: series.map((s) => {
      // The per-field render hint is what makes "bar + line" possible.
      const render = s.render ?? (isBar ? "bar" : "line");
      const type = render === "area" ? "line" : render;
      return {
        name: s.name,
        type,
        data: s.values,
        stack,
        smooth: type === "line" && (options.smooth ?? isArea),
        connectNulls: false,
        areaStyle: render === "area" ? {} : undefined,
        barGap: render === "bar" ? options.barGap : undefined,
        yAxisIndex: dualAxis && s.axis === "right" ? 1 : undefined,
      };
    }),
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
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(15,36,25,0.18)" },
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
      legend: { top: legendTop(spec) },
      grid: gridLayout(spec, {
        legend: true,
        xName: Boolean(axisTitle(xSpec)),
      }),
      xAxis: { type: "value", ...horizontalName(xSpec) },
      yAxis: { type: "value" },
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
    grid: gridLayout(spec, {
      xName: Boolean(axisTitle(xSpec)),
      topName: !spec.title,
    }),
    xAxis: { type: "value", ...horizontalName(xSpec) },
    yAxis: {
      type: "value",
      ...(!spec.title ? topAxisName(ySpec) : {}),
    },
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

/**
 * The heatmap needs a scale that keeps the losses visible: a linear scale from
 * the minimum to the maximum would paint a small loss like a big profit.
 * The scale is therefore diverging around zero.
 */
function buildHeatmapOption(spec: Spec, data: Row[]): EChartsOption {
  const { xCategories, yCategories, matrix, min, max } = buildMatrix(spec, data);
  const valueSpec = asArray(spec.encoding.value)[0];
  const xSpec = asArray(spec.encoding.x)[0];
  const ySpec = asArray(spec.encoding.series)[0];

  const hasNegative = min < 0;
  const bound = Math.max(Math.abs(min), Math.abs(max));
  const visualMin = hasNegative ? -bound : 0;
  const visualMax = hasNegative ? bound : max;

  const colors = hasNegative
    ? ["#dc2626", "#fca5a5", "#f1f5f9", "#6ee7b7", "#059669"]
    : ["#f1f5f9", "#6ee7b7", "#047857"];

  const cells = matrix.length * (matrix[0]?.length ?? 0);

  return {
    title: { text: spec.title, subtext: spec.subtitle },
    tooltip: {
      trigger: "item",
      valueFormatter: (value) =>
        formatValue(value, valueSpec?.format ?? "number"),
    },
    grid: {
      ...gridLayout(spec, {
        xName: Boolean(axisTitle(xSpec)),
        topName: !spec.title,
      }),
      bottom: 58,
    },
    xAxis: {
      type: "category",
      data: xCategories,
      ...horizontalName(xSpec),
      splitArea: { show: true },
    },
    yAxis: {
      type: "category",
      data: yCategories,
      ...(!spec.title ? topAxisName(ySpec) : {}),
      splitArea: { show: true },
    },
    visualMap: {
      dimension: 2,
      min: visualMin,
      max: visualMax,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 4,
      textStyle: { color: "#6b8576" },
      inRange: { color: colors },
    },
    series: [
      {
        type: "heatmap",
        data: matrix.flatMap((row, yi) =>
          row.map((value, xi) => [xi, yi, value]),
        ),
        label: {
          show: cells <= 40,
          color: "#064e3b",
          formatter: (params: { value: unknown }) => {
            const value = Array.isArray(params.value)
              ? params.value[2]
              : params.value;
            return formatValue(value, valueSpec?.format ?? "number");
          },
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(15,36,25,0.22)" },
        },
      },
    ],
  };
}

/**
 * The waterfall is drawn with a custom series: ECharts 6 has no native
 * waterfall series, and a stacked bar cannot go downwards.
 *
 * Two modes:
 * - "contributions" (default): every row is a contribution, the engine adds
 *   the final "Total" bar.
 * - "bridge": the first row is the starting total, the last one is the
 *   closing total, the rows in between are the contributions.
 */
interface WaterfallStep {
  name: string;
  from: number;
  to: number;
  delta: number;
  color: string;
}

const WF_POSITIVE = "#10b981";
const WF_NEGATIVE = "#ef4444";
const WF_NEUTRAL = "#94a3b8";

function toWaterfallSteps(
  categories: string[],
  values: number[],
  mode: "contributions" | "bridge",
): WaterfallStep[] {
  if (mode === "bridge" && values.length >= 2) {
    const steps: WaterfallStep[] = [];
    let running = values[0];
    steps.push({
      name: categories[0],
      from: 0,
      to: values[0],
      delta: values[0],
      color: WF_NEUTRAL,
    });
    for (let i = 1; i < values.length - 1; i++) {
      const from = running;
      running += values[i];
      steps.push({
        name: categories[i],
        from,
        to: running,
        delta: values[i],
        color: values[i] >= 0 ? WF_POSITIVE : WF_NEGATIVE,
      });
    }
    steps.push({
      name: categories[values.length - 1],
      from: 0,
      to: values[values.length - 1],
      delta: values[values.length - 1],
      color: WF_NEUTRAL,
    });
    return steps;
  }

  const steps: WaterfallStep[] = [];
  let running = 0;
  for (let i = 0; i < values.length; i++) {
    const from = running;
    running += values[i];
    steps.push({
      name: categories[i],
      from,
      to: running,
      delta: values[i],
      color: values[i] >= 0 ? WF_POSITIVE : WF_NEGATIVE,
    });
  }
  steps.push({
    name: "Total",
    from: 0,
    to: running,
    delta: running,
    color: WF_NEUTRAL,
  });
  return steps;
}

function clipRect(
  rect: { x: number; y: number; width: number; height: number },
  bounds: { x: number; y: number; width: number; height: number },
) {
  const x = Math.max(rect.x, bounds.x);
  const y = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  };
}

function buildWaterfallOption(spec: Spec, data: Row[]): EChartsOption {
  const { categories, series } = buildCartesian(spec, data);
  const options = spec.options ?? {};
  const ySpec = asArray(spec.encoding.y)[0];
  const format = ySpec?.format ?? "number";
  const values = (series[0]?.values ?? []).map((v) => v ?? 0);
  const mode =
    options.waterfallMode === "bridge" ? "bridge" : "contributions";

  const steps = toWaterfallSteps(categories, values, mode);
  const axisCategories = steps.map((step) => step.name);

  return {
    title: { text: spec.title, subtext: spec.subtitle },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params];
        const step = steps[list[0]?.dataIndex ?? 0];
        if (!step) return "";
        const sign = step.delta > 0 ? "+" : "";
        return `${step.name}<br/>${sign}${formatValue(step.delta, format)}`;
      },
    },
    legend: { show: false },
    grid: gridLayout(spec, { xName: false, topName: !spec.title }),
    xAxis: { type: "category", data: axisCategories },
    yAxis: {
      type: "value",
      ...(!spec.title ? topAxisName(ySpec) : {}),
      axisLabel: {
        formatter: (value: number) => formatValue(value, format),
      },
    },
    series: [
      {
        type: "custom",
        encode: { x: 0, y: [1, 2] },
        data: steps.map((step, index) => [index, step.from, step.to]),
        renderItem: (params, api) => {
          const index = Number(api.value(0));
          const from = Number(api.value(1));
          const to = Number(api.value(2));

          const startPoint = api.coord([index, from]);
          const endPoint = api.coord([index, to]);
          const size = api.size?.([1, 0]);
          const stepWidth =
            (Array.isArray(size) ? size[0] : size ?? 40) * 0.6;

          // At runtime the cartesian coordSys exposes the grid rectangle,
          // the public types only declare its type.
          const bounds = params.coordSys as unknown as {
            x: number;
            y: number;
            width: number;
            height: number;
          };

          const rect = clipRect(
            {
              x: startPoint[0] - stepWidth / 2,
              y: Math.min(startPoint[1], endPoint[1]),
              width: stepWidth,
              height: Math.abs(endPoint[1] - startPoint[1]),
            },
            bounds,
          );

          const step = steps[index];
          const sign = step && step.delta > 0 ? "+" : "";
          const labelY =
            step && step.delta < 0
              ? Math.max(startPoint[1], endPoint[1]) + 6
              : Math.min(startPoint[1], endPoint[1]) - 6;

          return {
            type: "group",
            children: [
              {
                type: "rect",
                shape: rect,
                style: api.style({
                  fill: step?.color ?? WF_NEUTRAL,
                }),
              },
              {
                type: "text",
                style: {
                  text: `${sign}${formatValue(step?.delta ?? 0, format)}`,
                  x: rect.x + rect.width / 2,
                  y: labelY,
                  fill: "#0f2419",
                  fontSize: 11,
                  align: "center",
                  verticalAlign: step && step.delta < 0 ? "top" : "bottom",
                },
              },
            ],
          };
        },
      },
    ],
  };
}

/**
 * The gauge shows one value against a target: the orange band on the axis is
 * the target zone, the needle is the actual value.
 */
function buildGaugeOption(spec: Spec, data: Row[]): EChartsOption {
  const options = spec.options ?? {};
  const ySpec = asArray(spec.encoding.y)[0];
  const value = data.length > 0 ? toNumber(data[0][ySpec?.field ?? ""]) ?? 0 : 0;
  const target = options.target;
  const format = ySpec?.format ?? options.format ?? "number";

  const max =
    target != null
      ? Math.max(value, target) * 1.2
      : value > 0
        ? value * 1.2
        : 100;
  const targetRatio = target != null && max > 0 ? target / max : 0;

  return {
    title: {
      text: spec.title,
      subtext:
        target != null
          ? `${spec.subtitle ?? ""} Objectif : ${formatValue(target, format)}`.trim()
          : spec.subtitle,
    },
    tooltip: {
      trigger: "item",
      valueFormatter: (v) => formatValue(v, format),
    },
    series: [
      {
        type: "gauge",
        min: 0,
        max,
        radius: "72%",
        center: ["50%", "58%"],
        pointer: { itemStyle: { color: "#0f7a4d" } },
        progress: { show: false },
        axisLine: {
          lineStyle: {
            width: 14,
            color:
              targetRatio > 0
                ? [
                    [targetRatio, "#f59e0b"],
                    [1, "#e2e8f0"],
                  ]
                : [[1, "#e2e8f0"]],
          },
        },
        axisTick: { show: false },
        splitLine: { length: 10, lineStyle: { color: "#94a3b8", width: 1 } },
        axisLabel: { color: "#6b8576" },
        title: { color: "#6b8576" },
        detail: {
          valueAnimation: true,
          color: "#0f2419",
          fontSize: 26,
          offsetCenter: [0, "62%"],
          formatter: (v: number) => formatValue(v, format),
        },
        data: [{ value, name: spec.title ?? "" }],
      },
    ],
  };
}

/** The funnel reuses the categorical reshape: label + value. */
function buildFunnelOption(spec: Spec, data: Row[]): EChartsOption {
  const items = buildCategorical(spec, data);
  const valueSpec = asArray(spec.encoding.value)[0];

  return {
    title: { text: spec.title, subtext: spec.subtitle },
    tooltip: {
      trigger: "item",
      valueFormatter: (value) =>
        formatValue(value, valueSpec?.format ?? "number"),
    },
    legend: { show: false },
    series: [
      {
        type: "funnel",
        left: "10%",
        right: "10%",
        top: 64,
        bottom: 24,
        minSize: "25%",
        maxSize: "100%",
        sort: "descending",
        gap: 3,
        label: {
          show: true,
          position: "inside",
          color: "#ffffff",
          fontWeight: 600,
        },
        data: items,
      },
    ],
  };
}

/** The radar compares profiles: every axis is normalized on its maximum. */
function buildRadarOption(spec: Spec, data: Row[]): EChartsOption {
  const { indicators, series } = buildRadar(spec, data);

  return {
    title: { text: spec.title, subtext: spec.subtitle },
    tooltip: {},
    legend: { show: true, top: 24 },
    radar: {
      indicator: indicators,
      radius: "65%",
      center: ["50%", "58%"],
      axisName: { color: "#6b8576" },
      splitLine: { lineStyle: { color: ["rgba(15,36,25,0.1)"] } },
      splitArea: { areaStyle: { color: ["rgba(15,36,25,0.03)"] } },
    },
    series: [
      {
        type: "radar",
        data: series.map((s) => ({ name: s.name, value: s.values })),
        areaStyle: {},
      },
    ],
  };
}

/** The bubble carries three measures: x, y and the size. */
function buildBubbleOption(spec: Spec, data: Row[]): EChartsOption {
  const { points, maxSize } = buildBubble(spec, data);
  const xSpec = asArray(spec.encoding.x)[0];
  const ySpec = asArray(spec.encoding.y)[0];

  const scale = (size: number) =>
    maxSize > 0 ? 12 + (size / maxSize) * 46 : 12;

  return {
    title: { text: spec.title, subtext: spec.subtitle },
    tooltip: { trigger: "item" },
    legend: { show: false },
    grid: gridLayout(spec, {
      xName: Boolean(axisTitle(xSpec)),
      topName: !spec.title,
    }),
    xAxis: { type: "value", ...horizontalName(xSpec) },
    yAxis: {
      type: "value",
      ...(!spec.title ? topAxisName(ySpec) : {}),
    },
    series: [
      {
        type: "scatter",
        data: points.map((p) => ({
          name: p.name,
          value: p.value,
          symbolSize: scale(p.value[2]),
        })),
      },
    ],
  };
}
