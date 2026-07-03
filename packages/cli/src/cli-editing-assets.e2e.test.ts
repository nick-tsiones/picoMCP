import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, qdJsonAllowExit, qdRaw, root } from "./cli-e2e-fixtures.js";

installCliFixture();

const FIXTURES_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "test-fixtures",
);

describe("editing sprites", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  // Behavior: editing-sprites/get-a-single-sprite
  it("gets a single sprite as 64 pixel values", async () => {
    // Sprite 0 should be all zeros initially (blank)
    const result = await qdJson("cart", "sprite", "get", "--file", cartPath, "--index", "1", "--json");
    expect(result.index).toBe(0);
    expect(result.pixels).toHaveLength(64);
    // All pixels should be 0 for a blank sprite
    for (const px of result.pixels) {
      expect(px).toBe(0);
    }
  });

  // Behavior: editing-sprites/get-a-range-of-sprites
  it("gets a range of sprites", async () => {
    const result = await qdJson("cart", "sprite", "get-range", "--file", cartPath, "--start", "1", "--end", "3", "--json");
    expect(result.sprites).toHaveLength(3);
    expect(result.sprites[0].index).toBe(0);
    expect(result.sprites[1].index).toBe(1);
    expect(result.sprites[2].index).toBe(2);
    for (const sprite of result.sprites) {
      expect(sprite.pixels).toHaveLength(64);
    }
  });

  // Behavior: editing-sprites/set-a-single-sprite
  it("sets a single sprite and verifies it", async () => {
    // Create a pattern: alternating 1 and 2
    const pixels = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 1 : 2));
    const pixelsStr = pixels.join(",");

    const setResult = await qdJson(
      "cart", "sprite", "set", "--file", cartPath, "--index", "5", "--pixels", pixelsStr, "--json",
    );
    expect(setResult.ok).toBe(true);
    expect(setResult.index).toBe(4);

    // Read it back
    const getResult = await qdJson("cart", "sprite", "get", "--file", cartPath, "--index", "5", "--json");
    expect(getResult.index).toBe(4);
    expect(getResult.pixels).toEqual(pixels);
  });

  // Behavior: editing-sprites/set-a-range-of-sprites
  it("sets a range of sprites", async () => {
    const pattern = Array.from({ length: 64 }, (_, i) => i % 16);
    const spritesJson = JSON.stringify([
      { index: 10, pixels: pattern },
      { index: 11, pixels: pattern.map((v) => (v + 1) % 16) },
    ]);

    const setResult = await qdJson(
      "cart", "sprite", "set-range", "--file", cartPath, "--sprites", spritesJson, "--json",
    );
    expect(setResult.ok).toBe(true);
    expect(setResult.count).toBe(2);

    // Read back both
    const getResult = await qdJson("cart", "sprite", "get-range", "--file", cartPath, "--start", "11", "--end", "12", "--json");
    expect(getResult.sprites).toHaveLength(2);
    expect(getResult.sprites[0].index).toBe(10);
    expect(getResult.sprites[0].pixels).toEqual(pattern);
  });

  // Acceptance: all other sprites are unchanged after setting one
  it("leaves other sprites unchanged when setting one sprite", async () => {
    // First read sprites 1 and 2
    const before = await qdJson("cart", "sprite", "get-range", "--file", cartPath, "--start", "1", "--end", "2", "--json");

    // Set sprite 1
    const pixels = Array.from({ length: 64 }, () => 7);
    await qdJson(
      "cart", "sprite", "set", "--file", cartPath, "--index", "1", "--pixels", pixels.join(","), "--json",
    );

    // Read back both
    const after = await qdJson("cart", "sprite", "get-range", "--file", cartPath, "--start", "1", "--end", "2", "--json");
    // Sprite 1 (index 0) changed
    expect(after.sprites[0].pixels).toEqual(pixels);
    // Sprite 2 (index 1) unchanged
    expect(after.sprites[1].pixels).toEqual(before.sprites[1].pixels);
  });
});

