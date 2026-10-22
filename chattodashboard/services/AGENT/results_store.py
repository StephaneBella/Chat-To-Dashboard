"""Résultats de requêtes gardés en mémoire, par conversation (thread), pour make_chart."""
import uuid

# {thread_id: {result_id: {"columns": [...], "rows": [[...]]}}}
RESULTS = {}


def save_result(thread_id, columns, rows):
    result_id = uuid.uuid4().hex[:8]
    RESULTS.setdefault(thread_id, {})[result_id] = {"columns": columns, "rows": rows}
    return result_id


def load_result(thread_id, result_id):
    """Renvoie le résultat, ou None s'il n'existe pas dans ce thread."""
    return RESULTS.get(thread_id, {}).get(result_id)
