# picoMCP

A standalone CLI and MCP (Model Context Protocol) server for PICO-8 cartridges — built for AI coding agents to read, write, edit, lint, minify, run, and export PICO-8 programs through a clean, composable tool surface.

```sh
picoMCP --version   # picoMCP 0.1.0
picoMCP --help      # 31 commands available
picoMCP serve        # start MCP server for AI agent integration
```

## Install

```sh
git clone https://github.com/nick-tsiones/picoMCP.git
cd picoMCP
corepack pnpm install
corepack pnpm run build
```

The `picoMCP` binary is at `packages/picoMCP/dist/index.mjs`. Add it to your PATH or alias it:

```sh
alias picoMCP="node $(pwd)/packages/picoMCP/dist/index.mjs"
```

Requires a licensed PICO-8 binary in `pico-8/pico8` and `xvfb-run` for headless execution on Linux.

## CLI Usage

### Reading cartridges

```sh
picoMCP read mygame.p8 --json           # overview: code, size, assets
picoMCP read mygame.p8 --tab 1 --json    # read a single code tab
```

### Writing and editing

```sh
picoMCP write mygame.p8 --code "cls()\nprint('hi')" --json
picoMCP write mygame.p8 --code "x=1" --tab 2 --json
picoMCP edit mygame.p8 range --from 1 --to 3 --code "new lines" --json
picoMCP edit mygame.p8 replace --find "old" --replace "new" --json
picoMCP edit mygame.p8 append --code "function _draw() end" --json
```

### Static analysis

```sh
picoMCP parse mygame.p8 --json           # syntax check with error locations
picoMCP lint mygame.p8 --json            # lint for common issues
picoMCP size mygame.p8 --json            # token, char, and compressed sizes
picoMCP minify mygame.p8 --json          # safe or aggressive minification
```

### Sprites

```sh
picoMCP sprite get mygame.p8 --index 1 --json
picoMCP sprite set mygame.p8 --index 1 --grid "0,1,2,..." --json
picoMCP sprite export mygame.p8 --output sheet.png
picoMCP sprite import mygame.p8 --file icon.png --index 0
```

### Map

```sh
picoMCP map get mygame.p8 --json
picoMCP map set mygame.p8 --x 0 --y 0 --grid "1,2,3,..." --json
picoMCP map get-region mygame.p8 --x 0 --y 0 --w 16 --h 16 --json
```

### Sound effects

```sh
picoMCP sfx list mygame.p8 --json
picoMCP sfx get mygame.p8 --index 0 --json
picoMCP sfx set mygame.p8 --index 0 --notes "C4,E4,G4" --json
```

### Format conversion

```sh
picoMCP convert mygame.p8 --to p8.png                # .p8 → cartridge image
picoMCP convert mygame.p8.png --to p8                 # cartridge image → .p8
```

### Sprite flags

```sh
picoMCP flags get mygame.p8 --json
picoMCP flags set mygame.p8 --sprite 1 --value 255 --json
picoMCP flags bulk mygame.p8 --pattern "0,0,1,1,..." --json
```

### Running and exporting

```sh
picoMCP run mygame.p8 --json                    # headless execution
picoMCP run mygame.p8 --capture screen --frames 60 --json   # with screenshot
picoMCP run mygame.p8 --capture gif --frames 120 --json     # animated capture
picoMCP export mygame.p8 --to web --output dist/game.html
picoMCP export mygame.p8 --to native --output dist/game.bin
```

### PICO-8 reference

```sh
picoMCP ref api --json          # full PICO-8 API reference
picoMCP ref pitfalls --json     # Lua pitfalls guide for PICO-8
```

## MCP Server

Start the MCP server for AI agent integration:

```sh
picoMCP serve
```

The server speaks JSON-RPC 2.0 over stdio. All 31 CLI commands are exposed as MCP tools with matching names (`picoMCP_read`, `picoMCP_write`, `picoMCP_run`, etc.).

### Configuration (Claude Desktop)

```json
{
  "mcpServers": {
    "picoMCP": {
      "command": "node",
      "args": ["/path/to/picoMCP/packages/picoMCP/dist/index.mjs", "serve"]
    }
  }
}
```

### Configuration (Codex / other MCP clients)

```json
{
  "mcpServers": {
    "picoMCP": {
      "command": "node",
      "args": ["/path/to/picoMCP/packages/picoMCP/dist/index.mjs", "serve"],
      "env": {
        "PICO8_BIN": "/path/to/pico-8/pico8"
      }
    }
  }
}
```

### Quick MCP test

```sh
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | picoMCP serve
```

## Development

This project is built and tracked using a local-first DAG ledger for evidence-backed agentic development. The `qd` (qdcli) binary manages the DAG — see `DAG_STATUS.md` for current state, `docs/` for qdcli documentation.

## License

Proprietary.
