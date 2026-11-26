"""Vendor-neutral MCP adapter with personal tokens and OAuth-bound access tokens."""

import hashlib
import os
from typing import Any

from asgiref.sync import sync_to_async
from django.conf import settings
from django.utils import timezone
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken
from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations
from rest_framework.exceptions import APIException

from finance import schemas
from finance.models import Entry
from finance.queries import parse_month, snapshot
from finance.services import execute, month_bounds, serialize_entry

from .models import Connection


class DatabaseTokenVerifier:
    @sync_to_async
    def verify_token(self, token):
        obj = (
            Connection.objects.select_related("user")
            .filter(
                token_hash=hashlib.sha256(token.encode()).hexdigest(),
                revoked_at=None,
                expires_at__gt=timezone.now(),
                user__is_active=True,
            )
            .first()
        )
        if obj is None:
            from oauth2_provider.models import AccessToken as OAuthAccessToken

            oauth = (
                OAuthAccessToken.objects.select_related("user")
                .filter(
                    token_checksum=hashlib.sha256(token.encode()).hexdigest(),
                    expires__gt=timezone.now(),
                    user__is_active=True,
                )
                .first()
            )
            if oauth is None or oauth.resource != [settings.MCP_PUBLIC_URL]:
                return None
            obj = Connection.objects.filter(
                user=oauth.user,
                oauth_application_id=oauth.application_id,
                revoked_at=None,
                expires_at__gt=timezone.now(),
            ).first()
            if obj is None:
                return None
            scopes = sorted(set(oauth.scope.split()) & set(obj.scopes))
        else:
            scopes = obj.scopes
        Connection.objects.filter(pk=obj.pk).update(last_used_at=timezone.now())
        return AccessToken(
            token=token,
            client_id=str(obj.pk),
            subject=str(obj.user_id),
            scopes=scopes,
            expires_at=int(obj.expires_at.timestamp()),
            resource=settings.MCP_PUBLIC_URL,
        )


verifier = DatabaseTokenVerifier()
mcp = FastMCP(
    "Life Goals",
    stateless_http=True,
    json_response=True,
    instructions="Controle financeiro pessoal. Valores monetários são strings decimais em BRL. Planejamento não é pagamento nem aporte realizado. Consulte IDs antes de escrever; peça esclarecimento em ambiguidades. Use a mesma idempotency_key ao repetir uma operação. Não registre pagamentos bancários reais: estas ferramentas apenas mantêm registros no aplicativo.",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[*settings.ALLOWED_HOSTS, "localhost:*", "127.0.0.1:*"],
        allowed_origins=settings.CORS_ALLOWED_ORIGINS,
    ),
)
READ = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)
WRITE = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)


async def actor(required_scope):
    access = get_access_token()
    raw = access.token if access else os.getenv("LIFEGOALS_MCP_TOKEN", "")
    verified = await verifier.verify_token(raw)
    if not verified or required_scope not in verified.scopes:
        raise ToolError("Conexão inválida, expirada, revogada ou sem a permissão necessária.")
    connection = await sync_to_async(Connection.objects.select_related("user").get)(pk=verified.client_id)
    return connection.user, f"mcp:{connection.pk}"


async def run_command(operation, payload, key):
    user, source = await actor("finance:write")
    try:
        return await sync_to_async(execute)(user, operation, payload.model_dump(mode="json"), key, source)
    except APIException as exc:
        raise ToolError(str(exc.detail)) from None


@mcp.tool(annotations=READ)
async def get_financial_summary(month: str) -> dict[str, Any]:
    """Consulta saldos e critérios. month deve ser AAAA-MM. Não inclui receitas futuras como saldo."""
    user, _ = await actor("finance:read")
    try:
        data = await sync_to_async(snapshot)(user, parse_month(month))
    except APIException as exc:
        raise ToolError(str(exc.detail)) from None
    return {key: data[key] for key in ["month", "as_of", "summary", "criteria", "accounts", "categories"]}


