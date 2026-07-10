# picoMCP

Standalone CLI and MCP server for PICO-8 cartridge manipulation. Provides 31 top-level commands for reading, writing, editing, analyzing, running, and exporting PICO-8 cartridges — plus an MCP stdio server that exposes every command as an AI-callable tool.

```sh
picomcp --version   # picoMCP 0.1.0
picomcp --help      # full command listing
picomcp serve        # start MCP server (31 tools over JSON-RPC stdio)
```

## Commands

### Reading

| Command                                  | Description                                     |
| ---------------------------------------- | ----------------------------------------------- |
| `picomcp read <file> [--json]`           | Cartridge overview (code, tabs, tokens, assets) |
| `picomcp read <file> --tab <n> [--json]` | Read a single code tab                          |

### Writing

| Command                                                  | Description                               |
| -------------------------------------------------------- | ----------------------------------------- |
| `picomcp write <file> --code=<lua> [--tab <n>] [--json]` | Write code to a new or existing cartridge |

### Editing

| Command                                                               | Description          |
| --------------------------------------------------------------------- | -------------------- |
| `picomcp edit <file> range --from <n> --to <n> --code=<lua> [--json]` | Replace a line range |
| `picomcp edit <file> replace --find <text> --replace <text> [--json]` | Find and replace     |
| `picomcp edit <file> append --code=<lua> [--json]`                    | Append code          |

### Analysis

| Command                          | Description                                   |
| -------------------------------- | --------------------------------------------- |
| `picomcp parse <file> [--json]`  | Lua syntax check with error locations         |
| `picomcp lint <file> [--json]`   | Lint for common PICO-8 code issues            |
| `picomcp size <file> [--json]`   | Token count, character count, compressed size |
| `picomcp minify <file> [--json]` | Minify code (safe or aggressive mode)         |

### Sprites

| Command                                                          | Description                  |
| ---------------------------------------------------------------- | ---------------------------- |
| `picomcp sprite get <file> --index <n> [--json]`                 | Read sprite as color grid    |
| `picomcp sprite set <file> --index <n> --grid <values> [--json]` | Write sprite from grid       |
| `picomcp sprite get-range <file> [--json]`                       | Read sprite range            |
| `picomcp sprite set-range <file> [--json]`                       | Write sprite range           |
| `picomcp sprite export <file> --output <path>`                   | Export sprite sheet as PNG   |
| `picomcp sprite import <file> --file <path> [--index <n>]`       | Import sprite sheet from PNG |

### Map

| Command                                                                  | Description      |
| ------------------------------------------------------------------------ | ---------------- |
| `picomcp map get <file> [--json]`                                        | Read full map    |
| `picomcp map set <file> --x <n> --y <n> --grid <values> [--json]`        | Paint map region |
| `picomcp map get-region <file> --x <n> --y <n> --w <n> --h <n> [--json]` | Read map region  |
| `picomcp map set-region <file> [--json]`                                 | Set map region   |

### Sound

| Command                                                     | Description                |
| ----------------------------------------------------------- | -------------------------- |
| `picomcp sfx list <file> [--json]`                          | List all sound effects     |
| `picomcp sfx get <file> --index <n> [--json]`               | Read sound effect as notes |
| `picomcp sfx set <file> --index <n> --data <json> [--json]` | Write sound effect         |

### Flags

| Command                                                      | Description            |
| ------------------------------------------------------------ | ---------------------- |
| `picomcp flags get <file> [--json]`                          | Read all sprite flags  |
| `picomcp flags set <file> --sprite <n> --value <n> [--json]` | Set single sprite flag |
| `picomcp flags bulk <file> --pattern <values> [--json]`      | Bulk set all 256 flags |

### Runtime

| Command                                                     | Description               |
| ----------------------------------------------------------- | ------------------------- |
| `picomcp run <file> [--json]`                               | Run cartridge headlessly  |
| `picomcp run <file> --capture screen --frames <n> [--json]` | Run with screenshot       |
| `picomcp run <file> --capture gif --frames <n> [--json]`    | Run with animated capture |
| `picomcp run <file> --trace <vars> [--json]`                | Run with variable tracing |
| `picomcp run <file> --buttons <json> [--json]`              | Run with scripted inputs  |
| `picomcp export <file> --to web --output <path>`            | Export web build          |
| `picomcp export <file> --to native --output <path>`         | Export native binary      |

Note: Headless runs seed `srand(1)` for deterministic behavior. Re-seed in `_init()` for random variety. A timeout kill (exit code 124) does not mean the capture failed — a partial capture may still be valid.

### Conversion

| Command                              | Description                      |
| ------------------------------------ | -------------------------------- |
| `picomcp convert <file> --to p8.png` | Convert .p8 to cartridge image   |
| `picomcp convert <file> --to p8`     | Extract .p8 from cartridge image |

### Reference

| Command                         | Description                   |
| ------------------------------- | ----------------------------- |
| `picomcp ref api [--json]`      | PICO-8 API function reference |
| `picomcp ref pitfalls [--json]` | Lua pitfalls guide            |

### MCP Server

| Command         | Description                              |
| --------------- | ---------------------------------------- |
| `picomcp serve` | Start MCP stdio server with all 31 tools |

## MCP Integration

The MCP server exposes every CLI command as a tool with the `picoMCP_` prefix. Send `tools/list` to discover available tools, `tools/call` to invoke them.

Example MCP tools/call for reading a cartridge:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "picoMCP_read",
    "arguments": { "filePath": "mygame.p8" }
  }
}
```

## Security

### Trust model

picoMCP's MCP server executes with the same filesystem permissions as the invoking user.
All cartridge paths are validated against the project root boundary. Headless PICO-8
execution runs in an isolated temporary directory.

- **Filesystem**: Only paths within the project directory are readable/writable
- **Execution**: PICO-8 runs in a sandboxed temp directory, deleted after each run
- **Network**: No network access provided through picoMCP

Only expose `picomcp serve` to trusted agents and environments.

## Dependencies

- Node.js ≥ 24
- PICO-8 licensed binary (for `run` and `export` commands)
- `xvfb-run` (Linux, for headless PICO-8 execution)
