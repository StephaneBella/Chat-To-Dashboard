from django.db import models

# Create your models here.

# 1. FactSales: This model represents the fact sales data.
class FactSales(models.Model):
    # Grain: one row per order line
    row_id = models.IntegerField(primary_key=True)
    order_id = models.IntegerField()

    # Date dimensions
    order_date = models.ForeignKey(
        'DimDate', on_delete=models.CASCADE,
        db_column='order_date_key',
        related_name="sales_by_order_date",
        )
    
    ship_date = models.ForeignKey(
        "DimDate",
        on_delete=models.PROTECT,
        to_field="date_key",
        db_column="ship_date_key",
        related_name="sales_by_ship_date",
    )

    # Other dimensions
    client = models.ForeignKey(
        "DimClient",
        on_delete=models.PROTECT,
        db_column="client_key",
        related_name="sales",
    )

    product = models.ForeignKey(
        "DimProduct",
        on_delete=models.PROTECT,
        db_column="product_key",
        related_name="sales",
    )

    locality = models.ForeignKey(
        "DimLocation",
        on_delete=models.PROTECT,
        db_column="locality_key",
        related_name="sales",
    )

    shipping_mode = models.ForeignKey(
        "DimShippingMode",
        on_delete=models.PROTECT,
        db_column="ship_mode_key",
        related_name="sales",
    )

    # Measures
    sales = models.FloatField()
    quantity = models.IntegerField()
    discount = models.FloatField()
    profit = models.FloatField()
    discount_amount = models.FloatField()
    shipping_time = models.PositiveIntegerField()
    is_sold_at_a_loss = models.BooleanField()

    class Meta:
        db_table = 'fact_sales'
        ordering = ['row_id']

    def __str__(self):
        return f"FactSales({self.row_id})"




# 2. FactOrders: This model represents the fact orders data.
class FactOrders(models.Model):
    # Grain: one row per order
    order_id = models.IntegerField(primary_key=True)

    order_date = models.ForeignKey(
        "DimDate",
        on_delete=models.PROTECT,
        to_field="date_key",
        db_column="order_date_key",
        related_name="orders_by_order_date",
    )
    client = models.ForeignKey(
        "DimClient",
        on_delete=models.PROTECT,
        db_column="client_key",
        related_name="orders",
    )
    shipping_mode = models.ForeignKey(
        "DimShippingMode",
        on_delete=models.PROTECT,
        db_column="ship_mode_key",
        related_name="orders",
    )

    # Aggregated measures
    order_sales = models.DecimalField()
    order_profit = models.FloatField()
    number_of_products = models.PositiveIntegerField()
    is_sold_at_a_loss = models.BooleanField()

    class Meta:
        db_table = 'fact_orders'
        ordering = ['order_id']

    def __str__(self):
        return f"FactOrders({self.order_id})"


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
    ship_mode_key = models.AutoField(primary_key=True)
    ship_mode = models.CharField(max_length=20, choices=MODES)

    class Meta:
        db_table = "dim_shipping_mode"
        verbose_name = "Shipping Mode"
        ordering = ["ship_mode"]

    def __str__(self):
        return self.ship_mode

