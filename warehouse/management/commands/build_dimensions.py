from django.conf import settings
from django.core.management.base import BaseCommand

from warehouse.etl.dimensions import (
    build_date_dimension,
    build_location_dimension,
    build_product_dimension,
)
from warehouse.ingestion.source_file import load_source_sales


class Command(BaseCommand):
    help = "Build dim_date, dim_produit and dim_localite from the Superstore file."

    def handle(self, *args, **options):
        sales = load_source_sales()
        self.stdout.write(f"{len(sales)} rows read from {settings.SOURCE_FILE.name}")

        settings.WAREHOUSE_DIRECTORY.mkdir(parents=True, exist_ok=True)

        dimensions = {
            "dim_date": build_date_dimension(sales),
            "dim_produit": build_product_dimension(sales),
            "dim_localite": build_location_dimension(sales),
        }
        for table_name, table in dimensions.items():
            output_file = settings.WAREHOUSE_DIRECTORY / f"{table_name}.csv"
            table.to_csv(output_file, index=False, encoding="utf-8")
            self.stdout.write(f"{table_name}: {len(table)} rows -> {output_file.name}")

        self.stdout.write(self.style.SUCCESS("Dimensions built."))
