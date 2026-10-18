from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import DashboardQuerySerializer
from .services.aggregations import get_chart_data, get_dashboard_options, get_kpi_cards


# Create your views here.
class StaticDashboardView(APIView):
    """
    GET api/static-dashboard/?kpi=profit_margin&dimension=shipping_mode&year=2017
    """

    def get(self, request):
        params = DashboardQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True) # Return automatically a detailled 400.
        p = params.validated_data

        year = p.get("year")
        return Response(
            {
                "options": get_dashboard_options(),
                "kpi_cards": get_kpi_cards(year),
                "chart": get_chart_data(p["kpi"], p["dimension"], year),
            }
        ) 