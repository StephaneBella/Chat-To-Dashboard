from rest_framework import serializers

from .services.aggregations import KPIs


class DashboardQuerySerializer(serializers.Serializer):
    """Valid GET /api/static-dasboard request's parameters."""
    kpi = serializers.ChoiceField(choices=list(KPIs), default="profit_margin")