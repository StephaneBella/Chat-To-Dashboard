import type { AgentChartPayload } from "../../api/agentChart";
import { catalogVariant } from "../contract/catalog";
import type {
  ContractEnvelope,
  FieldSpec,
  Options,
  Row,
  Spec,
} from "../contract";
import { SpecSchema } from "../contract";
import { crossValidate } from "../validate";
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

function measureToFieldSpec(
  measure: AgentChartPayload["y"][number],
  fallbackFormat: FieldSpec["format"],
): FieldSpec {
  const spec: FieldSpec = {
    field: measure.column,
    type: "number",
  };
  if (measure.label !== undefined) spec.title = measure.label;
  spec.format = measure.format ?? fallbackFormat;
  if (measure.render !== undefined) spec.render = measure.render;
  if (measure.axis !== undefined) spec.axis = measure.axis;
  // The backend already grouped the rows: "sum" is the safe default, the
  // engine must never silently keep only the last row of a group.
  spec.aggregate = measure.aggregate ?? "sum";
  return spec;
}

/**
 * The catalogue drives the mapping: it says which payload role feeds which
 * engine channel. The payload never carries the engine's own vocabulary.
 */
function payloadToOptions(
  payload: AgentChartPayload,
  hints: Record<string, unknown>,
): Options {
  const merged: Options = { ...(hints as Options) };
  const options = payload.options;
  if (!options) return merged;

  if (options.stacked !== undefined) merged.stacked = options.stacked;
  if (options.smooth !== undefined) merged.smooth = options.smooth;
  if (options.horizontal !== undefined) merged.horizontal = options.horizontal;
  if (options.legend !== undefined) merged.legend = options.legend;
  if (options.missing !== undefined) merged.missing = options.missing;
  if (options.sort !== undefined) merged.sort = options.sort;
  if (options.bar_gap !== undefined) merged.barGap = options.bar_gap;
  if (options.target !== undefined) merged.target = options.target;
  if (options.waterfall_mode !== undefined) {
    merged.waterfallMode = options.waterfall_mode;
  }

  return merged;
}

/**
 * Maps the enriched payload of the agent onto the engine's `{ spec, data }`
 * contract, so ChartRenderer can take over exactly like for the static
 * dashboard.
 */
export function agentChartToEnvelope(
  payload: AgentChartPayload,
  rows: Row[],
): ContractEnvelope {
  const variant = catalogVariant(payload.chart_type);
  if (!variant) {
    return errorEnvelope(
      "UNKNOWN_CHART_TYPE",
      `Type de graphique inconnu « ${payload.chart_type} ».`,
    );
  }

  const channels = variant.engineChannels;
  const fallbackFormat = formatFromUnit(payload.unit);
  const encoding: Spec["encoding"] = {};

  if (payload.x) {
    const xType = variant.roles.x === "number" ? "number" : "category";
    const xSpec: FieldSpec = { field: payload.x.column, type: xType };
    if (payload.x.label !== undefined) xSpec.title = payload.x.label;

    if (channels.x === "x") encoding.x = xSpec;
    else if (channels.x === "label") encoding.label = xSpec;
  }

  if (channels.y === "y") {
    encoding.y = payload.y.map((measure) =>
      measureToFieldSpec(measure, fallbackFormat),
    );
  } else if (channels.y === "value" && payload.y[0]) {
    encoding.value = measureToFieldSpec(payload.y[0], fallbackFormat);
  }

  if (channels.series === "series" && payload.series) {
    const seriesSpec: FieldSpec = {
      field: payload.series.column,
      type: "category",
    };
    if (payload.series.label !== undefined) seriesSpec.title = payload.series.label;
    encoding.series = seriesSpec;
  }

  if (channels.size === "size" && payload.size) {
    const sizeSpec: FieldSpec = {
      field: payload.size.column,
      type: "number",
    };
    if (payload.size.label !== undefined) sizeSpec.title = payload.size.label;
    encoding.size = sizeSpec;
  }

  const spec: Spec = {
    id: `agent-${payload.chart_type}`,
    chartType: variant.engineChartType as Spec["chartType"],
    encoding,
    options: payloadToOptions(payload, variant.engineHints),
  };
  if (payload.title !== undefined) spec.title = payload.title;
  if (payload.subtitle !== undefined) spec.subtitle = payload.subtitle;

  const parsed = SpecSchema.safeParse(spec);
  if (!parsed.success) {
    return errorEnvelope(
      "INVALID_AGENT_CHART",
      `Le graphique « ${payload.chart_type} » est incomplet : ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" ; ")}`,
    );
  }

  const cross = crossValidate(parsed.data, rows);
  if (!cross.ok) {
    return errorEnvelope(cross.code, cross.message);
  }

  return successEnvelope(parsed.data, rows);
}
