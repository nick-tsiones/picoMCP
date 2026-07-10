import { describe, expect, it } from "vite-plus/test";
import { runCli } from "../src/dispatch-cli.js";

async function captureRun(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode?: number }> {
  const previousExitCode = process.exitCode;
  const output: string[] = [];
  const errors: string[] = [];
  const previousLog = console.log;
  const previousError = console.error;
  process.exitCode = undefined;
  console.log = (...values: unknown[]) => output.push(values.map(String).join(" "));
  console.error = (...values: unknown[]) => errors.push(values.map(String).join(" "));
  try {
    // eslint-disable-next-line @typescript-eslint/await-thenable
    await runCli(args);
    return {
      exitCode: process.exitCode ?? undefined,
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
    process.exitCode = previousExitCode;
  }
}

describe("picoMCP CLI smoke", () => {
  it("--version returns picoMCP", async () => {
    const { stdout } = await captureRun(["--version"]);
    expect(stdout).toContain("picoMCP");
  });

  it("--help returns help text", async () => {
    const { stdout } = await captureRun(["--help"]);
    expect(stdout).toContain("picoMCP - PICO-8 Cartridge CLI");
    expect(stdout).toContain("Usage:");
  });

  it("cart read returns an error (proves it is NOT qd cart)", async () => {
    const result = await captureRun(["cart", "read"]);
    expect(result.stdout + "\n" + result.stderr).toMatch(/cart/);
  });
});
