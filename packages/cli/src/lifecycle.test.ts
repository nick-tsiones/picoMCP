import { describe, expect, it } from "vite-plus/test";
import {
  advanceNextAction,
  commitShaFromAdvanceOptions,
  shouldCompleteForAdvance,
} from "./lifecycle.js";

describe("lifecycle DAG completion helpers", () => {
  it("treats non-terminal statuses as completion candidates", () => {
    expect(shouldCompleteForAdvance("draft")).toBe(true);
    expect(shouldCompleteForAdvance("working")).toBe(true);
    expect(shouldCompleteForAdvance("blocked")).toBe(true);
    expect(shouldCompleteForAdvance("review")).toBe(false);
    expect(shouldCompleteForAdvance("mergeable")).toBe(false);
    expect(shouldCompleteForAdvance("done")).toBe(false);
  });

  it("resolves merge commit selection from advance options", () => {
    expect(commitShaFromAdvanceOptions({ "use-existing-commit": "abc123" })).toBe("abc123");
    expect(commitShaFromAdvanceOptions({ "already-merged-at": "def456" })).toBe("def456");
    expect(commitShaFromAdvanceOptions({})).toBeUndefined();
  });

  it("points mergeable nodes to the real merge step", () => {
    expect(advanceNextAction("mergeable", false)).toMatch(/real git\/GitHub merge/);
    expect(advanceNextAction("mergeable", true)).toBeNull();
    expect(advanceNextAction("done", false)).toBeNull();
  });
});
