"""
Tools for the AI Agent.
"""
import logging
import re

from django.db import DatabaseError
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from .memory import user_id_, KINDS, LongTermMemory

from .results_store import MAX_STORED_ROWS, store_and_preview, thread_id_from
from .sql_guard import TIMEOUT_MS, check_query, run_readonly
from .tools_utils import (
    MAX_KPI_ROWS, KPI_REGISTRY, DIMENSIONS, DIMENSION_COLUMNS,
    ERR_EXPIRED, rows_as_dicts, check_columns, check_numeric, 
    check_x_role,read_sections, to_json, base_query_set, round, 
    variant, load_result, check_points, apply_readability, 
    save_derived, keep_for_chart, push_chart, drop_none
)

from ..aggregations import aggregate_by_dimension

logger = logging.getLogger(__name__)

MAX_ROWS = MAX_STORED_ROWS  # One single limit's definition (results_store)



# ============================ TOOL 1 : get_schema =======================================================


@tool("get_schema")
def get_schema_tool(table: str | None = None) -> str:
    """Lit le dictionnaire de données de l'entrepôt : tables, colonnes exactes, sens, jointures,
    règles de calcul. À appeler AVANT toute requête run_sql.
    table : nom d'une ou plusieurs tables séparées par des virgules (ex. 'fact_sales,dim_produit').
    Sans table : liste de toutes les tables avec leur rôle, plus les règles globales.
    Tables : fact_sales, fact_orders, dim_date, dim_client, dim_produit, dim_localite, dim_shipping_mode."""

    general, tables = read_sections()

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


# ============================ TOOL 2 : run_sql =======================================================

@tool("run_sql")
def run_sql_tool(query: str, config: RunnableConfig = None) -> dict:
    """Exécute une requête SQL en lecture seule sur l'entrepôt. À utiliser uniquement quand get_kpi
    ne répond pas à la question, et après avoir consulté get_schema.
    query : une seule instruction SELECT (ou WITH ... SELECT), avec les noms exacts du dictionnaire.
    Le résultat complet (200 lignes maximum) est gardé côté serveur sous un result_id. Tu ne vois
    que les 30 premières lignes : utilise ORDER BY pour mettre les plus importantes en tête, et
    agrège plutôt que de lister des lignes brutes.
    Utilise le result_id avec make_chart pour construire un graphique.
    En cas d'erreur, le message explique la cause : corrige la requête (2 corrections maximum)."""

    thread_id = thread_id_from(config)

    if not thread_id:
        return {"error": "Conversation non identifiée : impossible d'enregistrer le résultat."}

    try:
        query = check_query(query)
    except ValueError as exc:
        logger.info("run_sql refusée (thread %s) : %s", thread_id, exc)
        return {"error": f"Requête refusée : {exc}"}

    # LIMIT posé autour de la requête : il s'applique même si elle n'en a pas.
    # On demande une ligne de plus pour savoir si le résultat a été coupé.
    sql = f"SELECT * FROM ({query}) AS q LIMIT {MAX_ROWS + 1}"

    try:
        columns, rows = run_readonly(sql)
    except DatabaseError as exc:
        message = str(exc).strip().splitlines()[0] if str(exc).strip() else "erreur inconnue"
        logger.info("run_sql en erreur (thread %s) : %s", thread_id, message)
        if "statement timeout" in message:
            return {"error": f"La requête a dépassé {TIMEOUT_MS // 1000} secondes. La simplifier (filtrer ou agréger)."}
        return {"error": f"Erreur SQL : {message}. Vérifier les noms avec get_schema."}

    truncated = len(rows) > MAX_ROWS
    rows = [[to_json(v) for v in row] for row in rows[:MAX_ROWS]]

    if not rows:
        return {
            "columns": columns, "row_count": 0, "truncated": False, "result_id": None,
            "message": "Aucune ligne retournée. Ne pas inventer de chiffres.",
        }

    # Résultat complet -> store ; le LLM ne reçoit que l'aperçu et le result_id
    result = store_and_preview(thread_id, columns, rows, source=query, truncated=truncated)
    if truncated:
        result["warning"] = (
            f"Résultat coupé à {MAX_ROWS} lignes : ne tire pas de conclusion sur l'ensemble. "
            "Filtre ou agrège pour obtenir un résultat complet."
        )
    return result



# ============================ TOOL 3 : memory_search_tool =======================================================
@tool("memory_search")
def memory_search_tool(query: str, kind: str | None = None, config: RunnableConfig = None) -> list[dict] | str:
    """Searches the user's long-term memory using natural language.
    Useful for retrieving an SQL query that has already been validated for a similar question.
    kind: 'preference' or 'validated_query'."""
    
    user_id = user_id_(config)
    if user_id is None:
        return "Mémoire indisponible (utilisateur non identifié)."

    if kind is not None and kind not in KINDS:
        return f"kind doit valoir : {', '.join(KINDS)}"
    
    found = LongTermMemory(user_id).search(query, kind)
    return [{"kind": m.kind, "content": m.content, "created_at": m.created_at.isoformat()} for m in found]


# ============================ TOOL 4 : memory_save_tool =======================================================
@tool("memory_save")
def memory_save_tool(kind: str, content: str, config: RunnableConfig = None) -> dict | str:
    """Stores persistent information for future conversations.
    kind 'preference': the user's stable preference (format, unit, tone).
    kind 'validated_query': question + SQL query validated by the user.
    Never include numbers derived from the data or sensitive personal information."""

    user_id = user_id_(config)
    if user_id is None:
        return "Mémoire indisponible (utilisateur non identifié)."
    try:
        memory, created = LongTermMemory(user_id).save(kind, content)
    except ValueError as exc:
        return f"Refusé : {exc}"

    return {"saved": True, "id": memory.id, "already_known": not created}




