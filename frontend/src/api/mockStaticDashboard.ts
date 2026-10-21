import type {
  ChartPayload,
  DimensionOption,
  KpiCard,
  KpiOption,
  StaticDashboardResponse,
} from "./staticDashboard";

interface KpiMeta {
  label: string;
  unit: string;
  base: number;
  spread: number;
}

const KPI_META: Record<string, KpiMeta> = {
  profit_margin: {
    label: "Taux de marge bénéficiaire",
    unit: "%",
    base: 12.4,
    spread: 6,
  },
  weighted_discount: {
    label: "Taux de remise moyen pondéré",
    unit: "%",
    base: 15.6,
    spread: 8,
  },
  loss_order_rate: {
    label: "Taux de commandes à profit négatif",
    unit: "%",
    base: 18.2,
    spread: 7,
  },
};

const KPI_ORDER = ["profit_margin", "weighted_discount", "loss_order_rate"];

const METRICS: Record<string, { label: string; unit: string; base: number; spread: number }> =
  {
    Total_sales: {
      label: "Chiffre d'affaires total",
      unit: "$",
      base: 2297200,
      spread: 120000,
    },
    total_discount: {
      label: "Montant total des remises",
      unit: "$",
      base: 156130,
      spread: 9000,
    },
  };

const DIMENSIONS: DimensionOption[] = [
  { key: "client", label: "Segment client", chart_type: "bar_vertical" },
  { key: "shipping_mode", label: "Mode de livraison", chart_type: "bar_horizontal" },
  { key: "location", label: "Région", chart_type: "bar_horizontal" },
  { key: "product", label: "Sous-catégorie de produit", chart_type: "count_plot" },
  { key: "time", label: "Mois", chart_type: "line" },
];

const DIMENSION_KEYS = DIMENSIONS.map((dimension) => dimension.key);

const SHIPPING_MODES = [
  "First Class",
  "Second Class",
  "Standard Class",
  "Same Day",
];
const REGIONS = ["West", "East", "Central", "South"];
const SUB_CATEGORIES = [
  "Phones",
  "Chairs",
  "Binders",
  "Storage",
  "Paper",
  "Accessories",
  "Furniture",
  "Appliances",
];
const SEGMENTS = ["Consumer", "Corporate", "Home office"];
const MONTHS = [
  "2017-01",
  "2017-02",
  "2017-03",
  "2017-04",
  "2017-05",
  "2017-06",
  "2017-07",
  "2017-08",
  "2017-09",
  "2017-10",
  "2017-11",
  "2017-12",
];

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kpiMeta(kpi: string): KpiMeta {
  return KPI_META[kpi] ?? KPI_META.profit_margin;
}

function dimensionMeta(key: string): DimensionOption {
  return DIMENSIONS.find((dimension) => dimension.key === key) ?? DIMENSIONS[4];
}

function buildOptions(): { kpis: KpiOption[]; dimensions: DimensionOption[] } {
  return {
    kpis: KPI_ORDER.map((key) => {
      const meta = kpiMeta(key);
      return { key, label: meta.label, unit: meta.unit };
    }),
    dimensions: DIMENSIONS,
  };
}

function buildCards(
  config: Record<string, { label: string; unit: string; base: number; spread: number }>,
): KpiCard[] {
  return Object.entries(config).map(([key, meta]) => {
    const rng = mulberry32(hashSeed(`card:${key}`));
    return {
      key,
      label: meta.label,
      value: r2(meta.base + (rng() - 0.5) * meta.spread),
      unit: meta.unit,
    };
  });
}

function scatterValues(kpi: string, dimension: string, count: number): number[] {
  const meta = kpiMeta(kpi);
  const rng = mulberry32(hashSeed(`${kpi}:${dimension}`));
  return Array.from({ length: count }, () =>
    r2(Math.max(0, meta.base * (0.7 + rng() * 0.6))),
  );
}

function sortedByValueDesc(
  labels: string[],
  values: number[],
): { labels: string[]; values: number[] } {
  const rows = labels.map((label, i) => ({ label, value: values[i] ?? 0 }));
  rows.sort((a, b) => b.value - a.value);
  return {
    labels: rows.map((row) => row.label),
    values: rows.map((row) => row.value),
  };
}

function buildChart(kpi: string, dimension: string): ChartPayload {
  const meta = kpiMeta(kpi);
  const dim = dimensionMeta(dimension);

  const base = {
    chart_type: dim.chart_type,
    kpi,
    kpi_label: meta.label,
    unit: meta.unit,
    dimension,
    dimension_label: dim.label,
  };

  switch (dimension) {
    case "client": {
      const rows = sortedByValueDesc(
        SEGMENTS,
        scatterValues(kpi, dimension, SEGMENTS.length),
      );
      return {
        ...base,
        x_axis: { label: dim.label, data: rows.labels },
        y_axis: { label: meta.label, data: rows.values },
      };
    }

    case "shipping_mode": {
      const rows = sortedByValueDesc(
        SHIPPING_MODES,
        scatterValues(kpi, dimension, SHIPPING_MODES.length),
      );
      return {
        ...base,
        x_axis: { label: meta.label, data: rows.values },
        y_axis: { label: dim.label, data: rows.labels },
      };
    }

    case "location": {
      const rows = sortedByValueDesc(
        REGIONS,
        scatterValues(kpi, dimension, REGIONS.length),
      );
      return {
        ...base,
        x_axis: { label: meta.label, data: rows.values },
        y_axis: { label: dim.label, data: rows.labels },
      };
    }

    case "product": {
      const rows = sortedByValueDesc(
        SUB_CATEGORIES,
        scatterValues(kpi, dimension, SUB_CATEGORIES.length),
      );
      return {
        ...base,
        x_axis: { label: dim.label, data: rows.labels },
        y_axis: { label: meta.label, data: rows.values },
      };
    }

    case "time":
    default: {
      const rng = mulberry32(hashSeed(`${kpi}:time`));
      const values = MONTHS.map(() =>
        r2(Math.max(0, meta.base * (0.8 + rng() * 0.45))),
      );
      return {
        ...base,
        x_axis: { label: "Mois", data: MONTHS },
        y_axis: { label: meta.label, data: values },
      };
    }
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** Builds a response shaped exactly like GET /api/static-dashboard/?kpi=... */
export async function buildMockResponse(
  kpi: string,
  signal?: AbortSignal,
): Promise<StaticDashboardResponse> {
  const rng = mulberry32(hashSeed(`${kpi}:latency`));
  await delay(180 + Math.floor(rng() * 200), signal);

  const charts = Object.fromEntries(
    DIMENSION_KEYS.map((dimension) => [dimension, buildChart(kpi, dimension)]),
  );

  return {
    options: buildOptions(),
    kpi_cards: buildCards(KPI_META),
    metrics_cards: buildCards(METRICS),
    charts,
  };
}
