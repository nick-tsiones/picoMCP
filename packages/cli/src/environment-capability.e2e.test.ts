import { beforeEach, describe, expect, it } from "vite-plus/test";
import { chmod, writeFile } from "node:fs/promises";
import path from "node:path";
import { installCliFixture, qd, qdJson, qdJsonAllowExit, root } from "./cli-e2e-fixtures.js";

installCliFixture();

const missingBinary = "/nonexistent/pico8-binary";

describe("environment and capability detection", () => {
  beforeEach(async () => {
    await qd("setup", "--no-hooks");
  });

  it("reports capabilities when PICO-8 is present", async () => {
    const presentBinary = path.join(root, "pico8");
    await writeFile(presentBinary, "#!/bin/sh\nexit 0\n");
    await chmod(presentBinary, 0o755);
    const result = await qdJson("toolbox", "capabilities", "--json", {
      env: { PICO8_BIN: presentBinary },
    });
    expect(result.capabilities.static.length).toBeGreaterThan(0);
    expect(result.capabilities.runtime.length).toBeGreaterThan(0);
    expect(result.runtime.available).toBe(true);
    expect(result.runtime.pico8.present).toBe(true);
  });

  it("reports capabilities when PICO-8 is absent", async () => {
    const result = await qdJson("toolbox", "capabilities", "--json", {
      env: { PICO8_BIN: missingBinary },
    });
    expect(result.capabilities.static.length).toBeGreaterThan(0);
    expect(result.capabilities.runtime).toEqual([]);
    expect(result.runtime.available).toBe(false);
    expect(result.runtime.pico8.present).toBe(false);
  });

  it("static work needs no PICO-8 program", async () => {
    const cartPath = `${root}/static-only.p8`;
    await writeFile(
      cartPath,
      `pico-8 cartridge // http://www.pico-8.com\nversion 42\n__lua__\nprint(1)\n__gfx__\n__gff__\n__map__\n__sfx__\n__music__\n`,
    );
    const result = await qdJson("cart", "size", cartPath, "--json", {
      env: { PICO8_BIN: missingBinary },
    });
    expect(result.charCount).toBeGreaterThan(0);
    expect(result.message).toContain("headroom");
  });

  it("declines running when no PICO-8 program is present", async () => {
    const cartPath = `${root}/run-decline.p8`;
    await writeFile(
      cartPath,
      `pico-8 cartridge // http://www.pico-8.com\nversion 42\n__lua__\nprint(1)\n__gfx__\n__gff__\n__map__\n__sfx__\n__music__\n`,
    );
    const result = await qdJsonAllowExit("cart", "run", cartPath, "--json", {
      env: { PICO8_BIN: missingBinary },
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.json.error).toContain("No PICO-8 program is installed");
    expect(result.json.message).toContain("running and exporting are unavailable");
    expect(result.json.success).not.toBe(true);
  });
});