# ============================ TOOL 5 : get_kpi_tool =======================================================
@tool("get_kpi")
def get_kpi_tool(kpi: str, dimension: str | None = None, config: RunnableConfig = None) -> dict:
    """Calcule un KPI ou une métrique officiels, avec les mêmes formules que le dashboard.
    À utiliser EN PREMIER pour toute question sur la marge, la remise ou les commandes à perte.
    kpi : profit_margin (taux de marge, %), weighted_discount (remise moyenne pondérée, %),
      loss_order_rate (taux de commandes à profit négatif, %), total_sales (chiffre d'affaires, $),
      total_discount (montant total des remises, $).
    dimension (optionnel) : client (par segment), shipping_mode (par mode de livraison),
      location (par région), product (par sous-catégorie), time (par mois).
    Sans dimension : une seule valeur globale.
    Le résultat a deux colonnes : la dimension (segment, ship_mode, region, sub_category ou annee_mois)
    et la valeur (colonne nommée comme le KPI). Utilise result_id avec make_chart pour un graphique.
    Aucun filtre possible (année, région...) : pour un besoin filtré, utilise run_sql."""

    thread_id = thread_id_from(config)
    if not thread_id:
        return {"error": "Conversation non identifiée : impossible d'enregistrer le résultat."}
    if kpi not in KPI_REGISTRY:
        return {"error": f"KPI inconnu : '{kpi}'. Valeurs possibles : {list(KPI_REGISTRY)}"}
    config = KPI_REGISTRY[kpi]

    if dimension is None:
        total = base_query_set().aggregate(value=config["agg"])["value"]
        columns, rows = ["label", "value"], [[config["label"], round(total)]]
    else:
        if dimension not in DIMENSIONS:
            return {"error": f"Dimension inconnue : '{dimension}'. Valeurs possibles : {list(DIMENSIONS)}"}
        columns = [DIMENSION_COLUMNS[dimension], kpi]
        rows = [
            [label, round(value)]
            for label, value in aggregate_by_dimension(config, DIMENSIONS[dimension])
        ]

    result = store_and_preview(
        thread_id, columns, rows, source=f"get_kpi({kpi}, {dimension})", preview_rows=MAX_KPI_ROWS
    )
    return {"kpi": kpi, "label": config["label"], "unit": config["unit"], "dimension": dimension, **result}


# ============================ TOOL 4 : make_chart_tool =======================================================
@tool("make_chart")
def make_chart_tool(
    result_id: str,
    chart_type: str,
    x_column: str,
    y_column: str,
    title: str,
    y_columns: list[str] | None = None,
    series_column: str | None = None,
    size_column: str | None = None,
    x_label: str | None = None,
    y_label: str | None = None,
    unit: str | None = None,
    config: RunnableConfig = None,
) -> dict:
    """Affiche un graphique à droite de la conversation, à partir d'un résultat de get_kpi ou run_sql.
    Les données ne passent pas par toi : tu indiques seulement quelles colonnes tracer.
    À utiliser pour comparer des catégories, suivre une évolution ou classer.
    Pas pour un chiffre unique (moins de 2 points) ni pour plus de 30 catégories : agrège avec ORDER BY et LIMIT.
    result_id : identifiant renvoyé par get_kpi ou run_sql.
    chart_type : identifiant du catalogue (ex. line, bar, hbar, pie, donut). La liste exacte est donnée en cas d'erreur.
    x_column : colonne des catégories ou du temps. Si elle est numérique (ex. une année), utilise CAST(... AS text) en SQL.
    y_column : colonne numérique à tracer. y_columns : plusieurs mesures (remplace y_column).
    series_column : colonne qui découpe en séries, si le type de graphique l'exige.
    title : titre court. x_label, y_label : libellés d'axes. unit : '$', '%'...
    L'outil peut remplacer le type pour la lisibilité (ex. bar -> hbar) ou réduire les données : il te le dit."""

    thread_id = thread_id_from(config)

    if not thread_id:
        return {"error": "Conversation non identifiée."}

    variant, error = variant(chart_type)
    if error:
        return error

    stored = load_result(thread_id, result_id)
    if stored is None:
        return {"error": ERR_EXPIRED}
    result = {"columns": stored["columns"], "rows": rows_as_dicts(stored)}

    measures = list(y_columns) if y_columns else [y_column]

    error = check_columns(result, variant, x_column, measures, series_column, size_column)
    if error:
        return error
    error = check_numeric(result, measures)
    if error:
        return error
    error = check_x_role(result, variant, x_column)
    if error:
        return error
    error = check_points(result, x_column)
    if error:
        return error

    requested = chart_type
    chart_type, rows = apply_readability(list(result["rows"]), chart_type, x_column, measures, series_column)
    trimmed = rows != result["rows"]

    # the frontend must fetch the rows that are really plotted, not the cut ones
    if trimmed:
        columns = result["columns"]
        result_id = save_derived(
            thread_id, columns, [[row[column] for column in columns] for row in rows], source_id=result_id
        )
    keep_for_chart(thread_id, result_id)  # le frontend relira ces lignes plus tard

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
    push_chart(thread_id, drop_none(payload))

    notes = ["Graphique affiché à l'utilisateur, à droite de la conversation."]
    if chart_type != requested:
        notes.append(f"Type remplacé par '{chart_type}' pour la lisibilité.")
    if trimmed:
        notes.append("Données réduites (top N ou séries regroupées en 'Autres').")
    return {"ok": True, "chart_type": chart_type, "title": title, "message": " ".join(notes)}


agent_tools = [
    get_schema_tool, 
    run_sql_tool, 
    get_kpi_tool, 
    make_chart_tool, 
    memory_save_tool, 
    memory_search_tool
]