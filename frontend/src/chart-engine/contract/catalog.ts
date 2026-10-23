import catalogJson from "./chartCatalog.json";

/**
 * The catalogue is the single source of truth for the chart types the product
 * supports. Python (the agent tools) reads the very same file, so both sides
 * agree on the ids, the required roles and the readability caps.
 */
export const CHART_FAMILIES = [
  "univariate",
  "bivariate",
  "trivariate",
  "multivariate",
] as const;
export type ChartFamily = (typeof CHART_FAMILIES)[number];

/** A channel of the engine spec a payload role can feed. */
export type EngineChannel =
  | "x"
  | "y"
  | "series"
  | "value"
  | "label"
  | "size";

/** The kind of data a role expects (null = the role is not used). */
export type RoleKind = "category" | "number" | null;

export interface CatalogVariant {
  /** The id the agent uses as `chart_type`. */
  id: string;
  family: ChartFamily;
  label: string;
  /** The chart type the engine knows how to render. */
  engineChartType: string;
  /** Options the engine must apply for this variant. */
  engineHints: Record<string, unknown>;
  /** Where each payload role lands in the engine spec. */
  engineChannels: {
    x: EngineChannel | null;
    y: EngineChannel | null;
    series: EngineChannel | null;
    size: EngineChannel | null;
  };
  /** What the tool must provide. */
  roles: {
    x: RoleKind;
    y: RoleKind;
    series: RoleKind;
    size: RoleKind;
  };
  /** Readability cap: beyond this the tool must fall back. */
  maxPoints: number;
  /** The variant to use when the cap is exceeded. */
  fallback: string;
  /** True when the tool has to pre-compute the data. */
  serverComputed: boolean;
  /** Words the router (or the LLM) can match a question against. */
  intent: string[];
  /** Canonical questions, written for a director. */
  intentExamples: string[];
  /** Which DW columns usually feed this variant. */
  dwHint: Record<string, string>;
  notes: string;
}

export interface ChartCatalog {
  version: number;
  families: readonly ChartFamily[];
  variants: CatalogVariant[];
}

export const chartCatalog = catalogJson as unknown as ChartCatalog;

export const catalogVariants: CatalogVariant[] = chartCatalog.variants;

/** Every valid `chart_type` the agent may ask for. */
export const catalogIds: string[] = catalogVariants.map((v) => v.id);

const byId = new Map(catalogVariants.map((v) => [v.id, v]));

export function catalogVariant(id: string): CatalogVariant | undefined {
  return byId.get(id);
}

export function variantsByFamily(family: ChartFamily): CatalogVariant[] {
  return catalogVariants.filter((v) => v.family === family);
}

/** The roles a variant actually uses, in a stable order. */
export function requiredRoles(variant: CatalogVariant): (keyof CatalogVariant["roles"])[] {
  return (["x", "y", "series", "size"] as const).filter(
    (role) => variant.roles[role] != null,
  );
}
