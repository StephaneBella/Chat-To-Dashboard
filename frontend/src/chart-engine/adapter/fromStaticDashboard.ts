import type { ChartPayload } from "../../api/staticDashboard";
import type {
  ContractEnvelope,
  FieldFormat,
  Options,
  Row,
  Spec,
} from "../contract";
import { formatFromUnit } from "./format";

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
 * `{ spec, data }` contract so ChartRenderer can take over.
 */
export function staticDashboardToEnvelope(
  chart: ChartPayload,
  kpiKey: string,
): ContractEnvelope {
  const format = formatFromUnit(chart.unit);

  switch (chart.chart_type) {
    case "line":
      return cartesianEnvelope(chart, "line", format, {
        smooth: true,
        legend: false,
      });

    case "bar_horizontal": {
      // Backend puts the categories on y_axis and the values on x_axis.
      if (!chart.x_axis || !chart.y_axis) {
        return errorEnvelope("MALFORMED_CHART", "Axes manquants dans la réponse.");
      }
      const spec: Spec = {
        id: "static-bar_horizontal",
        chartType: "hbar",
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
        options: { horizontal: true, legend: false },
      };
      return successEnvelope(spec, pairs(chart.y_axis.data, chart.x_axis.data));
    }

    case "count_plot":
    case "bar_vertical":
      return cartesianEnvelope(chart, "bar", format, { legend: false });

    default:
      return errorEnvelope(
        "UNSUPPORTED_CHART_TYPE",
        `Type de graphique inconnu « ${chart.chart_type} » (KPI ${kpiKey}).`,
      );
  }
}
