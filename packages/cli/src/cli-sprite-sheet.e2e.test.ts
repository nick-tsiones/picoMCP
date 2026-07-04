import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, qdRaw, root } from "./cli-e2e-fixtures.js";

installCliFixture();

const FIXTURES_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "test-fixtures",
);

describe("sprite sheet export/import", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  it("the sprite sheet is exported as a PNG image", async () => {
    const outputPath = path.join(root, "sprites.png");

    const result = await qdJson(
      "cart",
      "sprite",
      "export",
      "--file",
      cartPath,
      "--output",
      outputPath,
      "--json",
    );
    expect(result.ok).toBe(true);
    expect(result.outputPath).toBe(outputPath);
    expect(result.message).toContain("exported");

    const pngData = await readFile(outputPath);
    expect(pngData.length).toBeGreaterThan(100);
    expect(pngData.slice(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  it("importing a PNG replaces the current sprites", async () => {
    const pixels = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 1 : 2));
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

    const exportPath = path.join(root, "exported-sprites.png");
    await qd("cart", "sprite", "export", "--file", cartPath, "--output", exportPath);

    const importResult = await qdJson(
      "cart",
      "sprite",
      "import",
      "--file",
      cartPath,
      "--input",
      exportPath,
      "--json",
    );
    expect(importResult.ok).toBe(true);
    expect(importResult.message).toContain("colour-fitted");

    const getResult = await qdJson(
      "cart",
      "sprite",
      "get",
      "--file",
      cartPath,
      "--index",
      "1",
      "--json",
    );
    expect(getResult.pixels).toHaveLength(64);
  });

  it("importing a non-PNG image is refused", async () => {
    const nonPngPath = path.join(root, "not-an-image.png");
    await writeFile(nonPngPath, "this is not a PNG file");

    const result = await qdRaw([
      "cart",
      "sprite",
      "import",
      "--file",
      cartPath,
      "--input",
      nonPngPath,
      "--json",
    ]);
    expect(result.exitCode).toBeTruthy();
  });

  it("exports sprites and re-imports with colour-fitting reported", async () => {
    const pixels = Array.from({ length: 64 }, (_, i) => i % 16);
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

    const exportPath = path.join(root, "acceptance-test.png");
    const exportResult = await qdJson(
      "cart",
      "sprite",
      "export",
      "--file",
      cartPath,
      "--output",
      exportPath,
      "--json",
    );
    expect(exportResult.ok).toBe(true);

    const pngData = await readFile(exportPath);
    expect(pngData.length).toBeGreaterThan(0);

    const importResult = await qdJson(
      "cart",
      "sprite",
      "import",
      "--file",
      cartPath,
      "--input",
      exportPath,
      "--json",
    );
    expect(importResult.ok).toBe(true);
    expect(importResult.message).toMatch(
      /Imported \d+×\d+ pixel data, colour-fitted to PICO-8 palette/,
    );

    const getResult = await qdJson(
      "cart",
      "sprite",
      "get",
      "--file",
      cartPath,
      "--index",
      "1",
      "--json",
    );
    expect(getResult.pixels).toHaveLength(64);
    for (const px of getResult.pixels) {
      expect(px).toBeGreaterThanOrEqual(0);
      expect(px).toBeLessThanOrEqual(15);
    }
  });
});
