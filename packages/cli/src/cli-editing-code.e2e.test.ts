import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, qdJsonAllowExit, qdRaw, root } from "./cli-e2e-fixtures.js";
import { CartRepo } from "@cat-cave/qdcli-core";

installCliFixture();

const FIXTURES_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "test-fixtures",
);

describe("cart edit", () => {
  let cartPath: string;
  let repo: CartRepo;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    repo = new CartRepo();
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  // ── edit range ──────────────────────────────────────────────────────────

  // Behavior: editing-code/edit-a-range-of-lines
  it("replaces a specific range of lines and reports updated size", async () => {
    const newCode = 'print("replaced line")';
    const result = await qdJson(
      "cart", "edit", "range", cartPath,
      "--from", "1", "--to", "1", "--code", newCode, "--json",
    );

    expect(result.charCount).toBeGreaterThan(0);
    expect(result.headroom).toBeGreaterThan(0);
    expect(result.replacedRange).toEqual({ from: 1, to: 1 });

    // Verify only the specified lines changed
    const cart = await repo.load(root, cartPath);
    expect(cart.code[0]).toBe(newCode);
    // Tab 1 should be unchanged
    expect(cart.code[1]).toContain("function _draw()");
  });

  // Behavior: edit range with multiple lines
  it("replaces multiple lines and leaves other tabs unchanged", async () => {
    const codeLines = 'print("line a")\nprint("line b")';
    const result = await qdJson(
      "cart", "edit", "range", cartPath,
      "--from", "1", "--to", "1", "--code", codeLines, "--json",
    );

    expect(result.replacedRange).toEqual({ from: 1, to: 1 });
    expect(result.tabCount).toBe(3); // original had 2, we added 2 lines for 1 = 3 tabs

    const cart = await repo.load(root, cartPath);
    expect(cart.code[0]).toBe('print("line a")');
    expect(cart.code[1]).toBe('print("line b")');
    expect(cart.code[2]).toContain("function _draw()");
  });

  // ── edit replace ────────────────────────────────────────────────────────

  // Behavior: editing-code/edit-by-finding-and-replacing-text
  it("replaces matching occurrences by finding and replacing text", async () => {
    const result = await qdJson(
      "cart", "edit", "replace", cartPath,
      "--find", "print", "--replace", "printh", "--json",
    );

    expect(result.replaced).toBeGreaterThanOrEqual(1);

    const cart = await repo.load(root, cartPath);
    expect(cart.code[0]).toContain('printh("hello")');
    expect(cart.code[0]).not.toContain('print("hello")');
  });

  // Behavior: editing-code/an-unmatched-search-changes-nothing
  it("reports nothing matched when find text is not present", async () => {
    const result = await qdJson(
      "cart", "edit", "replace", cartPath,
      "--find", "NONEXISTENT_TEXT_XYZ", "--replace", "foo", "--json",
    );

    expect(result.error).toBe("nothing matched");
    expect(result.message).toBeDefined();

    // Verify code is unchanged
    const cart = await repo.load(root, cartPath);
    expect(cart.code[0]).toContain('print("hello")');
  });

  // ── edit append ─────────────────────────────────────────────────────────

  // Behavior: editing-code/append-code-to-a-cartridge
  it("appends code at the end and leaves the rest unchanged", async () => {
    const appendedCode = 'print("appended")';
    const result = await qdJson(
      "cart", "edit", "append", cartPath,
      "--code", appendedCode, "--json",
    );

    expect(result.charCount).toBeGreaterThan(0);
    expect(result.tabCount).toBe(3); // original 2 + 1 new

    const cart = await repo.load(root, cartPath);
    expect(cart.code[0]).toContain('print("hello")');
    expect(cart.code[1]).toContain("function _draw()");
    expect(cart.code[2]).toBe(appendedCode);
  });

  // ── edit errors ─────────────────────────────────────────────────────────

  // Behavior: editing-code/an-unmatched-search-changes-nothing (covered above)

  // Behavior: editing-code/editing-a-tab-that-does-not-exist-is-rejected
  it("rejects editing a tab that does not exist", async () => {
    const result = await qdJson(
      "cart", "edit", "range", cartPath,
      "--from", "99", "--to", "99", "--code", "x = 1", "--json",
    );

    expect(result.error).toBeDefined();
    expect(result.error).toContain("does not exist");
    expect(result.message).toBeDefined();
  });

  // Behavior: editing-code/removing-code-increases-the-reported-headroom
  it("removing code increases the reported headroom", async () => {
    // First, get current headroom
    const before = await qdJson("cart", "size", cartPath, "--json");

    // Replace tab 1 with shorter code
    const result = await qdJson(
      "cart", "edit", "range", cartPath,
      "--from", "1", "--to", "1", "--code", "x=1", "--json",
    );

    expect(result.headroom).toBeGreaterThan(before.headroom);
  });
});