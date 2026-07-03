import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdRaw, root } from "./cli-e2e-fixtures.js";

installCliFixture();

describe("qd project and path boundaries", () => {
  it("refuses export paths outside the project boundary", async () => {
    await qd("setup", "--no-hooks");
    await qd("method", "acknowledge", "--agent", "test");
    await qd(
      "node",
      "add",
      "--id",
      "boundary-node",
      "--title",
      "Boundary node",
      "--spec",
      "Stay inside the project.",
      "--acceptance",
      "The export stays inside the project boundary.",
    );

    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "qdcli-outside-boundary-"));
    const outsideExport = path.join(outsideRoot, "snapshot.json");

    const result = await qdRaw(["export", "--out", outsideExport, "--json"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("outside the project boundary");
  });
});
