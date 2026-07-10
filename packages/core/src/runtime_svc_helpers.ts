import { spawn } from "node:child_process";
import { access, copyFile, readdir, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

export interface RunTraceEntry {
  frame: number;
  name: string;
  value: string;
}

export interface RunPerformance {
  averageCpu: number;
  peakCpu: number;
}

export interface RunErrorReport {
  message: string;
  line: number;
  tab: number;
  phase: string | null;
}

export async function runExternal(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: timedOut ? 124 : (code ?? 1),
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        timedOut,
      });
    });
  });
}

export async function copyRunArtifacts(
  homeDir: string,
  desktopDir: string,
  outputDir: string,
  stdout: string,
  stderr: string,
): Promise<{
  screenshotPath: string | null;
  animationPath: string | null;
  logPath: string | null;
  stdoutPath: string;
  stderrPath: string;
}> {
  const stdoutPath = path.join(outputDir, "stdout.txt");
  const stderrPath = path.join(outputDir, "stderr.txt");
  await writeFile(stdoutPath, stdout, "utf8");
  await writeFile(stderrPath, stderr, "utf8");

  const logSource = path.join(homeDir, "carts", "log.txt");
  const logPath = (await fileExists(logSource)) ? path.join(outputDir, "log.txt") : null;
  if (logPath) await copyFile(logSource, logPath);

  const desktopFiles = await readdir(desktopDir).catch(() => []);
  const screenshotSource = desktopFiles.find((name) => name.toLowerCase().endsWith(".png"));
  const animationSource = desktopFiles.find((name) => name.toLowerCase().endsWith(".gif"));
  const screenshotPath = screenshotSource ? path.join(outputDir, screenshotSource) : null;
  const animationPath = animationSource ? path.join(outputDir, animationSource) : null;
  if (screenshotSource && screenshotPath) {
    await copyFile(path.join(desktopDir, screenshotSource), screenshotPath);
  }
  if (animationSource && animationPath) {
    await copyFile(path.join(desktopDir, animationSource), animationPath);
  }
  return { screenshotPath, animationPath, logPath, stdoutPath, stderrPath };
}

export function parseRunLog(contents: string): {
  traces: RunTraceEntry[];
  performance: RunPerformance | null;
  frameCount: number | null;
} {
  const traces: RunTraceEntry[] = [];
  let performance: RunPerformance | null = null;
  let frameCount: number | null = null;
  for (const line of contents.split(/\r?\n/)) {
    if (line.startsWith("TRACE|")) {
      const [, frameText, name, ...valueParts] = line.split("|");
      traces.push({ frame: Number(frameText), name: name ?? "", value: valueParts.join("|") });
      continue;
    }
    if (line.startsWith("PERF|")) {
      const [, averageText, peakText, frameText] = line.split("|");
      performance = { averageCpu: Number(averageText), peakCpu: Number(peakText) };
      frameCount = Number(frameText);
    }
  }
  return { traces, performance, frameCount };
}

export function emptyParsedLog(): {
  traces: RunTraceEntry[];
  performance: RunPerformance | null;
  frameCount: number | null;
} {
  return { traces: [], performance: null, frameCount: null };
}

export function parseRuntimeError(stdout: string): RunErrorReport | null {
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const runtimeIndex = lines.findIndex((line) => line.startsWith("runtime error line "));
  if (runtimeIndex === -1) return null;
  const headerMatch = /runtime error line (\d+) tab (\d+)/.exec(lines[runtimeIndex] ?? "");
  const phaseLine = lines.find((line) => line.startsWith("in ")) ?? null;
  return {
    message: lines[runtimeIndex + 2] ?? "runtime error",
    line: headerMatch ? Number(headerMatch[1]) : 0,
    tab: headerMatch ? Number(headerMatch[2]) : 0,
    phase: phaseLine ? phaseLine.replace(/^in /, "") : null,
  };
}

export async function listExportFiles(outputPath: string): Promise<string[]> {
  if (!(await fileExists(outputPath))) return [];
  const info = await stat(outputPath);
  if (info.isFile()) return [outputPath];
  const files: string[] = [];
  await walkFiles(outputPath, files);
  return files.sort();
}

async function walkFiles(target: string, files: string[]): Promise<void> {
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const nextPath = path.join(target, entry.name);
    if (entry.isDirectory()) await walkFiles(nextPath, files);
    else files.push(nextPath);
  }
}

async function fileExists(target: string): Promise<boolean> {
  try {
    await access(target, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export function escapeLuaString(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}
