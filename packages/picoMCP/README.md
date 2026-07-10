# picoMCP

Standalone CLI and MCP server for PICO-8 cartridge manipulation. Provides 31 top-level commands for reading, writing, editing, analyzing, running, and exporting PICO-8 cartridges — plus an MCP stdio server that exposes every command as an AI-callable tool.

```sh
picoMCP --version   # picoMCP 0.1.0
picoMCP --help      # full command listing
picoMCP serve        # start MCP server (31 tools over JSON-RPC stdio)
```

## Commands

### Reading
| Command | Description |
|---------|-------------|
| `picoMCP read <file> [--json]` | Cartridge overview (code, tabs, tokens, assets) |
| `picoMCP read <file> --tab <n> [--json]` | Read a single code tab |

### Writing
| Command | Description |
|---------|-------------|
| `picoMCP write <file> --code <lua> [--tab <n>] [--json]` | Write code to a new or existing cartridge |

### Editing
| Command | Description |
|---------|-------------|
| `picoMCP edit <file> range --from <n> --to <n> --code <lua> [--json]` | Replace a line range |
| `picoMCP edit <file> replace --find <text> --replace <text> [--json]` | Find and replace |
| `picoMCP edit <file> append --code <lua> [--json]` | Append code |

### Analysis
| Command | Description |
|---------|-------------|
| `picoMCP parse <file> [--json]` | Lua syntax check with error locations |
| `picoMCP lint <file> [--json]` | Lint for common PICO-8 code issues |
| `picoMCP size <file> [--json]` | Token count, character count, compressed size |
| `picoMCP minify <file> [--json]` | Minify code (safe or aggressive mode) |

### Sprites
| Command | Description |
|---------|-------------|
| `picoMCP sprite get <file> --index <n> [--json]` | Read sprite as color grid |
| `picoMCP sprite set <file> --index <n> --grid <values> [--json]` | Write sprite from grid |
| `picoMCP sprite get-range <file> [--json]` | Read sprite range |
| `picoMCP sprite set-range <file> [--json]` | Write sprite range |
| `picoMCP sprite export <file> --output <path>` | Export sprite sheet as PNG |
| `picoMCP sprite import <file> --file <path> [--index <n>]` | Import sprite sheet from PNG |

### Map
| Command | Description |
|---------|-------------|
| `picoMCP map get <file> [--json]` | Read full map |
| `picoMCP map set <file> --x <n> --y <n> --grid <values> [--json]` | Paint map region |
| `picoMCP map get-region <file> --x <n> --y <n> --w <n> --h <n> [--json]` | Read map region |
| `picoMCP map set-region <file> [--json]` | Set map region |

### Sound
| Command | Description |
|---------|-------------|
| `picoMCP sfx list <file> [--json]` | List all sound effects |
| `picoMCP sfx get <file> --index <n> [--json]` | Read sound effect as notes |
| `picoMCP sfx set <file> --index <n> --notes <values> [--json]` | Write sound effect |

### Flags
| Command | Description |
|---------|-------------|
| `picoMCP flags get <file> [--json]` | Read all sprite flags |
| `picoMCP flags set <file> --sprite <n> --value <n> [--json]` | Set single sprite flag |
| `picoMCP flags bulk <file> --pattern <values> [--json]` | Bulk set all 256 flags |

### Runtime
| Command | Description |
|---------|-------------|
| `picoMCP run <file> [--json]` | Run cartridge headlessly |
| `picoMCP run <file> --capture screen --frames <n> [--json]` | Run with screenshot |
| `picoMCP run <file> --capture gif --frames <n> [--json]` | Run with animated capture |
| `picoMCP run <file> --trace <vars> [--json]` | Run with variable tracing |
| `picoMCP run <file> --input <json|@file.json> [--json]` | Run with scripted button injection |

Example with scripted inputs:
```sh
picoMCP run mygame.p8 --input '[{"frame":30,"hold":[4]},{"frame":60,"hold":[5]}]'
picoMCP run mygame.p8 --input @inputs.json
```
Where `inputs.json` contains an array of `{frame, hold}` entries with PICO-8 button numbers (0=left, 1=right, 2=up, 3=down, 4=X, 5=O).
| `picoMCP export <file> --to web --output <path>` | Export web build |
| `picoMCP export <file> --to native --output <path>` | Export native binary |

### Conversion
| Command | Description |
|---------|-------------|
| `picoMCP convert <file> --to p8.png` | Convert .p8 to cartridge image |
| `picoMCP convert <file> --to p8` | Extract .p8 from cartridge image |

### Reference
| Command | Description |
|---------|-------------|
| `picoMCP ref api [--json]` | PICO-8 API function reference |
| `picoMCP ref pitfalls [--json]` | Lua pitfalls guide |

### MCP Server
| Command | Description |
|---------|-------------|
| `picoMCP serve` | Start MCP stdio server with all 31 tools |

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

## Dependencies

- Node.js ≥ 22
- PICO-8 licensed binary (for `run` and `export` commands)
- `xvfb-run` (Linux, for headless PICO-8 execution)
