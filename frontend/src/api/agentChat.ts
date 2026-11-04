import { z } from "zod";
import {
  API_BASE,
  ApiError,
  ensureCsrfToken,
  extractErrorMessage,
  getCsrfToken,
  requestJson,
} from "./http";
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

export interface AgentStreamStatus {
  tool: string;
  label: string;
}

export interface AgentStreamHandlers {
  onStatus?: (status: AgentStreamStatus) => void;
  onToken?: (text: string) => void;
  onDone?: (response: AgentChatResponse) => void;
  onError?: (message: string) => void;
}

interface SseEvent {
  event: string;
  data: string;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function nextEventBoundary(buffer: string): { index: number; length: number } | null {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf === -1 && crlf === -1) return null;
  if (crlf !== -1 && (lf === -1 || crlf < lf)) {
    return { index: crlf, length: 4 };
  }
  return { index: lf, length: 2 };
}

function parseSseEvent(raw: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  if (data.length === 0) return null;
  return { event, data: data.join("\n") };
}

function dispatchSseEvent(
  event: string,
  data: string,
  handlers: AgentStreamHandlers,
): void {
  let payload: unknown;
  try {
    payload = data ? JSON.parse(data) : null;
  } catch {
    return;
  }
  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  switch (event) {
    case "status":
      if (typeof record.label === "string") {
        handlers.onStatus?.({
          tool: typeof record.tool === "string" ? record.tool : "",
          label: record.label,
        });
      }
      break;
    case "token":
      if (typeof record.text === "string" && record.text.length > 0) {
        handlers.onToken?.(record.text);
      }
      break;
    case "done": {
      const parsed = AgentChatResponseSchema.safeParse(payload);
      if (parsed.success) {
        handlers.onDone?.(parsed.data);
      } else {
        handlers.onError?.("Réponse finale inattendue du serveur.");
      }
      break;
    }
    case "error":
      handlers.onError?.(
        typeof record.error === "string"
          ? record.error
          : "Erreur interne du serveur.",
      );
      break;
    default:
      break;
  }
}

function drainSseBuffer(
  buffer: string,
  handlers: AgentStreamHandlers,
): string {
  let rest = buffer;
  for (;;) {
    const boundary = nextEventBoundary(rest);
    if (!boundary) return rest;
    const raw = rest.slice(0, boundary.index);
    rest = rest.slice(boundary.index + boundary.length);
    const parsed = parseSseEvent(raw);
    if (parsed) dispatchSseEvent(parsed.event, parsed.data, handlers);
  }
}

function defaultHttpMessage(status: number): string {
  switch (status) {
    case 401:
    case 403:
      return "Authentification requise. Veuillez vous connecter.";
    case 409:
      return "Une question est déjà en cours dans cette conversation.";
    case 429:
      return "Trop de questions. Réessayez plus tard.";
    case 502:
      return "L'assistant est momentanément indisponible. Réessayez dans un instant.";
    case 503:
      return "Chargement des données en cours, réessayez dans quelques secondes.";
    default:
      return `Erreur serveur (HTTP ${status}).`;
  }
}

/**
 * POST /api/chat/astream/ -> Server-Sent Events.
 *
 * Events: "status" {tool,label}, "token" {text}, "done" {answer,chart,thread_id},
 * "error" {error}. The promise resolves when the stream ends; a server-side
 * error event is reported through `onError`.
 */
export async function streamAgentChat(
  params: AgentChatParams,
  handlers: AgentStreamHandlers = {},
): Promise<void> {
  const headers = new Headers({
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  });
  let csrf = getCsrfToken();
  if (!csrf) csrf = await ensureCsrfToken();
  if (csrf) headers.set("X-CSRFToken", csrf);

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/chat/astream/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: params.message,
        thread_id: params.thread_id,
      }),
      credentials: "include",
      signal: params.signal,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ApiError(
      0,
      "Impossible de joindre le serveur. Vérifiez que Django est démarré, puis réessayez.",
    );
  }

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    let body: unknown;
    try {
      body = contentType.includes("application/json")
        ? await response.json()
        : await response.text();
    } catch {
      body = null;
    }
    const message =
      typeof body === "string" && body.trim().length > 0
        ? body.trim()
        : extractErrorMessage(body) ?? defaultHttpMessage(response.status);
    throw new ApiError(response.status, message);
  }

  if (!response.body) {
    throw new ApiError(0, "Le serveur n'a pas renvoyé de flux de réponse.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = drainSseBuffer(buffer, handlers);
    }
    buffer += decoder.decode();
    if (buffer.trim().length > 0) {
      const parsed = parseSseEvent(buffer);
      if (parsed) dispatchSseEvent(parsed.event, parsed.data, handlers);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }
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
      columns.forEach((col: string, idx: number) => {
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
