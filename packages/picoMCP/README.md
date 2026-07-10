# picoMCP

CLI and MCP server for PICO-8 cartridge manipulation.

## CLI

picoMCP provides top-level commands for reading, writing, editing, linting, minifying,
running, and exporting PICO-8 cartridges.

## MCP Server

Start with `picoMCP serve`. Exposes every CLI command as an MCP tool over stdio JSON-RPC.
