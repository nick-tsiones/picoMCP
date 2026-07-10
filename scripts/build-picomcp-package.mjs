#!/usr/bin/env node
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const picoRoot = path.join(repoRoot, "packages", "picoMCP");
const packageManager = process.env.npm_execpath
  ? { command: process.execPath, prefixArgs: [process.env.npm_execpath] }
  : { command: "pnpm", prefixArgs: [] };

runPnpm(["--dir", repoRoot, "--filter", "@cat-cave/qdcli-core", "run", "build"]);
runPnpm(["--dir", picoRoot, "exec", "vp", "pack", "src/index.ts", "--format", "esm", "--dts"]);

function runPnpm(args) {
  const result = spawnSync(packageManager.command, [...packageManager.prefixArgs, ...args], {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