@mcp.tool(annotations=READ)
async def list_transactions(month: str, limit: int = 50, offset: int = 0) -> dict[str, Any]:
    """Lista lançamentos próprios por mês de vencimento; paginação até 200 itens."""
    user, _ = await actor("finance:read")
    if not 1 <= limit <= 200 or offset < 0:
        raise ToolError("Use limit entre 1 e 200 e offset não negativo.")

    @sync_to_async
    def query():
        from finance.services import ensure_recurring_month

        start, end = month_bounds(parse_month(month))
        ensure_recurring_month(user, start)
        rows = Entry.objects.filter(user=user, due_date__range=(start, end))
        return {"count": rows.count(), "items": [serialize_entry(e) for e in rows[offset : offset + limit]]}

    try:
        return await query()
    except APIException as exc:
        raise ToolError(str(exc.detail)) from None


@mcp.tool(annotations=READ)
async def get_financial_goals(month: str) -> dict[str, Any]:
    """Retorna metas, saldo efetivamente reservado e plano do mês AAAA-MM."""
    user, _ = await actor("finance:read")
    try:
        data = await sync_to_async(snapshot)(user, parse_month(month))
    except APIException as exc:
        raise ToolError(str(exc.detail)) from None
    return {"month": data["month"], "goals": data["goals"]}


@mcp.tool(annotations=WRITE)
async def create_transaction(payload: schemas.EntryInput, idempotency_key: str) -> dict[str, Any]:
    """Registra receita/despesa. paid_on só quando o usuário informar realização; não efetua pagamento bancário."""
    return await run_command("create_transaction", payload, idempotency_key)


@mcp.tool(annotations=READ)
async def list_card_invoices(month: str) -> dict[str, Any]:
    """Consulta totais e pagamentos das faturas no mês AAAA-MM, sem duplicar compras e liquidações."""
    user, _ = await actor("finance:read")
    try:
        data = await sync_to_async(snapshot)(user, parse_month(month))
    except APIException as exc:
        raise ToolError(str(exc.detail)) from None
    return {"month": data["month"], "cards": data["cards"]}


@mcp.tool(annotations=READ)
async def list_recurring_expenses(month: str) -> dict[str, Any]:
    """Consulta regras de recorrência próprias. Não gera compromissos nem registra pagamentos."""
    user, _ = await actor("finance:read")
    try:
        data = await sync_to_async(snapshot)(user, parse_month(month))
    except APIException as exc:
        raise ToolError(str(exc.detail)) from None
    return {"rules": data["recurring"]}


@mcp.tool(annotations=WRITE)
async def set_goal_plan(payload: schemas.GoalPlanInput, idempotency_key: str) -> dict[str, Any]:
    """Define aporte planejado do mês. Não registra dinheiro efetivamente reservado."""
    return await run_command("set_goal_plan", payload, idempotency_key)


@mcp.tool(annotations=WRITE)
async def create_card_purchase(payload: schemas.PurchaseInput, idempotency_key: str) -> dict[str, Any]:
    """Registra compra no cartão e suas parcelas. Exige vencimento inicial confirmado pelo usuário."""
    return await run_command("create_card_purchase", payload, idempotency_key)


@mcp.tool(annotations=WRITE)
async def create_financial_goal(payload: schemas.GoalInput, idempotency_key: str) -> dict[str, Any]:
    """Cria uma meta com saldo realizado zero. Criar meta não reserva dinheiro."""
    return await run_command("create_goal", payload, idempotency_key)


@mcp.tool(annotations=WRITE)
async def allocate_goal_funds(payload: schemas.AllocationInput, idempotency_key: str) -> dict[str, Any]:
    """Reserva/retira dinheiro registrado para uma meta; exige conta de origem. Não transfere dinheiro no banco."""
    return await run_command("allocate_goal_funds", payload, idempotency_key)


@mcp.tool(annotations=WRITE)
async def update_transaction(payload: schemas.EntryUpdate, idempotency_key: str) -> dict[str, Any]:
    """Edita lançamento aberto com controle de versão. Não altera lançamentos liquidados ou parcelas."""
    return await run_command("update_transaction", payload, idempotency_key)
