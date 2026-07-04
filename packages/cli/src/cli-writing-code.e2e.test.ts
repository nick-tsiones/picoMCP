import { copyFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, root } from "./cli-e2e-fixtures.js";
import { CartRepo } from "@cat-cave/qdcli-core";

installCliFixture();

const FIXTURES_DIR = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "test-fixtures",
);

describe("cart write", () => {
  let cartPath: string;
  let repo: CartRepo;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    repo = new CartRepo();
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  // Behavior: writing-code/writing-code-to-a-new-location-creates-a-cartridge
  it("creating a new cartridge carries no boilerplate", async () => {
    const newCartPath = path.join(root, "new-cart.p8");
    const code = 'print("hello from new cart")';

    const result = await qdJson("cart", "write", newCartPath, "--code", code, "--json");

    expect(result.charCount).toBeGreaterThan(0);
    expect(result.tab).toBe(1);

    // Verify the file was created
    const cart = await repo.load(root, newCartPath);
    expect(cart.code).toHaveLength(1);
    expect(cart.code[0]).toBe(code);
    // No boilerplate beyond what's in the code section
    expect(cart.gfx.length).toBe(0);
    expect(cart.map.length).toBe(0);
    expect(cart.sfx.length).toBe(0);
    expect(cart.music.length).toBe(0);
  });

  // Behavior: writing-code/writing-code-preserves-existing-assets
  it("replaces code and preserves sprites and map", async () => {
    const newCode = 'print("replaced code")';

    const result = await qdJson(
      "cart",
      "write",
      cartPath,
      "--code",
      newCode,
      "--tab",
      "1",
      "--json",
    );

    expect(result.charCount).toBeGreaterThan(0);
    expect(result.tab).toBe(1);

    // Verify code was replaced
    const cart = await repo.load(root, cartPath);
    expect(cart.code).toHaveLength(2); // original cart had 2 tabs
    expect(cart.code[0]).toBe(newCode);
    // Code in tab 1 should be the original tab 1 content
    expect(cart.code[1]).toContain("function _draw()");

    // Assets should be preserved (gfx still there)
    expect(cart.gfx.length).toBeGreaterThan(0);
    expect(cart.map.length).toBeGreaterThan(0);
  });

  // Behavior: writing-code/writing-to-one-tab-leaves-other-tabs-unchanged
  it("only changes the specified tab", async () => {
    const newCode = 'print("only tab 2 changes")';

    const result = await qdJson(
      "cart",
      "write",
      cartPath,
      "--code",
      newCode,
      "--tab",
      "2",
      "--json",
    );

    expect(result.tab).toBe(2);

    // Verify only tab 2 was changed
    const cart = await repo.load(root, cartPath);
    expect(cart.code).toHaveLength(2);
    // Tab 0 should still be original
    expect(cart.code[0]).toContain('print("hello")');
    // Tab 1 should be the new code
    expect(cart.code[1]).toBe(newCode);
  });

  // Behavior: writing-code/uppercase-identifiers-round-trip
  it("uppercase identifiers round-trip unchanged", async () => {
    const code = "MYVAR = 42\nfunction MYFUNC()\n  return MYVAR\nend";

    const result = await qdJson("cart", "write", cartPath, "--code", code, "--tab", "1", "--json");

    expect(result.charCount).toBeGreaterThan(0);

    // Verify code round-trips exactly
    const cart = await repo.load(root, cartPath);
    expect(cart.code[0]).toBe(code);
  });

  // Behavior: writing-code/a-newly-created-cartridge-carries-no-boilerplate
  it("new cartridge contains only the written code and no added structure", async () => {
    const newCartPath = path.join(root, "fresh.p8");
    const code = "x = 1\ny = 2\nprint(x + y)";

    const result = await qdJson("cart", "write", newCartPath, "--code", code, "--json");

    expect(result.charCount).toBeGreaterThan(0);

    // Read the raw file content to verify no boilerplate
    const cart = await repo.load(root, newCartPath);
    // Only the code we wrote, no extra tabs or boilerplate
    expect(cart.code).toHaveLength(1);
    expect(cart.code[0]).toBe(code);
    // No extra structure: gfx, map, sfx, music should be empty
    const overview = repo.overview(cart);
    expect(overview.hasSprites).toBe(false);
    expect(overview.hasMap).toBe(false);
    expect(overview.hasSfx).toBe(false);
    expect(overview.hasMusic).toBe(false);
  });
});
