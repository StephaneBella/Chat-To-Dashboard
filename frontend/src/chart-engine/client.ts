import type { ContractEnvelope, ContractError } from "./contract";
import { matchFixture } from "./data/fixtures";
import { mockBackendQuery } from "./data/mockBackend";
import { mockAgentSpec } from "./data/mockAgent";

/** Flip to false when the real services are ready. */
export const USE_MOCK = true;

export interface VisualizationRequest {
  question: string;
}

function errorEnvelope(code: string, message: string): ContractEnvelope {
  return {
    contractVersion: 1,
    status: "error",
    spec: null,
    data: [],
    error: { code, message } satisfies ContractError,
    meta: { rowCount: 0 },
  };
}

/**
 * The one entry point the UI uses.
 * Today: mock backend + mock agent.
 * Tomorrow: real HTTP calls, same return type.
 */
export async function fetchVisualization(
  request: VisualizationRequest,
): Promise<ContractEnvelope> {
  if (!USE_MOCK) {
    return realFetchVisualization(request);
  }

  const fixture = matchFixture(request.question);
  if (!fixture) {
    return errorEnvelope(
      "NO_MATCH",
      `No example matches "${request.question}". Try one of the suggested questions.`,
    );
  }

  if (fixture.forceStatus === "error") {
    return errorEnvelope("BACKEND_ERROR", "The query failed on the server.");
  }

  // Producer 1: the backend returns columns + rows.
  const { columns, rows } = await mockBackendQuery(fixture.id);

  // Producer 2: the agent returns the spec.
  const spec = await mockAgentSpec(fixture.id, columns);

  if (fixture.forceStatus === "empty" || rows.length === 0) {
    return {
      contractVersion: 1,
      status: "empty",
      spec,
      data: rows,
      error: null,
      meta: { rowCount: 0 },
    };
  }

  if (!spec) {
    return errorEnvelope("NO_SPEC", "No chart spec could be produced.");
  }

  // Producer 3: the orchestrator glues them into one envelope.
  return {
    contractVersion: 1,
    status: "success",
    spec,
    data: rows,
    error: null,
    meta: {
      rowCount: rows.length,
      truncated: false,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * The real implementation, ready to fill in later.
 * It must return a ContractEnvelope — ideally validated before returning.
 */
async function realFetchVisualization(
  request: VisualizationRequest,
): Promise<ContractEnvelope> {
  // Example shape of the future call:
  //
  //   const res = await fetch("/api/visualize", {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify(request),
  //   });
  //   if (!res.ok) return errorEnvelope("HTTP_ERROR", `HTTP ${res.status}`);
  //   return (await res.json()) as ContractEnvelope;
  //
  void request;
  return errorEnvelope(
    "NOT_IMPLEMENTED",
    "The real backend is not connected yet.",
  );
}
