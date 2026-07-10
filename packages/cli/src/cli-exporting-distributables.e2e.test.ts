import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, root } from "./cli-e2e-fixtures.js";

installCliFixture();

const liveEnabled = process.env.PICO8_LIVE === "1" && Boolean(process.env.PICO8_BIN);

describe("exporting distributables", () => {
  beforeEach(async () => {
    await qd("setup", "--no-hooks");
  });

  it("exports web and native builds from a cartridge", async () => {
    if (!liveEnabled) return;

    const cartPath = path.join(root, "exportable.p8");
    const webPath = path.join(root, "dist", "exportable.html");
    const nativePath = path.join(root, "dist", "exportable.bin");
    await mkdir(path.dirname(webPath), { recursive: true });
    await writeFile(
      cartPath,
      [
        "pico-8 cartridge // http://www.pico-8.com",
        "version 42",
        "__lua__",
        "function _draw() cls(1) print('ok',1,1,7) end",
        "__gfx__",
        "__gff__",
        "__map__",
        "__sfx__",
        "__music__",
        "__label__",
        "0000000000000000",
      ].join("\n"),
    );

    const webResult = await qdJson(
      "cart",
      "export",
      cartPath,
      "--json",
      "--to",
      "web",
      "--output",
      webPath,
      {
        env: { PICO8_BIN: process.env.PICO8_BIN! },
      },
    );
    expect(webResult.success).toBe(true);
    expect(webResult.outputPath).toBe(webPath);
    expect(webResult.files).toContain(webPath);
    expect(webResult.files.some((file: string) => file.endsWith(".js"))).toBe(true);
    expect(await readFile(webPath, "utf8")).toContain("<!DOCTYPE html");

    const nativeResult = await qdJson(
      "cart",
      "export",
      cartPath,
      "--json",
      "--to",
      "native",
      "--output",
      nativePath,
      {
        env: { PICO8_BIN: process.env.PICO8_BIN! },
      },
    );
    expect(nativeResult.success).toBe(true);
    expect(nativeResult.outputPath).toBe(nativePath);
    expect(nativeResult.files.some((file: string) => file.endsWith("/linux/out"))).toBe(true);
  });
});
