# picoMCP — Software Design Document (SDD)

**Status:** Draft for implementation
**Companion documents:**
- `picoMCP-proposal.md` — the *what & why* (scope, non-goals, tool surface, rationale).
- `picomcp-behaviors.jsonl` — the *acceptance criteria* (Gherkin, deliberately implementation-free).
- **This document** — the *how*: the mechanics, formats, algorithms, interfaces, and process design the behaviors intentionally leave out.

Where the behaviors say "*When I check the cartridge's size … Then I am told it exceeds the token limit*," this document specifies how a token is counted, where the limit comes from, which library does the counting, how the result is shaped, and how it is returned over MCP and the CLI. Every section cross-references the behavior features it realizes; §14 is the full traceability matrix.

This document does not restate PICO-8 platform facts already tabulated in the proposal (Appendix A there); it assumes them and specifies the implementation on top.

---

## 1. Scope of this document

The behaviors are written in domain language and omit, by design:

- the concrete tool/command names and their request/response schemas;
- the MCP protocol wiring (transports, resources, image content, auth) and the CLI grammar/exit codes;
- how the PICO-8 process is discovered, invoked, and driven headlessly;
- the internal cartridge model and the on-disk format codecs (`.p8`, `.p8.png`, `.rom`, `.lua`);
- the algorithms behind counting, minification, conversion, linting, and colour-fitting;
- the run harness (input scripting, telemetry, capture, perf, determinism);
- sandboxing, resource limits, path validation, error taxonomy, logging, concurrency, packaging, and version compatibility.

All of the above is specified here.

---

## 2. Design decisions (ADR-lite)

