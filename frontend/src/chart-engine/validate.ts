import {EnvelopeSchema, type ContractEnvelope, type Row, type Spec} from "./contract"
import {type ZodError} from "zod"

// principle of discriminated union(more than one types)
export type ValidationResult =
  | { ok: true; envelope: ContractEnvelope }
  | { ok: false; code: string; message: string; issues: string[] };
export type CrossCheckResult =
  | { ok: true }
  | { ok: false; code: string; message: string; issues: string[] };

// turning the zod error into a more readable format
function formatIssues(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

export function validateEnvelope(input: unknown): ValidationResult {
  const parsed = EnvelopeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_ENVELOPE",
      message: "The response did not match the chart contract.",
      issues: formatIssues(parsed.error),
    };
  }
  return { ok: true, envelope: parsed.data };
}


// provides a list of column names that the spec references
function encodedFields(spec: Spec): string[] {
  const fields = new Set<string>();
  const channels = [
    spec.encoding.x,
    spec.encoding.y,
    spec.encoding.series,
    spec.encoding.value,
    spec.encoding.label,
  ];
  for (const channel of channels) {
    if (channel == null) continue;
    const list = Array.isArray(channel) ? channel : [channel];
    for (const f of list) fields.add(f.field);
  }
  return [...fields];
}

//checks if every column we got exists in the data parsed 
export function crossValidate(spec: Spec, data: Row[]): CrossCheckResult {
  if (data.length === 0) return { ok: true };

  const missing = encodedFields(spec).filter(
    (field) => !(field in data[0]),
  );

  if (missing.length > 0) {
    return {
      ok: false,
      code: "MISSING_FIELDS",
      message: "The spec references columns that are not in the data.",
      issues: missing.map((f) => `field "${f}" not found in data rows`),
    };
  }
  return { ok: true };
}