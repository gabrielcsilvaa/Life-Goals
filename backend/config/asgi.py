import os
from contextlib import asynccontextmanager

from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
from django.core.asgi import get_asgi_application

django_app = get_asgi_application()

from mcp.server.auth.middleware.auth_context import AuthContextMiddleware
from mcp.server.auth.middleware.bearer_auth import BearerAuthBackend, RequireAuthMiddleware
from starlette.applications import Starlette
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.routing import Mount

from integrations.mcp_server import mcp, verifier

http_mcp = mcp.streamable_http_app()
secured_mcp = AuthenticationMiddleware(
    AuthContextMiddleware(RequireAuthMiddleware(http_mcp, required_scopes=[])),
    backend=BearerAuthBackend(verifier),
)


class Dispatch:
    async def __call__(self, scope, receive, send):
        target = secured_mcp if scope.get("path", "").rstrip("/") == "/mcp" else django_app

        async def advertise(message):
            if (
                target is secured_mcp
                and message["type"] == "http.response.start"
                and message["status"] == 401
            ):
                headers = [(k, v) for k, v in message.get("headers", []) if k.lower() != b"www-authenticate"]
                headers.append(
                    (
                        b"www-authenticate",
                        f'Bearer resource_metadata="{settings.OAUTH_PUBLIC_ORIGIN}/.well-known/oauth-protected-resource/mcp"'.encode(),
                    )
                )
                message = {**message, "headers": headers}
            await send(message)

        await target(scope, receive, advertise)


@asynccontextmanager
async def lifespan(app):
    async with mcp.session_manager.run():
        yield


application = Starlette(routes=[Mount("/", app=Dispatch())], lifespan=lifespan)
