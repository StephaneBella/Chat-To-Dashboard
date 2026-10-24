import type { Row } from "../contract";
import { fixtures, type ColumnDef } from "./fixtures";

export interface QueryResult {
  columns: ColumnDef[];
  rows: Row[];
}

const SIMULATED_LATENCY_MS = 450;

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Stand-in for "run a query and return columns + rows". */
export async function mockBackendQuery(fixtureId: string): Promise<QueryResult> {
  const fixture = fixtures.find((f) => f.id === fixtureId);

  // Pretend the server was slow, so the loading state is visible.
  await delay(null, SIMULATED_LATENCY_MS);

  if (!fixture) {
    return { columns: [], rows: [] };
  }
  return { columns: fixture.columns, rows: fixture.rows };
}