| # | Decision | Rationale | Consequence |
|---|---|---|---|
| D1 | **Python 3.11+ core** (resolves the proposal's "Rust/Python" hedge). | The two backbone libraries (shrinko8, picotool) are Python; reusing them directly avoids a Lua re-implementation and FFI. | Ships as a `pip` package; optional single-file binary via PyInstaller for the CLI. |
| D2 | **Reuse, don't reimplement.** shrinko8 = tokenising / counting / minify / lint / format codecs; picotool = AST + cart read/write. | Both are mature and PICO-8-accurate. | Vendored at pinned versions; wrapped behind internal service interfaces so either can be swapped. |
| D3 | **Two thin front-ends over one core.** MCP adapter + CLI adapter call the same service functions. | One behaviour, two surfaces; no logic duplication. | Front-ends contain only (de)serialisation, transport, and error mapping. |
| D4 | **Static core is binary-free.** L1/L2 never invoke PICO-8. | Keeps CI/hosted/pre-purchase usable. | Colour-fitting and size are computed in-process (see §7.6, §7.1). |
| D5 | **Runtime = one wrapped cart, one process, one sandbox.** No orchestration layer. | Matches the toolbox contract (no workflows). | `p8_run` drives a single execution; composing runs is the caller's job. |
| D6 | **Filesystem is the single source of truth.** Operations are stateless functions over cart files. | Simplicity, safe concurrency, no session state. | Writes are atomic (temp + rename); last-write-wins. |
| D7 | **PICO-8 is never bundled.** Discovered from the host. | Licensing/ToS. | Capability probe + graceful degradation (§7.7). |

---

## 3. Architecture

The four-layer core from the proposal, decomposed into implementable components.

```
 front-ends │  mcp_adapter                cli_adapter
────────────┼──────────────────────────────────────────────
   services │  cart_repo   static_svc   asset_svc   runtime_svc   ref_svc
────────────┼──────────────────────────────────────────────
    support │  config/capability   path_guard   errors   logging
────────────┼──────────────────────────────────────────────
   externals│  shrinko8   picotool   Pillow   [ pico8 binary + Xvfb ]
```

### 3.1 Component responsibilities

| Component | Layer | Responsibility | Depends on |
|---|---|---|---|
| `mcp_adapter` | front-end | Expose services as MCP tools + resources; encode images; map errors to MCP tool errors; host stdio + Streamable-HTTP transports; OAuth in hosted mode. | services |
| `cli_adapter` | front-end | Command grammar, flags, stdout/JSON, exit codes. | services |
| `cart_repo` | L1 | Load/save the internal `Cart` model from/to all four formats; atomic writes; path-guarded I/O. | picotool, path_guard, format codecs |
| `static_svc` | L2 | parse, lint, size, minify, convert. Binary-free. | shrinko8, cart_repo |
| `asset_svc` | L1 | Sprite/map/flags/SFX get-set as structured grids/notes; PNG import/export with colour-fit. | cart_repo, Pillow |
| `runtime_svc` | L3 | Build the harness cart, run it in a sandbox, collect + shape artifacts (images/log/error/perf). | config/capability, pico8, cart_repo |
| `ref_svc` | L4 | Serve the bundled API index & pitfalls sheet; compute cart snapshots. | cart_repo |
| `config/capability` | support | Locate the binary, probe headless capability, detect version, report feature availability. | pico8 |
| `path_guard` | support | Canonicalise paths, enforce project-root containment. | — |
| `errors`, `logging` | support | Error taxonomy; host-side structured logs (distinct from a cart's in-run output). | — |

---

## 4. Data design

### 4.1 Internal `Cart` model

The in-memory representation every service operates on; codecs convert to/from it.

```
Cart
├── version: int                       # PICO-8 cart version header
├── code:    list[str]                 # one entry per tab, in order (concatenation = program)
├── gfx:     uint8[128][128]            # sprite-sheet pixels, colour index 0..15
├── flags:   uint8[256]                 # sprite flags, one bitfield per sprite
├── map:     uint8[128][64]             # tile indices (rows 32..63 alias gfx rows 64..127)
├── sfx:     Sfx[64]                    # each: notes[32]{pitch,instr,vol,fx}, speed, loop_start, loop_end, filters
├── music:   Pattern[64]               # each: 4 channel SFX refs + flow flags (loop-start/loop-back/stop)
└── label:   uint8[128][128] | None     # optional cart label image
```

Only `code` is edited as text; every other section is edited through typed accessors so callers never touch hex. The **shared-storage aliasing** (map rows 32–63 ⇔ gfx rows 64–127) is represented once and surfaced through both `gfx` and `map` views, with the overlap detectable for the lint in §7.5.

### 4.2 Format codecs

All four formats round-trip through `Cart`. `.p8` and `.rom` are handled in-process; `.p8.png` decode/encode reuses shrinko8's codec (better compression than PICO-8, per D2).

**`.p8` (text).** Two header lines (`pico-8 cartridge // http://www.pico-8.com`, `version N`) then ordered sections `__lua__ __gfx__ __gff__ __label__ __map__ __sfx__ __music__`. Encoder rules to match PICO-8 output exactly:
- omit any non-`__lua__` section equal to the default (empty) cart;
- omit trailing default lines within a section;
- `__gfx__`: 128 lines × 128 hex nybbles, **in pixel order** — note the codec must swap nybble pairs relative to the in-memory byte order (memory stores least-significant-nybble first);
- `__map__`: 32 lines × 256 hex (rows 0–31 only; rows 32–63 live in the bottom of `__gfx__`);
- `__sfx__`: 64 lines × 84 bytes; `__gff__`: flag bytes; `__music__`: pattern bytes.
- decoder tolerates repeated sections (concatenate) and a permissive header (first line contains `pico-8 cartridge`, second line discarded).

**`.p8.png` (steganographic).** 160×205 image; each cart byte occupies the two low bits of the A, R, G, B channels (A carries the two most-significant bits). `0x0000–0x42ff` = gfx/map/flags/music/sfx; `0x4300–0x7fff` = code (compressed "pxa": header `\x00pxa`, decompressed length and compressed length MSB-first, move-to-front stream). The **distribution size gate** (§7.3) rejects encode when compressed code ≥ 15,360 bytes.

**`.rom`** = the raw 32 KB byte image; **`.lua`** = the concatenated `code` only.

### 4.3 Tool request/response envelope

Every tool takes a flat JSON object and returns:

```jsonc
{ "ok": true,  ...tool-specific fields }
// or
{ "ok": false, "error": { "code":"…", "message":"…", "details": {…}? } }
```

Code-reading/-writing tools include a `budget` block whenever code is present:

```jsonc
"budget": { "tokens":123, "chars":456, "compressed":789,
            "token_limit":8192, "compressed_limit":15360,
            "token_headroom":8069, "compressed_headroom":14571,
            "within_limits": true }
```

`budget` is **metadata**, never a gate (contract §14 → `@contract`,`@size`). Full per-tool schemas are in Appendix A.

### 4.4 Run I/O model

```jsonc
// request
{ "path":"…", "frames":300, "fps":30|60,
  "input_script":[ {"frame":0,"buttons":["left","right","up","down","x","o"]}... ]?,
  "capture":"screenshot"|"gif"|"none", "capture_at": <frame>?,
  "trace":[ "<label or expression>" ]? }

// result
{ "ok":true,
  "images":[ {"kind":"png"|"gif","data_base64":"…","frame":<int>?} ],
  "log":"…",                         // decoded telemetry + assertion output
  "error": {"message":"…","file":"…","line":<int>?}? ,   // cart runtime fault
  "timed_out": false,
  "perf": {"cpu_mean":0.42,"cpu_peak":0.91,"frames_run":300} }
```

Buttons use PICO-8's fixed six-button vocabulary. `input_script` is a sparse frame→held-buttons map; a frame with no entry inherits the previous entry's held set (edge vs. held is resolved by the harness, §7.8).

### 4.5 Bundled reference content

`ref_svc` ships two static, curated documents (no network): the **API index** (`signature — one-line` per function, grouped) and the **pitfalls sheet** (the proposal's gotchas). The **cart snapshot** resource is `p8_read_cart`'s output computed on demand.

### 4.6 Error taxonomy

| code | meaning | typical origin |
|---|---|---|
| `NOT_FOUND` | cartridge/file absent | reads, static ops |
| `INVALID_CARTRIDGE` | unparseable/corrupt cart file | codecs |
| `INVALID_ARGUMENT` | bad grid size, colour/tile out of range, unknown tab | asset/edit tools |
| `OUT_OF_BOUNDS` | map region beyond bounds | map tools |
| `NO_MATCH` | search-replace matched nothing | edit tool |
| `TOO_LARGE` | compressed code won't fit an image/rom | convert, png encode |
| `RUNTIME_UNAVAILABLE` | no usable PICO-8 binary | run/export |
| `RUN_TIMEOUT` | cart exceeded the wall-clock limit | run |
| `RUN_ERROR` | cart raised a Lua error | run |
| `OUTSIDE_PROJECT` | path escapes the project root | path_guard |
| `INTERNAL` | unexpected failure | any |

`parse`/`lint` do **not** use error codes for findings — syntax errors and lints are ordinary success-payload data.

---

## 5. MCP interface design

### 5.1 Transports & modes
- **Local dev:** stdio transport; runtime tools enabled.
- **Hosted/static:** Streamable HTTP + OAuth; runtime tools **not registered** (least privilege, D7/§10). The tool list itself differs by mode so a remote client cannot call `p8_run`.

### 5.2 Tools & resources
Registered names exactly as proposal §7.5. Tools are declared with rich parameter descriptions (per MCP guidance) and JSON schemas from Appendix A. Resources: `p8://api-reference`, `p8://syntax-gotchas`, `p8://cart/{path}`. **No prompts** are registered (contract).

### 5.3 Images
`p8_run` returns captures as MCP **image content blocks** (base64, `image/png` or `image/gif`) interleaved with a text block carrying `log`/`perf`/`error`, so a multimodal client sees the frame and reads the telemetry in one response.

### 5.4 Error surfacing
Service errors become MCP tool errors (`isError: true`) with `message`; `details` ride along as structured content. Findings (parse/lint/over-budget) are **not** errors — they are normal results, preserving the "reported, not enforced" contract.

---

## 6. CLI interface design

Thin wrapper (Typer) over the same services; static commands need no binary, runtime commands require `--pico8 PATH` or `PICO8_BIN`.

Commands mirror the tools: `read parse lint stats minify convert sprite map flags sfx import-png export-png run export serve doctor` (see proposal §8 for the surface). `serve` starts the MCP server (stdio default; `--http` for hosted). JSON output via `--json`; images via `--out`.

**Exit codes** (the CLI's only opinion, and purely a CI affordance — the underlying services never reject over-budget writes):

| code | meaning |
|---|---|
| 0 | success / within limits |
| 1 | a *findings* gate tripped: `parse` found a syntax error, or `stats`/`check`-style size query is over a limit |
| 2 | usage error (bad flags) |
| 3 | `NOT_FOUND` / `INVALID_CARTRIDGE` |
| 4 | `RUNTIME_UNAVAILABLE` |
| 5 | `RUN_TIMEOUT` / `RUN_ERROR` |
| 6 | `OUTSIDE_PROJECT` |
| 70 | `INTERNAL` |

### 6.1 External process contract (the PICO-8 binary)
`runtime_svc` shells out to exactly one pinned executable with fixed flags — never arbitrary shell.
- **Headless run:** `pico8 -x <driver.p8> -home <T/home> -root_path <T/root> -desktop <T/desktop>` (CWD = `T/work`).
- **Export:** `pico8 <cart.p8> -export "<args>"` (html/bin/png; also format conversions where a binary is required).
- **Linux servers:** wrapped in `xvfb-run` (virtual framebuffer), since PICO-8 expects a display.
- **In-cart contract used by the harness:** `printh(str,"log.txt")` for telemetry; `extcmd("screen"|"rec_frames"|"video")` for capture; `stat(1)` for per-frame CPU; `stat(7)` fps; `assert()`/Lua errors for faults; `stop()` to end a headless run.

---

## 7. Detailed algorithm & process design

### 7.1 Size accounting  → *Reporting size against the limits*
Delegated to shrinko8. **Tokens:** a word or operator = 1; each string literal and each bracket **pair** = 1; commas, `.`, `local`, `;`, `end`, and comments are not counted; limit = 8192. **Chars:** raw character count. **Compressed:** shrinko8's compressor run over the code (a *safe upper bound* — it compresses at least as well as PICO-8, so "fits" here implies "fits in PICO-8"). Tokenising/compressing is skipped when a caller only needs one metric. Headroom = limit − value; `within_limits` = both headrooms ≥ 0.

### 7.2 Minification  → *Minifying code*
shrinko8 pipeline, two exposed levels:
- **safe** = rename-safe-only + whitespace/paren reduction; **guarantees behaviour preservation** (this is what the behavior "*the program's behaviour is unchanged*" binds to).
- **aggressive** = safe + global/table-key renaming + constant folding + dead-branch removal (e.g. drop `if false` blocks). Preserves behaviour **except** for code that reflects on global names or builds identifiers from strings; such names are auto-exempted where detectable, and the caveat is documented (risk R3).
- `target ∈ {tokens, chars, compressed}` selects the metric the minifier optimises hardest. Output is re-measured; `before`/`after`/`removed` returned. In-place writes are atomic (D6); "into a separate cartridge" leaves the source byte-identical.

### 7.3 Conversion & the fit gate  → *Converting cartridge formats*
Decode source → `Cart` → encode target. **Round-trip fidelity** (`p8 → X → p8` equals original) is a codec invariant and a test gate. Encoding to `.p8.png`/`.rom` first checks compressed code < 15,360 bytes; otherwise `TOO_LARGE` (mirrors PICO-8's own refusal). Unreadable input → `INVALID_CARTRIDGE`.

### 7.4 Parsing  → *Parsing code*
picotool's PICO-8-flavoured parser over the concatenated tabs. Returns `{parses, errors:[{line,col,message}]}`. Accepts PICO-8 shorthand (single-line `if`/`while`, compound assignment, `!=`) as valid — these are grammar, not errors. Empty program parses.

### 7.5 Lint checks  → *Linting code*
Generic checks come from shrinko8's linter over picotool's AST + scope table: **undefined**, **unused local**, **duplicate local**. PICO-8-specific checks are additional AST/data passes:

| Lint | Detection |
|---|---|
| out-of-range number | numeric literal outside ±32767.99999 |
| per-frame overflow | monotonic `+=`/`-=` on a variable inside `_update`/`_update60` with no reset/wrap on any path |
| radians angle | `sin`/`cos` argument containing `math.pi`, `3.14…`, or `*2*…` full-turn constants (PICO-8 angles are turns; heuristic → `level:warning`) |
| shared-storage overlap | both `gfx` rows 64–127 and `map` rows 32–63 are non-default (§4.1) |
| unavailable stdlib | call to a Lua-stdlib name absent from PICO-8's API, with the PICO-8 equivalent suggested |

All are findings in the success payload, never blocking.

### 7.6 Write normalisation & PNG colour-fit
- **Write normalisation** (`p8_write_code`) → *Writing code*: fold uppercase ASCII identifiers to lowercase and map special glyphs to their canonical code points, matching what PICO-8 itself stores, so agent-authored ASCII round-trips unchanged. This normalises the **output encoding only**; it never rewrites logic.
- **PNG import** (`p8_import_png`) → *Sprite sheet images*: Pillow loads the image; each pixel is mapped to the nearest of the 16 palette colours (no dithering, to match PICO-8's colour-fit intent); optional integer `shrink` resizes before fitting; optional `x,y` offset positions it in the sheet. Static fit may differ slightly from PICO-8's built-in `IMPORT`; a binary-backed exact-fit path is offered when a binary is present (fidelity note R5).

### 7.7 Capability detection & binary discovery  → *Environment and capability detection*
Resolution order: request/`--pico8` arg → `PICO8_BIN` → config file → `pico8` on `PATH`. **Probe:** run a tiny generated cart headless that `printh`s the version and `stop()`s; success confirms `-x` works and yields the version. Results: `{static: true, run: <bool>, export: <bool>, pico8_version: <str|null>}`. If discovery fails, run/export return `RUNTIME_UNAVAILABLE` with a clear reason; **static stays fully available**. If `-x` is present but non-functional on the host, fall back to windowed-under-`Xvfb` with a hard timeout kill (R1).

### 7.8 Run harness  → *Running a cartridge headlessly*
`runtime_svc` never runs the raw cart. It builds a **driver cart**: the target's non-code sections copied verbatim, and `__lua__` = *injected prologue* + *target code* + *injected epilogue*. Globals resolve at call time, so redefining `btn`/`flip` in the epilogue takes effect inside the target's callbacks.

```lua
-- PROLOGUE (before target code): helpers only; target callbacks don't exist yet
__pm={f=0, cpu_peak=0, cpu_sum=0, script=<compiled input_script>, cap=<n>, N=<frames>}
function __pm_log(s) printh(s,"log.txt") end
function __pm_btnstate() ... end            -- resolve held/edge set for __pm.f from script
-- override input to read the script instead of hardware
btn  = function(i,p) return __pm_held(i) end
btnp = function(i,p) return __pm_edge(i) end
srand(1)                                     -- deterministic RNG

-- TARGET CODE HERE (defines _init/_update[/60]/_draw, or a custom mainloop) --

-- EPILOGUE (after target code): wrap whatever the target defined
local _i,_u,_u6,_d = _init,_update,_update60,_draw
if _u or _u6 or _d then                      -- game-loop cart: PICO-8 auto-flips
  function _init() srand(1) if _i then __pm_guard(_i) end end
  local function step()
    __pm.f+=1
    local c=stat(1); __pm.cpu_sum+=c; __pm.cpu_peak=max(__pm.cpu_peak,c)
    if __pm.f==__pm.cap then extcmd("screen") end
    if __pm.f>=__pm.N then __pm_finish() end   -- save gif if recording, log perf, stop()
  end
  if _u6 then _update60=function() __pm_guard(_u6) step() end
  elseif _u then _update=function() __pm_guard(_u)  step() end end
  if _d  then _draw =function() __pm_guard(_d) end end
else                                          -- custom mainloop: hook flip() instead
  local _f=flip
  flip=function(...) local r=_f(...) step() return r end
end
```

- **`__pm_guard(fn)`** = `pcall(fn)`; on error it `__pm_log`s the Lua message (which carries `file:line`) and calls `__pm_finish()` → the runtime service surfaces `RUN_ERROR{message,file,line}`.
- **Capture:** a still uses `extcmd("screen")` at `capture_at` (default: last frame); a gif uses `extcmd("rec_frames")` at start (one gif frame per flip → deterministic) and `extcmd("video")` at finish.
- **Perf:** `stat(1)` sampled once per driven frame; mean/peak logged at finish.
- **Trace:** requested labels are appended to the log via `__pm_log` each frame.
- **Determinism** (*runs are reproducible*): fixed `srand` seed each run; frame count fixed; frame-based `rnd`/`t()` are therefore identical across runs. Wall-clock reads (`stat(80..85)`) remain nondeterministic — documented limitation (R2). Custom-mainloop carts get capture/timeout/scripted-input/trace but not per-callback perf attribution (R2).

### 7.9 Sandbox execution
Per run: create temp root `T`; the driver cart is written under `T/root`, `-home T/home`, `-desktop T/desktop`, CWD `T/work` (where `log.txt` lands). The process is launched in its own process group under a **wall-clock timeout**; on timeout the group is killed and `timed_out:true` is returned with whatever artifacts exist (*non-terminating cartridge is stopped*). On Linux, execution is additionally confined (container/`rlimit`s: CPU, memory, no network, output-size caps) so a hostile cart's `printh`/`export` writes cannot escape `T` (*cannot alter files outside its isolated workspace*). `T` is removed after artifacts are collected.

### 7.10 Path validation  → *Project and path boundaries*
`path_guard.resolve(p, roots)`: canonicalise `p` (realpath, resolving symlinks and `..`), require it to be within one configured project root by normalized-prefix check, else `OUTSIDE_PROJECT`. Applied to every read, write, and output path before any I/O.

---

## 8. Error handling & logging
- Services raise typed errors (§4.6); front-ends translate (MCP tool error / CLI exit code). Findings are never errors.
- **Host-side logging** (structured, leveled) records tool invocations, argument shapes (not full cart contents), binary discovery, and process exits — and is entirely separate from a cart's in-run `printh` output. Hosted mode ships request tracing for auditability.
- Cart runtime faults are captured inside the harness (§7.8), not by scraping unstructured console output alone, giving a stable `{message,file,line}`.

## 9. Concurrency & state
Operations are stateless pure-ish functions over files; the MCP server keeps no per-cart session state. Concurrent `p8_run`s are safe because each gets a private sandbox `T`. Cart writes are **atomic** (write to temp in the same directory, `fsync`, `rename`) so a crash never leaves a half-written cart; concurrent writers to the same path are last-write-wins (documented; no lock manager).

## 10. Security design
- **Injection surface (MCP):** narrowly-scoped tools; every path is `path_guard`ed; only the pinned `pico8` runs, with fixed flags; no arbitrary shell.
- **Untrusted-cart execution:** contained per §7.9 (sandbox + timeout + rlimits + no network).
- **shrinko8 custom Python hooks** are powerful (arbitrary code); **disabled by default**, opt-in only, and never exposed over the hosted transport.
- **Least privilege by transport:** hosted mode registers no runtime tools, so a remote deployment cannot be coerced into executing a cart at all; OAuth scopes gate access.
- **Output caps:** capture image/gif size and `log` length are bounded to prevent resource-exhaustion responses.

## 11. Deployment, packaging & configuration
- **Package:** one `pip` distribution exposing `picomcp` (CLI) and `picomcp serve` (MCP). Optional PyInstaller single-file CLI. Hosted mode ships a container image **with `Xvfb` but without PICO-8** (operators mount their licensed binary).
- **Config precedence:** CLI flag → env (`PICO8_BIN`, `PICOMCP_ROOT`) → config file → defaults. Config declares project root(s), timeouts, resource limits, capture caps, and transport.
- **Dependencies** pinned (Appendix C). PICO-8 is a runtime prerequisite for L3 only, supplied by the user (D7).

## 12. Non-functional requirements
- **Performance:** static operations complete in milliseconds for typical carts (≤ 8k tokens); a run is bounded by `frames` and the timeout. Colour-fitting a full sheet is a single Pillow pass.
- **Portability:** Windows / macOS / Linux / Raspberry Pi (the platforms PICO-8 targets); Linux servers require `Xvfb` for runtime.
- **Observability:** structured host logs + optional request tracing.
- **Testability:** L1/L2 are deterministic and binary-free (unit-testable in CI); L3 is exercised against a matrix of PICO-8 versions on a licensed runner.

## 13. PICO-8 version compatibility
`config/capability` records the detected version and consults a small **capability map** keyed by version for behaviours that have shifted (e.g. nested-comment handling, `-x` viability, format tweaks). Tested versions are pinned; `-accept_future` stays off so unknown newer carts fail loudly rather than silently misparse.

---

## 14. Traceability: behaviors → design

Every behavior feature (and the tags it carries) maps to the components/algorithms that implement it. This is the concrete answer to "what the behaviors left out."

| Behavior feature (JSONL) | Realised by |
|---|---|
| Environment and capability detection | §7.7 capability probe; §5.1/§6 mode-dependent tool registration; error `RUNTIME_UNAVAILABLE` |
| Project and path boundaries | §7.10 `path_guard`; error `OUTSIDE_PROJECT` |
| Reading cartridges | `cart_repo` load (§4.1–4.2); `p8_read_cart`/`p8_read_code` (App. A) |
| Writing code | `p8_write_code`; §7.6 normalisation; §9 atomic write; §4.3 `budget` |
| Editing code | `p8_edit_code` (range/search-replace/append); `NO_MATCH`, `INVALID_ARGUMENT` (bad tab); §7.1 re-measure |
| Parsing code | §7.4 picotool parser; shorthand acceptance |
| Linting code | §7.5 generic + PICO-8-specific passes |
| Reporting size against the limits | §7.1 counting; limits 8192 / 15,360; `NOT_FOUND` |
| Minifying code | §7.2 pipeline; safe = behaviour-preserving; targets; §7.3 fit interplay |
| Converting cartridge formats | §4.2 codecs; §7.3 round-trip invariant + `TOO_LARGE`; `INVALID_CARTRIDGE` |
| Editing sprites / flags | §4.1 model; `asset_svc`; grid/colour validation (`INVALID_ARGUMENT`) |
| Editing the map | `asset_svc`; range + bounds checks (`INVALID_ARGUMENT`, `OUT_OF_BOUNDS`) |
| Sprite sheet images | §7.6 colour-fit; Pillow shrink/offset |
| Editing sound effects | §4.1 `Sfx` model; structured note accessors (advanced; risk R4) |
| Running a cartridge headlessly | §7.8 harness (input/capture/trace/perf/determinism); §7.9 sandbox & timeout; `RUN_ERROR`/`RUN_TIMEOUT` |
| Exporting a distributable | §6.1 `-export`; bundling & icon flags; `RUNTIME_UNAVAILABLE` |
| Reference data | §4.5 bundled content; `ref_svc`; passivity (no I/O side-effects) |
| Toolbox contract | D5/D6; §4.3 budget-as-metadata; §5.2 no prompts; independence of service calls |

---

## 15. Open implementation issues & risks

| # | Issue | Handling |
|---|---|---|
| R1 | `-x` headless is experimental and version/OS-sensitive. | Capability probe (§7.7); fallback to windowed-under-`Xvfb` + timeout kill; version capability map (§13). |
| R2 | Custom-mainloop carts and wall-clock reads limit determinism/telemetry. | `flip()`-hook mode (§7.8) for capture/timeout/input; documented limits; fixed seed for the common case. |
| R3 | Aggressive minify can break reflection/string-built identifiers. | Default to `safe`; auto-exempt detectable names; document. |
| R4 | Structured SFX authoring may be low-value for text agents. | Ship read + basic write; validate demand before deeper investment. |
| R5 | Static PNG colour-fit ≠ PICO-8's built-in `IMPORT` exactly. | Nearest-colour default; optional binary-backed exact-fit when available. |
| R6 | Compressed-size parity (shrinko8 vs PICO-8) is upper-bound, not identical. | Treat as conservative; offer a final binary round-trip check before shipping an image. |
| R7 | Licensing/ToS of headlessly driving a user's PICO-8. | Confirm terms; never bundle or redistribute the binary or paid carts (D7). |

---

## Appendix A — Tool schemas (authoritative)

Envelope per §4.3. `→` shows the success payload beyond `{ok:true}`.

```jsonc
p8_read_cart   { path }
  → { code_tabs:[{index,tokens,preview}], budget, sprites:{used,flags_summary},
      map:{w,h,nonempty_tiles}, sfx:{used}, music:{patterns} }
p8_read_code   { path, tab? }                         → { code, budget }
p8_write_code  { path, tab?, code }                   → { budget }          // creates if absent
p8_edit_code   { path, tab?, op:"replace_range|search_replace|append",
                 range:[start,end]?, find?, replace } → { diff, budget }
p8_parse       { path }                               → { parses, errors:[{line,col,message}] }
p8_lint        { path }                               → { lints:[{level,line,message}] }
p8_stats       { path }                               → { budget }
p8_minify      { path, level:"safe|aggressive", target:"tokens|chars|compressed",
                 in_place?:false, out? }              → { before, after, removed, out_path }
p8_convert     { path, out }                          → { out_path }        // format from extension
p8_get_sprite  { path, n }                            → { pixels[8][8], flags[8] }
p8_set_sprite  { path, n, pixels[8][8], flags[8]? }   → { ok }
p8_set_flags   { path, n, flags[8] }                  → { ok }
p8_get_map     { path, x, y, w, h }                   → { tiles[h][w] }
p8_set_map     { path, x, y, tiles[][] }              → { ok }
p8_import_png  { path, png, x?:0, y?:0, shrink?:1 }   → { ok }
p8_export_png  { path, out }                          → { out_path }
p8_get_sfx     { path, n }                            → { notes[…], speed, loop_start, loop_end, filters }
p8_set_sfx     { path, n, notes[…], speed?, loop_start?, loop_end?, filters? } → { ok }
p8_run         { …§4.4 request… }                     → { …§4.4 result… }   // binary
p8_export      { path, format:"html|bin|png", extra_carts[]?, icon{index,size,transparent}? }
  → { out_paths[] }                                                        // binary
p8_doctor      { }                                    → { static, run, export, pico8_version }
```

## Appendix B — `.p8` section reference (encoder view)

| Section | Lines × width | Encodes | Notes |
|---|---|---|---|
| header | 2 | magic + `version N` | permissive decode |
| `__lua__` | n | plaintext code (all tabs) | always present |
| `__gfx__` | 128 × 128 hex | sprite pixels | pixel-order nybbles; rows 64–127 alias map rows 32–63 |
| `__gff__` | 2 × 256 hex | sprite flags | |
| `__label__` | ≤128 × 128 hex | cart label | optional |
| `__map__` | 32 × 256 hex | tile rows 0–31 | rows 32–63 live in `__gfx__` |
| `__sfx__` | 64 × 168 hex | 64 SFX, 84 bytes each | |
| `__music__` | n × … | patterns | flow flags per pattern |

Empty and trailing-default lines/sections are omitted to match PICO-8 output.

## Appendix C — Dependencies

| Dependency | Use | Notes |
|---|---|---|
| Python ≥ 3.11 | core runtime | D1 |
| shrinko8 (pinned) | tokenise, count, minify, lint, `.p8.png`/`.rom` codec | Pillow required for PNG |
| picotool (pinned) | PICO-8 Lua parser/AST, `.p8`/`.p8.png` read, `.p8` write | D2 |
| Pillow | PNG decode/encode, colour-fit, resize | §7.6 |
| MCP Python SDK | server, tools, resources, image content, transports | §5 |
| Typer | CLI | §6 |
| PyInstaller (build) | optional single-file CLI | §11 |
| PICO-8 (user-supplied) | L3 only | D7; not bundled |
| Xvfb (Linux runtime) | virtual framebuffer for headless runs | §6.1/§7.9 |
