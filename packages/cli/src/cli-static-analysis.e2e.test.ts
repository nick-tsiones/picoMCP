import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdAt, qdJson, qdJsonAllowExit, qdRaw, root } from "./cli-e2e-fixtures.js";
import { createMinimalPng, extractP8FromPng } from "@cat-cave/qdcli-core";

installCliFixture();

const FIXTURES_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "test-fixtures",
);

describe("cart size", () => {
  let cartPath: string;
  let emptyCartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    emptyCartPath = path.join(root, "empty-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
    await copyFile(path.join(FIXTURES_DIR, "empty-cart.p8"), emptyCartPath);
  });

  // Behavior: cartridge-size/below-the-limit
  it("reports headroom remaining when below the limit", async () => {
    const result = await qdJson("cart", "size", cartPath, "--json");

    expect(result.charCount).toBeGreaterThan(0);
    expect(result.limit).toBe(65536);
    expect(result.headroom).toBeGreaterThan(0);
    expect(result.aboveLimit).toBe(false);
    expect(result.atLimit).toBe(false);
    expect(result.status).toBe("below");
    expect(result.message).toContain("headroom remaining");
  });

  // Behavior: cartridge-size/above-the-limit
  it("reports it exceeds the token limit by N", async () => {
    // Create a cartridge that exceeds the limit
    const bigCartPath = path.join(root, "big-cart.p8");
    const bigCode = "x".repeat(70000); // exceeds 65536
    const bigContent = [
      "pico-8 cartridge // http://www.pico-8.com",
      "version 42",
      "__lua__",
      bigCode,
      "__gfx__",
      "__gff__",
      "__map__",
      "__sfx__",
      "__music__",
      "",
    ].join("\n");
    await writeFile(bigCartPath, bigContent, "utf-8");

    const result = await qdJson("cart", "size", bigCartPath, "--json");

    expect(result.aboveLimit).toBe(true);
    expect(result.status).toBe("above");
    expect(result.message).toContain("exceeds the token limit by");
    expect(result.message).toContain(String(result.charCount - 65536));
  });

  // Behavior: cartridge-size/at-the-limit
  it("reports that it exactly reaches the limit", async () => {
    const exactCartPath = path.join(root, "exact-cart.p8");
    const exactCode = "x".repeat(65536);
    const exactContent = [
      "pico-8 cartridge // http://www.pico-8.com",
      "version 42",
      "__lua__",
      exactCode,
      "__gfx__",
      "__gff__",
      "__map__",
      "__sfx__",
      "__music__",
      "",
    ].join("\n");
    await writeFile(exactCartPath, exactContent, "utf-8");

    const result = await qdJson("cart", "size", exactCartPath, "--json");

    expect(result.atLimit).toBe(true);
    expect(result.status).toBe("at");
    expect(result.message).toContain("exactly reaches the limit");
  });
});

describe("cart parse", () => {
  let cartPath: string;
  let emptyCartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    emptyCartPath = path.join(root, "empty-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
    await copyFile(path.join(FIXTURES_DIR, "empty-cart.p8"), emptyCartPath);
  });

  // Behavior: parsing/valid-code-is-parsed-successfully
  it("reports that the code is valid", async () => {
    const result = await qdJson("cart", "parse", cartPath, "--json");

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.code).toContain('print("hello")');
    expect(result.tabCount).toBe(2);
  });

  // Behavior: parsing/code-with-syntax-errors-reports-the-errors
  it("reports the syntax errors found", async () => {
    const badCartPath = path.join(root, "bad-cart.p8");
    const badContent = [
      "pico-8 cartridge // http://www.pico-8.com",
      "version 42",
      "__lua__",
      'print("unclosed',
      'x = {1, 2, 3)',
      "__gfx__",
      "__gff__",
      "__map__",
      "__sfx__",
      "__music__",
      "",
    ].join("\n");
    await writeFile(badCartPath, badContent, "utf-8");

    const result = await qdJson("cart", "parse", badCartPath, "--json");

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // Should have errors about unclosed quote and mismatched brace/paren
    const errorMessages = result.errors.join(" ");
    expect(errorMessages).toMatch(/unclosed/i);
  });

  // Behavior: parsing/parsing-a-cartridge-with-an-empty-program-succeeds
  it("reports a valid (but empty) program", async () => {
    const result = await qdJson("cart", "parse", emptyCartPath, "--json");

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.tabCount).toBe(0);
  });

  // Behavior: parsing/parsing-a-missing-cartridge-reports-the-missing-cartridge
  it("reports that the cartridge was not found", async () => {
    const nonExistentPath = path.join(root, "does-not-exist.p8");

    const result = await qdJsonAllowExit("cart", "parse", nonExistentPath, "--json");

    expect(result.exitCode).toBeFalsy();
    expect(result.json.error).toBe("cartridge was not found");
  });
});

