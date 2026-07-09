# Editing Code — Completion Evidence Report

## Summary

- **Node**: editing-code
- **Status**: PASS ✓
- **Worktree**: `/tmp/dcode/issue-editing-code`
- **Kind**: feature | **Priority**: P1 | **Risk**: medium

All 6 verification behaviors are proven end-to-end through the real CLI surface (7 test cases, all passing).

---

## Verification Results

| Behavior | Test | Status |
|---|---|---|
| editing-code/edit-a-range-of-lines | replaces a specific range of lines and reports updated size | PASS ✓ |
| editing-code/edit-a-range-of-lines | replaces multiple lines and leaves other tabs unchanged | PASS ✓ |
| editing-code/edit-by-finding-and-replacing-text | replaces matching occurrences by finding and replacing text | PASS ✓ |
| editing-code/append-code-to-a-cartridge | appends code at the end and leaves the rest unchanged | PASS ✓ |
| editing-code/an-unmatched-search-changes-nothing | reports nothing matched when find text is not present | PASS ✓ |
| editing-code/editing-a-tab-that-does-not-exist-is-rejected | rejects editing a tab that does not exist | PASS ✓ |
| editing-code/removing-code-increases-the-reported-headroom | removing code increases the reported headroom | PASS ✓ |

---

## Test Output

```
 RUN  v4.1.9 /tmp/dcode/issue-editing-code

 ✓ packages/cli/src/cli-editing-code.e2e.test.ts > cart edit > replaces a specific range of lines and reports updated size 29ms
 ✓ packages/cli/src/cli-editing-code.e2e.test.ts > cart edit > replaces multiple lines and leaves other tabs unchanged 24ms
 ✓ packages/cli/src/cli-editing-code.e2e.test.ts > cart edit > replaces matching occurrences by finding and replacing text 24ms
 ✓ packages/cli/src/cli-editing-code.e2e.test.ts > cart edit > reports nothing matched when find text is not present 27ms
 ✓ packages/cli/src/cli-editing-code.e2e.test.ts > cart edit > appends code at the end and leaves the rest unchanged 25ms
 ✓ packages/cli/src/cli-editing-code.e2e.test.ts > cart edit > rejects editing a tab that does not exist 22ms
 ✓ packages/cli/src/cli-editing-code.e2e.test.ts > cart edit > removing code increases the reported headroom 22ms

 Test Files  1 passed (1)
      Tests  7 passed (7)
   Start at  20:33:41
   Duration  530ms
```

---

## Evidence Per Acceptance Clause

### 1. "only those lines change its updated size is reported"
- **Proven by**: `replaces a specific range of lines and reports updated size`
- Assertions: `result.charCount > 0`, `result.headroom > 0`, `result.replacedRange = { from: 1, to: 1 }`, `cart.code[0]` equals new code, `cart.code[1]` still contains original content.

### 2. "the intended occurrences are replaced"
- **Proven by**: `replaces matching occurrences by finding and replacing text`
- Assertions: `result.replaced >= 1`, `cart.code[0]` contains `printh` (replaced), does NOT contain `print` (original).

### 3. "the new code appears at the end and the rest is unchanged"
- **Proven by**: `appends code at the end and leaves the rest unchanged`
- Assertions: `result.tabCount = 3` (was 2), `cart.code[0]` unchanged, `cart.code[1]` unchanged, `cart.code[2]` equals appended code.

### 4. "the code is unchanged the toolbox reports that nothing matched"
- **Proven by**: `reports nothing matched when find text is not present`
- Assertions: `result.error = "nothing matched"`, `result.message` is defined, `cart.code[0]` still contains `print("hello")` unchanged.

### 5. "the toolbox reports that the tab does not exist"
- **Proven by**: `rejects editing a tab that does not exist`
- Assertions: `result.error` contains `"does not exist"`, `result.message` is defined.

### 6. "the reported headroom against the token limit increases"
- **Proven by**: `removing code increases the reported headroom`
- Assertions: `result.headroom > before.headroom` (headroom after removal is strictly greater than headroom before).

---

## Build & Typecheck Status

| Check | Status |
|---|---|
| Build (`build`) | PASS ✓ |
| Typecheck (`typecheck`) | PASS ✓ |
| Format check (`check`) | PASS ✓ |

---

## Implementation Summary

The editing code slice is implemented across these layers:

| Layer | File | Contribution |
|---|---|---|
| **cart_repo** | `packages/core/src/cart_repo.ts` | Parse/save `.p8` cartridge files with code tabs |
| **static_svc** | `packages/core/src/static_svc.ts` | `reportCartSize()` computes charCount, headroom, limit |
| **cli_adapter** | `packages/cli/src/cartridge-edit-commands.ts` | `editRangeCommand`, `editReplaceCommand`, `editAppendCommand` |
| **cli_dispatch** | `packages/cli/src/cli-dispatch.ts` | Routes `cart edit range`, `cart edit replace`, `cart edit append` |
| **E2E tests** | `packages/cli/src/cli-editing-code.e2e.test.ts` | 7 tests covering all 6 behaviors |

No MCP adapter changes were needed for this node — the behaviors are proven through the real CLI surface (`qd cart edit ...`).