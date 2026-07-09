# Linting Code — Completion Evidence

## Node Info
- **Title:** Linting code
- **Kind:** feature
- **Priority:** P1
- **Risk:** medium
- **Status:** review

## SDD Design Slice
static_svc, cart_repo, cli_adapter, mcp_adapter.

## Behaviors Verified
- linting-code/clean-code-produces-no-lints ✅
- linting-code/lint-reports-likely-problems ✅
- linting-code/a-cartridge-that-does-not-exist-reports-the-missing-cartridge ✅

---

## Verification 1: Build

```
$ cd /tmp/dcode/issue-linting-code && corepack pnpm run build
...
✔ Build complete in 1061ms
```

**Result:** Build passes with zero errors.

---

## Verification 2: E2E Tests

```
$ corepack pnpm run test -- --run packages/cli/src/cli-linting-code.e2e.test.ts

 RUN  v4.1.9 /tmp/dcode/issue-linting-code

 ✓ packages/cli/src/cli-linting-code.e2e.test.ts (3 tests) 82ms

 Test Files  1 passed (1)
      Tests  3 passed (3)
   Start at  20:27:29
   Duration   634ms
```

**Result:** All 3 tests pass — covering clean code (no lints), problematic code (lint reports), and missing cartridge (error reporting).

---

## Verification 3: Real CLI Surface — Clean Cartridge (no lints)

```
$ qd cart lint <clean-cart>.p8 --json
{
  "issues": [],
  "tabCount": 2
}
```

**Result:** No lint issues reported for clean code — confirms `linting-code/clean-code-produces-no-lints`.

---

## Verification 4: Real CLI Surface — Problematic Cartridge (lint reports)

```
$ qd cart lint <lint-test>.p8 --json
{
  "issues": [
    {
      "line": 2,
      "column": 1,
      "message": "\"myglobal\" is assigned without \"local\"; consider using \"local myglobal = ...\"",
      "severity": "warning"
    },
    {
      "line": 4,
      "column": 1,
      "message": "mapdraw was removed in PICO-8 0.1.12; use map() instead",
      "severity": "warning"
    },
    {
      "line": 6,
      "column": 1,
      "message": "Variable name \"this_is_an_extremely_long_variable_name_that_exceeds_twenty_chars\" is very long (65 chars); consider using a shorter name",
      "severity": "warning"
    },
    {
      "line": 6,
      "column": 1,
      "message": "\"this_is_an_extremely_long_variable_name_that_exceeds_twenty_chars\" is assigned without \"local\"; consider using \"local this_is_an_extremely_long_variable_name_that_exceeds_twenty_chars = ...\"",
      "severity": "warning"
    }
  ],
  "tabCount": 1
}
```

**Result:** Lint correctly reports: missing `local`, deprecated `mapdraw()`, long variable names — confirms `linting-code/lint-reports-likely-problems`.

---

## Verification 5: Real CLI Surface — Missing Cartridge

```
$ qd cart lint <does-not-exist>.p8 --json
{
  "error": "cartridge was not found",
  "message": "cartridge was not found"
}
```

**Result:** Graceful error when cartridge does not exist.

---

## Audit Compliance

| Requirement | Evidence |
|---|---|
| Each verification drives the real code path end-to-end | All CLIs invoked via built CLI entrypoint (`packages/cli/dist/index.mjs`) against real temp directories |
| Reject tautological checks | Each lint rule (no-local, deprecated func, long name) is a substantive semantic check, not a tautology |
| Negation check | Clean cartridge truly produces zero lints (no trivial "no issues" output that skips analysis); the lint engine runs the same code path in both cases |
| Every acceptance clause has real-surface evidence | Both `clean-code-produces-no-lints` and `lint-reports-likely-problems` have real CLI `--json` output shown above |