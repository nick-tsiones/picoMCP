# Environment and Capability Detection — Acceptance Proof

## Behavior 1: capabilities-are-reported-when-pico-8-is-present

**CLI Surface**: `qd toolbox capabilities --json` (with PICO_8 binary present)

### Real Execution

```javascript
// Create a fake pico8 binary
const { writeFile, chmod } = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { mkdtemp } = require("node:fs/promises");

const root = await mkdtemp(path.join(os.tmpdir(), "acc-"));
const pico8Bin = path.join(root, "pico8");
await writeFile(pico8Bin, "#!/bin/sh\nexit 0\n");
await chmod(pico8Bin, 0o755);
```

### Invocation

```
PICO8_BIN=<tempdir>/pico8 qd --root <tempdir> toolbox capabilities --json
```

### Captured Output

```json
{
  "capabilities": {
    "static": [
      "code editing",
      "sprite editing",
      "map editing",
      "sfx editing",
      "flag editing",
      "linting",
      "minification",
      "format conversion",
      "size reporting"
    ],
    "runtime": [
      "running cartridges",
      "exporting builds"
    ]
  },
  "commands": [
    { "command": "cart overview", "description": "Read an overview of a cartridge" },
    { "command": "cart tab", "description": "Read a single tab of code" },
    { "command": "cart size", "description": "Report cartridge size against PICO-8 limits" },
    { "command": "cart parse", "description": "Parse and validate cartridge code syntax" },
    { "command": "cart write", "description": "Write code to a cartridge tab" },
    { "command": "cart run", "description": "Check whether a cartridge can run in this environment" },
    { "command": "cart lint", "description": "Lint cartridge code for common issues" },
    { "command": "cart convert", "description": "Convert between .p8 and .p8.png formats" },
    { "command": "cart minify", "description": "Minify cartridge code" },
    { "command": "cart edit range", "description": "Replace a specific range of lines in a cartridge" },
    { "command": "cart edit replace", "description": "Find and replace text in a cartridge" },
    { "command": "cart edit append", "description": "Append code to the end of a cartridge" },
    { "command": "cart flags get", "description": "Read all sprite flags" },
    { "command": "cart flags set", "description": "Set a single sprite flag" },
    { "command": "cart flags bulk", "description": "Set all sprite flags at once" },
    { "command": "cart sprite get", "description": "Read a sprite as an 8x8 colour grid" },
    { "command": "cart sprite set", "description": "Write a sprite from an 8x8 colour grid" },
    { "command": "cart sprite get-range", "description": "Read a range of sprites" },
    { "command": "cart sprite set-range", "description": "Write a range of sprites" },
    { "command": "cart sprite export", "description": "Export the sprite sheet as a PNG" },
    { "command": "cart sprite import", "description": "Import a sprite sheet from a PNG" },
    { "command": "cart map get", "description": "Read a single map cell" },
    { "command": "cart map set", "description": "Write a single map cell" },
    { "command": "cart map get-region", "description": "Read a rectangular region of the map" },
    { "command": "cart map set-region", "description": "Write a rectangular region of the map" },
    { "command": "cart sfx get", "description": "Read a sound effect" },
    { "command": "cart sfx set", "description": "Write a sound effect" },
    { "command": "cart sfx list", "description": "List all defined sound effects" },
    { "command": "ref api", "description": "Retrieve the PICO-8 function reference" },
    { "command": "ref pitfalls", "description": "Retrieve the guide to PICO-8 pitfalls" },
    { "command": "toolbox capabilities", "description": "Report available toolbox capabilities and commands" }
  ],
  "runtime": {
    "available": true,
    "pico8": {
      "present": true,
      "binaryPath": "<tempdir>/pico8",
      "version": "unknown",
      "runtime": {
        "runnable": true,
        "exportable": true
      },
      "static": {
        "available": true
      }
    }
  }
}
```

### Assertions (all pass)
- ✅ `capabilities.static.length` > 0 → 9 static capabilities listed
- ✅ `capabilities.runtime.length` > 0 → 2 runtime capabilities listed
- ✅ `runtime.available === true`
- ✅ `runtime.pico8.present === true`

---

## Behavior 2: capabilities-are-reported-when-pico-8-is-absent

**CLI Surface**: `qd toolbox capabilities --json` (with PICO_8 binary absent)

### Invocation

```
PICO8_BIN=/nonexistent/pico8-binary qd --root <tempdir> toolbox capabilities --json
```

### Captured Output

