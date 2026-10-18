import pandas as pd


format_data = "%m/%d/%Y"
months= ["Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin", "Juilet", "Aout",
         "Septembre", "Octobre", "Novembre", "Decembre"]

DISCOUNT_BINS = [-1, 0, 0.10, 0.20, 0.30, 0.50, 1]
DISCOUNT_LABELS = ["0 %", "1 à 10 %", "11 à 20 %", "21 à 30 %", "31 à 50 %", "plus de 50 %"]

def create_dimension(sales, columns, key_name):
    dimension = sales[columns].drop_duplicates().reset_index(drop=True)
    dimension[key_name] = dimension.index + 1
    return dimension

def clean_sales(sales):
    sales["order_date"]=pd.to_datetime(sales["order_date"], format= format_data)
    sales["ship_date"] = pd.to_datetime(sales["ship_date"],format = format_data)
    sales["postal_code"]= sales["postal_code"].str.zfill(5)
    return sales

def create_dim_date(sales):
    first_d=min(sales["order_date"].min(), sales["ship_date"].min())
    last_d = max(sales["order_date"].max(),sales["ship_date"].max())
    dim_date = pd.DataFrame({"date":pd.date_range(first_d, last_d)})
    dim_date["date_key"] = dim_date["date"].dt.strftime("%Y%m%d").astype(int)
    dim_date["year"] = dim_date["date"].dt.year
    dim_date["quarter"] = dim_date["date"].dt.quarter
    dim_date["year_quarter"] = dim_date["year"].astype(str) + "-T" + dim_date["quarter"].astype(str)
    dim_date["month"] = dim_date["date"].dt.month
    dim_date["year_month"] = dim_date["date"].dt.strftime("%Y-%m")
    dim_date["month_name"] = dim_date["month"].apply(lambda month: months[month - 1])
    dim_date["iso_week"] = dim_date["date"].dt.isocalendar().week
    dim_date["weekday"] = dim_date["date"].dt.dayofweek + 1
    dim_date["date"] = dim_date["date"].dt.date
    return dim_date

def create_dim_client(sales):
    return create_dimension(sales, ["customer_id", "customer_name", "segment"], "client_key")


def create_dim_product(sales):
    return create_dimension(sales, ["product_id", "product_name", "sub_category", "category"], "product_key")

def create_dim_location(sales):
    return create_dimension(sales, ["country", "region", "state", "city", "postal_code"], "location_key")

def create_dim_shipping_mode(sales):
    return create_dimension(sales, ["ship_mode"], "mode_exp_key")

def create_fact_sales(sales, dim_client, dim_product, dim_location, dim_shipping_mode):
    fact_sales = sales.merge(dim_client, on=["customer_id", "customer_name", "segment"])
    fact_sales = fact_sales.merge(dim_product, on=["product_id", "product_name", "sub_category", "category"])
    fact_sales = fact_sales.merge(dim_location, on=["country", "region", "state", "city", "postal_code"])
    fact_sales = fact_sales.merge(dim_shipping_mode, on="ship_mode")

    fact_sales["order_date_key"] = fact_sales["order_date"].dt.strftime("%Y%m%d").astype(int)
    fact_sales["ship_date_key"] = fact_sales["ship_date"].dt.strftime("%Y%m%d").astype(int)
    fact_sales["ship_mode_key"] = fact_sales["mode_exp_key"]
    fact_sales["discount_tranche"] = pd.cut(fact_sales["discount"], bins=DISCOUNT_BINS, labels=DISCOUNT_LABELS).astype(str)
    fact_sales["discount_amount"] = fact_sales["sales"] * fact_sales["discount"]
    fact_sales["shipping_time"] = (fact_sales["ship_date"] - fact_sales["order_date"]).dt.days.clip(lower=0)
    fact_sales["is_sold_at_a_loss"] = fact_sales["profit"] < 0

    return fact_sales[[
        "row_id", "order_id", "order_date_key", "ship_date_key",
        "client_key", "product_key", "location_key", "ship_mode_key",
        "sales", "quantity", "discount", "discount_tranche", "profit",
        "discount_amount", "shipping_time", "is_sold_at_a_loss",
    ]]

def create_fact_orders(fact_sales):
    fact_orders = fact_sales.groupby("order_id", as_index=False).agg(
        order_date_key=("order_date_key", "first"),
        client_key=("client_key", "first"),
        ship_mode_key=("ship_mode_key", "first"),
        order_sales=("sales", "sum"),
        order_profit=("profit", "sum"),
        number_of_products=("row_id", "count"),
    )
    fact_orders["is_sold_at_a_loss"] = fact_orders["order_profit"] < 0
    return fact_orders
