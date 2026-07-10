# Contributing to picoMCP

## Setup

```sh
git clone https://github.com/nick-tsiones/picoMCP.git
cd picoMCP
corepack pnpm install
corepack pnpm run build
```

## Development workflow

1. Create a branch from `main`
2. Make changes in `packages/core/` or `packages/picoMCP/`
3. Run `pnpm run ci` to verify format, lint, typecheck, build, and tests
4. Commit and open a pull request

## Code standards

- TypeScript strict mode
- All public APIs must be exported from `packages/core/src/index.ts`
- CLI commands must have a corresponding MCP tool
- Tests required for new features and bug fixes
- Run `pnpm run format` before committing

## Package structure

- `packages/core/` — shared PICO-8 cartridge primitives library
- `packages/picoMCP/` — CLI + MCP server (the product)

## Reporting issues

Use GitHub Issues. Include:

- picoMCP version (`picomcp --version`)
- PICO-8 version
- Steps to reproduce
- Expected vs actual behavior
