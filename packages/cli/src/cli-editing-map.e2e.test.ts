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

describe("editing the map", () => {
  let cartPath: string;

  beforeEach(async () => {
    await qd("setup", "--no-hooks");
    cartPath = path.join(root, "test-cart.p8");
    await copyFile(path.join(FIXTURES_DIR, "test-cart.p8"), cartPath);
  });

  it("gets a single map cell", async () => {
    const result = await qdJson(
      "cart",
      "map",
      "get",
      "--file",
      cartPath,
      "--x",
      "1",
      "--y",
      "1",
      "--json",
    );
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(typeof result.tile).toBe("number");
  });

  it("gets a map region", async () => {
    const result = await qdJson(
      "cart",
      "map",
      "get-region",
      "--file",
      cartPath,
      "--x",
      "1",
      "--y",
      "1",
      "--width",
      "3",
      "--height",
      "2",
      "--json",
    );
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
    expect(result.w).toBe(3);
    expect(result.h).toBe(2);
    expect(result.region).toHaveLength(2);
    expect(result.region[0]).toHaveLength(3);
    expect(result.region[1]).toHaveLength(3);
  });

  it("sets a single map cell and verifies it", async () => {
    const setResult = await qdJson(
      "cart",
      "map",
      "set",
      "--file",
      cartPath,
      "--x",
      "5",
      "--y",
      "3",
      "--tile",
      "42",
      "--json",
    );
    expect(setResult.ok).toBe(true);
    expect(setResult.x).toBe(4);
    expect(setResult.y).toBe(2);
    expect(setResult.tile).toBe(41);

    const getResult = await qdJson(
      "cart",
      "map",
      "get",
      "--file",
      cartPath,
      "--x",
      "5",
      "--y",
      "3",
      "--json",
    );
    expect(getResult.tile).toBe(41);
  });

  it("sets a map region and verifies it", async () => {
    const region = [
      [10, 20, 30],
      [40, 50, 60],
    ];
    const setResult = await qdJson(
      "cart",
      "map",
      "set-region",
      "--file",
      cartPath,
      "--x",
      "1",
      "--y",
      "1",
      "--values",
      JSON.stringify(region),
      "--json",
    );
    expect(setResult.ok).toBe(true);

    const getResult = await qdJson(
      "cart",
      "map",
      "get-region",
      "--file",
      cartPath,
      "--x",
      "1",
      "--y",
      "1",
      "--width",
      "3",
      "--height",
      "2",
      "--json",
    );
    expect(getResult.region).toEqual(region);
  });

  it("leaves adjacent cells unchanged when setting one cell", async () => {
    await qd("cart", "map", "set", "--file", cartPath, "--x", "10", "--y", "10", "--tile", "99");

    const adj = await qdJson(
      "cart",
      "map",
      "get",
      "--file",
      cartPath,
      "--x",
      "11",
      "--y",
      "10",
      "--json",
    );
    expect(adj.tile).toBe(0);
  });
});
