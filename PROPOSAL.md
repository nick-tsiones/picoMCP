# picoMCP — a toolbox for agent-authored PICO-8 programs

**Status:** Draft proposal / RFC
**Scope:** An MCP server + CLI that exposes low-level, composable operations for working with PICO-8 cartridges. A toolbox, not a framework.

---

## 1. One-paragraph summary

picoMCP is a single core exposed two ways — as a **Model Context Protocol (MCP) server** (for agents like Claude) and as a **CLI** (for humans and CI) — that gives the caller a set of small, single-purpose operations over PICO-8 cartridges: read and edit the code and assets, statically check that a cart parses and fits PICO-8's hard limits, and — when a licensed PICO-8 binary is present — run a cart headlessly and hand back screenshots plus telemetry. It reports PICO-8's unusual budgets (8192 code tokens, 15,360 compressed bytes) as cart metadata, works with sprites and maps as structured grids rather than raw hex, and builds on the mature open tooling (shrinko8, picotool) rather than reimplementing a Lua parser. **It imposes no workflow** — how the tools are combined is entirely the caller's decision.

---

## 2. Non-goals

picoMCP is deliberately *not* a framework. It does **not**:

- scaffold projects or ship game templates / boilerplate;
- impose a project layout, file-naming scheme, or coding conventions;
- provide multi-step workflows, agent "recipes," or MCP prompt chains;
- decide *when* or *in what order* tools should be called;
- write the game for you or make design decisions.

Each tool does one thing. Combining tools into a workflow is the caller's job. Everything below follows from this.

---

## 3. Why PICO-8 is a good — and hard — target for agents

PICO-8 is a "fantasy console": a deliberately constrained virtual 8-bit machine for making tiny games, programmed in a Lua dialect, with a fixed 128×128 / 16-colour display and 32 KB cartridges. Those properties make it a clean agent target:

- **The whole program is small and self-contained.** One cartridge = one file; a complete game fits in ~8k tokens of code, so an agent can hold the entire artifact in context.
- **The source format is plaintext and diff-friendly.** The `.p8` format stores Lua as plaintext near the top of the file.
- **Correctness has a hard, cheap, deterministic component.** "Does it parse? Does it fit in 8192 tokens and 15,360 compressed bytes?" is answerable in milliseconds, with no display and no license.
- **Success is *visual*,** which pairs naturally with a multimodal agent that can look at a rendered frame.

The same traits make it awkward for a generic "filesystem + shell" setup, which is why a PICO-8-aware toolbox helps:

