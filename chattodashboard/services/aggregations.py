from django.db.models import Count, ExpressionWrapper, F, Q, FloatField, Sum, Value
from django.db.models.functions import NullIf

from ..models import FactSales, FactOrders


# Define orders with negative profit
LOSS_ORDER_IDS = FactOrders.objects.filter(is_sold_at_a_loss=True).values("order_id")

# 1. Configuration with KPIs and available dimensions
KPIs = {
    "profit_margin": {
        "label": "Taux de marge bénéficiaire",
        "agg": ExpressionWrapper(Sum("profit") * 100.0 / NullIf(Sum("sales"), Value(0.0)), output_field=FloatField()),
        "unit": "%",
    },

    "weighted_discount": {
        "label": "Taux de remise moyen pondéré",
        "agg": ExpressionWrapper(Sum(F("sales") * F("discount")) * 100.0 / NullIf(Sum("sales"), Value(0.0)), output_field=FloatField(),),
        "unit": "%",
    },

    "loss_order_rate": {
        "label": "Taux de commandes à profit négatif",
        "agg": ExpressionWrapper(
            Count("order_id", distinct=True, filter=Q(order_id__in=LOSS_ORDER_IDS)) * 100.0
            / NullIf(Count("order_id", distinct=True), Value(0)), output_field=FloatField(),
        ),
        "unit": "%",
    },
}


# Metrics : measures only displayed through cards
METRICS = {
    # -- Measures --
    "Total_sales": {"label": "Chiffre d'affaires total", "agg": Sum("sales"), "unit": "$"},
    "total_discount": {"label": "Montant total des remises", "agg": Sum("discount_amount"), "unit": "$"},
}

DIMENSIONS = {
    "client": {
        "label": "Segment client",
        "field": "client__segment",
        "chart_type": "bar_vertical",
    },

    "shipping_mode": {
        "label": "Mode de livraison",
        "field": "shipping_mode__ship_mode",
        "chart_type": "bar_horizontal",
    },

    "location": {
        "label": "Région",
        "field": "locality__region",
        "chart_type": "bar_horizontal",
    },
    "product": {
        "label": "Sous-catégorie de produit",
        "field": "product__sub_category",
        "chart_type": "count_plot",
    },
    "time": {
        "label": "Mois",
        "field": "order_date__year_month",
        "chart_type": "line",
    },
}

# 2. Utils
def base_query_set(year=None):
    """Base Queryset for the fact table (grain = order line)."""
    return FactSales.objects.all()

def _round(value, digits=2):
    return round(value, digits) if value is not None else 0

# 3. Section 1 : KPIs cards

def get_summary_cards():
    """Three kpis cards: CA total, profit total, nombre de commandes."""
    totals = base_query_set().aggregate(
        **{k: v["agg"] for k, v in KPIs.items()},
        **{k: v["agg"] for k, v in METRICS.items()},
    )

    def to_card(key, cfg):
        return {
            "key": key,
            "label": cfg["label"],
            "value": _round(totals[key]),
            "unit": cfg["unit"],
        }
    
    return {
        "kpi_cards": [to_card(k, v) for k, v in KPIs.items()],
        "metrics_cards": [to_card(k, v) for k, v in METRICS.items()],
    }


# 4. Section 2 : chart per dimension
def aggregate_by_dimension(kpi_cfg, dim_cfg):
    """Return one list of tuples (label, value) grouped by dimension"""
    qs = (
        base_query_set().values(label=F(dim_cfg["field"]))
        .annotate(value=kpi_cfg["agg"])
    )

    # Time : chronogical order
    qs = qs.order_by("label") if dim_cfg["chart_type"] == "line" else qs.order_by("-value")
    return [(r["label"], _round(r["value"])) for r in qs]


def build_vertical(rows, kpi_cfg, dim_cfg):
    """Categories in X, horizontal values in Y (barres verticales, count plot, courbe)."""
    return {
        "x_axis": {"label": dim_cfg["label"], "data": [r[0] for r in rows]},
        "y_axis": {"label": kpi_cfg["label"], "data": [r[1] for r in rows]},
    }


def build_horizontal(rows, kpi_cfg, dim_cfg):
    # Horizontal bars : categories in the Y axis, values in the X axis
    return {
        "x_axis": {"label": kpi_cfg["label"], "data": [r[1] for r in rows]},
        "y_axis": {"label": dim_cfg["label"], "data": [r[0] for r in rows]},
    }


CHART_BUILDERS = {
    "bar_vertical": build_vertical,
    "count_plot": build_vertical,
    "line": build_vertical,
    "bar_horizontal": build_horizontal,
}


def get_chart_data(kpi, dimension, year=None):
    """One chart for (kpi, dimension)"""
    if kpi not in KPIs:
        raise ValueError(f"KPI inconnu: '{kpi}'. Valeurs possibles : {list(KPIs)}")
    if dimension not in DIMENSIONS:
        raise ValueError(f"Dimension inconnue : '{dimension}'. Valuers possibles : {list(DIMENSIONS)}")

    kpi_cfg = KPIs[kpi]
    dim_cfg = DIMENSIONS[dimension]
    chart_type = dim_cfg["chart_type"]

    rows = aggregate_by_dimension(kpi_cfg, dim_cfg)

    return {
        "chart_type": chart_type,
        "kpi": kpi,
        "kpi_label": kpi_cfg["label"],
        "unit": kpi_cfg["unit"],
        "dimension": dimension,
        "dimension_label": dim_cfg["label"],
        **CHART_BUILDERS[chart_type](rows, kpi_cfg, dim_cfg),
    }


def get_all_charts(kpi):
    """The five dashboard's charts for the same KPI"""
    return {
        dim: get_chart_data(kpi, dim) 
        for dim in DIMENSIONS
    }


def get_dashboard_options():
    """To animate frontend drop-down lists."""
    return {
        "kpis": [
            {
                "key": k, 
                "label": v["label"], 
                "unit": v["unit"],   
            }
             for k, v in KPIs.items()],
        
        "dimensions": [
            {"key": k, "label": v["label"], "chart_type": v["chart_type"]} for k, v in DIMENSIONS.items()
        ],
    }