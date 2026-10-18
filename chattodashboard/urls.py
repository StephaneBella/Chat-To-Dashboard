from django.urls import path
from . import views

urlpatterns = [
    path("static-dashboard/", views.StaticDashboardView.as_view(), name="static-dashboard"),
]