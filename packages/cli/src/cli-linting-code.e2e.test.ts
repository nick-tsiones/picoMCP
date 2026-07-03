import { copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, qdJsonAllowExit, root } from "./cli-e2e-fixtures.js";

installCliFixture();

const FIXTURES_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "test-fixtures",
);

describe("cart lint", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  // Behavior: linting-code/lint-a-cartridge-without-issues
  it("reports no issues for clean code", async () => {
    const result = await qdJson("cart", "lint", cartPath, "--json");

    expect(result.issues).toEqual([]);
    expect(result.tabCount).toBe(2);
  });

  // Behavior: linting-code/lint-a-cartridge-with-issues
  it("reports specific lines and what is problematic about them", async () => {
    const lintCartPath = path.join(root, "lint-test.p8");
    // Code with issues: non-local variable, deprecated function, long variable name
    const code = [
      "pico-8 cartridge // http://www.pico-8.com",
      "version 42",
      "__lua__",
      "-- global assignment without local",
      "myglobal = 42",
      "-- deprecated mapdraw function",
      "mapdraw(0, 0, 0, 0, 16, 16)",
      "-- long variable name",
      "this_is_an_extremely_long_variable_name_that_exceeds_twenty_chars = 1",
      "__gfx__",
      "__gff__",
      "__map__",
      "__sfx__",
      "__music__",
      "",
    ].join("\n");
    await writeFile(lintCartPath, code, "utf-8");

    const result = await qdJson("cart", "lint", lintCartPath, "--json");

    expect(result.issues.length).toBeGreaterThan(0);

    // Should have a warning about missing local
    const localIssue = result.issues.find(
      (i: { message: string }) => i.message.includes("local"),
    );
    expect(localIssue).toBeDefined();
    expect(localIssue.line).toBe(2); // "myglobal = 42" is line 2 in the tab
    expect(localIssue.severity).toBe("warning");

    // Should have a warning about deprecated mapdraw
    const depIssue = result.issues.find(
      (i: { message: string }) => i.message.includes("mapdraw"),
    );
    expect(depIssue).toBeDefined();
    expect(depIssue.severity).toBe("warning");

    // Should have a warning about long variable name
    const longIssue = result.issues.find(
      (i: { message: string }) => i.message.includes("long"),
    );
    expect(longIssue).toBeDefined();
    expect(longIssue.severity).toBe("warning");
  });

  // Behavior: linting-code/a-cartridge-that-does-not-exist-reports-the-missing-cartridge
  it("reports that the cartridge was not found", async () => {
    const nonExistentPath = path.join(root, "does-not-exist.p8");

    const result = await qdJsonAllowExit("cart", "lint", nonExistentPath, "--json");

    expect(result.exitCode).toBeFalsy();
    expect(result.json.error).toBe("cartridge was not found");
  });
});