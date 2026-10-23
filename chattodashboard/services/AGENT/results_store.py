"""Store the results (result_id) per thread"""
import uuid
from datetime import date, datetime
from decimal import Decimal

from django.core.cache import caches

PREVIEW_ROWS = 5        # lines provides to the LLM
MAX_STORED_ROWS = 200   # the sam limit as run_sql
RESULT_TTL = 60 * 60    # 1 hour
CHART_TTL = 10 * 60     # one chart has the same lifetime as the request

ERR_EXPIRED = "Résultat introuvable ou expiré : relance la requete pour en obtenir un nouveau."


def cache():
    # Dedicated alias : the ETL empty the default cache, not this one
    return caches["agent_results"]

def thread_id_from(config):
    """The tread_id comes from the call configuration, never from the LLM's arguments."""
    return (config or {}).get("configurable", {}).get("thread_id")

def json_safe(value):
    """Decimal numbers and dates are not converted to JSON: we convert them."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def result_key(thread_id, result_id):
    return f"result:{thread_id}: {result_id}"


# 1. Data result
def store_and_preview(thread_id, columns, rows, source, truncated=False):
    """
        Saves the full result and returns a brief summary to the LLM.
    source: the SQL query or the KPI name (useful for debugging).
    """
    rows = [[json_safe(v) for v in row] for row in rows[:MAX_STORED_ROWS]]
    result_id = "r_" + uuid.uuid4().hex[:8]
    cache().set(
        result_key(thread_id, result_id),
        {"columns": list(columns), "rows": rows, "source": source, "truncated": truncated},
        RESULT_TTL,
    )
    return {
        "result_id": result_id,
        "columns": list(columns),
        "row_count": len(rows),
        "truncated": truncated,
        "preview": rows[:PREVIEW_ROWS],
        "note": (
            f"Apercu de {min(PREVIEW_ROWS, len(rows))} lignes sur {len(rows)}."
            "Utilise result_id avec make_chart pour un graphique."
        ),
    }

def load_result(thread_id, result_id):
    """The complete result, or None if """
    return cache().get(result_key(thread_id, result_id))


def column_values(result, column):
    """Values of a column; ValueError with a list of the columns if unknown."""
    if column not in result["columns"]:
        raise ValueError(f"Colonne '{column}' inconnue. Colonnes disponibles : {result['columns']}")

    index = result["columns"].index(column)
    return [row[index] for row in result["rows"]]

# 2. charts made during the actual request (make_chart -> API)
def chart_key(thread_id):
    return f"charts:{thread_id}"

def push_chart(thread_id, spec):
    charts = cache().get(chart_key(thread_id), [])
    charts.append(spec)
    cache().set(chart_key(thread_id), charts, CHART_TTL)


def pop_charts(thread_id):
    """Retrieve and drop waiting charts. Called by run_agent."""
    charts = cache().get(chart_key(thread_id), [])
    cache().delete(chart_key(thread_id))
    return charts