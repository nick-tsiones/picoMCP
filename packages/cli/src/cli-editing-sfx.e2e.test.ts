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

describe("editing sound effects", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  it("gets a single SFX entry", async () => {
    const result = await qdJson("cart", "sfx", "get", "--file", cartPath, "--index", "1", "--json");
    expect(result.index).toBe(0);
    expect(Array.isArray(result.notes)).toBe(true);
    expect(typeof result.speed).toBe("number");
    expect(typeof result.loopStart).toBe("number");
    expect(typeof result.loopEnd).toBe("number");
  });

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
      "cart",
      "sfx",
      "set",
      "--file",
      cartPath,
      "--index",
      "3",
      "--data",
      JSON.stringify(sfxData),
      "--json",
    );
    expect(setResult.ok).toBe(true);
    expect(setResult.index).toBe(2);

    const getResult = await qdJson(
      "cart",
      "sfx",
      "get",
      "--file",
      cartPath,
      "--index",
      "3",
      "--json",
    );
    expect(getResult.index).toBe(2);
    expect(getResult.notes).toHaveLength(3);
    expect(getResult.notes[0].pitch).toBe(24);
    expect(getResult.notes[0].instr).toBe(1);
    expect(getResult.speed).toBe(12);
    expect(getResult.loopStart).toBe(0);
    expect(getResult.loopEnd).toBe(2);
  });

  it("lists all SFX entries", async () => {
    const result = await qdJson("cart", "sfx", "list", "--file", cartPath, "--json");
    expect(result.sfx).toHaveLength(64);
    for (const entry of result.sfx) {
      expect(typeof entry.index).toBe("number");
      expect(typeof entry.noteCount).toBe("number");
      expect(entry.index).toBeGreaterThanOrEqual(0);
      expect(entry.index).toBeLessThanOrEqual(63);
    }
  });

  it("leaves other SFX entries unchanged when setting one", async () => {
    const sfxData = {
      notes: [{ pitch: 30, instr: 0, vol: 5, fx: 0 }],
      speed: 8,
      loopStart: 0,
      loopEnd: 0,
    };
    await qdJson(
      "cart",
      "sfx",
      "set",
      "--file",
      cartPath,
      "--index",
      "1",
      "--data",
      JSON.stringify(sfxData),
      "--json",
    );

    const sfx2 = await qdJson("cart", "sfx", "get", "--file", cartPath, "--index", "2", "--json");
    expect(sfx2.notes).toHaveLength(0);
  });
});
