export type Accent = "primary" | "secondary" | "tertiary" | "error";

export const ACCENT_BORDER: Record<Accent, string> = {
  primary: "hover:border-primary/50",
  secondary: "hover:border-secondary/50",
  tertiary: "hover:border-tertiary/50",
  error: "hover:border-error/50",
};

export const ACCENT_GLOW: Record<Accent, string> = {
  primary: "bg-primary/5 group-hover:bg-primary/10",
  secondary: "bg-secondary/5 group-hover:bg-secondary/10",
  tertiary: "bg-tertiary/5 group-hover:bg-tertiary/10",
  error: "bg-error/5 group-hover:bg-error/10",
};

export const ACCENT_DOT: Record<Accent, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  tertiary: "bg-tertiary",
  error: "bg-error",
};

export const KPI_ACCENT: Record<string, Accent> = {
  profit_margin: "secondary",
  weighted_discount: "tertiary",
  loss_order_rate: "error",
};

export interface ChartCellConfig {
  dimension: string;
  title: string;
  caption: string;
  badge: string;
  accent: Accent;
  /** The badge/chart accent follows the selected KPI colour. */
  accentFromKpi?: boolean;
}

export const CHART_CELLS: ChartCellConfig[] = [
  {
    dimension: "time",
    title: "Évolution temporelle : {kpi}",
    caption: "Évolution temporelle (selon le KPI sélectionné)",
    badge: "{kpi}",
    accent: "primary",
    accentFromKpi: true,
  },
  {
    dimension: "shipping_mode",
    title: "Performance par mode d'expédition : {kpi}",
    caption: "KPI par mode d'expédition",
    badge: "Benchmark global : {benchmark}",
    accent: "primary",
    accentFromKpi: true,
  },
  {
    dimension: "product",
    title: "Distribution par sous-catégorie produit",
    caption: "KPI par sous-catégorie de produit",
    badge: "Classement par sous-catégorie",
    accent: "tertiary",
  },
  {
    dimension: "location",
    title: "Répartition par région géographique",
    caption: "KPI par région",
    badge: "Comparaison régionale",
    accent: "secondary",
  },
  {
    dimension: "client",
    title: "Performance par segment client",
    caption: "KPI par segment client",
    badge: "Comparaison par segment",
    accent: "primary",
  },
];

export function fillTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}
