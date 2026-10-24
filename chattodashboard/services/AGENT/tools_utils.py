from datetime import date, datetime
from pathlib import Path
import json
from decimal import Decimal
from functools import lru_cache

from django.conf import settings

from ..aggregations import DIMENSIONS, KPIs, METRICS, aggregate_by_dimension, base_query_set
from .results_store import (
    ERR_EXPIRED,
    keep_for_chart,
    load_result,
    push_chart,
    rows_as_dicts,
    save_derived,
    store_and_preview,
    thread_id_from,
)
import re

DICTIONARY = Path(__file__).resolve().parent / "data_dictionary.md"

# readability limits (the LLM is expected to filter or aggregate above them)
MIN_POINTS, MAX_POINTS = 2, 30
MAX_PIE_PARTS = 5
MAX_BAR_CATEGORIES = 12
TOP_N = 10
MAX_SERIES = 5
MAX_KPI_ROWS = 60  # un KPI par dimension fait au plus 48 lignes (mois) : le LLM les voit toutes

# columns whose labels are too long to stay readable on a vertical bar
LONG_LABEL_COLUMNS = {"product_name", "city", "customer_name"}

# columns that already carry a time axis: a long series stays a line
TIME_COLUMNS = {"annee_mois", "trimestre", "date"}

# name of the first column of a get_kpi result, per dimension.
# Same names as the SQL columns, so TIME_COLUMNS also applies to get_kpi results.
DIMENSION_COLUMNS = {
    "client": "segment",
    "shipping_mode": "ship_mode",
    "location": "region",
    "product": "sub_category",
    "time": "annee_mois",
}

# The dashboard's KPIs plus the two measures shown on the cards.
KPI_REGISTRY = {**KPIs, **METRICS}


# ======================== UTILS FOR get_schema_tool & run_sql_tool =========================================
def read_sections():
    """Découpe le dictionnaire en sections '## ...'. Renvoie ({titre: texte}, {table: texte})."""
    text = DICTIONARY.read_text(encoding="utf-8")
    parts = re.split(r"^## (.+)$", text, flags=re.MULTILINE)
    general, tables = {}, {}
    # parts = [intro, titre1, texte1, titre2, texte2, ...]
    for title, body in zip(parts[1::2], parts[2::2]):
        if title.startswith("TABLE "):
            tables[title[6:].strip()] = body.strip()
        else:
            general[title.strip()] = body.strip()
    return general, tables

def to_json(value):
    if isinstance(value, (Decimal, float)):
        return round(float(value), 4)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value



# ========================== UTILS FOR kpi_tool & chart_tool ====================================

@lru_cache(maxsize=1)
def catalog():
    """The frontend catalogue indexed by chart id, loaded only once."""
    with open(settings.CHART_CATALOG_PATH, encoding="utf-8") as file:
        data = json.load(file)
    variants = data["variants"] if isinstance(data, dict) else data
    return {variant["id"]: variant for variant in variants}


def variant(chart_type):
    """The catalogue entry for 'chart_type', or a ready-to-return error."""
    try:
        catalog = catalog()
    except (OSError, ValueError) as exc:
        return None, {"error": f"Catalogue indisponible : {exc}"}
    variant = catalog.get(chart_type)
    if variant is None:
        return None, {
            "error": f"Type de graphique inconnu : '{chart_type}'. Valeurs possibles : {sorted(catalog)}"
        }
    return variant, None


# 'result' below is {"columns": [...], "rows": [{column: value}, ...]}
def is_number(value):
    return isinstance(value, (int, float, Decimal)) and not isinstance(value, bool)


def check_columns(result, variant, x_column, measures, series_column, size_column):
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


def check_numeric(result, measures):
    """A measure column must be numeric and not empty."""
    for column in measures:
        values = [row[column] for row in result["rows"]]
        if not values or not all(is_number(value) for value in values):
            return {
                "error": f"La colonne '{column}' n'est pas numérique : elle ne peut pas être une mesure."
            }


def check_x_role(result, variant, x_column):
    """A category axis must not receive a numeric column."""
    if variant["roles"].get("x") != "category":
        return None
    values = [row[x_column] for row in result["rows"]]
    if values and all(is_number(value) for value in values):
        return {
            "error": (
                f"La colonne '{x_column}' est numérique mais le graphique "
                f"'{variant['id']}' attend une catégorie. Utilise CAST({x_column} AS text)."
            )
        }


def check_points(result, x_column):
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
def cap_series(rows, x_column, measures, series_column):
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


def apply_readability(rows, chart_type, x_column, measures, series_column):
    """Pick the readable variant of the chart and cut the rows to fit."""
    points = len({row[x_column] for row in rows})

    if chart_type in ("pie", "donut") and points > MAX_PIE_PARTS:
        chart_type = "hbar"
    if chart_type == "bar" and (points > MAX_BAR_CATEGORIES or x_column in LONG_LABEL_COLUMNS):
        chart_type = "hbar"
    if chart_type == "hbar" and points > MAX_BAR_CATEGORIES and not series_column:
        rows = sorted(rows, key=lambda row: row[measures[0]] or 0, reverse=True)[:TOP_N]
    if series_column:
        rows = cap_series(rows, x_column, measures, series_column)

    return chart_type, rows


def drop_none(value):
    """Remove ``None`` keys: the frontend contract rejects them."""
    if isinstance(value, dict):
        return {key: drop_none(item) for key, item in value.items() if item is not None}
    if isinstance(value, list):
        return [drop_none(item) for item in value]
    return value


def round(value, digits=2):
    return round(float(value), digits) if value is not None else 0


# ========================== UTILS FOR memory_search_tool & memory_save_tool ====================================
