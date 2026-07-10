export const HELP_TEXT = `picoMCP - PICO-8 Cartridge CLI and MCP Server

Usage: picomcp <command> [options]

Reading cartridges:
  picomcp read <file> [--json]
  picomcp read <file> --tab <n> [--json]

Writing cartridges:
  picomcp write <file> --code <lua> [--tab <n>] [--json]

Editing cartridges:
  picomcp edit <file> range --from <n> --to <n> --code <lua> [--json]
  picomcp edit <file> replace --find <text> --replace <text> [--json]
  picomcp edit <file> append --code <lua> [--json]

Analysis:
  picomcp parse <file> [--json]
  picomcp lint <file> [--json]
  picomcp size <file> [--json]
  picomcp minify <file> [--rename] [--json]

Assets:
  picomcp sprite get <file> --index <n> [--json]    (n is 0-based, 0-255)
  picomcp sprite set <file> --index <n> --pixels <64-values> [--json]    (n is 0-based, 0-255)
  picomcp sprite get-range <file> --start <n> --end <n> [--json]    (0-based)
  picomcp sprite set-range <file> --sprites <json> [--json]
  picomcp sprite export <file> --output <path.png> [--json]
  picomcp sprite import <file> --input <path.png> [--json]
  picomcp map get <file> --x <n> --y <n> [--json]
  picomcp map set <file> --x <n> --y <n> --tile <n> [--json]
  picomcp map get-region <file> --x <n> --y <n> --width <n> --height <n> [--json]
  picomcp map set-region <file> --x <n> --y <n> --values <json> [--json]
  picomcp sfx get <file> --index <n> [--json]    (n is 0-based, 0-63)
  picomcp sfx set <file> --index <n> --data <json> [--json]    (n is 0-based, 0-63)
  picomcp sfx list <file> [--json]
  picomcp flags get <file> [--json]
  picomcp flags set <file> --sprite <n> --value <n> [--json]
  picomcp flags bulk <file> --pattern <values> [--json]

Runtime:
  picomcp run <file> [--pico8 <path>] [--frames <n>] [--capture none|screen|gif] [--capture-at <n>] [--param <s>] [--json]
  Note: headless runs seed srand(1) for deterministic behavior. Re-seed in _init for variety.
  picomcp export <file> --to web|native [--pico8 <path>] [--output <path>] [--json]

Conversion:
  picomcp convert <file> --to p8.png|p8 [--output <path>] [--json]

Reference:
  picomcp ref api [--json]
  picomcp ref pitfalls [--json]

MCP Server:
  picomcp serve

Tip: Use --option="value" form to pass values that start with hyphens or contain
     special characters, e.g. --code="-- comment\ncls()"

Global options:
  --json     Output results as JSON
  --help     Show command help
  --version  Show version number`;
