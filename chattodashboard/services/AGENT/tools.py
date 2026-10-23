import json
from decimal import Decimal
from functools import lru_cache

from django.conf import settings

from ..aggregations import DIMENSIONS, KPIs, METRICS, aggregate_by_dimension, base_query_set
from .results_store import get_result, save_derived, save_result

# readability limits (the LLM is expected to filter or aggregate above them)
MIN_POINTS, MAX_POINTS = 2, 30
MAX_PIE_PARTS = 5
MAX_BAR_CATEGORIES = 12
TOP_N = 10
MAX_SERIES = 5

# columns whose labels are too long to stay readable on a vertical bar
LONG_LABEL_COLUMNS = {"product_name", "city", "customer_name"}

# columns that already carry a time axis: a long series stays a line
TIME_COLUMNS = {"annee_mois", "trimestre", "date"}

# The dashboard's KPIs plus the two measures shown on the cards.
KPI_REGISTRY = {**KPIs, **METRICS}


# catalogue
@lru_cache(maxsize=1)
def _catalog():
    """The frontend catalogue indexed by chart id, loaded only once."""
    with open(settings.CHART_CATALOG_PATH, encoding="utf-8") as file:
        data = json.load(file)
    variants = data["variants"] if isinstance(data, dict) else data
    return {variant["id"]: variant for variant in variants}


def _variant(chart_type):
    """The catalogue entry for ``chart_type``, or a ready-to-return error."""
    try:
        catalog = _catalog()
    except (OSError, ValueError) as exc:
        return None, {"error": f"Catalogue indisponible : {exc}"}
    variant = catalog.get(chart_type)
    if variant is None:
        return None, {
            "error": f"Type de graphique inconnu : '{chart_type}'. Valeurs possibles : {sorted(catalog)}"
        }
    return variant, None


# validation
def _is_number(value):
    return isinstance(value, (int, float, Decimal)) and not isinstance(value, bool)


def _check_columns(result, variant, x_column, measures, series_column, size_column):
    """Every referenced column must exist; the series role must be filled."""
    columns = result["columns"]
    used = list(measures)
    if variant["roles"].get("x"):
        used.append(x_column)
    if series_column:
        used.append(series_column)
    if size_column:
        used.append(size_column)
    for column in used:
        if column not in columns:
            return {"error": f"Colonne inconnue : '{column}'. Colonnes du résultat : {columns}"}

    if variant["roles"].get("series") and not series_column:
        return {
            "error": f"Le graphique '{variant['id']}' attend une colonne de série (series_column)."
        }


def _check_numeric(result, measures):
    """A measure column must be numeric and not empty."""
    for column in measures:
        values = [row[column] for row in result["rows"]]
        if not values or not all(_is_number(value) for value in values):
            return {
                "error": f"La colonne '{column}' n'est pas numérique : elle ne peut pas être une mesure."
            }


def _check_x_role(result, variant, x_column):
    """A category axis must not receive a numeric column."""
    if variant["roles"].get("x") != "category":
        return None
    values = [row[x_column] for row in result["rows"]]
    if values and all(_is_number(value) for value in values):
        return {
            "error": (
                f"La colonne '{x_column}' est numérique mais le graphique "
                f"'{variant['id']}' attend une catégorie. Utilise CAST({x_column} AS text)."
            )
        }


def _check_points(result, x_column):
    """Too few or too many categories: the LLM must fix its SQL."""
    points = {row[x_column] for row in result["rows"]}
    if len(points) < MIN_POINTS:
        return {"error": f"Un graphique demande au moins {MIN_POINTS} points : réponds en texte."}
    if len(points) > MAX_POINTS and x_column not in TIME_COLUMNS:
        return {
            "error": (
                f"Trop de points ({len(points)} > {MAX_POINTS}) : filtre ou agrège "
                f"la requête SQL avant de dessiner."
            )
        }


