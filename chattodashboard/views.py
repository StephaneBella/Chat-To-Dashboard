from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import DashboardQuerySerializer
from .services.aggregations import get_all_charts, get_dashboard_options, get_summary_cards


# Create your views here.
class StaticDashboardView(APIView):
    """
    GET api/static-dashboard/?kpi=profit_margin

    - kpi : profit_margin | weighted_discount | loss_order_rate

    Return on the entire dataset:
    - Options : KPIs and dimensions (for the selector)
    - Kpi_cards : the three global KPIs
    - metric_cards : CA total and montant total des remises
    - charts : one chart per dimension, for the selected KPI
    """

    # Only 3 possible responses, that only change at the DW refreshing
    @method_decorator(cache_page(60 * 60))
    def get(self, request):
        params = DashboardQuerySerializer(data=request.query_params)
        params.is_valid(raise_exception=True)
        kpi = params.validated_data['kpi']

        return Response(
            {
                "options": get_dashboard_options(),
                "kpi_cards": kpi,
                **get_summary_cards(),
                "charts": get_all_charts(kpi),
            }
        ) 