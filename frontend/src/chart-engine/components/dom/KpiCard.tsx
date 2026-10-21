import type { Row, Spec } from "../../contract";
import { asArray, formatValue, toNumber } from "../../adapter";

export interface KpiCardProps {
  spec: Spec;
  data: Row[];
}

export function KpiCard({ spec, data }: KpiCardProps) {
  const ySpec = asArray(spec.encoding.y)[0];
  const firstRow = data[0] ?? {};
  const raw = ySpec ? firstRow[ySpec.field] : undefined;
  const value = ySpec ? toNumber(raw) : null;

  const display =
    value == null
      ? "—"
      : formatValue(value, ySpec?.format ?? spec.options?.format ?? "number");

  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-6">
      <span className="text-sm font-medium uppercase tracking-wide text-slate-500">
        {spec.title ?? ySpec?.title ?? ySpec?.field ?? "KPI"}
      </span>
      <span className="text-5xl font-bold text-slate-800">{display}</span>
    </div>
  );
}
