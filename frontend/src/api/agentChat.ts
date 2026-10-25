import { z } from "zod";
import { requestJson } from "./http";
import type { Row } from "../chart-engine";

const ColumnRefSchema = z.object({
  column: z.string().min(1),
  label: z.string().optional(),
});

const MeasureRefSchema = z.object({
  column: z.string().min(1),
  label: z.string().optional(),
  render: z.enum(["bar", "line", "area", "scatter"]).optional(),
  format: z.enum(["number", "currency", "percent", "compact"]).optional(),
  axis: z.enum(["left", "right"]).optional(),
  aggregate: z.enum(["sum", "avg", "min", "max", "count"]).optional(),
});

export const AgentChartOptionsSchema = z.object({
  stacked: z.boolean().optional(),
  smooth: z.boolean().optional(),
  horizontal: z.boolean().optional(),
  legend: z.boolean().optional(),
  missing: z.enum(["null", "zero"]).optional(),
  sort: z.enum(["none", "asc", "desc"]).optional(),
  bar_gap: z.number().min(0).max(1).optional(),
  target: z.number().optional(),
  waterfall_mode: z.enum(["contributions", "bridge"]).optional(),
});

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
  thread_id: z.string().optional(),
});

export type AgentChatResponse = z.infer<typeof AgentChatResponseSchema>;

export interface AgentChatParams {
  message: string;
  thread_id?: string;
  signal?: AbortSignal;
}

export interface ThreadSummary {
  id: string;
  title: string;
  updated_at: string;
}

export interface ThreadMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ThreadDetail {
  id: string;
  title: string;
  messages: ThreadMessage[];
}

export interface AgentResultRows {
  result_id: string;
  rows: Row[];
  columns: string[];
}

export async function postAgentChat(
  params: AgentChatParams,
): Promise<AgentChatResponse> {
  const body = {
    message: params.message,
    thread_id: params.thread_id,
  };
  const response = await requestJson<unknown>("/chat/", {
    method: "POST",
    body: JSON.stringify(body),
    signal: params.signal,
  });
  const parsed = AgentChatResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error("Réponse inattendue du serveur.");
  }
  return parsed.data;
}

export async function fetchAgentResultRows(
  threadId: string,
  resultId: string,
  signal?: AbortSignal,
): Promise<AgentResultRows> {
  const response = await requestJson<any>(
    `/chat/threads/${encodeURIComponent(threadId)}/results/${encodeURIComponent(resultId)}/`,
    { method: "GET", signal },
  );
  const columns = Array.isArray(response.columns) ? response.columns : [];
  const rawRows = Array.isArray(response.rows) ? response.rows : [];
  const rows: Row[] = rawRows.map((row: any) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return row as Row;
    }
    if (Array.isArray(row)) {
      const obj: Row = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    }
    return {} as Row;
  });
  return {
    result_id: resultId,
    rows,
    columns,
  };
}

export async function listThreads(): Promise<ThreadSummary[]> {
  const response = await requestJson<unknown>("/chat/threads/", {
    method: "GET",
  });
  if (!Array.isArray(response)) return [];
  return response
    .filter((t: any) => t && typeof t === "object")
    .map((t: any) => ({
      id: String(t.id),
      title: String(t.title ?? ""),
      updated_at: String(t.updated_at ?? ""),
    }));
}

export async function getThread(threadId: string): Promise<ThreadDetail> {
  const response = await requestJson<any>(
    `/chat/threads/${encodeURIComponent(threadId)}/`,
    { method: "GET" },
  );
  const messages = Array.isArray(response.messages)
    ? response.messages
        .filter((m: any) => m && typeof m === "object")
        .map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content ?? ""),
        }))
    : [];
  return {
    id: String(response.id ?? threadId),
    title: String(response.title ?? ""),
    messages,
  };
}

export async function deleteThread(threadId: string): Promise<void> {
  await requestJson<void>(
    `/chat/threads/${encodeURIComponent(threadId)}/`,
    { method: "DELETE" },
  );
}
