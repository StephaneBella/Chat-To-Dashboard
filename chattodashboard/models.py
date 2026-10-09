from django.db import models

# Create your models here.

# 1. FactSales: This model represents the fact sales data.
class FactSales(models.Model):
    row_id = models.IntegerField(primary_key=True)
    order_id = models.IntegerField()
    order_date_key = models.DateField()
    expiration_date_key = models.DateField()
    client_key = models.IntegerField()
    product_key = models.IntegerField()
    locality_key = models.IntegerField()
    ship_mode_key = models.IntegerField()
    sales = models.FloatField()
    quantity = models.IntegerField()
    discount = models.FloatField()
    profit = models.FloatField()


# 2. FactOrders: This model represents the fact orders data.
class FactOrders(models.Model):
    order_id = models.IntegerField(primary_key=True)
    order_date_key = models.DateField()
    client_key = models.IntegerField()
    ship_mode_key = models.IntegerField()
    order_sales = models.FloatField()
    order_profit = models.FloatField()


# 3. DimDate: This model represents the date dimension data.
class DimDate(models.Model):
    date_key = models.IntegerField(primary_key=True)
    date = models.DateField(unique=True)
    year = models.PositiveSmallIntegerField(db_column="annee")
    quarter = models.PositiveSmallIntegerField(db_column="trimestre")
    year_quarter = models.CharField(max_length=7, db_column="annee_trimestre")
    month = models.PositiveSmallIntegerField(db_column="mois")
    year_month = models.CharField(max_length=7, db_column="annee_mois")
    month_name = models.CharField(max_length=10, db_column="nom_mois")
    iso_week = models.PositiveSmallIntegerField(db_column="semaine_iso")
    weekday = models.PositiveSmallIntegerField(db_column="jour_semaine")

    class Meta:
        db_table = "dim_date"
        ordering = ["date_key"]

    def __str__(self):
        return self.date.isoformat()


# 4. DimProduct: This model represents the product dimension data.
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


# 5. DimLocation: This model represents the location dimension data.
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


# 6. DimClient: This model represents the client dimension data.
class DimClient(models.Model):
    SEGMENTS = {
        "Consumer":"Consumer",
        "Corporate":"Corporate",
        "Home office":"Home office"
    }

    client_key = models.IntegerField(primary_key=True)
    customer_id = models.CharField(max_length=20, unique=True)
    customer_name = models.CharField(max_length=100)
    segment = models.CharField(max_length=20,choices=SEGMENTS)

    class Meta:
        db_table = "dim_client"
        verbose_name = "Client"
        ordering = ["customer_name"]

    def __str__(self):
        return self.customer_name


# 7. DimShippingMode: This model represents the shipping mode dimension data.
class DimShippingMode(models.Model):
    MODES = {
        "First Class": "First Class",
        "Second Class": "Second Class",
        "Standard Class": "Standard Class",
    }
    mode_exp_key = models.CharField(primary_key=True)
    ship_mode = models.CharField(max_length=20, choices=MODES)

    class Meta:
        db_table = "dim_shipping_mode"
        verbose_name = "Shipping Mode"
        ordering = ["ship_mode"]

    def __str__(self):
        return self.ship_mode