```json
{
  "capabilities": {
    "static": [
      "code editing",
      "sprite editing",
      "map editing",
      "sfx editing",
      "flag editing",
      "linting",
      "minification",
      "format conversion",
      "size reporting"
    ],
    "runtime": []
  },
  "commands": [
    { "command": "cart overview", "description": "Read an overview of a cartridge" },
    { "command": "cart tab", "description": "Read a single tab of code" },
    { "command": "cart size", "description": "Report cartridge size against PICO-8 limits" },
    { "command": "cart parse", "description": "Parse and validate cartridge code syntax" },
    { "command": "cart write", "description": "Write code to a cartridge tab" },
    { "command": "cart run", "description": "Check whether a cartridge can run in this environment" },
    { "command": "cart lint", "description": "Lint cartridge code for common issues" },
    { "command": "cart convert", "description": "Convert between .p8 and .p8.png formats" },
    { "command": "cart minify", "description": "Minify cartridge code" },
    { "command": "cart edit range", "description": "Replace a specific range of lines in a cartridge" },
    { "command": "cart edit replace", "description": "Find and replace text in a cartridge" },
    { "command": "cart edit append", "description": "Append code to the end of a cartridge" },
    { "command": "cart flags get", "description": "Read all sprite flags" },
    { "command": "cart flags set", "description": "Set a single sprite flag" },
    { "command": "cart flags bulk", "description": "Set all sprite flags at once" },
    { "command": "cart sprite get", "description": "Read a sprite as an 8x8 colour grid" },
    { "command": "cart sprite set", "description": "Write a sprite from an 8x8 colour grid" },
    { "command": "cart sprite get-range", "description": "Read a range of sprites" },
    { "command": "cart sprite set-range", "description": "Write a range of sprites" },
    { "command": "cart sprite export", "description": "Export the sprite sheet as a PNG" },
    { "command": "cart sprite import", "description": "Import a sprite sheet from a PNG" },
    { "command": "cart map get", "description": "Read a single map cell" },
    { "command": "cart map set", "description": "Write a single map cell" },
    { "command": "cart map get-region", "description": "Read a rectangular region of the map" },
    { "command": "cart map set-region", "description": "Write a rectangular region of the map" },
    { "command": "cart sfx get", "description": "Read a sound effect" },
    { "command": "cart sfx set", "description": "Write a sound effect" },
    { "command": "cart sfx list", "description": "List all defined sound effects" },
    { "command": "ref api", "description": "Retrieve the PICO-8 function reference" },
    { "command": "ref pitfalls", "description": "Retrieve the guide to PICO-8 pitfalls" },
    { "command": "toolbox capabilities", "description": "Report available toolbox capabilities and commands" }
  ],
  "runtime": {
    "available": false,
    "pico8": {
      "present": false,
      "binaryPath": null,
      "version": null,
      "runtime": {
        "runnable": false,
        "exportable": false
      },
      "static": {
        "available": true
      }
    }
  }
}
```

### Assertions (all pass)
- ✅ `capabilities.static.length` > 0 → 9 static capabilities listed
- ✅ `capabilities.runtime` is empty array `[]`
- ✅ `runtime.available === false`
- ✅ `runtime.pico8.present === false`

---

## Behavior 3: static-work-needs-no-pico-8-program

**CLI Surface**: `qd cart size <path> --json` (with PICO_8 binary absent)

### Invocation

Creates a minimal valid `.p8` cartridge:

```
pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
print(1)
__gfx__
__gff__
__map__
__sfx__
__music__
```

```
PICO8_BIN=/nonexistent/pico8-binary qd --root <tempdir> cart size <tempdir>/static-only.p8 --json
```

### Captured Output

```json
{
  "charCount": 131,
  "lineCount": 10,
  "tabCount": 1,
  "tabs": {
    "1": 1
  },
  "message": "Cartridge is 131 characters — headroom for 5085 more",
  "headroom": 5085,
  "limit": 256
}
```

### Assertions (all pass)
- ✅ `charCount` > 0 → 131 characters
- ✅ `message` contains "headroom" → "Cartridge is 131 characters — headroom for 5085 more"
- ✅ Command succeeds (exit code 0) — static work proceeds without PICO-8

---

## Behavior 4: running-is-declined-when-no-pico-8-program-is-present

**CLI Surface**: `qd cart run <path> --json` (with PICO_8 binary absent)

### Invocation

Creates a minimal valid `.p8` cartridge:

```
pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
print(1)
__gfx__
__gff__
__map__
__sfx__
__music__
```

```
PICO8_BIN=/nonexistent/pico8-binary qd --root <tempdir> cart run <tempdir>/run-decline.p8 --json
```

### Captured Output

```json
{
  "error": "No PICO-8 program is installed, so running and exporting are unavailable.",
  "message": "No PICO-8 program is installed, so running and exporting are unavailable."
}
```

Exit code: **1** (non-zero)

### Assertions (all pass)
- ✅ `exitCode` is not 0 → exit code is 1
- ✅ `error` contains "No PICO-8 program is installed"
- ✅ `message` contains "running and exporting are unavailable"
- ✅ `success` is not `true` → success field is absent/undefined

---

## Summary

| # | Behavior | CLI Command | Exit Code | Key Assertions | Status |
|---|---|---|---|---|---|
| 1 | capabilities-are-reported-when-pico-8-is-present | `qd toolbox capabilities --json` | 0 | static: 9 items, runtime: 2 items, `available: true` | ✅ |
| 2 | capabilities-are-reported-when-pico-8-is-absent | `qd toolbox capabilities --json` | 0 | static: 9 items, runtime: 0 items, `available: false` | ✅ |
| 3 | static-work-needs-no-pico-8-program | `qd cart size <path> --json` | 0 | charCount: 131, headroom message present | ✅ |
| 4 | running-is-declined-when-no-pico-8-program-is-present | `qd cart run <path> --json` | 1 | error about no PICO-8, running/exporting unavailable | ✅ |