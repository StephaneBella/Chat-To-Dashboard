
import logging
import os
import tempfile


from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import DashboardQuerySerializer, ETLRefreshSerializer
from .services.aggregations import get_all_charts, get_dashboard_options, get_summary_cards
from .services.ETL.extract import SourceFileError
from .services.ETL.run_etl import ETLAlreadyRunning, ensure_dw_loaded, run_etl_safely

logger = logging.getLogger(__name__)

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

class ETLRefreshView(APIView):
    """
    POST /api/etl/refresh/   (multipart/form-data, optional field "file")

    - withouth file : rerun te ETL process with the default file (SOURCE_FILE)
    - with a csv : replace all the DW by the new file's content (only for admin)
    """

    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = ETLRefreshSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mode = serializer.validated_data["mode"]
        uploaded = serializer.validated_data.get("file")

        tmp_path = None
        try :
            if uploaded:
                with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
                    for chunk in uploaded.chunks():
                        tmp.write(chunk)
                    tmp_path = tmp.name

            summary = run_etl_safely(tmp_path, mode)

        except ETLAlreadyRunning:
            return Response(
                {"error": "Un ETL est déjà en cours d'exécution."},
                status=status.HTTP_409_CONFLICT,
            )
        except (SourceFileError, FileNotFoundError, ValueError, KeyError, UnicodeDecodeError) as exc:
            # Missing columns, bad format for dates, unreadable CSV
            # Nothing were modified : the transformation comes before the loading
            return Response(
                {"error": f"Fichier invalide : {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception("ETL failed")
            return Response(
                {"error": "L'ETL a échoué, aucune donnée n'a été modifiée."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.remove(tmp_path)

        return Response({"status": "success", **summary})