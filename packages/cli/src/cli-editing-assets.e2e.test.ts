import { copyFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, root } from "./cli-e2e-fixtures.js";

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
    const result = await qdJson(
      "cart",
      "sprite",
      "get",
      "--file",
      cartPath,
      "--index",
      "1",
      "--json",
    );
    expect(result.index).toBe(0);
    expect(result.pixels).toHaveLength(64);
    // All pixels should be 0 for a blank sprite
    for (const px of result.pixels) {
      expect(px).toBe(0);
    }
  });

  // Behavior: editing-sprites/get-a-range-of-sprites
  it("gets a range of sprites", async () => {
    const result = await qdJson(
      "cart",
      "sprite",
      "get-range",
      "--file",
      cartPath,
      "--start",
      "1",
      "--end",
      "3",
      "--json",
    );
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
      "cart",
      "sprite",
      "set",
      "--file",
      cartPath,
      "--index",
      "5",
      "--pixels",
      pixelsStr,
      "--json",
    );
    expect(setResult.ok).toBe(true);
    expect(setResult.index).toBe(4);

    // Read it back
    const getResult = await qdJson(
      "cart",
      "sprite",
      "get",
      "--file",
      cartPath,
      "--index",
      "5",
      "--json",
    );
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
      "cart",
      "sprite",
      "set-range",
      "--file",
      cartPath,
      "--sprites",
      spritesJson,
      "--json",
    );
    expect(setResult.ok).toBe(true);
    expect(setResult.count).toBe(2);

    // Read back both
    const getResult = await qdJson(
      "cart",
      "sprite",
      "get-range",
      "--file",
      cartPath,
      "--start",
      "11",
      "--end",
      "12",
      "--json",
    );
    expect(getResult.sprites).toHaveLength(2);
    expect(getResult.sprites[0].index).toBe(10);
    expect(getResult.sprites[0].pixels).toEqual(pattern);
  });

  // Acceptance: all other sprites are unchanged after setting one
  it("leaves other sprites unchanged when setting one sprite", async () => {
    // First read sprites 1 and 2
    const before = await qdJson(
      "cart",
      "sprite",
      "get-range",
      "--file",
      cartPath,
      "--start",
      "1",
      "--end",
      "2",
      "--json",
    );

    // Set sprite 1
    const pixels = Array.from({ length: 64 }, () => 7);
    await qdJson(
      "cart",
      "sprite",
      "set",
      "--file",
      cartPath,
      "--index",
      "1",
      "--pixels",
      pixels.join(","),
      "--json",
    );

    // Read back both
    const after = await qdJson(
      "cart",
      "sprite",
      "get-range",
      "--file",
      cartPath,
      "--start",
      "1",
      "--end",
      "2",
      "--json",
    );
    // Sprite 1 (index 0) changed
    expect(after.sprites[0].pixels).toEqual(pixels);
    // Sprite 2 (index 1) unchanged
    expect(after.sprites[1].pixels).toEqual(before.sprites[1].pixels);
  });
});