1. **PICO-8 is proprietary and paid** (~US$15, by Lexaloffle / Joseph "zep" White). picoMCP **cannot bundle or redistribute the binary**; it operates against a user-supplied licensed install and degrades gracefully when none is present.
2. **The limits are brutal and non-obvious.** Code is capped at **8192 tokens**; for `.p8.png`/`.p8.rom` distribution the *compressed* code must be **< 15,360 bytes**. Token counting has quirky rules (a string or a bracket pair counts as 1 token; `end`, commas, `local`, and comments don't count).
3. **The math is fixed-point.** Numbers are 16.16 signed fixed-point (≈ −32768 … 32767.99999, step ≈ 0.00002); a per-frame counter overflows after ~18 minutes. `sin()`/`cos()` take turns (0..1), not radians, and **`sin()` is inverted**. `sgn(0)` returns 1.
4. **No upper/lowercase** — editing a `.p8` directly means identifiers must be lowercase, and glyphs are stored as specific UTF-8 code points.
5. **Overlapping memory.** The bottom half of the sprite sheet and the bottom half of the map share the same cartridge bytes.
6. **Running it normally needs a window.** Headless execution exists but is marked *experimental*, and on a server needs a virtual framebuffer.

What picoMCP adds over a generic filesystem + shell is PICO-8 *awareness*: budgets and quirks surfaced as data, assets as structured grids, and a headless run that returns pixels and telemetry. It stops there — it's a toolbox, not a workflow engine.

---

## 4. Design principles

1. **Composable primitives, no imposed workflow.** Every tool is small and single-purpose, and picoMCP imposes no project structure, conventions, templates, or recipes (see Non-goals). "Single-purpose" still means *well-shaped*: a sprite is read and written as a grid of colour indices, not a 128-character hex line. The shaping is about ergonomics for one operation, never about doing the caller's job for them.
2. **Static-first, runtime-optional.** Every deterministic operation (parse, lint, token/char/compressed counts, minify, convert) works with **no PICO-8 binary at all**, purely from open-source tooling. Runtime operations light up only when a licensed binary is configured, so picoMCP stays useful in CI, in sandboxes, and for users mid-purchase.
3. **Report the budget as cart metadata.** Read and write operations can return `{tokens, chars, compressed}` plus headroom against the 8192 / 15,360 limits — the same way a file write reports a byte count. It's a property of the artifact, not a mandated step.
4. **Structured assets, never raw hex.** Sprites are pixel grids (indices 0–15), maps are tile grids, flags are booleans. picoMCP parses the `.p8` sections and re-serialises; the caller works with meaning.
5. **Token-frugal I/O.** Prefer targeted edits (line-range / search-replace) and compact summaries over full-file rewrites and hex dumps, because the agent's context is the scarce resource.
6. **Build on the ecosystem.** Use **shrinko8** (minify, lint, format conversion with better-than-PICO-8 compression, size counting, modern-syntax aware) and **picotool** (full PICO-8-flavoured Lua parser/AST, `.p8`/`.p8.png` read/write) as libraries. Don't hand-roll a Lua tokenizer.

---

## 5. Architecture

Four layers behind one core; two front-ends (MCP + CLI) over that core.

```
                ┌──────────────────────┐      ┌───────────────────┐
   Agent  ─────▶│   picoMCP MCP server  │      │   picoMCP CLI      │◀── human / CI
                │  (stdio / streamable  │      │  (same core)       │
                │   HTTP; tools +       │      └─────────┬─────────┘
                │   read-only resources)│                │
                └──────────┬───────────┘                 │
                           └─────────────┬────────────────┘
                                         ▼
        ┌───────────────────────────────────────────────────────────┐
        │                      picoMCP core                           │
        │                                                             │
        │  L1  Cart model      parse/serialise .p8 & .p8.png;         │
        │                      code-by-tab, sprites, map, flags,      │
        │                      sfx, music, label  (picotool)          │
        │                                                             │
        │  L2  Static layer    parse, lint, token/char/compressed     │
        │                      counts, minify, convert                │
        │                      (shrinko8)          ── NO binary needed │
        │                                                             │
        │  L3  Runtime layer   instrumentation harness + headless     │
        │                      pico8 -x  →  screenshots + printh log   │
        │                      + perf; export html/bin/png            │
        │                      (needs user-supplied PICO-8)           │
        │                                                             │
        │  L4  Reference data   API index + syntax-gotcha sheet,      │
        │                       served as read-only MCP resources     │
        └───────────────────────────────────────────────────────────┘
```

**L1 — Cart model.** A parser/serialiser for the `.p8` text format and the `.p8.png` steganographic format. The `.p8` file is a 2-line header (`pico-8 cartridge // http://www.pico-8.com` / `version N`) followed by ordered sections: `__lua__`, `__gfx__`, `__gff__`, `__label__`, `__map__`, `__sfx__`, `__music__`. Exposed as typed objects so higher layers never touch hex; picotool already reads both formats and gives an AST.

**L2 — Static layer (always on).** Deterministic answers with no display and no license: parse errors (PICO-8 flavour, including shorthand forms), lints, exact `{tokens, chars, compressed}` and headroom (shrinko8's compressor is slightly better than PICO-8's, so its compressed count is a safe upper bound), minify (safe/aggressive with constant-folding and dead-branch removal), and format conversion `.p8 ↔ .p8.png ↔ .rom ↔ .lua`.

**L3 — Runtime layer (opt-in, needs the binary).** PICO-8 can run a cart headless and quit (`pico8 -x cart.p8`, documented as experimental), save screenshots/gifs, and write debug text to a file via `printh(...)` / `extcmd("screen")` / `extcmd("video")`. picoMCP orchestrates *a single run* (see §6).

**L4 — Reference data.** A curated, condensed API index and a "gotchas" sheet, served to the agent as read-only MCP resources so grounding lives in-protocol. This is data, not behavior — see §9.

---

## 6. What the tools give back

Two independent signal channels. The caller decides how to use them.

**Static (no binary, deterministic, fast).**
`p8_parse` returns syntax errors with line/column. `p8_lint` returns lints. `p8_stats` returns `{tokens, chars, compressed}` plus headroom against 8192 / 15,360. Write/edit operations return the updated budget as metadata. None of this needs a display or a license.

**Runtime (needs the licensed binary; gives behavior + pixels).**
`p8_run` wraps the target cart in a small generated **harness**, runs it headless, and returns artifacts a multimodal agent can use directly:

1. **Frame capture → image.** The harness runs the cart for *N* frames, then calls `extcmd("screen")` (or records a short gif via `extcmd("video")`) and `stop()`s. picoMCP hands the PNG(s)/gif back as image content the model can *see*.
2. **Telemetry → text.** The harness injects a logger built on `printh(msg, "log.txt")`. Anything the caller asks to trace, plus `assert()` failures and the runtime error message and stack, is written to a file picoMCP reads back as text.
3. **Deterministic synthetic input.** Rather than injecting OS-level key events, the harness *rewrites `btn()`/`btnp()`* to read from a caller-supplied `frame → buttons` script (e.g. "hold ➡️ for 30 frames, then ❎"), so runs are reproducible and describable in JSON.
4. **Perf → numbers.** The harness samples `stat(1)` (CPU used per frame; 1.0 = 100%) and reports peak/mean.

picoMCP surfaces these signals; deciding *when* to check, *when* to run, and *how* to react is left entirely to the caller.

**Headless deployment note.** On Linux servers PICO-8 still expects a display; run it under `Xvfb` (or an equivalent virtual framebuffer). `-x` is experimental, so `p8_run` always sets an execution timeout, runs in a throwaway `-home`/`-desktop`, and treats a non-terminating cart as a failure with partial artifacts returned.

---

## 7. MCP tool surface

Every tool does one thing. Names are stable; code-reading/-writing tools can return the budget block. Illustrative schemas below; the full set is in the table.

### 7.1 Code
```jsonc
// p8_write_code — replace code (whole cart or one tab); creates the cart if the path doesn't exist
{ "path":"string", "tab":"int?", "code":"string" }
// → { ok, stats:{tokens,chars,compressed, token_headroom, compressed_headroom} }

// p8_edit_code — targeted edit, avoids full rewrites (token-frugal)
{ "path":"string", "tab":"int?",
  "op":"replace_range | search_replace | append",
  "range":[startLine,endLine]?, "find":"string?", "replace":"string" }
// → { ok, diff, stats:{tokens,chars,compressed, ...headroom} }
```

### 7.2 Static analysis (no binary)
```jsonc
// p8_parse — syntax errors only
{ "path":"string" }
// → { parses:bool, errors:[{line,col,msg}] }

// p8_lint — common bugs + PICO-8-specific checks (see §9)
{ "path":"string" }
// → { lints:[{level,line,msg}] }

// p8_stats — size vs the hard limits
{ "path":"string" }
// → { tokens, chars, compressed, token_headroom, compressed_headroom }

// p8_minify — shrink, with a report
{ "path":"string", "level":"safe | aggressive",
  "target":"tokens | chars | compressed", "in_place":false, "out":"string?" }
// → { before:{...}, after:{...}, removed:{...}, out_path }
```

### 7.3 Assets (structured, no hex)
```jsonc
// p8_set_sprite — write sprite N as an 8×8 grid of colour indices 0..15
{ "path":"string", "n":"int",
  "pixels":[[0..15 × 8] × 8], "flags":[bool × 8]? }

// p8_set_map — paint a tile-index region
{ "path":"string", "x":"int", "y":"int", "tiles":[[0..255 …] …] }

// p8_import_png / p8_export_png — spritesheet <-> PNG (colour-fit)
{ "path":"string", "png":"string", "x":0, "y":0, "shrink":1 }
```

### 7.4 Runtime (needs licensed PICO-8)
```jsonc
// p8_run — headless run of a single cart; returns pixels + telemetry
{ "path":"string", "frames":300, "fps":30,
  "input_script":[{ "frame":0, "buttons":["right"] },
                  { "frame":30, "buttons":["x"] }]?,
  "capture":"screenshot | gif | none", "capture_at":"int?",
  "trace":["var expressions or labels"]? }
// → { ok, images:[<png/gif as image content>], log:"string",
//     error:{line,msg,stack}?, perf:{cpu_mean, cpu_peak} }

// p8_export — build a distributable
{ "path":"string", "format":"html | bin | png",
  "extra_carts":["…"]?, "icon":{ "index":int,"size":int,"transparent":int }? }
// → { out_path(s), notes }
```

### 7.5 Full tool list

| Tool | Layer | Binary? | Purpose |
|---|---|---|---|
| `p8_read_cart` | L1 | no | Structured overview (code/stats/assets) |
| `p8_read_code` / `p8_write_code` | L1 | no | Get / replace code (whole or per tab); write creates cart if missing |
| `p8_edit_code` | L1 | no | Targeted range / search-replace / append edit |
| `p8_convert` | L1/L2 | no | `.p8 ↔ .png ↔ .rom ↔ .lua` |
| `p8_parse` | L2 | no | Syntax errors (line/col), PICO-8 flavour |
| `p8_lint` | L2 | no | Lints incl. PICO-8-specific checks |
| `p8_stats` | L2 | no | Tokens / chars / compressed + headroom |
| `p8_minify` | L2 | no | Shrink, before/after report |
| `p8_get_sprite` / `p8_set_sprite` | L1 | no | Sprite as pixel grid + flags |
| `p8_get_map` / `p8_set_map` | L1 | no | Map region as tile grid |
| `p8_set_flags` | L1 | no | Sprite flag bits |
| `p8_import_png` / `p8_export_png` | L1 | no | Spritesheet ↔ PNG (colour-fit) |
| `p8_get_sfx` / `p8_set_sfx` | L1 | no | SFX as structured notes (advanced) |
| `p8_run` | L3 | **yes** | Headless run → screenshots/gif + log + perf (+ scripted input) |
| `p8_export` | L3 | **yes** | Build html / bin / png |
| `p8_doctor` | — | no | Report whether a binary is configured & which features are live |

Note there is no "new project," "check-and-fit gate," "smoke test," or "screenshot" convenience tool: those are compositions of the primitives above, and composing them is the caller's job. (`p8_run` with `capture:"screenshot"` and `capture_at:K` already covers single-frame grabs.)

---

## 8. CLI surface

The same core, ergonomic for humans and CI. Static commands need no binary; runtime commands require `--pico8 <path>` or `PICO8_BIN`.

```bash
picomcp read    mygame.p8
picomcp parse   mygame.p8                # nonzero exit on syntax error
picomcp lint    mygame.p8
picomcp stats   mygame.p8 --json         # nonzero exit if over budget
picomcp minify  mygame.p8 -o mygame.png --level aggressive --target compressed
picomcp convert mygame.p8 mygame.p8.png
picomcp sprite  set mygame.p8 --n 1 --from sprite1.txt
picomcp run     mygame.p8 --frames 300 --capture gif --out run.gif \
                --input "0:right,30:x" --trace "player.x,player.y"
picomcp export  mygame.p8 --format html
picomcp serve                            # start the MCP server (stdio by default)
picomcp doctor                           # what's available in this environment
```

`parse` and `stats` return nonzero exit codes on failure/over-budget, so a CI job can gate on them — but picoMCP ships no opinion about *which* checks belong in your pipeline.

---

## 9. Reference data (MCP resources)

Beyond tools, picoMCP exposes the other read-only MCP primitive to *ground* the agent. These are **data, not behavior** — the agent pulls them if it wants; nothing is triggered automatically, and no workflow is implied.

- `p8://api-reference` — condensed index: every API function as `signature — one line`, grouped (System, Graphics, Tables, Input, Audio, Map, Memory, Math, Strings).
- `p8://syntax-gotchas` — the quirk sheet (fixed-point range/step + overflow, 1-based arrays, `sin`/`cos` take 0..1 and `sin` is inverted, `sgn(0)==1`, lowercase-only identifiers, shared gfx/map memory, token-counting rules, `#include` behavior).
- `p8://cart/{path}` — a live structured snapshot of a cart (the same data `p8_read_cart` returns, as a resource).

There are intentionally **no MCP prompts** (workflow templates). Prompts would encode "how to build a game," which is the caller's decision.

---

## 10. PICO-8-specific lint checks & write behavior

The PICO-8 traps are surfaced through the ordinary tools, on explicit calls — nothing silently rewrites your logic or imposes structure.

**`p8_lint` checks** (in addition to generic undefined / unused / duplicate locals):

- fixed-point literals outside ±32767.99999, and per-frame accumulators that will overflow;
- radians-style angle constants (`* 2 * 3.14…`, `math.pi`), since PICO-8 angles are turns and `sin` is inverted;
- both the bottom half of the sprite sheet *and* the bottom half of the map being non-empty (shared memory);
- use of Lua standard-library names PICO-8 doesn't provide, with the PICO-8 equivalent suggested.

**`p8_write_code` behavior:** identifiers are normalised to lowercase and glyphs to their canonical code points — matching what PICO-8 itself stores — so agent-written ASCII round-trips through PICO-8 unchanged. This is a correctness normalisation of the output encoding, not a style opinion.

**Budget metadata:** as in §4.3, code-changing tools return `{tokens, chars, compressed}` + headroom. Reporting a size is not enforcing a workflow; the caller chooses whether to act on it.

---

## 11. Deployment modes

| Mode | Transport | Binary | What works |
|---|---|---|---|
| **Local dev** | stdio | user-supplied PICO-8 (+ Xvfb on Linux) | everything, incl. `p8_run`, screenshots, export |
| **Static / hosted** | Streamable HTTP (+ OAuth) | none | all of L1/L2: read, parse, lint, stats, minify, convert, assets |
| **CI** | CLI | optional | `parse` / `stats` exit-code gates; runtime tests if a licensed runner is available |

Runtime features are strictly gated behind a detected, user-provided license/binary; picoMCP ships neither the binary nor any cartridge ROM, and reports this via `p8_doctor`.

---

## 12. Security considerations

- **MCP is a known injection surface.** Published analyses flag prompt injection and "poisoned tool" data-exfiltration risks. picoMCP keeps tools narrowly scoped, validates every path against an allowed project root, and never executes arbitrary shell — only the pinned `pico8` binary with fixed flags.
- **Untrusted carts execute code.** A `.p8` can contain hostile Lua and `printh`/`export` writes to the host filesystem. Headless runs go in a throwaway `-home`/`-desktop` sandbox, under a wall-clock timeout and (on Linux) resource limits / a container, with host FS writes confined to that sandbox.
- **shrinko8 custom scripts** (arbitrary Python pre/post hooks) are powerful; picoMCP disables them by default and gates them behind explicit opt-in.
- **Least privilege by transport.** The hosted/static mode exposes only no-binary tools, so a remote deployment can't be coerced into running code at all.

---

## 13. Implementation plan

**M0 — Cart core + CLI (static).** `.p8`/`.p8.png` parse/serialise via picotool; `read`, `parse`, `lint`, `stats`, `minify`, `convert` over shrinko8. Deliverable: static CLI works, no binary needed.

**M1 — MCP server (static).** Wrap M0 as stdio MCP tools; add `p8://api-reference` and `p8://syntax-gotchas` resources. Deliverable: an agent can author a cart that parses and fits, fully offline.

**M2 — Structured assets.** Sprite/map/flags get/set as grids; PNG import/export. Deliverable: assets editable without touching hex.

**M3 — Runtime harness.** Headless `-x` runner under Xvfb; frame capture → image, `printh` telemetry → text, scripted `btn()` input, `stat(1)` perf. Deliverable: `p8_run`.

**M4 — Export + hosted mode.** `p8_export` (html/bin/png), `p8_doctor`, hosted Streamable-HTTP + OAuth mode with runtime tools disabled.

**M5 — Evals.** A held-out suite of "make X" tasks scored on parses/fits/behaves, run after every server or tool-description change to catch regressions.

---

## 14. Open questions & risks

- **`-x` is experimental.** The headless path may change between PICO-8 versions or across OSes; M3 needs version detection + a capability probe, with a fallback to windowed-under-Xvfb if `-x` regresses.
- **Synthetic input via `btn()` rewriting** changes the cart under test. For carts that read raw memory for input, an OS-level injection fallback may be needed.
- **SFX/music authoring is genuinely hard for text agents.** `p8_set_sfx` as structured notes is proposed but may be low-value; worth validating before investing.
- **Compression parity.** shrinko8's compressor is *slightly better* than PICO-8's, so its "compressed bytes" is a safe upper bound but not byte-identical; a final `p8_convert`-through-the-real-binary check is advisable before shipping a `.p8.png`.
- **Licensing/ToS.** Confirm that programmatically driving a user's own licensed PICO-8 headlessly is within Lexaloffle's terms; picoMCP must never distribute the binary or paid carts.
- **Picotron.** shrinko8 already has experimental Picotron support; a later `picotronMCP` could reuse most of this architecture.

---

## Appendix A — PICO-8 quick reference (grounding for the design)

**Specs.** 128×128 display, fixed 16-colour palette · 6-button input · 32 KB carts (png-encoded) · 4-channel / 64 SFX audio · code capped at **8192 tokens** · virtual CPU ~4M vm insts/sec (≈2 cycles/instruction) · 256 8×8 sprites (128 + 128 shared with map) · 128×32 tilemap (+128×32 shared). Current manual: **v0.2.7** (© 2014–2025 Lexaloffle). Built on z8lua (Lua 5.2 base, **no standard library**).

**Runtime callbacks.** `_init()` once at start · `_update()` @30fps (or `_update60()` @60fps) · `_draw()` per visible frame. Tabs are concatenated left→right into one program. `#include file.lua` injects code at boot (not recursively).

**Number model.** 16.16 signed fixed-point; range ≈ −32768 … 32767.99999; step ≈ 0.00002; divide-by-zero → ±0x7fff.ffff. `sin`/`cos` take **turns (0..1)** and **`sin` is inverted**; `sgn(0)==1`; arrays are **1-based**.

**PICO-8 shorthand.** Single-line `if (cond) a=1 b=2` (parens required); compound assignment `+= -= *= /= &= |= ..=`; `!=` accepted for `~=`.

**`.p8` text format.** Header line `pico-8 cartridge // http://www.pico-8.com`, then `version N`, then ordered sections: `__lua__` (plaintext), `__gfx__` (128 lines × 128 hex), `__gff__` (flags), `__label__`, `__map__` (32 lines × 256 hex), `__sfx__` (64 lines × 168 hex), `__music__`. Empty/trailing-default sections are omitted; repeated sections concatenate.

**`.p8.png` format.** Steganographic: cart bytes live in the 2 LSBs of each ARGB channel of a 160×205 image (≈32,800 bytes). `0x0000–0x42ff` = gfx/map/flags/music/sfx; `0x4300–0x7fff` = Lua code (compressed "pxa" format since v0.2.0). Distribution requires **compressed code < 15,360 bytes**.

**Headless / CLI switches that matter.** `-x file` run headless then quit (*experimental*) · `-export "<args>"` run EXPORT headless (build html/bin/png; also format conversion, e.g. `pico8 foo.p8 -export foo.p8.png`) · `-run file` · `-home path`, `-root_path path`, `-desktop path` · `-screenshot_scale n`, `-gif_scale n`, `-gif_len n` · `-p param_str`.

**In-cart hooks for feedback.** `printh(str, "file.txt"[, overwrite])` writes text to the host (or `"@clip"`); `extcmd("screen")` saves a screenshot, `extcmd("rec")`/`extcmd("video")` capture a gif; `stat(1)` = CPU used since last flip (1.0 = 100%), `stat(7)` = framerate, `stat(80..85)` = UTC time; `assert(cond, msg)` halts with a message.

## Appendix B — Existing tooling picoMCP builds on

- **shrinko8** (thisismypassport; Python 3.8+, Pillow for PNG) — minify (token/char/compressed; constant-folding; dead-branch removal), lint (undefined/unused/duplicate locals), format conversion with better-than-PICO-8 compression, size counting, unminify, custom pre/post Python scripts, modern-syntax and Picotron aware. **Backbone of L2.**
- **picotool / p8tool** (dansanderson; Python) — full PICO-8-flavoured Lua parser + AST, `.p8` and `.p8.png` read/write, `build` (compose code/gfx/sfx from different carts), `luamin`/`luafmt`, `stats`, `require()` support. **Backbone of L1.**
- **pico8parse** (JS) — an alternative PICO-8-flavour Lua parser, if a JS/TS core is preferred.
