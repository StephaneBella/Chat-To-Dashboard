from django.db.models import Avg, Count, ExpressionWrapper, F, Q, FloatField, Sum, Value
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
        "kind": "kpi",
        "additive": False,
    },

    "weighted_discount": {
        "label": "Taux de remise moyen pondéré",
        "agg": ExpressionWrapper(Sum(F("sales") * F("discount")) * 100.0 / NullIf(Sum("sales"), Value(0.0)), output_field=FloatField(),),
        "unit": "%",
        "kind": "kpi",
        "additive": False,
    },

    "loss_order_rate": {
        "label": "Taux de commandes à profit négatif",
        "agg": ExpressionWrapper(
            Count("order_id", distinct=True, filter=Q(order_id__in=LOSS_ORDER_IDS)) * 100.0
            / NullIf(Count("order_id", distinct=True), Value(0)), output_field=FloatField(),
        ),
        "unit": "%",
        "kind": "kpi",
        "additive": False,
    },

    # -- Measures --
    "sales": {"label": "Chiffre d'affaires", "agg": Sum("sales"), "unit": "$", "kind": "metric", "additive": True},
    "profit": {"label": "Profit", "agg": Sum("profit"), "unit": "$", "kind": "metric", "additive": True},
    "quantity": {"label": "Quantité vendue", "agg": Sum("quantity"), "unit": "", "kind": "metric", "additive": True},
}


DIMENSIONS = {
    "client": {
        "label": "Segment client",
        "field": "client__segment",
        "chart_type": "waterfall",
    },

    "shipping_mode": {
        "label": "Mode de livraison",
        "field": "shipping_mode__ship_mode",
        "chart_type": "bar_horizontal",
    },

    "location": {
        "label": "Région",
        "field": "locality__region",
        "chart_type": "donut",
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
    qs = FactSales.objects.all()
    if year:
        qs = qs.filter(order_date__year=year)
    return qs

def _round(value, digits=2):
    return round(value, digits) if value is not None else 0

# 3. Section 1 : KPIs cards
CARD_KPIS = ["profit_margin", "weighted_discount", "loss_order_rate"]

def get_kpi_cards(year=None):
    """Three kpis cards: CA total, profit total, nombre de commandes."""
    qs = base_query_set(year)
    totals = qs.aggregate(**{k: KPIs[k]["agg"] for k in CARD_KPIS})
    return [
        {
            "key": k,
            "label": KPIs[k]["label"],
            "value": _round(totals[k]),
            "unit": KPIs[k]["unit"],
        }
        for k in CARD_KPIS
    ]


# 4. Section 2 : generic request + constructors per chart type
def aggregate_by_dimension(kpi_cfg, dim_cfg, year=None):
    """Return one list of tuples (label, value) grouped by dimension"""
    qs = (base_query_set(year).values(label=F(dim_cfg["field"])).annotate(value=kpi_cfg["agg"]))

    # Time : chronological order
    qs = qs.order_by("label") if dim_cfg["chart_type"] == "line" else qs.order_by("-value")
    return [(r["label"], _round(r["value"])) for r in qs]


def build_waterfall(rows, kpi_cfg):
    labels = [r[0] for r in rows]
    values = [r[1] for r in rows]
    return {
        "x_axis": {"label": "Segment", "data": labels + ["Total"]},
        "y_axis": {"label": kpi_cfg["label"], "data": values + [_round(sum(values))]},
        # Format compatible with plotly : "relative" = floating bar, "total" = "final bar"
        "measure": ["relative"] * len(values) + ["total"],
    }

def build_bar_horizontal(rows, kpi_cfg):
    # Horizontal bars : categories in the Y axis, values in the X axis
    return {
        "x_axis": {"label": kpi_cfg["label"], "data": [r[1] for r in rows]},
        "y_axis": {"label": "Mode de livraison", "data": [r[0] for r in rows]},
    }

def build_donut(rows, kpi_cfg):
    values = [r[1] for r in rows]
    total = sum(values)
    return {
        "labels": [r[0] for r in rows],
        "values": values,
        "percentages": [_round(v * 100 / total) if total else 0 for v in values],
    }

def build_count_plot(rows, kpi_cfg):
    return {
        "x_axis": {"label": "Sous-catégorie", "data": [r[0] for r in rows]},
        "y_axis": {"label": kpi_cfg["label"], "data": [r[1] for r in rows]},
    }

def build_line(rows, kpi_cfg):
    return {
        "x_axis": {"label": "Mois", "data": [r[0] for r in rows]},
        "y_axis": {"label": kpi_cfg["label"], "data": [r[1] for r in rows]},
    }

CHART_BUILDERS = {
    "waterfall": build_waterfall,
    "bar_horizontal": build_bar_horizontal,
    "donut": build_donut,
    "count_plot": build_count_plot,
    "line": build_line,
}


def get_chart_data(kpi, dimension, year=None):
    """Entry point for section 2 : provides the dict ready for the frontend."""
    if kpi not in KPIs:
        raise ValueError(f"KPI inconnu: '{kpi}'. Valeurs possibles : {list(KPIs)}")
    if dimension not in DIMENSIONS:
        raise ValueError(f"Dimension inconnue : '{dimension}'. Valuers possibles : {list(DIMENSIONS)}")

    kpi_cfg = KPIs[kpi]
    dim_cfg = DIMENSIONS[dimension]
    chart_type = dim_cfg["chart_type"]

    if chart_type == "waterfall" and not kpi_cfg["aditive"]:
        raise ValueError(f"Le KPI '{kpi}' n'est pas additif : impossible de l'afficher en waterfall.")

    rows = aggregate_by_dimension(kpi_cfg, dim_cfg, year)

    return {
        "chart_type": chart_type,
        "kpi": kpi,
        "kpi_label": kpi_cfg["label"],
        "unit": kpi_cfg["unit"],
        "dimension": dimension,
        "dimension_label": dim_cfg["label"],
        **CHART_BUILDERS[chart_type](rows, kpi_cfg),
    }

def get_dashboard_options():
    """To animate frontend drop-down lists."""
    return {
        "kpis": [
            {
                "key": k, 
                "label": v["label"], 
                "unit": v["unit"], 
                "kind": v["kind"],
                "additive": v["additive"],  
            }
             for k, v in KPIs.items()],
        
        "dimensions": [
            {"key": k, "label": v["label"], "chart_type": v["chart_type"]} for k, v in DIMENSIONS.items()
        ],
    }