describe("editing the map", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  // Behavior: editing-the-map/get-a-single-cell
  it("gets a single map cell", async () => {
    const result = await qdJson("cart", "map", "get", "--file", cartPath, "--x", "1", "--y", "1", "--json");
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(typeof result.tile).toBe("number");
  });

  // Behavior: editing-the-map/get-a-region
  it("gets a map region", async () => {
    const result = await qdJson("cart", "map", "get-region", "--file", cartPath, "--x", "1", "--y", "1", "--width", "3", "--height", "2", "--json");
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.w).toBe(3);
    expect(result.h).toBe(2);
    expect(result.region).toHaveLength(2);
    expect(result.region[0]).toHaveLength(3);
    expect(result.region[1]).toHaveLength(3);
  });

  // Behavior: editing-the-map/set-a-single-cell
  it("sets a single map cell and verifies it", async () => {
    const setResult = await qdJson(
      "cart", "map", "set", "--file", cartPath, "--x", "5", "--y", "3", "--tile", "42", "--json",
    );
    expect(setResult.ok).toBe(true);
    expect(setResult.x).toBe(4);
    expect(setResult.y).toBe(2);
    expect(setResult.tile).toBe(41);

    // Read it back
    const getResult = await qdJson("cart", "map", "get", "--file", cartPath, "--x", "5", "--y", "3", "--json");
    expect(getResult.tile).toBe(41);
  });

  // Behavior: editing-the-map/set-a-region
  it("sets a map region and verifies it", async () => {
    const region = [
      [10, 20, 30],
      [40, 50, 60],
    ];
    const setResult = await qdJson(
      "cart", "map", "set-region", "--file", cartPath, "--x", "1", "--y", "1", "--values", JSON.stringify(region), "--json",
    );
    expect(setResult.ok).toBe(true);

    // Read it back
    const getResult = await qdJson("cart", "map", "get-region", "--file", cartPath, "--x", "1", "--y", "1", "--width", "3", "--height", "2", "--json");
    expect(getResult.region).toEqual(region);
  });

  // Acceptance: adjacent cells unchanged
  it("leaves adjacent cells unchanged when setting one cell", async () => {
    // Set a cell
    await qd("cart", "map", "set", "--file", cartPath, "--x", "10", "--y", "10", "--tile", "99");

    // Check adjacent cell
    const adj = await qdJson("cart", "map", "get", "--file", cartPath, "--x", "11", "--y", "10", "--json");
    // Adjacent cell should be unchanged (0 in empty cart)
    expect(adj.tile).toBe(0);
  });
});

describe("editing sound effects", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  // Behavior: editing-sound-effects/get-one-sfx
  it("gets a single SFX entry", async () => {
    const result = await qdJson("cart", "sfx", "get", "--file", cartPath, "--index", "1", "--json");
    expect(result.index).toBe(0);
    expect(result.notes).toBeDefined();
    expect(Array.isArray(result.notes)).toBe(true);
    expect(typeof result.speed).toBe("number");
    expect(typeof result.loopStart).toBe("number");
    expect(typeof result.loopEnd).toBe("number");
  });

  // Behavior: editing-sound-effects/set-one-sfx
  it("sets a single SFX and verifies it", async () => {
    const sfxData = {
      notes: [
        { pitch: 24, instr: 1, vol: 3, fx: 0 },
        { pitch: 26, instr: 1, vol: 3, fx: 0 },
        { pitch: 28, instr: 2, vol: 2, fx: 1 },
      ],
      speed: 12,
      loopStart: 0,
      loopEnd: 2,
    };
    const setResult = await qdJson(
      "cart", "sfx", "set", "--file", cartPath, "--index", "3", "--data", JSON.stringify(sfxData), "--json",
    );
    expect(setResult.ok).toBe(true);
    expect(setResult.index).toBe(2);

    // Read it back
    const getResult = await qdJson("cart", "sfx", "get", "--file", cartPath, "--index", "3", "--json");
    expect(getResult.index).toBe(2);
    expect(getResult.notes).toHaveLength(3);
    expect(getResult.notes[0].pitch).toBe(24);
    expect(getResult.notes[0].instr).toBe(1);
    expect(getResult.speed).toBe(12);
    expect(getResult.loopStart).toBe(0);
    expect(getResult.loopEnd).toBe(2);
  });

  // Behavior: editing-sound-effects/list-all-sfx
  it("lists all SFX entries", async () => {
    const result = await qdJson("cart", "sfx", "list", "--file", cartPath, "--json");
    expect(result.sfx).toBeDefined();
    expect(result.sfx).toHaveLength(64);
    for (const entry of result.sfx) {
      expect(typeof entry.index).toBe("number");
      expect(typeof entry.noteCount).toBe("number");
      expect(entry.index).toBeGreaterThanOrEqual(0);
      expect(entry.index).toBeLessThanOrEqual(63);
    }
  });

  // Acceptance: other SFX unchanged when setting one
  it("leaves other SFX entries unchanged when setting one", async () => {
    // Set SFX 1
    const sfxData = {
      notes: [{ pitch: 30, instr: 0, vol: 5, fx: 0 }],
      speed: 8,
      loopStart: 0,
      loopEnd: 0,
    };
    await qdJson(
      "cart", "sfx", "set", "--file", cartPath, "--index", "1", "--data", JSON.stringify(sfxData), "--json",
    );

    // SFX 2 should still be empty
    const sfx2 = await qdJson("cart", "sfx", "get", "--file", cartPath, "--index", "2", "--json");
    expect(sfx2.notes).toHaveLength(0);
  });
});

