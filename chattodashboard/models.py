from django.db import models

# Create your models here.
class FactSales(models.Model):
    row_id = models.IntegerField(primary_key=True)
    order_id = models.CharField(max_length=50)
    order_date_key = models.DateField()
    expiration_date_key = models.DateField()
    client_key = models.IntegerField()
    product_key = models.IntegerField()
    locality_key = models.IntegerField()
    ship_mode_key = models.IntegerField()
    sales = models.FloatField()
    quantity = models.IntegerField()
    discount = models.FloatField()
    discount_tranche = models.CharField(max_length=50)
    profit = models.FloatField()
    discount_amount = models.FloatField()
    shipping_time = models.IntegerField()
    is_sold_at_a_loss = models.BooleanField()

    class Meta:
        db_table = 'fact_sales'
        ordering = ['row_id']

    def __str__(self):
        return f"FactSales({self.row_id})"




class FactOrders(models.Model):
    order_id = models.CharField(max_length=50, primary_key=True)
    order_date_key = models.DateField()
    client_key = models.IntegerField()
    ship_mode_key = models.IntegerField()
    order_sales = models.FloatField()
    order_profit = models.FloatField()
    number_of_products = models.IntegerField()
    is_sold_at_a_loss = models.BooleanField()

    class Meta:
        db_table = 'fact_orders'
        ordering = ['order_id']

    def __str__(self):
        return f"FactOrders({self.order_id})"