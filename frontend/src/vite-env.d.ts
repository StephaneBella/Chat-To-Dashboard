/// <reference types="vite/client" />

/**
 * Contract of the environment variables read by the frontend.
 *
 * Declared here so a renamed variable is a type error instead of a silent
 * fallback. The runtime counterpart lives in src/api/staticDashboard.ts
 * (resolveDataSource), which throws on an unknown VITE_DATA_SOURCE value.
 */
interface ImportMetaEnv {
  /** Base URL of the REST API. "/api" goes through the Vite dev proxy. */
  readonly VITE_API_BASE_URL?: string;
  /** "api" | "auto" | "mock" - where the dashboard data comes from. */
  readonly VITE_DATA_SOURCE?: "api" | "auto" | "mock";
}
