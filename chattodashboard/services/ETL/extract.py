import csv

import pandas as pd
from django.conf import settings

# utf-8 at the first time, then cp1252 secondly : a cp1252 with accents isn't a valid utf-8 
ENCODINGS = ("utf-8-sig", "cp1252")

columns = {
    "Row ID": "row_id",
    "Order ID": "order_id",
    "Order Date": "order_date",
    "Ship Date": "ship_date",
    "Ship Mode": "ship_mode",
    "Customer ID": "customer_id",
    "Customer Name": "customer_name",
    "Segment": "segment",
    "Country": "country",
    "City": "city",
    "State": "state",
    "Postal Code": "postal_code",
    "Region": "region",
    "Product ID": "product_id",
    "Category": "category",
    "Sub-Category": "sub_category",
    "Product Name": "product_name",
    "Sales": "sales",
    "Quantity": "quantity",
    "Discount": "discount",
    "Profit": "profit",
}
NUMERIC_COLUMNS = ["sales", "quantity", "discount", "profit"]


class SourceFileError(Exception):
    """Custom exception for source file errors."""



def check_columns(names):
    missing = [c for c in columns if c not in names]
    if missing:
        raise SourceFileError(f"Colonnes manquantes : {', '.join(missing)}")


def validate_source_header(file_obj):
    """Verify an uploaded file's header (only the first line, quickly)"""
    file_obj.seek(0)
    first_line = file_obj.readline()
    file_obj.seek(0)
    for encoding in ENCODINGS:
        try:
            header = first_line.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise SourceFileError("Encodage du fichier non reconnu (utf-8 ou cp1252 attendu).")
    check_columns([name.strip() for name in next(csv.reader([header]), [])])


def read_csv(source):
    for encoding in ENCODINGS:
        try:
            return pd.read_csv(source, encoding=encoding, dtype={"Postal Code": str})
        except UnicodeDecodeError:
            continue
        except (pd.errors.EmptyDataError, pd.errors.ParserError) as exc:
            raise SourceFileError(f"CSV illisible : {exc}")

    raise SourceFileError("Encodage du fichier non reconnu (utf-8 ou cp1252 attendu).")



def read_file_source(source_file = None):
    source_file = source_file or settings.SOURCE_FILE
    raw = read_csv(source_file)
    check_columns(raw.columns)
    raw = raw.rename(columns=columns).dropna(how="all")

    if raw.empty:
        raise SourceFileError("Le fichier ne contient aucune ligne.")
    if raw[list(columns.values())].isna().any().any():
        bad = raw.columns[raw.isna().any()].tolist()
        raise SourceFileError(f"Valeurs manquantes dans : {', '.join(bad)}")

    for col in NUMERIC_COLUMNS:
        try:
            raw[col] = pd.to_numeric(raw[col])
        except (ValueError, TypeError):
            raise SourceFileError(f"La colonne '{col}' doit etre numérique.")
    if not raw["discount"].between(0, 1).all():
        raise SourceFileError("La colonne 'discount' doit etre comprise entre 0 et 1.")
    return raw

