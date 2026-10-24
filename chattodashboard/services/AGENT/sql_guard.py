"""SQL validation & read only connexion"""
"""
Validation of the SQL written by the LLM and read-only execution.

True protection is a PostgreSQL role that has only SELECT privileges.
To be executed once with the postgres account (change the password):

    CREATE ROLE dw_reader LOGIN PASSWORD 'change-me';
    GRANT CONNECT ON DATABASE “Chat_To_BI_DW” TO dw_reader;
    GRANT USAGE ON SCHEMA public TO dw_reader;
    GRANT SELECT ON fact_sales, fact_orders, dim_date, dim_client,
                    dim_product, dim_location, dim_shipping_mode TO dw_reader;

Then, in settings.py, add a connection alias that uses this role:

    DATABASES[“dw_readonly”] = {**DATABASES[“default”], 'USER': “dw_reader”,
                                “PASSWORD”: os.environ[“DW_READONLY_PASSWORD”]}
    AGENT_DB_ALIAS = “dw_readonly”

Without this alias, `run_readonly` uses the “default” connection (read-only per transaction).

Translated with DeepL.com (free version)
"""

import re

from django.conf import settings
from django.db import connections, transaction

TIMEOUT_MS = 10000

TABLES = {
    "fact_sales", "fact_orders", "dim_date", "dim_client",
    "dim_produit", "dim_localite", "dim_shipping_mode",
}

FORBIDDEN_WORDS = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|attach|pragma|copy|"
    r"into|set|do|call|execute|vacuum|table)\b",
    re.IGNORECASE,
)
SYSTEM_NAMES = re.compile(r"\b(auth_\w+|django_\w+|pg_\w+|information_schema)\b", re.IGNORECASE)


def check_query(query):
    """Renvoie la requête nettoyée, ou lève ValueError avec la raison du refus."""
    query = (query or "").strip().rstrip(";").strip()
    if not query:
        raise ValueError("La requête est vide.")

    # On enlève les textes entre apostrophes pour ne pas les analyser ('%Copy%' par exemple)
    code = re.sub(r"'(?:[^']|'')*'", "''", query)

    if ";" in code:
        raise ValueError("Une seule instruction est autorisée (pas de ';' au milieu).")
    if "--" in code or "/*" in code:
        raise ValueError("Les commentaires SQL ne sont pas autorisés.")
    if "$" in code or "\\" in code:
        raise ValueError("Caractère non autorisé ($ ou \\).")
    if not re.match(r"(select|with)\b", code, flags=re.IGNORECASE):
        raise ValueError("La requête doit commencer par SELECT (ou WITH ... SELECT).")

    forbidden = FORBIDDEN_WORDS.search(code)
    if forbidden:
        raise ValueError(f"Mot interdit : {forbidden.group(1).upper()}. Seules les lectures sont autorisées.")
    if SYSTEM_NAMES.search(code):
        raise ValueError("Les tables système et Django sont inaccessibles.")

    # Tables citées après FROM / JOIN : uniquement celles de l'entrepôt (ou un nom défini par WITH)
    cte_names = {name.lower() for name in re.findall(r"(\w+)\s+as\s*\(", code, flags=re.IGNORECASE)}
    code_for_from = re.sub(r"\b(extract|substring|trim)\s*\([^()]*\)", " ", code, flags=re.IGNORECASE)
    for name in re.findall(r"\b(?:from|join)\s+([\w.\"]+)", code_for_from, flags=re.IGNORECASE):
        name = name.replace('"', "").lower().removeprefix("public.")
        if name not in TABLES and name not in cte_names:
            raise ValueError(f"Table non autorisée : '{name}'. Tables disponibles : {', '.join(sorted(TABLES))}.")

    return query


def run_readonly(sql):
    """Exécute le SQL dans une transaction en lecture seule. Renvoie (colonnes, lignes)."""
    alias = getattr(settings, "AGENT_DB_ALIAS", "default")  # idéalement un rôle PostgreSQL SELECT only
    with transaction.atomic(using=alias):
        with connections[alias].cursor() as cursor:
            cursor.execute("SET LOCAL transaction_read_only = on")
            cursor.execute(f"SET LOCAL statement_timeout = {TIMEOUT_MS}")
            cursor.execute(sql)
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
    return columns, rows