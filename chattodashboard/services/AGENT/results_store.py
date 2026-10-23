"""In-memory store for the rows produced by the agent's tools.

``get_kpi`` saves a result and hands its id to the LLM; ``make_chart`` reads it
back, and saves a derived copy whenever it has to rewrite the rows (top N,
"Autres", ...). Results are scoped by thread so two conversations never share
an id. Swapping this module for a real store is the only change needed once
the API runs with several workers.
"""

# all the results while the process runs, keyed by result id
RESULTS = {}


def save_result(thread_id, columns, rows):
    """Keep a result and return its id, so make_chart can read it back."""
    result_id = f"r{len(RESULTS) + 1}"
    RESULTS[result_id] = {
        "thread_id": thread_id,
        "columns": list(columns),
        "rows": list(rows),
        "source_id": None,
    }
    return result_id


def get_result(thread_id, result_id):
    """The stored result, or None when it is unknown or belongs to another thread."""
    result = RESULTS.get(result_id)
    if result is None or result["thread_id"] != thread_id:
        return None
    return result


def save_derived(thread_id, columns, rows, source_id=None):
    """Keep the rows actually plotted (after top N / series merge) under a new id."""
    result_id = save_result(thread_id, columns, rows)
    RESULTS[result_id]["source_id"] = source_id
    return result_id
