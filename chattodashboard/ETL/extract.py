import pandas as pd
from django.conf import settings
source_encoding = "cp1252"  # Windows-1252 encoding for the source CSV file
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
class SourceFileError(Exception):
    """Custom exception for source file errors."""
    pass
def read_file_source(source_file = None):
    source_file = source_file or settings.SOURCE_FILE
    raw_sales = pd.read_csv(source_file, encoding= source_encoding, dtype={"Postal Code":str})
    missing_columns = [column for column in columns if column not in raw_sales.columns]
    if missing_columns:
        raise SourceFileError(f"Missing columns in source file: {', '.join(missing_columns)}")
    return raw_sales.rename(columns=columns)

