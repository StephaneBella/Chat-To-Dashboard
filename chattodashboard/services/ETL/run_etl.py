import pandas as pd
from django.core.cache import cache
from django.db import transaction

from chattodashboard.models import (
    DimClient, DimLocation, DimDate, DimShippingMode,
    DimProduct, FactOrders, FactSales
)

from .extract import read_file_source
from .load import load_table
from .transform import (
    clean_sales, create_dim_client, create_dim_date, create_dim_location,
    create_dim_product, create_dim_shipping_mode, create_fact_orders, create_fact_sales
)

ETL_LOCK_KEY = 'etl_running'
MODES = ("replace", "append")


# source format columns -> path in the DW
EXISTING_FIELDS = {
    "row_id": "row_id",
    "order_id": "order_id",
    "order_date": "order_date__date",
    "ship_date": "ship_date__date",
    "ship_mode": "shipping_mode__ship_mode",
    "customer_id": "client__customer_id",
    "customer_name": "client__customer_name",
    "segment": "client__segment",
    "country": "locality__country",
    "region": "locality__region",
    "state": "locality__state",
    "city": "locality__city",
    "postal_code": "locality__postal_code",
    "product_id": "product__product_id",
    "product_name": "product__product_name",
    "sub_category": "product__sub_category",
    "category": "product__category",
    "sales": "sales",
    "quantity": "quantity",
    "discount": "discount",
    "profit": "profit",
}


class ETLAlreadyRunning(Exception):
    """Un ETL est déjà en cours d'éxécution"""


def read_existing_sales():
    """Reread the DW in the form of the source file (one line per command line)"""
    rows = list(FactSales.objects.values_list(*EXISTING_FIELDS.values()))
    df = pd.DataFrame.from_records(rows, columns=list(EXISTING_FIELDS))
    df["order_date"] = pd.to_datetime(df["order_date"])
    df["ship_date"] = pd.to_datetime(df["ship_date"])
    return df


def prepare_sales(source_file, mode):
    """Return (data to transform, fusion statistics)"""
    new = clean_sales(read_file_source(source_file))
    stats = {"mode": mode, "rows_added": len(new), "rows_skipped": 0, "orders_skipped": 0}

    if mode == "replace":
        return new, stats

    existing = read_existing_sales()
    if existing.empty:
        return new, stats

    already_loaded = new["order_id"].isin(set(existing["order_id"]))
    fresh = new[~already_loaded].copy()
    stats.update(
        rows_added=len(fresh),
        rows_skipped=int(already_loaded.sum()),
        orders_skipped=int(new.loc[already_loaded, "order_id"].nunique()),
    )

    start = int(existing["row_id"].max()) + 1
    fresh["row_id"] = range(start, start + len(fresh))
    return pd.concat([existing, fresh], ignore_index=True), stats



def run_etl(source_file=None, mode="replace"):
    """
    replace : replace all the DW (default file if source_file is None)

    append  : add to the DW, orders that are not in the source_file
    """
    if mode not in MODES:
        raise ValueError(f"Mode inconnu : {mode}")

    sales, stats = prepare_sales(source_file, mode)
    if stats["rows_added"] == 0:
        return {**stats, "loaded": {}}  # no news : we don't touch the DW

    dim_date = create_dim_date(sales)
    dim_client = create_dim_client(sales)
    dim_product = create_dim_product(sales)
    dim_location = create_dim_location(sales)
    dim_shipping_mode = create_dim_shipping_mode(sales)

    fact_sales = create_fact_sales(sales, dim_client, dim_product, dim_location, dim_shipping_mode)
    fact_orders = create_fact_orders(fact_sales)

    tables = [
        (DimDate, dim_date),
        (DimClient, dim_client),
        (DimProduct, dim_product),
        (DimLocation, dim_location),
        (DimShippingMode, dim_shipping_mode),
        (FactSales, fact_sales),
        (FactOrders, fact_orders),
    ]

    loaded = {}
    # All or nothing : if an insertion fail, the DW stay in his previous state
    with transaction.atomic():
        for model, _ in reversed(tables):      # Facts first (FK PROTECT)
            model.objects.all().delete()
        for model, table in tables:            # Dimensions first
            loaded[model._meta.db_table] = load_table(model, table)
    return {**stats, "loaded": loaded}


def run_etl_safely(source_file=None, mode="replace"):
    """run_etl() avec verrou anti-concurrence + invalidation du cache."""
    if not cache.add(ETL_LOCK_KEY, True, timeout=600):
        raise ETLAlreadyRunning()
    try:
        result = run_etl(source_file, mode)
        cache.clear()  # the dashboard should reflect the new data
        return result
    finally:
        cache.delete(ETL_LOCK_KEY)


def ensure_dw_loaded():
    """Load the default file if the DW is empty (first call)"""
    if not FactSales.objects.exists():
        run_etl_safely()