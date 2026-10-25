import { z } from "zod";

const API_BASE_RAW =
  (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/+$/, "");

export const API_BASE = API_BASE_RAW;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop()!.split(";").shift() || "");
  }
  return null;
}

export function getCsrfToken(): string | null {
  return getCookie("csrftoken");
}

async function ensureCsrfToken(): Promise<string | null> {
  let token = getCsrfToken();
  if (token) return token;
  try {
    await fetch(`${API_BASE.replace(/\/api$/, "") || ""}/api-auth/login/`, {
      method: "GET",
      credentials: "include",
    });
    token = getCsrfToken();
    return token;
  } catch {
    return null;
  }
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (typeof record.error === "string") return record.error;
  if (typeof record.detail === "string") return record.detail;
  if (typeof record.message === "string") return record.message;
  const fieldErrors: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      fieldErrors.push(`${key}: ${value.map(String).join(", ")}`);
    } else if (typeof value === "string" && key !== "status") {
      fieldErrors.push(`${key}: ${value}`);
    }
  }
  if (fieldErrors.length > 0) return fieldErrors.join(" | ");
  return null;
}

export interface RequestJsonOptions extends RequestInit {
  skipCsrf?: boolean;
}

export async function requestJson<T>(
  path: string,
  options: RequestJsonOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";
  const needsCsrf =
    !options.skipCsrf &&
    method !== "GET" &&
    method !== "HEAD" &&
    method !== "OPTIONS";

  let headers = new Headers(options.headers ?? {});
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  if (needsCsrf) {
    let token = getCsrfToken();
    if (!token) {
      token = await ensureCsrfToken();
    }
    if (token) {
      headers.set("X-CSRFToken", token);
    }
    if (
      !headers.has("Content-Type") &&
      !(options.body instanceof FormData) &&
      typeof options.body === "string"
    ) {
      headers.set("Content-Type", "application/json");
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      0,
      "Impossible de joindre le serveur. Vérifiez que Django est démarré, puis réessayez.",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  let body: unknown = null;
  if (contentType.includes("application/json")) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  } else {
    try {
      const text = await response.text();
      body = text ? text : null;
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const extracted = extractErrorMessage(body);
    if (response.status === 401 || response.status === 403) {
      throw new ApiError(
        response.status,
        extracted ?? "Authentification requise. Veuillez vous connecter.",
      );
    }
    if (response.status === 409) {
      throw new ApiError(
        response.status,
        extracted ?? "Une question est déjà en cours dans cette conversation.",
      );
    }
    if (response.status === 429) {
      throw new ApiError(
        response.status,
        extracted ?? "Trop de questions. Réessayez plus tard.",
      );
    }
    if (response.status === 502) {
      throw new ApiError(
        response.status,
        extracted ?? "L'assistant est momentanément indisponible. Réessayez dans un instant.",
      );
    }
    if (response.status === 503) {
      throw new ApiError(
        response.status,
        extracted ??
          "Chargement des données en cours, réessayez dans quelques secondes.",
      );
    }
    throw new ApiError(
      response.status,
      extracted ?? `Erreur serveur (HTTP ${response.status}).`,
    );
  }

  return body as T;
}

export async function requestForm<T>(
  url: string,
  form: FormData,
  options: RequestInit = {},
): Promise<T> {
  let headers = new Headers(options.headers ?? {});
  let token = getCsrfToken();
  if (!token) {
    token = await ensureCsrfToken();
  }
  if (token) {
    headers.set("X-CSRFToken", token);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      method: options.method ?? "POST",
      headers,
      body: form,
      credentials: "include",
    });
  } catch {
    throw new ApiError(
      0,
      "Impossible de joindre le serveur. Vérifiez que Django est démarré, puis réessayez.",
    );
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      try {
        body = await response.text();
      } catch {
        body = null;
      }
    }
    const extracted = extractErrorMessage(body);
    throw new ApiError(
      response.status,
      extracted ?? `Erreur serveur (HTTP ${response.status}).`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return {} as T;
}