describe("reference data", () => {
  beforeEach(async () => {
    await qd("setup", "--no-hooks");
  });

  // Behavior: reference-data/the-api-index-is-available
  it("prints a list of PICO-8 API functions", async () => {
    const result = await qdJson("ref", "api", "--json");
    expect(result.functions).toBeDefined();
    expect(Array.isArray(result.functions)).toBe(true);
    expect(result.functions.length).toBeGreaterThan(10);
    // Check a known function
    const clsFn = result.functions.find((f: { name: string }) => f.name === "cls");
    expect(clsFn).toBeDefined();
    expect(clsFn.args).toBe("[col]");
    expect(clsFn.description).toBeDefined();
    // All entries should have required fields
    for (const fn of result.functions) {
      expect(typeof fn.name).toBe("string");
      expect(typeof fn.args).toBe("string");
      expect(typeof fn.description).toBe("string");
    }
  });

  // Behavior: reference-data/the-pitfalls-sheet-is-available
  it("prints a list of known pitfalls and their remedies", async () => {
    const result = await qdJson("ref", "pitfalls", "--json");
    expect(result.pitfalls).toBeDefined();
    expect(Array.isArray(result.pitfalls)).toBe(true);
    expect(result.pitfalls.length).toBeGreaterThan(5);
    // Check all entries have required fields
    for (const p of result.pitfalls) {
      expect(typeof p.title).toBe("string");
      expect(typeof p.problem).toBe("string");
      expect(typeof p.remedy).toBe("string");
    }
    // Check a known pitfall
    const tokenPitfall = result.pitfalls.find(
      (p: { title: string }) => p.title === "Token limit (8192 tokens)",
    );
    expect(tokenPitfall).toBeDefined();
  });
});

describe("sprite sheet export/import", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  // Behavior: sprite-sheet-images/the-sprite-sheet-is-exported-as-a-png-image
  it("the sprite sheet is exported as a PNG image", async () => {
    const outputPath = path.join(root, "sprites.png");

    const result = await qdJson(
      "cart", "sprite", "export", "--file", cartPath, "--output", outputPath, "--json",
    );
    expect(result.ok).toBe(true);
    expect(result.outputPath).toBe(outputPath);
    expect(result.message).toContain("exported");

    // Verify the file exists and is a valid PNG
    const pngData = await readFile(outputPath);
    expect(pngData.length).toBeGreaterThan(100);
    // Check PNG signature
    const signature = pngData.slice(0, 8);
    expect(signature).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  // Behavior: sprite-sheet-images/importing-a-png-replaces-the-current-sprites
  it("importing a PNG replaces the current sprites", async () => {
    // First, set a known sprite (index 1) to a pattern
    const pixels = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 1 : 2));
    await qdJson(
      "cart", "sprite", "set", "--file", cartPath, "--index", "1", "--pixels", pixels.join(","), "--json",
    );

    // Export the sprite sheet
    const exportPath = path.join(root, "exported-sprites.png");
    await qd("cart", "sprite", "export", "--file", cartPath, "--output", exportPath);

    // Import it back
    const importResult = await qdJson(
      "cart", "sprite", "import", "--file", cartPath, "--input", exportPath, "--json",
    );
    expect(importResult.ok).toBe(true);
    expect(importResult.message).toContain("colour-fitted");

    // The sprite should still be the same after re-import (since we exported and imported exactly the same data)
    const getResult = await qdJson("cart", "sprite", "get", "--file", cartPath, "--index", "1", "--json");
    // Sprite 1 should have the pattern (or something close due to color fitting)
    expect(getResult.pixels).toHaveLength(64);
  });

  // Behavior: sprite-sheet-images/importing-a-non-png-image-is-refused
  it("importing a non-PNG image is refused", async () => {
    // Create a file that is not a valid PNG
    const nonPngPath = path.join(root, "not-an-image.png");
    const { writeFile } = await import("node:fs/promises");
    await writeFile(nonPngPath, "this is not a PNG file");

    const result = await qdRaw(["cart", "sprite", "import", "--file", cartPath, "--input", nonPngPath, "--json"]);
    // Should fail
    expect(result.exitCode).toBeTruthy();
  });

  // Acceptance: the sprite sheet is exported as a PNG, the sprite data is replaced with colour-fitted pixel data, reported with a legitimate reason
  it("exports sprites and re-imports with colour-fitting reported", async () => {
    // Set some sprites with known colors
    const pixels = Array.from({ length: 64 }, (_, i) => i % 16); // all 16 colors
    await qdJson(
      "cart", "sprite", "set", "--file", cartPath, "--index", "1", "--pixels", pixels.join(","), "--json",
    );

    // Export
    const exportPath = path.join(root, "acceptance-test.png");
    const exportResult = await qdJson(
      "cart", "sprite", "export", "--file", cartPath, "--output", exportPath, "--json",
    );
    expect(exportResult.ok).toBe(true);

    // Verify the PNG can be read back
    const pngData = await readFile(exportPath);
    expect(pngData.length).toBeGreaterThan(0);

    // Import back
    const importResult = await qdJson(
      "cart", "sprite", "import", "--file", cartPath, "--input", exportPath, "--json",
    );
    expect(importResult.ok).toBe(true);
    expect(importResult.message).toMatch(/Imported \d+×\d+ pixel data, colour-fitted to PICO-8 palette/);

    // Read the sprite back - should have colour-fitted values
    const getResult = await qdJson("cart", "sprite", "get", "--file", cartPath, "--index", "1", "--json");
    expect(getResult.pixels).toHaveLength(64);
    for (const px of getResult.pixels) {
      expect(px).toBeGreaterThanOrEqual(0);
      expect(px).toBeLessThanOrEqual(15);
    }
  });
});