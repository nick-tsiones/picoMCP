export const HELP_TEXT = `picoMCP - PICO-8 Cartridge CLI and MCP Server

Usage: picomcp <command> [options]

Cartridge management:
  picomcp init <file> [--json]
      Create a new PICO-8 cartridge with boilerplate _init/_update/_draw code.

Reading cartridges:
  picomcp read <file> [--json]
  picomcp read <file> --tab <n> [--json]

Writing cartridges:
  picomcp write <file> --code <lua> [--tab <n>] [--json]
  picomcp write <file> --code-file <path.lua> [--tab <n>] [--json]

Editing cartridges:
  picomcp edit <file> range --from <n> --to <n> --code <lua> [--json]
  picomcp edit <file> replace --find <text> --replace <text> [--json]
  picomcp edit <file> append --code <lua> [--json]
  picomcp edit <file> insert --at <n> --code <lua> [--json]
  picomcp edit <file> delete --from <n> --to <n> [--json]

Analysis:
  picomcp check <file> [--json]      Run parse + lint + size in one call
  picomcp parse <file> [--json]
  picomcp lint <file> [--json]
  picomcp size <file> [--json]
  picomcp minify <file> [--rename] [--json]

Assets:
  Sprites (n is 0-based, 0-255):
    picomcp sprite get <file> --index <n> [--json]
    picomcp sprite set <file> --index <n> --pixels <64-values> [--json]
    picomcp sprite get-range <file> --start <n> --end <n> [--json]
    picomcp sprite set-range <file> --sprites <json> [--json]
    picomcp sprite fill <file> --index <n> --color <0-15> [--json]
    picomcp sprite fill-range <file> --start <n> --end <n> --colors <0-15,...> [--json]
    picomcp sprite copy <file> --from <n> --to <n> [--json]
    picomcp sprite mirror <file> --index <n> [--horizontal] [--vertical] [--json]
    picomcp sprite preview <file> --index <n> [--ansi] [--json]
    picomcp sprite draw-rect <file> --index <n> --x <n> --y <n> --width <n> --height <n> --color <0-15> [--stroke] [--json]
    picomcp sprite draw-circle <file> --index <n> --cx <n> --cy <n> --radius <n> --color <0-15> [--stroke] [--json]
    picomcp sprite draw-line <file> --index <n> --x1 <n> --y1 <n> --x2 <n> --y2 <n> --color <0-15> [--json]
    picomcp sprite export <file> --output <path.png> [--json]
    picomcp sprite import <file> --input <path.png> [--json]

  Map (x/y are 1-based for get/set; 0-based for fill/draw):
    picomcp map get <file> --x <n> --y <n> [--json]
    picomcp map set <file> --x <n> --y <n> --tile <1-256> [--json]
    picomcp map get-region <file> --x <n> --y <n> --width <n> --height <n> [--json]
    picomcp map set-region <file> --x <n> --y <n> --values <json> [--json]
    picomcp map fill <file> --x <n> --y <n> --width <n> --height <n> --tile <1-256> [--json]
    picomcp map draw-line <file> --x1 <n> --y1 <n> --x2 <n> --y2 <n> --tile <1-256> [--width <n>] [--json]
    picomcp map draw-circle <file> --cx <n> --cy <n> --radius <n> --tile <1-256> [--json]

  Sound Effects (n is 0-based, 0-63):
    picomcp sfx get <file> --index <n> [--json]
    picomcp sfx set <file> --index <n> --data <json> [--json]
    picomcp sfx tone <file> --index <n> --notes "C4,E4,G4" [--instr <0-15>] [--vol <0-7>] [--fx <0-7>] [--speed <n>] [--json]
    picomcp sfx list <file> [--json]

  Flags:
    picomcp flags get <file> [--json]
    picomcp flags set <file> --sprite <n> --value <n> [--json]
    picomcp flags bulk <file> --pattern <values> [--json]

Runtime:
  picomcp run <file> [--pico8 <path>] [--frames <n>] [--capture none|screen|gif] [--capture-at <n>] [--timeout-ms <n>] [--param <s>] [--json]
  picomcp export <file> --to web|native [--pico8 <path>] [--output <path>] [--json]

Conversion:
  picomcp convert <file> --to p8.png|p8 [--output <path>] [--json]

Reference:
  picomcp ref api [--json]
  picomcp ref pitfalls [--json]

MCP Server:
  picomcp serve

Environment:
  PICOMCP_ROOT   Override project root directory
  PICO8_BIN      Path to PICO-8 binary

Tip: Use --option="value" form to pass values that start with hyphens or contain
     special characters, e.g. --code="-- comment\\ncls()"

Global options:
  --json     Output results as JSON
  --root     Override project root directory (also: PICOMCP_ROOT env var)
  --help     Show command help
  --version  Show version number`;
