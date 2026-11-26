"""Local MCP transport. Credentials come from the environment, never CLI arguments."""

import os

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from .mcp_server import mcp

if __name__ == "__main__":
    if not os.getenv("LIFEGOALS_MCP_TOKEN"):
        raise SystemExit("Defina LIFEGOALS_MCP_TOKEN com uma conexão válida.")
    mcp.run(transport="stdio")
