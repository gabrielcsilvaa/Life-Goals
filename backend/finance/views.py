from django.http import JsonResponse
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Entry
from .queries import parse_month, snapshot
from .services import COMMANDS, execute, serialize_entry


def health(request):
    return JsonResponse({"status": "ok", "database": "not_checked", "service": "life-goals"})


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
