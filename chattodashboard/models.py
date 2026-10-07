from django.db import models

# Create your models here.
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


class FactOrders(models.Model):
    order_id = models.IntegerField(primary_key=True)
    order_date_key = models.DateField()
    client_key = models.IntegerField()
    ship_mode_key = models.IntegerField()
    order_sales = models.FloatField()
    order_profit = models.FloatField()

    