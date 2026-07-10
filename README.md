# picoMCP

A standalone CLI and MCP (Model Context Protocol) server for PICO-8 cartridges — built for AI coding agents to read, write, edit, lint, minify, run, and export PICO-8 programs through a clean, composable tool surface.

```sh
picomcp --version   # picoMCP 0.1.0
picomcp --help      # 31 commands available
picomcp serve        # start MCP server for AI agent integration
```

## Install

```sh
pnpm dlx picomcp --version
npx picomcp --version
```

The canonical binary name is `picomcp` (lowercase) — the package registers it as an npm bin entry.

**Prerequisites**: A licensed PICO-8 binary (`pico-8/pico8`) and `xvfb-run` for headless execution on Linux. Node.js ≥ 24.

### Upgrade

```sh
pnpm dlx picomcp@latest --version
```

### Uninstall

```sh
pnpm store prune                 # for pnpm dlx cache
npm uninstall -g picomcp         # for global npm installs
```

## CLI Usage

### Reading cartridges

```sh
picomcp read mygame.p8 --json           # overview: code, size, assets
picomcp read mygame.p8 --tab 1 --json    # read a single code tab
```

### Writing and editing

```sh
picomcp write mygame.p8 --code="cls()\nprint('hi')" --json
picomcp write mygame.p8 --code="x=1" --tab 2 --json
picomcp edit mygame.p8 range --from 1 --to 3 --code="new lines" --json
picomcp edit mygame.p8 replace --find "old" --replace "new" --json
picomcp edit mygame.p8 append --code="function _draw() end" --json
```

### Static analysis

```sh
picomcp parse mygame.p8 --json           # syntax check with error locations
picomcp lint mygame.p8 --json            # lint for common issues
picomcp size mygame.p8 --json            # token, char, and compressed sizes
picomcp minify mygame.p8 --json          # safe or aggressive minification
```

### Sprites

```sh
picomcp sprite get mygame.p8 --index 1 --json
picomcp sprite set mygame.p8 --index 1 --grid "0,1,2,..." --json
picomcp sprite export mygame.p8 --output sheet.png
picomcp sprite import mygame.p8 --file icon.png --index 0
```

### Map

```sh
picomcp map get mygame.p8 --json
picomcp map set mygame.p8 --x 0 --y 0 --grid "1,2,3,..." --json
picomcp map get-region mygame.p8 --x 0 --y 0 --w 16 --h 16 --json
```

### Sound effects

```sh
picomcp sfx list mygame.p8 --json
picomcp sfx get mygame.p8 --index 0 --json
picomcp sfx set mygame.p8 --index 0 --data='{"notes":[{"pitch":24,"instr":1,"vol":3,"fx":0}],"speed":12,"loopStart":0,"loopEnd":0}' --json
```

### Format conversion

```sh
picomcp convert mygame.p8 --to p8.png                # .p8 → cartridge image
picomcp convert mygame.p8.png --to p8                 # cartridge image → .p8
```

### Sprite flags

```sh
picomcp flags get mygame.p8 --json
picomcp flags set mygame.p8 --sprite 1 --value 255 --json
picomcp flags bulk mygame.p8 --pattern "0,0,1,1,..." --json
```

### Running and exporting

```sh
picomcp run mygame.p8 --json                    # headless execution
picomcp run mygame.p8 --capture screen --frames 60 --json   # with screenshot
picomcp run mygame.p8 --capture gif --frames 120 --json     # animated capture
picomcp export mygame.p8 --to web --output dist/game.html
picomcp export mygame.p8 --to native --output dist/game.bin
```

Note: PICO-8 headless runs seed `srand(1)` for deterministic output. Re-seed in `_init()` if your game needs random variety. A `--capture-at` value greater than the frame count (or a timeout kill with exit code 124) does not mean the capture failed — a partial capture may still be valid.

````

### PICO-8 reference

```sh
picomcp ref api --json          # full PICO-8 API reference
picomcp ref pitfalls --json     # Lua pitfalls guide for PICO-8
````

## MCP Server

Start the MCP server for AI agent integration:

```sh
picomcp serve
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
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' picomcp serve
```

## Development

```sh
git clone https://github.com/nick-tsiones/picoMCP.git
cd picoMCP
corepack pnpm install
corepack pnpm run ci
```

See `AGENTS.md` for architecture, safe editing rules, and troubleshooting.

## Support

- **Node.js**: >= 24
- **PICO-8**: 0.2.7+ (licensed binary required)
- **Platform**: Linux (headless), macOS (headless)
- **Windows**: Not supported (PICO-8 headless requires xvfb-run)

### Versioning

This project follows [Semantic Versioning](https://semver.org). The public API is the CLI command interface and MCP tool definitions.

### Reporting issues

Use [GitHub Issues](https://github.com/nick-tsiones/picoMCP/issues). Include `picomcp --version` output.

## License

MIT
