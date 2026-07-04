import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson } from "./cli-e2e-fixtures.js";

installCliFixture();

describe("reference data", () => {
  beforeEach(async () => {
    await qd("setup", "--no-hooks");
  });

  it("prints a list of PICO-8 API functions", async () => {
    const result = await qdJson("ref", "api", "--json");
    expect(Array.isArray(result.functions)).toBe(true);
    expect(result.functions.length).toBeGreaterThan(10);
    const clsFn = result.functions.find((f: { name: string }) => f.name === "cls");
    expect(clsFn).toBeDefined();
    expect(clsFn.args).toBe("[col]");
    expect(clsFn.description).toBeDefined();
    for (const fn of result.functions) {
      expect(typeof fn.name).toBe("string");
      expect(typeof fn.args).toBe("string");
      expect(typeof fn.description).toBe("string");
    }
  });

  it("prints a list of known pitfalls and their remedies", async () => {
    const result = await qdJson("ref", "pitfalls", "--json");
    expect(Array.isArray(result.pitfalls)).toBe(true);
    expect(result.pitfalls.length).toBeGreaterThan(5);
    for (const p of result.pitfalls) {
      expect(typeof p.title).toBe("string");
      expect(typeof p.problem).toBe("string");
      expect(typeof p.remedy).toBe("string");
    }
    const tokenPitfall = result.pitfalls.find(
      (p: { title: string }) => p.title === "Token limit (8192 tokens)",
    );
    expect(tokenPitfall).toBeDefined();
  });
});