describe("cart convert", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  // Behavior: format-conversion/convert-p8-to-p8png
  it("a .p8.png file is produced", async () => {
    const result = await qdJson("cart", "convert", cartPath, "--to", "p8.png", "--json");

    expect(result.success).toBe(true);
    expect(result.outputPath).toContain(".p8.png");
  });

  // Behavior: format-conversion/convert-p8png-to-p8
  it("a .p8 file is produced from .p8.png", async () => {
    // First convert to .p8.png
    const convertResult = await qdJson("cart", "convert", cartPath, "--to", "p8.png", "--json");
    const pngPath = convertResult.outputPath;

    // Then convert back to .p8
    const roundTripPath = path.join(root, "roundtrip.p8");
    const result = await qdJson(
      "cart",
      "convert",
      pngPath,
      "--to",
      "p8",
      "--output",
      roundTripPath,
      "--json",
    );

    expect(result.success).toBe(true);
    expect(result.outputPath).toBe(roundTripPath);
  });

  // Behavior: format-conversion/converting-a-missing-file-reports-the-error
  it("reports that the source cartridge was not found", async () => {
    const nonExistentPath = path.join(root, "does-not-exist.p8");

    const result = await qdJsonAllowExit("cart", "convert", nonExistentPath, "--to", "p8.png", "--json");

    expect(result.json.error).toBe("cartridge was not found");
  });

  it("round-trips .p8 -> .p8.png -> .p8 identically", async () => {
    const originalContent = await (await import("node:fs/promises")).readFile(cartPath, "utf-8");

    // Convert to .p8.png
    const convertResult = await qdJson("cart", "convert", cartPath, "--to", "p8.png", "--json");
    const pngPath = convertResult.outputPath;

    // Convert back to .p8
    const roundTripPath = path.join(root, "roundtrip.p8");
    await qdJson("cart", "convert", pngPath, "--to", "p8", "--output", roundTripPath, "--json");

    const roundTripContent = await (await import("node:fs/promises")).readFile(roundTripPath, "utf-8");
    expect(roundTripContent).toBe(originalContent);
  });
});

describe("cart flags", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  // Behavior: editing-sprite-flags/get-the-current-flags-for-every-sprite
  it("receives a table of 256 flags", async () => {
    const result = await qdJson("cart", "flags", "get", cartPath, "--json");

    expect(result.flags).toBeDefined();
    expect(Array.isArray(result.flags)).toBe(true);
    expect(result.flags.length).toBe(256);
    // All flags should be valid uint8 values
    for (const flag of result.flags) {
      expect(flag).toBeGreaterThanOrEqual(0);
      expect(flag).toBeLessThanOrEqual(255);
    }
  });

  // Behavior: editing-sprite-flags/set-one-flag
  it("a single sprite's flags are updated and all others are unchanged", async () => {
    // Get current flags
    const before = await qdJson("cart", "flags", "get", cartPath, "--json");

    // Set sprite 5 (1-indexed) to value 7
    const setResult = await qdJson(
      "cart",
      "flags",
      "set",
      cartPath,
      "--sprite",
      "5",
      "--value",
      "7",
      "--json",
    );

    expect(setResult.spriteIndex).toBe(4); // 0-indexed
    expect(setResult.newValue).toBe(7);

    // Verify only that sprite changed
    const after = await qdJson("cart", "flags", "get", cartPath, "--json");
    expect(after.flags[4]).toBe(7);

    for (let i = 0; i < 256; i++) {
      if (i !== 4) {
        expect(after.flags[i]).toBe(before.flags[i]);
      }
    }
  });

  // Behavior: editing-sprite-flags/bulk-set-every-flag-at-once
  it("every sprite's flag is set to the provided pattern", async () => {
    const pattern = Array.from({ length: 256 }, (_, i) => i % 256);
    const patternStr = pattern.join(",");

    const result = await qdJson(
      "cart",
      "flags",
      "bulk",
      cartPath,
      "--pattern",
      patternStr,
      "--json",
    );

    expect(result.flags).toEqual(pattern);
    expect(result.changed).toBeGreaterThan(0);

    // Verify persisted
    const after = await qdJson("cart", "flags", "get", cartPath, "--json");
    expect(after.flags).toEqual(pattern);
  });
});

