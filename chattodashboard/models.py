from django.db import models

# Create your models here.
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