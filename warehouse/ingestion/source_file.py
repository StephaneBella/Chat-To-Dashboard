import pandas as pd
from django.conf import settings

# The Kaggle export is encoded in Windows-1252, not UTF-8
SOURCE_ENCODING = "cp1252"
SOURCE_DATE_FORMAT = "%m/%d/%Y"

SOURCE_COLUMNS = {
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


class SourceFileError(Exception):
    pass


def check_source_columns(raw_sales):
    missing_columns = [column for column in SOURCE_COLUMNS if column not in raw_sales.columns]
    if missing_columns:
        raise SourceFileError(f"Missing columns in source file: {', '.join(missing_columns)}")


def clean_sales(sales):
    text_columns = sales.select_dtypes(include=["object", "string"]).columns
    for column in text_columns:
        sales[column] = sales[column].str.strip()

    sales["order_date"] = pd.to_datetime(sales["order_date"], format=SOURCE_DATE_FORMAT)
    sales["ship_date"] = pd.to_datetime(sales["ship_date"], format=SOURCE_DATE_FORMAT)

    sales["row_id"] = sales["row_id"].astype(int)
    sales["quantity"] = sales["quantity"].astype(int)
    for column in ["sales", "discount", "profit"]:
        sales[column] = sales[column].astype(float)

    # Postal codes stay as text; the export dropped the leading zeros (5401 -> 05401)
    sales["postal_code"] = sales["postal_code"].str.zfill(5)
    return sales


def load_source_sales(source_file=None):
    """Read the Superstore file (never modified) and return a cleaned copy in memory."""
    source_file = source_file or settings.SOURCE_FILE
    raw_sales = pd.read_csv(source_file, encoding=SOURCE_ENCODING, dtype={"Postal Code": str})
    check_source_columns(raw_sales)
    sales = raw_sales.rename(columns=SOURCE_COLUMNS)
    return clean_sales(sales)
