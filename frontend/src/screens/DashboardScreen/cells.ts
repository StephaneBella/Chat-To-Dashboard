export type Accent = "primary" | "secondary" | "tertiary" | "error";

export const ACCENT_BORDER: Record<Accent, string> = {
  primary: "hover:border-primary/40",
  secondary: "hover:border-secondary/40",
  tertiary: "hover:border-tertiary/40",
  error: "hover:border-error/40",
};

export const ACCENT_GLOW: Record<Accent, string> = {
  primary: "bg-primary/10 group-hover:bg-primary/20",
  secondary: "bg-secondary/10 group-hover:bg-secondary/20",
  tertiary: "bg-tertiary/10 group-hover:bg-tertiary/20",
  error: "bg-error/10 group-hover:bg-error/20",
};

export const ACCENT_DOT: Record<Accent, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  error: "bg-error",
};

/** Icon tile of the KPI / chart cards. */
export const ACCENT_TILE: Record<Accent, string> = {
  primary: "bg-primary-container text-primary",
  secondary: "bg-secondary-container text-secondary",
  tertiary: "bg-tertiary-container text-tertiary",
  error: "bg-error-container text-error",
};

/** Thin gradient bar on top of the cards. */
export const ACCENT_BAR: Record<Accent, string> = {
  primary: "from-primary via-emerald-400 to-secondary",
  secondary: "from-secondary via-teal-400 to-emerald-400",
  tertiary: "from-tertiary via-amber-400 to-orange-300",
  error: "from-error via-rose-400 to-orange-300",
};

export const KPI_ACCENT: Record<string, Accent> = {
  profit_margin: "primary",
  weighted_discount: "secondary",
  loss_order_rate: "tertiary",
};

export interface ChartCellConfig {
  dimension: string;
  title: string;
  caption: string;
  badge: string;
  accent: Accent;
  /** The badge/chart accent follows the selected KPI colour. */
  accentFromKpi?: boolean;
  /** The catalogue id this cell renders (single source of truth). */
  variant: string;
  /** Material Symbols icon shown in the card header. */
  icon: string;
}

export const CHART_CELLS: ChartCellConfig[] = [
  {
    dimension: "time",
    title: "Évolution temporelle : {kpi}",
    caption: "Tendance mensuelle sur toute la période",
    badge: "{kpi}",
    accent: "primary",
    accentFromKpi: true,
    variant: "line",
    icon: "timeline",
  },
  {
    dimension: "shipping_mode",
    title: "Performance par mode d'expédition : {kpi}",
    caption: "KPI par mode de livraison",
    badge: "Benchmark global : {benchmark}",
    accent: "secondary",
    accentFromKpi: true,
    variant: "hbar",
    icon: "local_shipping",
  },
  {
    dimension: "product",
    title: "Distribution par sous-catégorie produit",
    caption: "KPI par sous-catégorie de produit",
    badge: "Classement par sous-catégorie",
    accent: "tertiary",
    variant: "count_plot",
    icon: "category",
  },
  {
    dimension: "location",
    title: "Répartition par région géographique",
    caption: "KPI par région",
    badge: "Comparaison régionale",
    accent: "secondary",
    variant: "hbar",
    icon: "public",
  },
  {
    dimension: "client",
    title: "Performance par segment client",
    caption: "KPI par segment client",
    badge: "Comparaison par segment",
    accent: "primary",
    variant: "bar",
    icon: "groups",
  },
];

export function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}
