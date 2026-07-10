export const HELP_TEXT = `picoMCP - PICO-8 Cartridge CLI and MCP Server

Usage: picoMCP <command> [options]

Reading cartridges:
  picoMCP read <file> [--json]
  picoMCP read <file> --tab <n> [--json]

Writing cartridges:
  picoMCP write <file> --code <lua> [--tab <n>] [--json]

Editing cartridges:
  picoMCP edit <file> range --from <n> --to <n> --code <lua> [--json]
  picoMCP edit <file> replace --find <text> --replace <text> [--json]
  picoMCP edit <file> append --code <lua> [--json]

Analysis:
  picoMCP parse <file> [--json]
  picoMCP lint <file> [--json]
  picoMCP size <file> [--json]
  picoMCP minify <file> [--rename] [--json]

Assets:
  picoMCP sprite get <file> --index <n> [--json]    (n is 0-based, 0-255)
  picoMCP sprite set <file> --index <n> --pixels <64-values> [--json]    (n is 0-based, 0-255)
  picoMCP sprite get-range <file> --start <n> --end <n> [--json]    (0-based)
  picoMCP sprite set-range <file> --sprites <json> [--json]
  picoMCP sprite export <file> --output <path.png> [--json]
  picoMCP sprite import <file> --input <path.png> [--json]
  picoMCP map get <file> --x <n> --y <n> [--json]
  picoMCP map set <file> --x <n> --y <n> --tile <n> [--json]
  picoMCP map get-region <file> --x <n> --y <n> --width <n> --height <n> [--json]
  picoMCP map set-region <file> --x <n> --y <n> --values <json> [--json]
  picoMCP sfx get <file> --index <n> [--json]    (n is 0-based, 0-63)
  picoMCP sfx set <file> --index <n> --data <json> [--json]    (n is 0-based, 0-63)
  picoMCP sfx list <file> [--json]
  picoMCP flags get <file> [--json]
  picoMCP flags set <file> --sprite <n> --value <n> [--json]
  picoMCP flags bulk <file> --pattern <values> [--json]

Runtime:
  picoMCP run <file> [--pico8 <path>] [--frames <n>] [--capture none|screen|gif] [--capture-at <n>] [--param <s>] [--json]
  Note: headless runs seed srand(1) for deterministic behavior. Re-seed in _init for variety.
  picoMCP export <file> --to web|native [--pico8 <path>] [--output <path>] [--json]

Conversion:
  picoMCP convert <file> --to p8.png|p8 [--output <path>] [--json]

Reference:
  picoMCP ref api [--json]
  picoMCP ref pitfalls [--json]

MCP Server:
  picoMCP serve

Global options:
  --json     Output results as JSON
  --help     Show command help
  --version  Show version number`;
