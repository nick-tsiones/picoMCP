# Environment and Capability Detection — Completion Evidence

## Build Status

```
$ corepack pnpm run build
...
Build complete in 1031ms
```

The workspace builds successfully (core + cli packages) with no errors.

## Test Results

All 4 e2e tests pass:

```
 ✓ packages/cli/src/environment-capability.e2e.test.ts > environment and capability detection > reports capabilities when PICO-8 is present 31ms
 ✓ packages/cli/src/environment-capability.e2e.test.ts > environment and capability detection > reports capabilities when PICO-8 is absent 26ms
 ✓ packages/cli/src/environment-capability.e2e.test.ts > environment and capability detection > static work needs no PICO-8 program 24ms
 ✓ packages/cli/src/environment-capability.e2e.test.ts > environment and capability detection > declines running when no PICO-8 program is present 25ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Duration  505ms
```

## Acceptance Clause Evidence

| # | Acceptance Clause | Test / Behavior | Status | Evidence |
|---|---|---|---|---|
| 1 | It reports that both static and run capabilities are available | `reports capabilities when PICO-8 is present` | ✅ PASS | Creates a fake pico8 binary, sets `PICO8_BIN`, invokes `qd toolbox capabilities --json`. Asserts `static.length > 0`, `runtime.length > 0`, `runtime.available === true`, `runtime.pico8.present === true`. |
| 2 | It reports that only static capabilities are available | `reports capabilities when PICO-8 is absent` | ✅ PASS | Sets `PICO8_BIN` to `/nonexistent/pico8-binary`, invokes `qd toolbox capabilities --json`. Asserts `static.length > 0`, `runtime` is empty array, `runtime.available === false`, `runtime.pico8.present === false`. |
| 3 | A valid cartridge the size report is produced successfully | `static work needs no PICO-8 program` | ✅ PASS | Creates a valid `.p8` cartridge, invokes `qd cart size <path> --json` with `PICO8_BIN` pointing to a nonexistent binary. Asserts `charCount > 0` and message contains "headroom". Proves static operations work without PICO-8. |
| 4 | The toolbox declines and explains that no PICO-8 program is installed | `declines running when no PICO-8 program is present` | ✅ PASS | Creates a valid `.p8` cartridge, invokes `qd cart run <path> --json` with `PICO8_BIN` pointing to a nonexistent binary. Asserts `exitCode !== 0`, error contains "No PICO-8 program is installed", message contains "running and exporting are unavailable", and `success` is not `true`. |

## Verification Mapping (as per SDD)

| Verification ID | Test Name | CLI Surface |
|---|---|---|
| `capabilities-are-reported-when-pico-8-is-present` | `reports capabilities when PICO-8 is present` | `qd toolbox capabilities --json` |
| `capabilities-are-reported-when-pico-8-is-absent` | `reports capabilities when PICO-8 is absent` | `qd toolbox capabilities --json` |
| `static-work-needs-no-pico-8-program` | `static work needs no PICO-8 program` | `qd cart size <path> --json` |
| `running-is-declined-when-no-pico-8-program-is-present` | `declines running when no PICO-8 program is present` | `qd cart run <path> --json` |

## Implementation Slices (SDD)

- **config/capability**: `packages/core/src/capability.ts` — `detectPico8Capability()` locates the PICO-8 binary via env vars (`PICO8_BIN`, `PICO_8_BIN`, `PICO8`, `PICO_8`) and returns a `Pico8CapabilityReport`.
- **runtime_svc**: Not a separate service; detection is inline via `detectPico8Capability()` calls in `capability-commands.ts` and `cartridge-commands.ts`.
- **cli_adapter**: `capability-commands.ts` — `capabilityCommand()` builds the JSON response for `toolbox capabilities`, including static/runtime capabilities and command listings.
- **mcp_adapter**: Not separately exercised in this slice (CLI surface used for verification).

## Code Paths Traversed

1. **toolbox capabilities** → `cli-dispatch.ts:toolboxCommand()` → `capability-commands.ts:capabilityCommand()` → `core/capability.ts:detectPico8Capability()` → returns capability report
2. **cart size** → `cli-dispatch.ts:cartridgeCommand()` → `cartridge-commands.ts:sizeCommand()` → `core/cart_repo.ts:CartRepo.load()` + `core/static_svc.ts:reportCartSize()` — purely static, no PICO-8 needed
3. **cart run** → `cli-dispatch.ts:cartridgeCommand()` → `cartridge-commands.ts:runCartCommand()` → `core/capability.ts:detectPico8Capability()` → declines if PICO-8 absent