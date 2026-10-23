import type { ChartPayload } from "../../api/staticDashboard";
import { catalogVariant } from "../contract/catalog";
import type {
  ContractEnvelope,
  FieldFormat,
  Options,
  Row,
  Spec,
} from "../contract";
import { formatFromUnit } from "./format";

/**
 * The static dashboard endpoint speaks in its own historical vocabulary.
 * This is the only place where those names are translated: the catalogue then
 * decides the engine type and the readability hints, exactly like for the
 * agent payload.
 */
const STATIC_VARIANT_IDS: Record<string, string> = {
  line: "line",
  bar_vertical: "bar",
  bar_horizontal: "hbar",
  count_plot: "count_plot",
};

function errorEnvelope(code: string, message: string): ContractEnvelope {
  return {
    contractVersion: 1,
    status: "error",
    spec: null,
    data: [],
    error: { code, message },
    meta: { rowCount: 0 },
  };
}

function successEnvelope(spec: Spec, data: Row[]): ContractEnvelope {
  return {
    contractVersion: 1,
    status: "success",
    spec,
    data,
    error: null,
    meta: { rowCount: data.length, generatedAt: new Date().toISOString() },
  };
}

function pairs(
  categories: (string | number)[],
  values: (string | number)[],
): Row[] {
  return categories.map((category, i) => ({
    category: String(category),
    value: Number(values[i] ?? 0),
  }));
}

function cartesianEnvelope(
  chart: ChartPayload,
  chartType: Spec["chartType"],
  format: FieldFormat,
  options: Options,
): ContractEnvelope {
  if (!chart.x_axis || !chart.y_axis) {
    return errorEnvelope("MALFORMED_CHART", "Axes manquants dans la réponse.");
  }
  const spec: Spec = {
    id: `static-${chart.chart_type}`,
    chartType,
    encoding: {
      x: {
        field: "category",
        type: "category",
        title: chart.x_axis.label,
      },
      y: {
        field: "value",
        type: "number",
        title: chart.y_axis.label,
        format,
      },
    },
    options,
  };
  return successEnvelope(spec, pairs(chart.x_axis.data, chart.y_axis.data));
}

/**
 * Maps the `chart` object of GET /api/static-dashboard/ onto the engine's
 * `{ spec, data }` contract so ChartRenderer can take over. The catalogue is
 * the source of truth for the engine type and the hints.
 */
export function staticDashboardToEnvelope(
  chart: ChartPayload,
  kpiKey: string,
): ContractEnvelope {
  const variantId = STATIC_VARIANT_IDS[chart.chart_type];
  const variant = variantId ? catalogVariant(variantId) : undefined;

  if (!variant) {
    return errorEnvelope(
      "UNSUPPORTED_CHART_TYPE",
      `Type de graphique inconnu « ${chart.chart_type} » (KPI ${kpiKey}).`,
    );
  }

  const format = formatFromUnit(chart.unit);
  const hints = (variant.engineHints ?? {}) as Options;
  const chartType = variant.engineChartType as Spec["chartType"];

  if (chart.chart_type === "bar_horizontal") {
    // The backend puts the categories on y_axis and the values on x_axis.
    if (!chart.x_axis || !chart.y_axis) {
      return errorEnvelope("MALFORMED_CHART", "Axes manquants dans la réponse.");
    }
    const spec: Spec = {
      id: `static-${chart.chart_type}`,
      chartType,
      encoding: {
        x: {
          field: "category",
          type: "category",
          title: chart.y_axis.label,
        },
        y: {
          field: "value",
          type: "number",
          title: chart.x_axis.label,
          format,
        },
      },
      options: { ...hints, horizontal: true, legend: false },
    };
    return successEnvelope(spec, pairs(chart.y_axis.data, chart.x_axis.data));
  }

  if (chart.chart_type === "line") {
    return cartesianEnvelope(chart, chartType, format, {
      ...hints,
      smooth: true,
      legend: false,
    });
  }

  return cartesianEnvelope(chart, chartType, format, {
    ...hints,
    legend: false,
  });
}
