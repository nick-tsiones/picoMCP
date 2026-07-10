import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, root } from "./cli-e2e-fixtures.js";

installCliFixture();

const PICO8_CHAR_LIMIT = 65536;

function buildCart(luaCode: string): string {
  return [
    "pico-8 cartridge // http://www.pico-8.com",
    "version 42",
    "__lua__",
    luaCode,
    "__gfx__",
    "__gff__",
    "__map__",
    "__sfx__",
    "__music__",
    "",
  ].join("\n");
}

// ────────────────────────────────────────────────────────────────────────────
// Behavior: minifying-code/safe-minification-shrinks-the-cart-and-preserves-behaviour
// ────────────────────────────────────────────────────────────────────────────
describe("safe minification shrinks the cart and preserves behaviour", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "verbose-cart.p8");
  });

  it("reports before/after sizes, shrinks characters, and the cartridge is still valid", async () => {
    // Given a cartridge with verbose code (comments, whitespace, blank lines)
    const verboseCode = [
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
      "",
      'print("hello world")',
    ].join("\n");
    await writeFile(cartPath, buildCart(verboseCode), "utf-8");

    // When I minify it safely (without --rename)
    const result = await qdJson("cart", "minify", cartPath, "--json");

    // Then the result is smaller in characters
    expect(result.originalChars).toBeGreaterThan(0);
    expect(result.minifiedChars).toBeLessThan(result.originalChars);
    expect(result.charsSaved).toBeGreaterThan(0);

    // And the before/after sizes are reported
    expect(result.originalChars).toBeDefined();
    expect(result.minifiedChars).toBeDefined();
    expect(result.charsSaved).toBeDefined();
    expect(result.renamed).toBe(false);

    // And the cartridge file on disk has been updated with smaller code
    const fileContent = await readFile(cartPath, "utf-8");
    const luaMatch = fileContent.match(/__lua__\n([\s\S]*?)\n__gfx__/);
    expect(luaMatch).not.toBeNull();
    const afterCode = luaMatch![1]!.trim();
    expect(afterCode.length).toBeLessThan(result.originalChars);

    // And the program's behaviour is unchanged (code parses successfully)
    const parse = await qdJson("cart", "parse", cartPath, "--json");
    expect(parse.valid).toBe(true);

    // And comments have been stripped but code logic is the same
    const overview = await qdJson("cart", "overview", cartPath, "--json");
    expect(overview.code).not.toContain("--");
    expect(overview.code).toContain("x = 1");
    expect(overview.code).toContain("y = 2 + 3");
    expect(overview.code).toContain("z = x + y");
    expect(overview.code).toContain('print("hello world")');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Behavior: minifying-code/aggressive-minification-shrinks-further-than-safe
// ────────────────────────────────────────────────────────────────────────────
describe("aggressive minification shrinks further than safe", () => {
  let safePath: string;
  let aggressivePath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    safePath = path.join(root, "safe-cart.p8");
    aggressivePath = path.join(root, "aggressive-cart.p8");
  });

  it("produces a smaller result with rename than without", async () => {
    // Given a cartridge with verbose code including long variable names
    const verboseCode = [
      "-- Initialise player state",
      "player_position_x = 64",
      "player_position_y = 64",
      "enemy_health_points = 100",
      "score_value = 0",
      "",
      "-- Calculate movement",
      "player_position_x = player_position_x + 1",
      "player_position_y = player_position_y + 1",
      "score_value = score_value + 10",
    ].join("\n");
    const cartContent = buildCart(verboseCode);
    await writeFile(safePath, cartContent, "utf-8");
    await writeFile(aggressivePath, cartContent, "utf-8");

    // When I minify safely (no rename)
    const safeResult = await qdJson("cart", "minify", safePath, "--json");
    const safeCharsSaved = safeResult.charsSaved as number;

    // And I minify aggressively (with rename)
    const aggressiveResult = await qdJson("cart", "minify", aggressivePath, "--rename", "--json");
    const aggressiveCharsSaved = aggressiveResult.charsSaved as number;

    // Then the aggressive result is smaller than safe minification
    expect(aggressiveCharsSaved).toBeGreaterThan(safeCharsSaved);

    // And rename was used
    expect(aggressiveResult.renamed).toBe(true);
    expect(aggressiveResult.renameMap).toBeDefined();

    // And both result in valid code
    const safeParse = await qdJson("cart", "parse", safePath, "--json");
    expect(safeParse.valid).toBe(true);
    const aggressiveParse = await qdJson("cart", "parse", aggressivePath, "--json");
    expect(aggressiveParse.valid).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Behavior: minifying-code/minifying-into-a-separate-cartridge-leaves-the-original-intact
// ────────────────────────────────────────────────────────────────────────────
describe("minifying into a separate cartridge leaves the original intact", () => {
  let originalPath: string;
  let copyPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    originalPath = path.join(root, "original-cart.p8");
    copyPath = path.join(root, "minified-copy.p8");
  });

  it("the original file is unchanged and a smaller cartridge is produced", async () => {
    // Given a cartridge with verbose code
    const verboseCode = [
      "-- Setup section",
      "a = 10",
      "",
      "-- Another bit of setup",
      "b   =   20",
      "",
      'print("hello")',
    ].join("\n");
    const cartContent = buildCart(verboseCode);
    await writeFile(originalPath, cartContent, "utf-8");
    await copyFile(originalPath, copyPath);

    // Record the original file content hash before minification
    const originalBefore = await readFile(originalPath, "utf-8");

    // When I minify the copy (separate cartridge)
    const result = await qdJson("cart", "minify", copyPath, "--json");

    // Then the original is unchanged
    const originalAfter = await readFile(originalPath, "utf-8");
    expect(originalAfter).toBe(originalBefore);

    // And the copy is smaller than the original
    expect(result.minifiedChars).toBeLessThan(result.originalChars);
    expect(result.charsSaved).toBeGreaterThan(0);

    // And the copy has valid code
    const copyParse = await qdJson("cart", "parse", copyPath, "--json");
    expect(copyParse.valid).toBe(true);

    // And the original still parses correctly too
    const originalParse = await qdJson("cart", "parse", originalPath, "--json");
    expect(originalParse.valid).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Behavior: minifying-code/minifying-in-place-updates-the-cartridge
// ────────────────────────────────────────────────────────────────────────────
describe("minifying in place updates the cartridge", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "inplace-cart.p8");
  });

  it("the same cartridge is updated with the smaller code", async () => {
    // Given a cartridge with verbose code
    const verboseCode = [
      "-- Tab 0 initialisation",
      "counter = 0",
      "",
      "--[[",
      "  A block comment explaining the loop",
      "]]",
      "for i=1,10 do",
      '  print("loop")',
      "end",
    ].join("\n");
    const cartContent = buildCart(verboseCode);
    await writeFile(cartPath, cartContent, "utf-8");

    // Record the original size on disk
    const originalSize = (await readFile(cartPath, "utf-8")).length;

    // When I minify it in place
    const result = await qdJson("cart", "minify", cartPath, "--json");

    // Then the same cartridge file is updated
    expect(result.charsSaved).toBeGreaterThan(0);
    expect(result.minifiedChars).toBeLessThan(result.originalChars);

    // And reading the file back shows the minified code (no comments)
    const overview = await qdJson("cart", "overview", cartPath, "--json");
    expect(overview.code).not.toContain("--");
    expect(overview.code).toContain("counter = 0");
    expect(overview.code).toContain("for i=1,10 do");

    // The file on disk is smaller than before
    const updatedSize = (await readFile(cartPath, "utf-8")).length;
    expect(updatedSize).toBeLessThan(originalSize);

    // And the code is still valid
    const parse = await qdJson("cart", "parse", cartPath, "--json");
    expect(parse.valid).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Behavior: minifying-code/minification-optimises-the-chosen-measure
// ────────────────────────────────────────────────────────────────────────────
describe("minification optimises the chosen measure", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "measure-cart.p8");
  });

  it("reduces the character count as much as the tool can manage", async () => {
    // Given a cartridge with verbose code (character count is the measure)
    const verboseCode = [
      "-- Lots of whitespace and long comments",
      "apple    =    10",
      "",
      "--[[",
      "  This is a very long comment block that should be stripped",
      "  and will significantly reduce the character count",
      "]]",
      "banana    =    apple + 5",
      "",
      'print("result: " .. banana)',
      "",
    ].join("\n");
    await writeFile(cartPath, buildCart(verboseCode), "utf-8");

    // When I minify it (favouring character count by default)
    const result = await qdJson("cart", "minify", cartPath, "--json");

    // Then the character count is reduced as much as the tool can manage
    expect(result.charsSaved).toBeGreaterThan(0);
    expect(result.minifiedChars).toBeLessThan(result.originalChars);

    // The code is still valid (behaviour preserved)
    const parse = await qdJson("cart", "parse", cartPath, "--json");
    expect(parse.valid).toBe(true);

    // The minified code has no extraneous whitespace or comments
    const overview = await qdJson("cart", "overview", cartPath, "--json");
    expect(overview.code).not.toContain("--");
    expect(overview.code).not.toContain("    "); // No multi-space indentation
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Behavior: minifying-code/minification-can-make-an-oversized-cartridge-fit-for-distribution
// ────────────────────────────────────────────────────────────────────────────
describe("minification can make an oversized cartridge fit for distribution", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "oversized-cart.p8");
  });

  it("reduces the size so compressed code fits within the distribution size limit", async () => {
    // Given a cartridge whose code just exceeds the character limit
    // Create code with many comment lines (~80 chars each) that can be stripped
    // to bring the cart below the limit
    const commentLine = "-- " + "x".repeat(76); // ~80 chars per line
    // Need to exceed 65536 chars. Use mostly comment lines that strip cleanly.
    // Each comment line is 80 chars, so we need ~820 comment lines (65600 chars)
    // Then minification strips them all, leaving only a small meaningful line
    const commentCount = 830;
    const commentBlock = Array.from({ length: commentCount }, () => commentLine).join("\n");
    const tailCode = 'a=1\nb=2\nprint("done")\n';
    const oversizedCode = commentBlock + "\n" + tailCode;

    // Verify it exceeds the limit
    expect(oversizedCode.length).toBeGreaterThan(PICO8_CHAR_LIMIT);

    await writeFile(cartPath, buildCart(oversizedCode), "utf-8");

    // Verify it's oversized before minification
    const sizeBefore = await qdJson("cart", "size", cartPath, "--json");
    expect(sizeBefore.aboveLimit).toBe(true);

    // When I minify it
    const result = await qdJson("cart", "minify", cartPath, "--json");

    // Then the character count is reduced
    expect(result.charsSaved).toBeGreaterThan(0);
    expect(result.minifiedChars).toBeLessThan(result.originalChars);

    // Now it should fit within the limit
    const sizeAfter = await qdJson("cart", "size", cartPath, "--json");
    expect(sizeAfter.aboveLimit).toBe(false);
    expect(sizeAfter.charCount).toBeLessThanOrEqual(PICO8_CHAR_LIMIT);

    // And the code is still valid
    const parse = await qdJson("cart", "parse", cartPath, "--json");
    expect(parse.valid).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Behavior: minifying-code/minifying-already-minimal-code-stays-valid
// ────────────────────────────────────────────────────────────────────────────
describe("minifying already-minimal code stays valid", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "minimal-cart.p8");
  });

  it("results in valid code that is no larger than before", async () => {
    // Given a cartridge whose code is already minimal (no comments, no excess whitespace)
    const minimalCode = ["a=1", "b=2", "c=a+b", 'print("done")'].join("\n");
    await writeFile(cartPath, buildCart(minimalCode), "utf-8");

    // When I minify it
    const result = await qdJson("cart", "minify", cartPath, "--json");

    // Then the result is no larger than before
    expect(result.charsSaved).toBeGreaterThanOrEqual(0);
    expect(result.minifiedChars).toBeLessThanOrEqual(result.originalChars);

    // And the code is still valid
    const parse = await qdJson("cart", "parse", cartPath, "--json");
    expect(parse.valid).toBe(true);

    // And the functional code is preserved
    const overviewAfter = await qdJson("cart", "overview", cartPath, "--json");
    expect(overviewAfter.code).toContain("a=1");
    expect(overviewAfter.code).toContain("b=2");
    expect(overviewAfter.code).toContain("c=a+b");
  });
});