describe("minifying code", () => {
  let cartPath: string;
  let emptyCartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    emptyCartPath = path.join(root, "empty-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
    await copyFile(path.join(FIXTURES_DIR, "empty-cart.p8"), emptyCartPath);
  });

  // Behavior: minifying-code/a-cartridge-is-minified-with-no-options
  it("a cartridge is minified with no options", async () => {
    // Create a cartridge with comments and whitespace
    const verboseCartPath = path.join(root, "verbose-cart.p8");
    const verboseContent = [
      "pico-8 cartridge // http://www.pico-8.com",
      "version 42",
      "__lua__",
      "-- This is a comment",
      "x = 1",
      "",
      "-- Another comment",
      "y   =   2   +   3",
      "",
      "--[[",
      "  Multi-line comment",
      "  block",
      "]]",
      "z = x + y",
      "__gfx__",
      "__gff__",
      "__map__",
      "__sfx__",
      "__music__",
      "",
    ].join("\n");
    await writeFile(verboseCartPath, verboseContent, "utf-8");

    const result = await qdJson("cart", "minify", verboseCartPath, "--json");

    expect(result.originalChars).toBeGreaterThan(0);
    expect(result.charsSaved).toBeGreaterThan(0);
    expect(result.minifiedChars).toBeLessThan(result.originalChars);
    expect(result.renamed).toBe(false);

    // The minified cartridge should still be loadable
    const overview = await qdJson("cart", "overview", verboseCartPath, "--json");
    expect(overview.code).not.toContain("--");
    expect(overview.code).toContain("x = 1");
    expect(overview.code).toContain("y = 2 + 3");
    expect(overview.code).toContain("z = x + y");
  });

  // Behavior: minifying-code/minify-with-renaming-enabled
  it("minify with renaming enabled", async () => {
    const verboseContent = [
      "pico-8 cartridge // http://www.pico-8.com",
      "version 42",
      "__lua__",
      "-- A program with named variables",
      "player_x = 10",
      "player_y = 20",
      "enemy_health = 100",
      "score = player_x + player_y",
      "__gfx__",
      "__gff__",
      "__map__",
      "__sfx__",
      "__music__",
      "",
    ].join("\n");
    const progPath = path.join(root, "prog.p8");
    await writeFile(progPath, verboseContent, "utf-8");

    const result = await qdJson("cart", "minify", progPath, "--rename", "--json");

    expect(result.renamed).toBe(true);
    expect(result.charsSaved).toBeGreaterThan(0);
    expect(result.renameMap).toBeDefined();

    // Verify variable names were shortened
    const overview = await qdJson("cart", "overview", progPath, "--json");
    expect(overview.code).not.toContain("player_x");
    expect(overview.code).not.toContain("player_y");
    expect(overview.code).not.toContain("enemy_health");
    expect(overview.code).not.toContain("score");
  });

  // Behavior: minifying-code/minify-a-cartridge-that-cannot-be-shrunk-further
  it("minify a cartridge that cannot be shrunk further", async () => {
    // Create already-minimal code
    const minimalContent = [
      "pico-8 cartridge // http://www.pico-8.com",
      "version 42",
      "__lua__",
      "x=1",
      "y=2",
      "z=x+y",
      "__gfx__",
      "__gff__",
      "__map__",
      "__sfx__",
      "__music__",
      "",
    ].join("\n");
    const minimalPath = path.join(root, "minimal-cart.p8");
    await writeFile(minimalPath, minimalContent, "utf-8");

    const result = await qdJson("cart", "minify", minimalPath, "--json");

    // The code is unchanged and charsSaved should be 0
    expect(result.charsSaved).toBe(0);

    // The code is unchanged
    const overview = await qdJson("cart", "overview", minimalPath, "--json");
    expect(overview.code).toContain("x=1");
    expect(overview.code).toContain("y=2");
    expect(overview.code).toContain("z=x+y");
  });

  // Behavior: minifying-code/minify-an-empty-cartridge
  it("minify an empty cartridge", async () => {
    const result = await qdJson("cart", "minify", emptyCartPath, "--json");

    expect(result.charsSaved).toBe(0);
    expect(result.originalChars).toBe(0);
    expect(result.minifiedChars).toBe(0);

    // The cartridge still has no code
    const overview = await qdJson("cart", "overview", emptyCartPath, "--json");
    expect(overview.code).toBe("");
    expect(overview.tabCount).toBe(0);
  });
});