# readability
def _cap_series(rows, x_column, measures, series_column):
    """Keep the top series and fold the others into an "Autres" series."""
    totals = {}
    for row in rows:
        series = row[series_column]
        totals[series] = totals.get(series, 0) + (row[measures[0]] or 0)
    if len(totals) <= MAX_SERIES:
        return rows

    keep = {
        series
        for series, _ in sorted(totals.items(), key=lambda item: item[1], reverse=True)[:MAX_SERIES]
    }
    out = []
    others = {}
    for row in rows:
        if row[series_column] in keep:
            out.append(row)
            continue
        key = row[x_column]
        if key not in others:
            others[key] = dict(row)
            others[key][series_column] = "Autres"
            others[key][measures[0]] = 0
        others[key][measures[0]] += row[measures[0]] or 0
    return out + list(others.values())


def _apply_readability(rows, chart_type, x_column, measures, series_column):
    """Pick the readable variant of the chart and cut the rows to fit."""
    points = len({row[x_column] for row in rows})

    if chart_type in ("pie", "donut") and points > MAX_PIE_PARTS:
        chart_type = "hbar"
    if chart_type == "bar" and (points > MAX_BAR_CATEGORIES or x_column in LONG_LABEL_COLUMNS):
        chart_type = "hbar"
    if chart_type == "hbar" and points > MAX_BAR_CATEGORIES and not series_column:
        rows = sorted(rows, key=lambda row: row[measures[0]] or 0, reverse=True)[:TOP_N]
    if series_column:
        rows = _cap_series(rows, x_column, measures, series_column)

    return chart_type, rows


def _drop_none(value):
    """Remove ``None`` keys: the frontend contract rejects them."""
    if isinstance(value, dict):
        return {key: _drop_none(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [_drop_none(item) for item in value]
    return value


# util functions
def _round(value, digits=2):
    return round(float(value), digits) if value is not None else 0


# KPI tool
def get_kpi(kpi, dimension=None, thread_id=None):
    """A dashboard KPI, globally or split along one dimension."""
    if kpi not in KPI_REGISTRY:
        return {"error": f"KPI inconnu : '{kpi}'. Valeurs possibles : {list(KPI_REGISTRY)}"}
    config = KPI_REGISTRY[kpi]

    if dimension is None:
        total = base_query_set().aggregate(value=config["agg"])["value"]
        rows = [{"label": config["label"], "value": _round(total)}]
    else:
        if dimension not in DIMENSIONS:
            return {"error": f"Dimension inconnue : '{dimension}'. Valeurs possibles : {list(DIMENSIONS)}"}
        rows = [
            {"label": label, "value": _round(value)}
            for label, value in aggregate_by_dimension(config, DIMENSIONS[dimension])
        ]

    return {
        "kpi": kpi,
        "label": config["label"],
        "unit": config["unit"],
        "dimension": dimension,
        "rows": rows,
        "result_id": save_result(thread_id, ["label", "value"], rows),
    }


# Chart Tool
def make_chart(
    thread_id,
    result_id,
    chart_type,
    x_column,
    y_column,
    title,
    y_columns=None,
    series_column=None,
    size_column=None,
    x_label=None,
    y_label=None,
    unit=None,
):
    """The chart spec for a stored result (columns and roles, no values)."""
    variant, error = _variant(chart_type)
    if error:
        return error

    result = get_result(thread_id, result_id)
    if result is None:
        return {"error": f"result_id inconnu : '{result_id}'. Lance d'abord get_kpi."}

    measures = list(y_columns) if y_columns else [y_column]

    error = _check_columns(result, variant, x_column, measures, series_column, size_column)
    if error:
        return error
    error = _check_numeric(result, measures)
    if error:
        return error
    error = _check_x_role(result, variant, x_column)
    if error:
        return error
    error = _check_points(result, x_column)
    if error:
        return error

    rows = list(result["rows"])
    chart_type, rows = _apply_readability(rows, chart_type, x_column, measures, series_column)

    # the frontend must fetch the rows that are really plotted, not the cut ones
    if rows != result["rows"]:
        result_id = save_derived(thread_id, result["columns"], rows, source_id=result_id)

    payload = {
        "result_id": result_id,
        "chart_type": chart_type,
        "title": title,
        "x": {"column": x_column, "label": x_label},
        "y": [{"column": column} for column in measures],
        "series": {"column": series_column} if series_column else None,
        "size": {"column": size_column} if size_column else None,
        "y_label": y_label,
        "unit": unit,
    }
    return _drop_none(payload)
