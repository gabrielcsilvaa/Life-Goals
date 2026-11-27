from django.conf import settings
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.http import JsonResponse
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Entry
from .queries import parse_month, snapshot
from .services import COMMANDS, execute, serialize_entry


def health(request):
    return JsonResponse(
        {
            "status": "ok",
            "database": "not_checked",
            "service": "life-goals",
            "version": getattr(settings, "APP_VERSION", "development"),
        }
    )


def ready(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        executor = MigrationExecutor(connection)
        pending = executor.migration_plan(executor.loader.graph.leaf_nodes())
        if pending:
            return JsonResponse({"status": "not_ready"}, status=503)
    except Exception:
        return JsonResponse({"status": "not_ready"}, status=503)
    return JsonResponse({"status": "ready", "version": getattr(settings, "APP_VERSION", "development")})


class SnapshotView(APIView):
    def get(self, request):
        return Response(snapshot(request.user, parse_month(request.query_params.get("month", ""))))


class CommandView(APIView):
    def post(self, request, operation):
        return Response(
            execute(request.user, operation, request.data, request.headers.get("Idempotency-Key")), status=200
        )


class TransactionListView(APIView):
    def get(self, request):
        from .services import ensure_recurring_month, month_bounds

        start, end = month_bounds(parse_month(request.query_params.get("month", "")))
        ensure_recurring_month(request.user, start)
        rows = Entry.objects.filter(user=request.user, due_date__range=(start, end))
        paginator = LimitOffsetPagination()
        paginator.max_limit = 200
        page = paginator.paginate_queryset(rows, request)
        return paginator.get_paginated_response([serialize_entry(e) for e in page])


class SchemaView(APIView):
    def get(self, request):
        return Response({name: schema.model_json_schema() for name, (schema, _) in COMMANDS.items()})
