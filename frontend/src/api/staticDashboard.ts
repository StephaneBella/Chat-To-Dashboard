import { z } from "zod";
import { buildMockResponse } from "./mockStaticDashboard";

/**
 * Relative by default: the Vite dev proxy (vite.config.ts) forwards "/api"
 * to the Django backend, so the request stays same-origin and CORS never
 * applies. An absolute URL (http://localhost:8000/api) is still supported
 * and calls the backend directly.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

/**
 * "api" (default): always call the API, surface backend errors.
 * "auto": call the API, fall back to mock data when it fails.
 * "mock": always use demo data.
 */
export const DATA_SOURCES = ["api", "auto", "mock"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

function resolveDataSource(raw: string | undefined): DataSource {
  if (raw === undefined || raw.trim() === "") return "api";
  if ((DATA_SOURCES as readonly string[]).includes(raw)) return raw as DataSource;
  throw new Error(
    `VITE_DATA_SOURCE invalide : ${JSON.stringify(raw)}. ` +
      `Valeurs acceptees : ${DATA_SOURCES.join(", ")}.`,
  );
}

const DATA_SOURCE = resolveDataSource(
  import.meta.env.VITE_DATA_SOURCE as string | undefined,
);

export const KpiOptionSchema = z.object({
  key: z.string(),
  label: z.string(),
  unit: z.string().default(""),
});
export type KpiOption = z.infer<typeof KpiOptionSchema>;

export const DimensionOptionSchema = z.object({
  key: z.string(),
  label: z.string(),
  chart_type: z.string(),
});
export type DimensionOption = z.infer<typeof DimensionOptionSchema>;

export const KpiCardSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  unit: z.string().default(""),
});
export type KpiCard = z.infer<typeof KpiCardSchema>;

const AxisSchema = z.object({
  label: z.string(),
  data: z.array(z.union([z.string(), z.number()])),
});

export const ChartPayloadSchema = z.object({
  chart_type: z.string(),
  kpi: z.string().optional(),
  kpi_label: z.string().optional(),
  unit: z.string().optional(),
  dimension: z.string().optional(),
  dimension_label: z.string().optional(),
  x_axis: AxisSchema.optional(),
  y_axis: AxisSchema.optional(),
  labels: z.array(z.string()).optional(),
  values: z.array(z.number()).optional(),
  percentages: z.array(z.number()).optional(),
  measure: z.array(z.string()).optional(),
});
export type ChartPayload = z.infer<typeof ChartPayloadSchema>;

export const StaticDashboardResponseSchema = z.object({
  options: z.object({
    kpis: z.array(KpiOptionSchema),
    dimensions: z.array(DimensionOptionSchema),
  }),
  kpi_cards: z.array(KpiCardSchema),
  metrics_cards: z.array(KpiCardSchema).default([]),
  charts: z.record(z.string(), ChartPayloadSchema),
});
export type StaticDashboardResponse = z.infer<typeof StaticDashboardResponseSchema>;

export interface StaticDashboardResult extends StaticDashboardResponse {
  /** True when the payload came from the demo generator instead of the API. */
  mocked: boolean;
  /** Why we fell back to demo data (only set on automatic fallback). */
  mockReason?: string;
}

export class StaticDashboardError extends Error {
  status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "StaticDashboardError";
    this.status = status;
  }
}

async function readJsonBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = await readJsonBody(response);

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const details: string[] = [];
    for (const [field, value] of Object.entries(record)) {
      if (Array.isArray(value)) {
        details.push(`${field} : ${value.map(String).join(", ")}`);
      } else if (typeof value === "string") {
        details.push(`${field} : ${value}`);
      }
    }
    if (details.length > 0) {
      return `Paramètres refusés par le serveur (${response.status}) — ${details.join(" ; ")}`;
    }
    if (typeof record.detail === "string") return record.detail;
  }

  switch (response.status) {
    case 404:
      return "Endpoint introuvable. Le backend est-il démarré sur http://localhost:8000 ?";
    default:
      return `Erreur serveur (HTTP ${response.status}). Le backend est-il démarré et à jour ?`;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchFromApi(
  params: { kpi?: string; signal?: AbortSignal } = {},
): Promise<StaticDashboardResponse> {
  const query = new URLSearchParams();
  if (params.kpi) query.set("kpi", params.kpi);

  const url = `${API_BASE}/static-dashboard/${query.size > 0 ? `?${query.toString()}` : ""}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: params.signal,
    });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new StaticDashboardError(
      `Impossible de joindre le backend (${API_BASE}). Verifiez que Django ecoute sur http://localhost:8000.`,
    );
  }

  if (!response.ok) {
    throw new StaticDashboardError(await readErrorMessage(response), response.status);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new StaticDashboardError(
      "Le serveur n'a pas renvoyé du JSON (probable page d'erreur Django).",
      response.status,
    );
  }

  const parsed = StaticDashboardResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new StaticDashboardError(
      "Réponse inattendue du serveur : le schéma de la réponse ne correspond pas au contrat.",
      response.status,
    );
  }
  return parsed.data;
}

export async function fetchStaticDashboard(
  params: { kpi?: string; signal?: AbortSignal } = {},
): Promise<StaticDashboardResult> {
  const kpi = params.kpi ?? "profit_margin";

  if (DATA_SOURCE === "mock") {
    console.warn(
      "[chatbi] VITE_DATA_SOURCE=mock : le tableau de bord affiche des donnees de demonstration, le backend n'est pas appele.",
    );
    return {
      ...(await buildMockResponse(kpi, params.signal)),
      mocked: true,
    };
  }

  try {
    return { ...(await fetchFromApi(params)), mocked: false };
  } catch (error) {
    if (isAbort(error) || DATA_SOURCE === "api") throw error;
    console.warn(
      `[chatbi] Appel a ${API_BASE} en echec, repli sur les donnees de demonstration : ${errorMessage(error)}`,
    );
    return {
      ...(await buildMockResponse(kpi, params.signal)),
      mocked: true,
      mockReason: errorMessage(error),
    };
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof StaticDashboardError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Erreur inconnue.";
}
