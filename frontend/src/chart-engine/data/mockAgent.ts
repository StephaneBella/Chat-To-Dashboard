import type { Spec } from "../contract";
import { fixtures, type ColumnDef } from "./fixtures";

const SIMULATED_LATENCY_MS = 150;

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Stand-in for "the LLM reads the columns and proposes a chart spec".
 * A real agent would look at `columns` and write a spec; here we look it up.
 */
export async function mockAgentSpec(
  fixtureId: string,
  columns: ColumnDef[],
): Promise<Spec | null> {
  await delay(null, SIMULATED_LATENCY_MS);
  void columns; // a real agent would use these; kept for signature parity
  const fixture = fixtures.find((f) => f.id === fixtureId);
  return fixture ? fixture.spec : null;
}
