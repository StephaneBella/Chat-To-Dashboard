
import logging
import os
import tempfile



from django.core.cache import caches
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView


from .models import ChatThread
from .serializers import DashboardQuerySerializer, ETLRefreshSerializer, ChatRequestSerializer
from .services.AGENT.agent import AgentError, run_agent
from .services.AGENT.memory import delete_thread, get_history
from .services.AGENT.results_store import ERR_EXPIRED, load_result, rows_as_dicts
from .services.aggregations import get_all_charts, get_dashboard_options, get_summary_cards
from .services.ETL.extract import SourceFileError
from .services.ETL.run_etl import ETLAlreadyRunning, ensure_dw_loaded, run_etl_safely

logger = logging.getLogger(__name__)

CHAT_LOCK_TTL = 120  # seconds : maximum duration of a question



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




# Chat
class ChatView(APIView):
    """
    POST /api/chat/   {"message": "...", "thread_id": "<uuid, optionnel>"}

    Return {"thread_id", "answer", "chart"}. "chart is null withouth a chart; if not the
    frontend read the lines via /api/chat/threads/<thread_id>/results/<chart.result_id>/.
    """

    permission_classes = [IsAuthenticated]  # No user, no memory
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "chat"

    def post(self, request):
        params = ChatRequestSerializer(data=request.data)
        params.is_valid(raise_exception=True)
        message = params.validated_data.get("thread_id")
        thread_id = params.validated_data.get("thread_id")

        try:
            ensure_dw_loaded() # first call : load the default file if the DW is empty
        except ETLAlreadyRunning:
            return Response(
                {"error": "Chargement des données en cours, réessaie dans quelques secondes."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
                headers={"Retry-After": "10"},
            )

        if thread_id:
            # 404 if the thread doesn't exist or beyonds to another person
            thread = get_object_or_404(ChatThread, id=thread_id, user=request.user)
        else:
            thread = ChatThread.objects.create(user=request.user, title=message[:60])

        # One single question per chat (if not the thread state shuffles)
        # Dedicated alias : the ETL process empty the default cache, not this one
        locks = caches["agent_results"]
        lock_key = f"chat_lock:{thread_id}"
        if not locks.add(lock_key, True, CHAT_LOCK_TTL):
            return Response(
                {"error": "Une question est déjà en cours dans cette conversation."},
                status=status.HTTP_409_CONFLICT,
            )
        try:
            result = run_agent(message, thread, request.user.id)
        except AgentError:
            return Response(
                {"error": "L'assistant est momentanément indisponible. Réessaie dans un instant."},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        finally:
            locks.delete(lock_key)

        thread.save(update_fields=["updated_at"])  # put the conversation at the top of the list
        return Response({"thread_id": str(thread.id), **result})


class ChatThreadListView(APIView):
    """GET /api/chat/threads/ : user's chats, the most recent first of all"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        threads = request.user.chat_threads.all()[:100]
        return Response(
            [{"id": str(t.id), "title": t.title, "updated_at": t.updated_at} for t in threads]
        )


class ChatThreadDetailView(APIView):
    """
    GET /api/chat/threads/<thread_id>/ : last chat messages (text) 
    DELETE /api/chat/threads/<thread_id>/ : delete the conversation and it history
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, thread_id):
        thread = get_object_or_404(ChatThread, id=thread_id, user=request.user)
        return Response({"id": str(thread.id), "title": thread.title, "messages": get_history(thread.id)})

    def delete(self, request, thread_id):
        thread = get_object_or_404(ChatThread, id=thread_id, user=request.user)
        delete_thread(thread)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatResultView(APIView):
    """GET /api/chat/threads/<thread_id>/results/<result_id>/ : chart line."""

    permission_classes = [IsAuthenticated]

    def get(self, request, thread_id, result_id):
        thread = get_object_or_404(ChatThread, id=thread_id, user=request.user)
        result = load_result(thread.id, result_id)
        if result is None:
            return Response({"error": ERR_EXPIRED}, status=status.HTTP_404_NOT_FOUND)
        return Response({"columns": result["columns"], "rows": rows_as_dicts(result)})