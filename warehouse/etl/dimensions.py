import pandas as pd

FRENCH_MONTH_NAMES = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
]


def add_sequential_key(dimension, key_name):
    dimension = dimension.reset_index(drop=True)
    dimension.insert(0, key_name, dimension.index + 1)
    return dimension


def build_date_dimension(sales):
    # Continuous calendar covering both order and ship dates
    first_day = min(sales["order_date"].min(), sales["ship_date"].min())
    last_day = max(sales["order_date"].max(), sales["ship_date"].max())
    calendar_days = pd.Series(pd.date_range(first_day, last_day, freq="D"))

    dim_date = pd.DataFrame({
        "date_key": calendar_days.dt.strftime("%Y%m%d").astype(int),
        "date": calendar_days.dt.date,
        "annee": calendar_days.dt.year,
        "trimestre": calendar_days.dt.quarter,
    })
    dim_date["annee_trimestre"] = (
        dim_date["annee"].astype(str) + "-T" + dim_date["trimestre"].astype(str)
    )
    dim_date["mois"] = calendar_days.dt.month
    dim_date["annee_mois"] = calendar_days.dt.strftime("%Y-%m")
    dim_date["nom_mois"] = dim_date["mois"].map(lambda month: FRENCH_MONTH_NAMES[month - 1])
    dim_date["semaine_iso"] = calendar_days.dt.isocalendar().week.astype(int)
    dim_date["jour_semaine"] = calendar_days.dt.dayofweek + 1
    return dim_date


def build_product_dimension(sales):
    # Product ID is not unique in the source: a few ids carry two names
    dim_produit = sales[["product_id", "product_name", "sub_category", "category"]]
    dim_produit = dim_produit.drop_duplicates(subset=["product_id", "product_name"])
    return add_sequential_key(dim_produit, "produit_key")


def build_location_dimension(sales):
    # A postal code can cover more than one city, so the whole address is the grain
    dim_localite = sales[["country", "region", "state", "city", "postal_code"]]
    dim_localite = dim_localite.drop_duplicates()
    return add_sequential_key(dim_localite, "localite_key")
