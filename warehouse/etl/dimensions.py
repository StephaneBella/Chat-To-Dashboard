import pandas as pd


def build_date_dimension(sales):
    first_day = min(sales["order_date"].min(), sales["ship_date"].min())
    last_day = max(sales["order_date"].max(), sales["ship_date"].max())

    # Full years so that every month and quarter is complete
    calendar_days = pd.date_range(
        start=f"{first_day.year}-01-01",
        end=f"{last_day.year}-12-31",
        freq="D",
    )

    dim_date = pd.DataFrame({"full_date": calendar_days})
    dim_date["date_key"] = dim_date["full_date"].dt.strftime("%Y%m%d").astype(int)
    dim_date["day_of_month"] = dim_date["full_date"].dt.day
    dim_date["day_of_week"] = dim_date["full_date"].dt.dayofweek + 1
    dim_date["day_name"] = dim_date["full_date"].dt.day_name()
    dim_date["week_of_year"] = dim_date["full_date"].dt.isocalendar().week.astype(int)
    dim_date["month_number"] = dim_date["full_date"].dt.month
    dim_date["month_name"] = dim_date["full_date"].dt.month_name()
    dim_date["quarter"] = dim_date["full_date"].dt.quarter
    dim_date["quarter_label"] = "Q" + dim_date["quarter"].astype(str)
    dim_date["year"] = dim_date["full_date"].dt.year
    dim_date["year_month"] = dim_date["full_date"].dt.strftime("%Y-%m")
    dim_date["is_weekend"] = dim_date["day_of_week"] >= 6

    dim_date["full_date"] = dim_date["full_date"].dt.date
    first_columns = ["date_key", "full_date"]
    other_columns = [column for column in dim_date.columns if column not in first_columns]
    return dim_date[first_columns + other_columns]


def build_product_dimension(sales):
    # A product_id is not unique in the source: a few ids are shared by two
    # different product names, so the grain is the (id, name) pair.
    dim_product = (
        sales[["product_id", "product_name", "category", "sub_category"]]
        .drop_duplicates(subset=["product_id", "product_name"])
        .sort_values(["category", "sub_category", "product_id", "product_name"])
        .reset_index(drop=True)
    )
    dim_product.insert(0, "product_key", dim_product.index + 1)
    return dim_product


def build_location_dimension(sales):
    location_columns = ["country", "region", "state", "city", "postal_code"]

    # One postal code can cover two cities, hence the full combination as grain
    dim_location = (
        sales[location_columns]
        .drop_duplicates()
        .sort_values(location_columns)
        .reset_index(drop=True)
    )
    dim_location.insert(0, "location_key", dim_location.index + 1)
    return dim_location
