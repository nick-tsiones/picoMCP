# picoMCP

A toolbox for agent-authored PICO-8 programs — an MCP server + CLI that exposes low-level, composable primitives for reading, writing, editing, linting, minifying, and running PICO-8 cartridges headlessly.

## What it does

- **Read** cartridges (overview, individual code tabs, assets)
- **Write/edit** code (line ranges, find-and-replace, append, per-tab)
- **Parse and lint** PICO-8 Lua code
- **Minify** code (safe and aggressive modes, size optimization)
- **Edit assets** (sprites, sprite flags, map, sound effects)
- **Import/export sprite sheets** as PNG images
- **Convert cartridge formats** (.p8 ↔ .p8.png)
- **Run cartridges headlessly** with screenshots, animations, telemetry, and tracing
- **Export distributables** (web builds, native binaries)
- **Reference data** (PICO-8 API reference, Lua pitfalls guide)

## Architecture

picoMCP exposes two surfaces:

- **CLI** (`picoMCP`) — for direct shell use and scripting
- **MCP server** — for use with AI coding agents (Claude, etc.)

## Development

This project is built and tracked using qdcli, a local-first DAG ledger for evidence-backed agentic development. See `DAG_STATUS.md` for the current implementation state.

### Dependencies

- Python 3.11+
- PICO-8 (licensed binary, `pico-8/` directory)
- xvfb-run (for headless Linux execution)

### Status

**22/22 DAG nodes complete (52/52 points)** — all planned picoMCP features are implemented and verified.

## License

Proprietary.
