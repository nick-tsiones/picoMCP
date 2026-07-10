# AGENTS.md

## Repository structure

- `packages/core/` (@picomcp/core) — shared PICO-8 cartridge primitives library
- `packages/picoMCP/` (picomcp) — CLI + MCP server for PICO-8 cartridge manipulation

## Required checks before commit

```sh
pnpm run format   # auto-format all files
pnpm run lint     # check for lint errors  
pnpm run typecheck # type-check TypeScript
pnpm run build    # build all packages
pnpm run test     # run all tests
pnpm run ci       # all of the above
```

## Safe editing rules

- Core library functions in `packages/core/src/` must NOT import from `packages/picoMCP/` (no reverse dependencies)
- All public core APIs must be re-exported from `packages/core/src/index.ts`
- CLI commands in `packages/picoMCP/src/commands.ts` must have a corresponding MCP tool in `packages/picoMCP/src/mcp-tools.ts`
- Changing a CLI command's interface requires updating the matching MCP tool definition
- Tests go next to the source: `packages/core/src/asset_svc.test.ts`, `packages/picoMCP/test/cli-smoke.test.ts`

## MCP mutation behavior

The MCP server (`picomcp serve`) exposes filesystem and PICO-8 execution capabilities via JSON-RPC over stdio. Tools that modify cartridges (`picoMCP_write`, `picoMCP_sprite_set`, `picoMCP_sfx_set`, etc.) write directly to disk. Tools that run cartridges (`picoMCP_run`) execute PICO-8 headlessly. Only expose to trusted agents.

## Architecture

- `packages/core/src/cart_repo.ts` — cartridge load/save/overview
- `packages/core/src/static_svc.ts` — size reporting, parsing
- `packages/core/src/static-analysis.ts` — linting, minification
- `packages/core/src/asset_svc.ts` — sprites, map, sfx manipulation
- `packages/core/src/runtime_svc.ts` — headless PICO-8 execution
- `packages/core/src/ref_svc.ts` — PICO-8 API reference data
- `packages/picoMCP/src/commands.ts` — CLI command implementations
- `packages/picoMCP/src/mcp-server.ts` — MCP stdio JSON-RPC server
- `packages/picoMCP/src/dispatch-cli.ts` — CLI argument parsing and dispatch

## Troubleshooting

- Build failures: run `pnpm install` then `pnpm run build`
- Test failures: check PICO-8 binary path and xvfb-run availability
- MCP test timeouts: ensure tests use appropriate timeouts for MCP server startup
