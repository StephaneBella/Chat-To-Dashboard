import type { FieldFormat, FieldSpec, FieldType, Row, Spec } from "../contract";

/** Normalize "one thing or many" into an array. */
export function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Safely turn any cell into a number (or null for gaps). */
export function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface ReshapedSeries {
  name: string;
  values: (number | null)[];
  field: string;
  type?: FieldType;
  format?: FieldFormat;
}

export interface ReshapedData {
  categories: string[];
  series: ReshapedSeries[];
}

const SEP = " \u2014 "; // an em dash with spaces

/** Combine a duplicate value according to an optional aggregate. */
function combine(
  current: number | null,
  next: number | null,
  aggregate: FieldSpec["aggregate"],
): number | null {
  if (next == null) return current;
  if (current == null) return next;
  switch (aggregate) {
    case "sum":
      return current + next;
    case "avg":
      return (current + next) / 2;
    case "min":
      return Math.min(current, next);
    case "max":
      return Math.max(current, next);
    case "count":
      return current + 1;
    default:
      return next; // backend already aggregated -> last wins
  }
}

/**
 * Cartesian reshape for the line / area / bar family.
 * Groups rows by x-category and splits into one series per
 * (measure x series-combination).
 */
export function buildCartesian(spec: Spec, data: Row[]): ReshapedData {
  const options = spec.options ?? {};
  const separator = options.seriesSeparator ?? SEP;

  const xSpec = asArray(spec.encoding.x)[0];
  const ySpecs = asArray(spec.encoding.y);
  const seriesSpecs = asArray(spec.encoding.series);

  /* Station 1: categories in first-seen order. */
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const row of data) {
    const key = xSpec ? String(row[xSpec.field] ?? "") : "";
    if (!seen.has(key)) {
      seen.add(key);
      categories.push(key);
    }
  }
  if (options.sort === "asc") categories.sort();
  else if (options.sort === "desc") categories.sort().reverse();

  const catIndex = new Map(categories.map((c, i) => [c, i]));

  /* Stations 2-3: build and fill series lazily. */
  const lookup = new Map<string, ReshapedSeries>();
  const ordered: ReshapedSeries[] = [];

  const getSeries = (key: string, name: string, field: string, ys: FieldSpec) => {
    let s = lookup.get(key);
    if (!s) {
      s = {
        name,
        field,
        type: ys.type,
        format: ys.format,
        values: new Array(categories.length).fill(null),
      };
      lookup.set(key, s);
      ordered.push(s);
    }
    return s;
  };

  for (const row of data) {
    const xIndex = xSpec ? catIndex.get(String(row[xSpec.field] ?? "")) : 0;
    if (xIndex == null) continue;

    const comboParts = seriesSpecs.map((s) => String(row[s.field] ?? ""));

    for (const ys of ySpecs) {
      const value = toNumber(row[ys.field]);

      let name: string;
      let key: string;

      if (seriesSpecs.length === 0) {
        name = ys.title ?? ys.field;
        key = `${ys.field}`;
      } else {
        const combo = comboParts.join(separator);
        name =
          ySpecs.length > 1 ? `${ys.title ?? ys.field}${separator}${combo}` : combo;
        key = `${ys.field}::${comboParts.join("|")}`;
      }

      const series = getSeries(key, name, ys.field, ys);
      series.values[xIndex] = combine(series.values[xIndex], value, ys.aggregate);
    }
  }

  return { categories, series: ordered };
}

/** Categorical reshape for pie / donut: label -> value. */
export interface CategoricalDatum {
  name: string;
  value: number;
}

export function buildCategorical(spec: Spec, data: Row[]): CategoricalDatum[] {
  const labelSpec = asArray(spec.encoding.label)[0];
  const valueSpec = asArray(spec.encoding.value)[0];
  if (!labelSpec || !valueSpec) return [];

  return data.map((row) => ({
    name: String(row[labelSpec.field] ?? ""),
    value: toNumber(row[valueSpec.field]) ?? 0,
  }));
}
