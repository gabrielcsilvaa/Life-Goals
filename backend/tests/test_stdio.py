import os
import sys
from pathlib import Path

import anyio
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


def test_official_mcp_client_initializes_stdio_and_discovers_tools():
    """Protocol discovery needs no database; real authorization is exercised over HTTP."""

    async def check():
        parameters = StdioServerParameters(
            command=sys.executable,
            args=["-m", "integrations.stdio"],
            cwd=str(Path(__file__).resolve().parents[1]),
            env={
                **os.environ,
                "DJANGO_SETTINGS_MODULE": "config.test_settings",
                "LIFEGOALS_MCP_TOKEN": "test-placeholder-not-a-real-token",
            },
        )
        async with stdio_client(parameters) as (reader, writer):
            async with ClientSession(reader, writer) as session:
                initialization = await session.initialize()
                assert initialization.serverInfo.name == "Life Goals"
                tools = await session.list_tools()
                names = {tool.name for tool in tools.tools}
                assert {"get_financial_summary", "create_transaction", "list_card_invoices"} <= names

    anyio.run(check)
