import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect } from "vite-plus/test";
import { runCli } from "./index.js";

export let root = "";

export function installCliFixture(): void {
  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "qdcli-e2e-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });
}

export async function qd(...args: string[]): Promise<string> {
  const result = await qdRaw(args);
  if (result.exitCode) {
    throw new Error(
      `qd ${args.join(" ")} exited ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
  return result.stdout;
}

export async function qdAt(targetRoot: string, ...args: string[]): Promise<string> {
  const result = await qdRaw(["--root", targetRoot, ...args]);
  if (result.exitCode) {
    throw new Error(
      `qd --root ${targetRoot} ${args.join(" ")} exited ${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
  return result.stdout;
}

export async function qdJson(...args: any[]): Promise<Record<string, any>> {
  const options =
    typeof args[args.length - 1] === "object" && !Array.isArray(args[args.length - 1])
      ? args.pop()
      : undefined;
  const text = await qdRawWithOptions(args as string[], options);
  if (text.exitCode) {
    throw new Error(
      `qd ${args.join(" ")} exited ${text.exitCode}\nstdout:\n${text.stdout}\nstderr:\n${text.stderr}`,
    );
  }
  return JSON.parse(text.stdout) as Record<string, any>;
}

export async function qdJsonAllowExit(...args: any[]): Promise<{
  exitCode: number | undefined;
  json: Record<string, any>;
  stderr: string;
  stdout: string;
}> {
  const options =
    typeof args[args.length - 1] === "object" && !Array.isArray(args[args.length - 1])
      ? args.pop()
      : undefined;
  const result = await qdRawWithOptions(args as string[], options);
  return {
    exitCode: result.exitCode,
    json: result.stdout ? (JSON.parse(result.stdout) as Record<string, any>) : {},
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

export async function expectQdFailure(pattern: RegExp, ...args: string[]): Promise<void> {
  const result = await qdRaw(args);
  expect(result.exitCode).toBeTruthy();
  expect(`${result.stdout}\n${result.stderr}`).toMatch(pattern);
}

export async function configureStrictDoctorCommands(): Promise<void> {
  await qd("config", "set", "check_command", 'node -e "process.exit(0)"');
  await qd("config", "set", "ci_command", 'node -e "process.exit(0)"');
}

export async function qdRaw(
  ...args: any[]
): Promise<{ exitCode: number | undefined; stdout: string; stderr: string }> {
  const { cliArgs, options } = normalizeCliArgs(args);
  return qdRawWithOptions(cliArgs, options);
}

async function qdRawWithOptions(
  args: string[],
  options: { env?: Record<string, string> } | undefined,
): Promise<{ exitCode: number | undefined; stdout: string; stderr: string }> {
  const previousExitCode = process.exitCode;
  const output: string[] = [];
  const errors: string[] = [];
  const previousLog = console.log;
  const previousError = console.error;
  const rootedArgs = args.includes("--root") ? args : ["--root", root, ...args];
  process.exitCode = undefined;
  console.log = (...values: unknown[]) => {
    output.push(values.map(String).join(" "));
  };
  console.error = (...values: unknown[]) => {
    errors.push(values.map(String).join(" "));
  };
  const restoreEnv = new Map<string, string | undefined>();
  if (options?.env) {
    for (const [name, value] of Object.entries(options.env)) {
      restoreEnv.set(name, process.env[name]);
      process.env[name] = value;
    }
  }
  try {
    await runCli(rootedArgs);
    return {
      exitCode: typeof process.exitCode === "number" ? process.exitCode : undefined,
      stdout: output.join("\n"),
      stderr: errors.join("\n"),
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: output.join("\n"),
      stderr: [errors.join("\n"), error instanceof Error ? error.message : String(error)]
        .filter(Boolean)
        .join("\n"),
    };
  } finally {
    console.log = previousLog;
    console.error = previousError;
    for (const [name, value] of restoreEnv) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    process.exitCode = previousExitCode;
  }
}

function normalizeCliArgs(args: any[]): {
  cliArgs: string[];
  options: { env?: Record<string, string> } | undefined;
} {
  const copied = [...args];
  const options =
    typeof copied[copied.length - 1] === "object" && !Array.isArray(copied[copied.length - 1])
      ? (copied.pop() as { env?: Record<string, string> })
      : undefined;
  const cliArgs =
    copied.length === 1 && Array.isArray(copied[0])
      ? (copied[0] as string[])
      : (copied as string[]);
  return { cliArgs, options };
}
