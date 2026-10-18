from rest_framework import serializers

from .services.aggregations import DIMENSIONS, KPIs


class DashboardQuerySerializer(serializers.Serializer):
    """Valid /api/static-dasboard request's parameters."""
    kpi = serializers.ChoiceField(choices=list(KPIs), default="profit_margin")
    dimension = serializers.IntegerField(required=False, min_value=2014, max_value=2017)

    def validate(self, attrs):
        kpi_cfg = KPIs[attrs["kpi"]]
        chart_type = DIMENSIONS[attrs["dimension"]]["chart_type"]

        # Waterfall & donut work only with additive metrics
        if chart_type in ("waterfall", "donut") and not kpi_cfg["additive"]:
            raise serializers.ValidationError(
                f"'{attrs['kpi']}' n'est pas additif : impossible de l'afficher"
                f"en {chart_type}. Choisis sales, profit ou quantity, "
                f"ou une autre dimension."
            )

        return attrs