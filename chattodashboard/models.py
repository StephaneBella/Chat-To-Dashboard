from django.db import models


class DimDate(models.Model):
    # Primary key in YYYYMMDD format
    date_key = models.IntegerField(primary_key=True)
    date = models.DateField(unique=True)
    year = models.PositiveSmallIntegerField(db_column="annee")
    quarter = models.PositiveSmallIntegerField(db_column="trimestre")
    year_quarter = models.CharField(max_length=7, db_column="annee_trimestre")
    month = models.PositiveSmallIntegerField(db_column="mois")
    year_month = models.CharField(max_length=7, db_column="annee_mois")
    month_name = models.CharField(max_length=10, db_column="nom_mois")
    iso_week = models.PositiveSmallIntegerField(db_column="semaine_iso")
    # 1 = Monday ... 7 = Sunday
    weekday = models.PositiveSmallIntegerField(db_column="jour_semaine")

    class Meta:
        db_table = "dim_date"
        ordering = ["date_key"]

    def __str__(self):
        return self.date.isoformat()


class DimProduct(models.Model):
    product_key = models.AutoField(primary_key=True, db_column="produit_key")
    # Not unique in the source: the same id can carry two product names
    product_id = models.CharField(max_length=20)
    product_name = models.CharField(max_length=255)
    sub_category = models.CharField(max_length=50)
    category = models.CharField(max_length=50)

    class Meta:
        db_table = "dim_produit"
        constraints = [
            models.UniqueConstraint(
                fields=["product_id", "product_name"],
                name="unique_product_id_name",
            ),
        ]

    def __str__(self):
        return f"{self.product_id} - {self.product_name}"


class DimLocation(models.Model):
    location_key = models.AutoField(primary_key=True, db_column="localite_key")
    country = models.CharField(max_length=100)
    region = models.CharField(max_length=50)
    state = models.CharField(max_length=100)
    city = models.CharField(max_length=100)
    # Kept as text to preserve leading zeros
    postal_code = models.CharField(max_length=10)

    class Meta:
        db_table = "dim_localite"
        constraints = [
            models.UniqueConstraint(
                fields=["country", "region", "state", "city", "postal_code"],
                name="unique_delivery_location",
            ),
        ]

    def __str__(self):
        return f"{self.city}, {self.state} {self.postal_code}"
