"""
Tools de l'agent. Fonctions Python simples : le branchement LangChain se fera plus tard.

Ici : get_schema et run_sql. Les autres tools (get_kpi, make_chart...) viendront dans ce fichier.
"""
import re
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

from django.db import DatabaseError

from .results_store import save_result
from .sql_guard import TIMEOUT_MS, check_query, run_readonly

MAX_ROWS = 200
DICTIONARY = Path(__file__).resolve().parent / "data_dictionary.md"


# ---------------------------------------------------------------- get_schema

def _read_sections():
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


def get_schema(table=None):
    """Sans argument : liste des tables + règles. Avec 'table' : détail (plusieurs possibles, séparées par des virgules)."""
    general, tables = _read_sections()

    if not table or not table.strip():
        lines = ["Tables disponibles :"]
        for name, body in tables.items():
            role = re.search(r"^Rôle : (.+)$", body, flags=re.MULTILINE)
            lines.append(f"- {name} : {role.group(1) if role else ''}")
        for title, body in general.items():
            lines += ["", f"## {title}", body]
        return "\n".join(lines)

    result = []
    for name in table.split(","):
        name = name.strip().lower()
        if name not in tables:
            return f"Table inconnue : '{name}'. Tables valides : {', '.join(tables)}."
        result.append(f"## TABLE {name}\n{tables[name]}")
    return "\n\n".join(result)


# ------------------------------------------------------------------- run_sql

def _to_json(value):
    if isinstance(value, (Decimal, float)):
        return round(float(value), 4)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def run_sql(query, thread_id):
    """Renvoie {columns, rows, row_count, truncated, result_id} ou {"error": "..."}."""
    try:
        query = check_query(query)
    except ValueError as exc:
        return {"error": f"Requête refusée : {exc}"}

    # LIMIT posé autour de la requête : il s'applique même si elle n'en a pas.
    # On demande une ligne de plus pour savoir si le résultat a été coupé.
    sql = f"SELECT * FROM ({query}) AS q LIMIT {MAX_ROWS + 1}"

    try:
        columns, rows = run_readonly(sql)
    except DatabaseError as exc:
        message = str(exc).strip().splitlines()[0] if str(exc).strip() else "erreur inconnue"
        if "statement timeout" in message:
            return {"error": f"La requête a dépassé {TIMEOUT_MS // 1000} secondes. La simplifier (filtrer ou agréger)."}
        return {"error": f"Erreur SQL : {message}. Vérifier les noms avec get_schema."}

    truncated = len(rows) > MAX_ROWS
    rows = [[_to_json(v) for v in row] for row in rows[:MAX_ROWS]]
    result = {"columns": columns, "rows": rows, "row_count": len(rows),
              "truncated": truncated, "result_id": None}

    if not rows:
        result["message"] = "Aucune ligne retournée. Ne pas inventer de chiffres."
        return result

    result["result_id"] = save_result(thread_id, columns, rows)
    return result
