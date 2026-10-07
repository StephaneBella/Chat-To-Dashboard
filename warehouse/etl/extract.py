import pandas as pd
from django.conf import settings

# The Superstore export is not UTF-8 (some product names contain Windows-1252 characters)
SOURCE_ENCODING = "cp1252"

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


def read_sales_file(source_file=None):
    source_file = source_file or settings.SOURCE_FILE
    sales = pd.read_csv(
        source_file,
        encoding=SOURCE_ENCODING,
        dtype={"Postal Code": str},
    )
    sales = sales.rename(columns=SOURCE_COLUMNS)

    sales["order_date"] = pd.to_datetime(sales["order_date"], format="%m/%d/%Y")
    sales["ship_date"] = pd.to_datetime(sales["ship_date"], format="%m/%d/%Y")
    # Leading zeros are lost in the export (e.g. 5401 instead of 05401)
    sales["postal_code"] = sales["postal_code"].str.zfill(5)

    return sales
