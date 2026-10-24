from django.urls import path
from . import views

urlpatterns = [
    path("static-dashboard/", views.StaticDashboardView.as_view(), name="static-dashboard"),
    path("etl/refresh/", views.ETLRefreshView.as_view(), name="etl-refresh"),
    path("chat/", views.ChatView.as_view(), name="chat"),
    path("chat/threads/<uuid:thread_id>/", views.ChatThreadDetailView.as_view(), name="chat-thread"),
    path(
        "chat/threads/<uuid:thread_id>/results/<str:result_id>/",
        views.ChatResultView.as_view(),
        name="chat-result",
    ),
]