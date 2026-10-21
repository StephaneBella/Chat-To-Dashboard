import type { Row, Spec } from "../../contract";
import { asArray, formatValue } from "../../adapter";

export interface DataTableProps {
  spec: Spec;
  data: Row[];
}

/** Collect the column keys the spec cares about, in a sensible order. */
function columnsFor(spec: Spec, data: Row[]): string[] {
  const encoded = [
    ...asArray(spec.encoding.x),
    ...asArray(spec.encoding.y),
    ...asArray(spec.encoding.series),
    ...asArray(spec.encoding.value),
    ...asArray(spec.encoding.label),
  ].map((f) => f.field);

  if (encoded.length > 0) return [...new Set(encoded)];
  return data.length > 0 ? Object.keys(data[0]) : [];
}

export function DataTable({ spec, data }: DataTableProps) {
  const columns = columnsFor(spec, data);

  return (
    <div className="h-full min-h-64 overflow-auto rounded-lg border border-slate-200">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-slate-100 text-slate-600">
          <tr>
            {columns.map((col) => (
              <th key={col} className="px-4 py-2 font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-t border-slate-100">
              {columns.map((col) => (
                <td key={col} className="px-4 py-2">
                  {typeof row[col] === "number"
                    ? formatValue(row[col], spec.options?.format ?? "number")
                    : String(row[col] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
