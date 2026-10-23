import { z } from "zod";

/**
 * Wire contract of the agent chart payload.
 *
 * The names are snake_case on purpose: this object is produced by the Python
 * tools and consumed by the browser, it is not a TypeScript internal type.
 * The mapper (chart-engine/adapter/fromAgentChart.ts) turns it into the
 * engine's camelCase `Spec`.
 */
const ColumnRefSchema = z.object({
  column: z.string().min(1, "column must be a non-empty column name"),
  label: z.string().optional(),
});
export type ColumnRef = z.infer<typeof ColumnRefSchema>;

const MeasureRefSchema = z.object({
  column: z.string().min(1, "column must be a non-empty column name"),
  label: z.string().optional(),
  /** How the measure must be drawn (bar + line on the same chart). */
  render: z.enum(["bar", "line", "area", "scatter"]).optional(),
  format: z.enum(["number", "currency", "percent", "compact"]).optional(),
  /** "right" puts the measure on a second axis. */
  axis: z.enum(["left", "right"]).optional(),
  aggregate: z.enum(["sum", "avg", "min", "max", "count"]).optional(),
});
export type MeasureRef = z.infer<typeof MeasureRefSchema>;

export const AgentChartOptionsSchema = z.object({
  stacked: z.boolean().optional(),
  smooth: z.boolean().optional(),
  horizontal: z.boolean().optional(),
  legend: z.boolean().optional(),
  /** "zero" renders the missing combinations as real zeros. */
  missing: z.enum(["null", "zero"]).optional(),
  sort: z.enum(["none", "asc", "desc"]).optional(),
  /** 0 = the bars touch (histogram). */
  bar_gap: z.number().min(0).max(1).optional(),
  /** The goal a gauge must reach. */
  target: z.number().optional(),
  /** "bridge": the first row is the starting total, the last one the closing total. */
  waterfall_mode: z.enum(["contributions", "bridge"]).optional(),
});
export type AgentChartOptions = z.infer<typeof AgentChartOptionsSchema>;

/**
 * The enriched chart payload: the agent says which chart to draw and which
 * column feeds each role. It never carries the values.
 */
export const AgentChartPayloadSchema = z.object({
  result_id: z.string().min(1),
  chart_type: z.string().min(1),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  unit: z.string().optional(),
  x: ColumnRefSchema.optional(),
  y: z.array(MeasureRefSchema).min(1),
  series: ColumnRefSchema.optional(),
  size: ColumnRefSchema.optional(),
  options: AgentChartOptionsSchema.optional(),
});
export type AgentChartPayload = z.infer<typeof AgentChartPayloadSchema>;

export const AgentChatResponseSchema = z.object({
  answer: z.string(),
  chart: AgentChartPayloadSchema.nullish(),
  /** The conversation thread: it must be sent back to keep the context. */
  thread_id: z.string().optional(),
});
export type AgentChatResponse = z.infer<typeof AgentChatResponseSchema>;

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

export class AgentChartError extends Error {
  status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AgentChartError";
    this.status = status;
  }
}

export interface AgentChatParams {
  message: string;
  thread_id?: string;
  signal?: AbortSignal;
}

export interface AgentResultRows {
  result_id: string;
  rows: Record<string, unknown>[];
  row_count: number;
}

/** POST /api/agent/chat/ -> { answer, chart } */
export async function postAgentChat(
  params: AgentChatParams,
): Promise<AgentChatResponse> {
  const response = await fetch(`${API_BASE}/agent/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      message: params.message,
      thread_id: params.thread_id,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    throw new AgentChartError(
      `Erreur serveur (HTTP ${response.status}).`,
      response.status,
    );
  }

  const parsed = AgentChatResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new AgentChartError(
      "Reponse inattendue du serveur : le schema de la reponse ne correspond pas au contrat.",
      response.status,
    );
  }
  return parsed.data;
}

/** GET /api/agent/results/<result_id>/rows/?thread_id=... */
export async function fetchAgentResultRows(
  resultId: string,
  threadId?: string,
  signal?: AbortSignal,
): Promise<AgentResultRows> {
  const query = threadId ? `?thread_id=${encodeURIComponent(threadId)}` : "";
  const response = await fetch(
    `${API_BASE}/agent/results/${encodeURIComponent(resultId)}/rows/${query}`,
    { headers: { Accept: "application/json" }, signal },
  );

  if (!response.ok) {
    throw new AgentChartError(
      `Impossible de recuperer les lignes du resultat (HTTP ${response.status}).`,
      response.status,
    );
  }

  const body = (await response.json()) as AgentResultRows;
  return {
    result_id: body.result_id ?? resultId,
    rows: Array.isArray(body.rows) ? body.rows : [],
    row_count: body.row_count ?? body.rows?.length ?? 0,
  };
}
