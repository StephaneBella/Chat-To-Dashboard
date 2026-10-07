from django.contrib import admin
from .models import FactSales, FactOrders

# Register your models here.
admin.site.register(FactSales)
admin.site.register(FactOrders)