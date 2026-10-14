from django.core.management.base import BaseCommand
from django.db import transaction

from chattodashboard.ETL.extract import read_file_source
from chattodashboard.ETL.load import load_table
from chattodashboard.ETL.transform import (
    clean_sales,
    create_dim_client,
    create_dim_date,
    create_dim_location,
    create_dim_product,
    create_dim_shipping_mode,
    create_fact_orders,
    create_fact_sales,
)
from chattodashboard.models import (
    DimClient,
    DimDate,
    DimLocation,
    DimProduct,
    DimShippingMode,
    FactOrders,
    FactSales,
)


class Command(BaseCommand):
    help = "Run the ETL process for the data warehouse."

    def handle(self, *args, **options):
        sales = clean_sales(read_file_source())

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
        with transaction.atomic():
            for model, table in tables:
                count = load_table(model, table)
                self.stdout.write(f"loaded {model._meta.db_table}: {count} rows")

        self.stdout.write(self.style.SUCCESS("ETL completed successfully."))
