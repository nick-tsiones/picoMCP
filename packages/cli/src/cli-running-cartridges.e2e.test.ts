import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, qdJsonAllowExit, root } from "./cli-e2e-fixtures.js";

installCliFixture();

const liveEnabled = process.env.PICO8_LIVE === "1" && Boolean(process.env.PICO8_BIN);

describe("running cartridges", () => {
  beforeEach(async () => {
    await qd("setup", "--no-hooks");
  });

  it("runs a cartridge headlessly and captures runtime artifacts", async () => {
    if (!liveEnabled) return;

    const cartPath = path.join(root, "runtime-test.p8");
    const outputDir = path.join(root, "artifacts");
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      cartPath,
      [
        "pico-8 cartridge // http://www.pico-8.com",
        "version 42",
        "__lua__",
        "x=0",
        "function _update()",
        " x+=1",
        "end",
        "function _draw()",
        " cls()",
        " print(x,1,1,7)",
        "end",
        "__gfx__",
        "__gff__",
        "__map__",
        "__sfx__",
        "__music__",
        "__label__",
        "0000000000000000",
      ].join("\n"),
    );

    const result = await qdJson(
      "cart",
      "run",
      cartPath,
      "--json",
      "--frames",
      "5",
      "--capture",
      "screen",
      "--trace",
      "x",
      "--output-dir",
      outputDir,
      {
        env: { PICO8_BIN: process.env.PICO8_BIN! },
      },
    );

    expect(result.success).toBe(true);
    expect(result.frameCount).toBe(5);
    expect(result.captureMode).toBe("screen");
    expect(result.screenshotPath).toContain("capture.png");
    if (result.logPath) {
      expect(result.logPath).toContain("log.txt");
      expect(
        result.traces.some((entry: { name: string; value: string }) => entry.name === "x"),
      ).toBe(true);
      expect(await readFile(result.logPath, "utf8")).toContain("TRACE|");
    }
  });

  it("reports runtime errors with source location details", async () => {
    if (!liveEnabled) return;

    const cartPath = path.join(root, "runtime-error.p8");
    await writeFile(
      cartPath,
      [
        "pico-8 cartridge // http://www.pico-8.com",
        "version 42",
        "__lua__",
        "function _init()",
        " local x=nil+1",
        "end",
        "__gfx__",
        "__gff__",
        "__map__",
        "__sfx__",
        "__music__",
        "__label__",
        "0000000000000000",
      ].join("\n"),
    );

    const result = await qdJsonAllowExit("cart", "run", cartPath, "--json", "--frames", "2", {
      env: { PICO8_BIN: process.env.PICO8_BIN! },
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.json.success).toBe(false);
    expect(result.json.error.message).toContain("attempt to perform arithmetic");
    expect(result.json.error.line).toBe(2);
  });
});
