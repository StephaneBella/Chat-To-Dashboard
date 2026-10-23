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
  /** How this series must be drawn (bar, line, area, scatter). */
  render?: "bar" | "line" | "area" | "scatter";
  /** Which value axis this series belongs to. */
  axis?: "left" | "right";
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
        render: ys.render,
        axis: ys.axis,
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

  // "missing: zero" turns the absent combinations into real zeros.
  // A count plot must show 0, not a hole in the bars.
  if (options.missing === "zero") {
    for (const s of ordered) {
      s.values = s.values.map((v) => (v == null ? 0 : v));
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

/* ---------- matrix (heatmap) ---------- */

export interface ReshapedMatrix {
  xCategories: string[];
  yCategories: string[];
  /** matrix[yIndex][xIndex] */
  matrix: number[][];
  min: number;
  max: number;
}

/**
 * Long rows -> a 2D matrix.
 * encoding.x = the column axis, encoding.series = the row axis,
 * encoding.value = the measured cell.
 */
export function buildMatrix(spec: Spec, data: Row[]): ReshapedMatrix {
  const xSpec = asArray(spec.encoding.x)[0];
  const ySpec = asArray(spec.encoding.series)[0];
  const valueSpec = asArray(spec.encoding.value)[0];
  if (!xSpec || !ySpec || !valueSpec) {
    return { xCategories: [], yCategories: [], matrix: [], min: 0, max: 0 };
  }

  const xCategories: string[] = [];
  const yCategories: string[] = [];
  const xSeen = new Set<string>();
  const ySeen = new Set<string>();

  for (const row of data) {
    const x = String(row[xSpec.field] ?? "");
    const y = String(row[ySpec.field] ?? "");
    if (!xSeen.has(x)) {
      xSeen.add(x);
      xCategories.push(x);
    }
    if (!ySeen.has(y)) {
      ySeen.add(y);
      yCategories.push(y);
    }
  }

  const xIndex = new Map(xCategories.map((c, i) => [c, i]));
  const yIndex = new Map(yCategories.map((c, i) => [c, i]));

  const matrix: number[][] = yCategories.map(() => xCategories.map(() => 0));
  let min = 0;
  let max = 0;

  for (const row of data) {
    const xi = xIndex.get(String(row[xSpec.field] ?? ""));
    const yi = yIndex.get(String(row[ySpec.field] ?? ""));
    if (xi == null || yi == null) continue;
    const value = toNumber(row[valueSpec.field]) ?? 0;
    matrix[yi][xi] = value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return { xCategories, yCategories, matrix, min, max };
}

/* ---------- bubble ---------- */

export interface BubblePoint {
  name: string;
  /** [x, y, size] - the ECharts bubble convention */
  value: [number, number, number];
}

export interface ReshapedBubble {
  points: BubblePoint[];
  maxSize: number;
}

/** encoding.x, encoding.y and encoding.size -> one point per row. */
export function buildBubble(spec: Spec, data: Row[]): ReshapedBubble {
  const xSpec = asArray(spec.encoding.x)[0];
  const ySpec = asArray(spec.encoding.y)[0];
  const sizeSpec = asArray(spec.encoding.size)[0];
  const labelSpec = asArray(spec.encoding.label)[0];
  if (!xSpec || !ySpec || !sizeSpec) return { points: [], maxSize: 0 };

  const points: BubblePoint[] = [];
  let maxSize = 0;

  for (const row of data) {
    const x = toNumber(row[xSpec.field]);
    const y = toNumber(row[ySpec.field]);
    if (x == null || y == null) continue;
    const size = toNumber(row[sizeSpec.field]) ?? 0;
    if (size > maxSize) maxSize = size;
    const name = labelSpec
      ? String(row[labelSpec.field] ?? "")
      : String(row[xSpec.field] ?? "");
    points.push({ name, value: [x, y, size] });
  }

  return { points, maxSize };
}

/* ---------- radar ---------- */

export interface RadarIndicator {
  name: string;
  max: number;
}

export interface RadarSeries {
  name: string;
  values: number[];
}

export interface ReshapedRadar {
  indicators: RadarIndicator[];
  series: RadarSeries[];
}

/**
 * encoding.x = the polygon (one row per polygon),
 * encoding.y = the indicators (one column each).
 * Every indicator is normalized on its own maximum: the radar compares
 * profiles, never levels.
 */
export function buildRadar(spec: Spec, data: Row[]): ReshapedRadar {
  const xSpec = asArray(spec.encoding.x)[0];
  const ySpecs = asArray(spec.encoding.y);
  if (!xSpec || ySpecs.length === 0) return { indicators: [], series: [] };

  const maxima = new Map<string, number>();
  for (const ys of ySpecs) {
    let max = 0;
    for (const row of data) {
      const value = toNumber(row[ys.field]);
      if (value != null && value > max) max = value;
    }
    maxima.set(ys.field, max > 0 ? max : 1);
  }

  const indicators = ySpecs.map((ys) => ({
    name: ys.title ?? ys.field,
    max: 1,
  }));

  const series = data.map((row) => ({
    name: String(row[xSpec.field] ?? ""),
    values: ySpecs.map(
      (ys) => (toNumber(row[ys.field]) ?? 0) / (maxima.get(ys.field) ?? 1),
    ),
  }));

  return { indicators, series };
}
