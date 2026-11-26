"""Only MCP and OAuth are exposed; the mobile REST API stays on the LAN."""

import re

from starlette.responses import PlainTextResponse

PUBLIC_PATHS = {
    "/mcp",
    "/oauth/login/",
    "/oauth/authorize/",
    "/oauth/token/",
    "/oauth/revoke_token/",
    "/oauth/register/",
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
}


class PublicBoundary:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path not in PUBLIC_PATHS and not re.fullmatch(r"/oauth/register/[A-Za-z0-9._~-]+/", path):
                return await PlainTextResponse("Not found", status_code=404)(scope, receive, send)
            headers = dict(scope.get("headers", []))
            try:
                length = int(headers.get(b"content-length", b"0"))
            except ValueError:
                length = -1
            if length < 0 or length > 65536:
                return await PlainTextResponse("Request too large", status_code=413)(scope, receive, send)
            if scope.get("method") == "POST":
                body = bytearray()
                while True:
                    event = await receive()
                    if event["type"] == "http.disconnect":
                        return
                    body.extend(event.get("body", b""))
                    if len(body) > 65536:
                        return await PlainTextResponse("Request too large", status_code=413)(
                            scope, receive, send
                        )
                    if not event.get("more_body", False):
                        break
                received = False
                original_receive = receive

                async def bounded_receive():
                    nonlocal received
                    if not received:
                        received = True
                        return {"type": "http.request", "body": bytes(body), "more_body": False}
                    return await original_receive()

                receive = bounded_receive
            # Uvicorn binds this process only to 127.0.0.1. TLS is terminated by cloudflared.
            scope = {**scope, "scheme": "https"}
        await self.app(scope, receive, send)
