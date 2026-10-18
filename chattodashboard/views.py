from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .services.aggregations import get_chart_data, get_dashboard_options, get_kpi_cards


# Create your views here.
@require_GET
def static_dashboard_view(request):
    """
    GET /dashboard/?kpi=profit_margin&dimension=shipping_mode&year=2017
    Warning : the dimension "client" (waterfall) only works with additive metrics (sales, profit, quantity). For a KPI, the API returns a 400 error.
    """

    kpi = request.GET.get("kpi", "profit_margin")
    dimension = request.GET.get("dimension", "time")
    year = request.GET.get("year")

    try:
        year = int(year) if year else None
        data = {
            "options": get_dashboard_options(),
            "kpi_cards": get_kpi_cards(year),
            "chart": get_chart_data(kpi, dimension, year),
        }
    except ValueError as exc:
        return JsonResponse({"error": str (exc)}, status=400)

    return JsonResponse(data)