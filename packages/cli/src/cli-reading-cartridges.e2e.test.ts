import { copyFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, qdJsonAllowExit, root } from "./cli-e2e-fixtures.js";

installCliFixture();

const FIXTURES_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "test-fixtures",
);

describe("reading cartridges", () => {
  let cartPath: string;
  let emptyCartPath: string;

  beforeEach(async () => {
    // Copy test fixture cartridges into the temp root so they are within boundaries
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    emptyCartPath = path.join(root, "empty-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
    await copyFile(path.join(FIXTURES_DIR, "empty-cart.p8"), emptyCartPath);
  });

  // Behavior 1: read-an-overview-of-a-cartridge
  it("reads an overview of a cartridge", async () => {
    // given a cartridge containing code, sprites, and a map
    // I receive its code, its size, and a summary of its assets
    const result = await qdJson("cart", "overview", cartPath, "--json");

    expect(result.code).toContain('print("hello")');
    expect(result.code).toContain("function _draw()");
    expect(result.tabCount).toBe(2);
    expect(result.size).toBe(2);
    expect(typeof result.tokenCount).toBe("number");
    expect(result.assets).toBeDefined();
  });

  // Behavior 2: read-a-single-tab-of-code
  it("reads a single tab of code", async () => {
    // given a cartridge whose code is organised into several tabs
    // I receive only that tab's code
    const result = await qdJson("cart", "tab", cartPath, "--tab", "1", "--json");

    expect(result.tab).toBe(1);
    expect(result.code).toContain('print("hello")');
    expect(result.code).not.toContain("function _draw()");
  });

  it("reads the second tab of code", async () => {
    const result = await qdJson("cart", "tab", cartPath, "--tab", "2", "--json");

    expect(result.tab).toBe(2);
    expect(result.code).toContain("function _draw()");
    expect(result.code).not.toContain('print("hello")');
  });

  // Behavior 3: read-a-cartridge-that-does-not-exist
  it("reports cartridge was not found for missing file", async () => {
    // given a location where no cartridge exists
    // the toolbox reports that the cartridge was not found
    const nonExistentPath = path.join(root, "does-not-exist.p8");

    const result = await qdJsonAllowExit("cart", "overview", nonExistentPath, "--json");

    expect(result.exitCode).toBeFalsy();
    expect(result.json.error).toBe("cartridge was not found");
  });

  // Behavior 4: read-an-empty-cartridge
  it("reads an empty cartridge", async () => {
    // given a cartridge with no code and no assets
    // I receive an empty program and a size of zero
    const result = await qdJson("cart", "overview", emptyCartPath, "--json");

    expect(result.code).toBe("");
    expect(result.tabCount).toBe(0);
    expect(result.size).toBe(0);
    expect(result.tokenCount).toBe(0);
    expect(result.hasSprites).toBe(false);
    expect(result.hasMap).toBe(false);
    expect(result.hasSfx).toBe(false);
    expect(result.hasMusic).toBe(false);
    expect(result.assets).toBe("none");
  });
});
