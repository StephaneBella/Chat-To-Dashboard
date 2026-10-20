from rest_framework import serializers

from .services.aggregations import KPIs
from .services.ETL.extract import SourceFileError, validate_source_header

MAX_CSV_SIZE = 20 * 1024 * 1024 # 20 Mo


class DashboardQuerySerializer(serializers.Serializer):
    """Valid GET /api/static-dasboard request's parameters."""
    kpi = serializers.ChoiceField(choices=list(KPIs), default="profit_margin")


class ETLRefreshSerializer(serializers.Serializer):
    """Valid POST /api/etl/refresh/."""

    mode = serializers.ChoiceField(choices=["append", "replace"], default="append")
    file = serializers.FileField(required=False) 

    def validate_file(self, f):
        if not f.name.lower().endswith(".csv"):
            raise serializers.ValidationError("Le fichier doit etre un .csv.")
        if f.size > MAX_CSV_SIZE:
            raise serializers.ValidationError("Fichier trop volumineux (20 Mo max).")
        try:
            validate_source_header(f) # same 21 columns as the origin file
        except SourceFileError as exc:
            raise serializers.ValidationError(str(exc))
        return f

    def validate(self, attrs):
        if attrs["mode"] == "append" and "file" not in attrs:
            raise serializers.ValidationError({"file": "Un fichier CSV est requis en mode 'append'."})
        return attrs