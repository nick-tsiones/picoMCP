import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Cart, CartRepo } from "./cart_repo.js";
import { detectPico8Capability } from "./capability.js";
import { assertWithinProjectBoundary } from "./path_guard.js";
import {
  copyRunArtifacts,
  emptyParsedLog,
  escapeLuaString,
  listExportFiles,
  parseRunLog,
  parseRuntimeError,
  runExternal,
  type RunErrorReport,
  type RunPerformance,
  type RunTraceEntry,
} from "./runtime_svc_helpers.js";

const repo = new CartRepo();
const DEFAULT_TIMEOUT_MS = 10_000;

export interface RunInputFrame {
  frame: number;
  hold: number[];
}

export interface RunCartOptions {
  binaryPath?: string | null;
  frames?: number;
  capture?: "none" | "screen" | "gif";
  captureAt?: number;
  trace?: string[];
  input?: RunInputFrame[];
  timeoutMs?: number;
  outputDir?: string;
  param?: string;
}

export interface RunCartResult {
  success: boolean;
  timedOut: boolean;
  exitCode: number;
  frameCount: number;
  captureMode: "none" | "screen" | "gif";
  outputDir: string;
  screenshotPath: string | null;
  animationPath: string | null;
  logPath: string | null;
  stdoutPath: string;
  stderrPath: string;
  stdout: string;
  stderr: string;
  traces: RunTraceEntry[];
  performance: RunPerformance | null;
  error: RunErrorReport | null;
}

export interface ExportCartOptions {
  binaryPath?: string | null;
  format: "web" | "native";
  outputPath?: string;
  extraCarts?: string[];
  iconIndex?: number;
  iconSize?: number;
  iconTransparent?: number;
}

export interface ExportCartResult {
  success: boolean;
  exitCode: number;
  outputPath: string;
  files: string[];
  stdout: string;
  stderr: string;
}

export async function runCart(
  root: string,
  cartPath: string,
  options: RunCartOptions = {},
): Promise<RunCartResult> {
  const resolvedCart = path.resolve(cartPath);
  await assertWithinProjectBoundary(root, resolvedCart);
  const binaryPath = await resolvePico8Binary(options.binaryPath);
  const frames = options.frames ?? 30;
  const capture = options.capture ?? "none";
  const captureAt = options.captureAt ?? frames;
  const outputDir = path.resolve(
    options.outputDir ??
      path.join(path.dirname(resolvedCart), ".qd-runtime", path.parse(resolvedCart).name),
  );
  await assertWithinProjectBoundary(root, outputDir);
  await mkdir(outputDir, { recursive: true });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "qdcli-runtime-"));
  const runtimeRoot = path.join(tempDir, "root");
  const homeDir = path.join(tempDir, "home");
  const desktopDir = path.join(tempDir, "desktop");
  const workDir = path.join(tempDir, "work");
  await mkdir(runtimeRoot, { recursive: true });
  await mkdir(homeDir, { recursive: true });
  await mkdir(desktopDir, { recursive: true });
  await mkdir(workDir, { recursive: true });

  const original = await repo.load(root, resolvedCart);
  await repo.save(
    runtimeRoot,
    path.join(runtimeRoot, "driver.p8"),
    buildDriverCart(original, {
      frames,
      capture,
      captureAt,
      trace: options.trace ?? [],
      input: normalizeInput(options.input ?? []),
    }),
  );

  const driverPath = path.join(runtimeRoot, "driver.p8");
  const command = buildRunCommand(
    binaryPath,
    driverPath,
    homeDir,
    runtimeRoot,
    desktopDir,
    options.param,
  );
  const processResult = await runExternal(
    command.command,
    command.args,
    workDir,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const copied = await copyRunArtifacts(
    homeDir,
    desktopDir,
    outputDir,
    processResult.stdout,
    processResult.stderr,
  );
  const parsedLog = copied.logPath
    ? parseRunLog(await readFile(copied.logPath, "utf8"))
    : emptyParsedLog();
  const runtimeError = parseRuntimeError(processResult.stdout);
  await rm(tempDir, { recursive: true, force: true });

  return {
    success:
      !processResult.timedOut &&
      runtimeError === null &&
      (capture === "none" ||
        (capture === "screen" ? copied.screenshotPath !== null : copied.animationPath !== null)),
    timedOut: processResult.timedOut,
    exitCode: processResult.exitCode,
    frameCount: parsedLog.frameCount ?? frames,
    captureMode: capture,
    outputDir,
    screenshotPath: copied.screenshotPath,
    animationPath: copied.animationPath,
    logPath: copied.logPath,
    stdoutPath: copied.stdoutPath,
    stderrPath: copied.stderrPath,
    stdout: processResult.stdout,
    stderr: processResult.stderr,
    traces: parsedLog.traces,
    performance: parsedLog.performance,
    error: runtimeError,
  };
}

export async function exportCart(
  root: string,
  cartPath: string,
  options: ExportCartOptions,
): Promise<ExportCartResult> {
  const resolvedCart = path.resolve(cartPath);
  await assertWithinProjectBoundary(root, resolvedCart);
  const binaryPath = await resolvePico8Binary(options.binaryPath);
  const outputPath = path.resolve(
    options.outputPath ??
      resolvedCart.replace(/\.p8(\.png)?$/i, options.format === "web" ? ".html" : ".bin"),
  );
  await assertWithinProjectBoundary(root, outputPath);
  for (const extraCart of options.extraCarts ?? []) {
    await assertWithinProjectBoundary(root, path.resolve(extraCart));
  }

  const cwd = root;
  const exportArgs: string[] = [];
  if (options.format === "native") {
    if (options.iconIndex !== undefined) exportArgs.push("-i", String(options.iconIndex));
    if (options.iconSize !== undefined) exportArgs.push("-s", String(options.iconSize));
    if (options.iconTransparent !== undefined)
      exportArgs.push("-c", String(options.iconTransparent));
  }
  exportArgs.push(path.relative(cwd, outputPath));
  for (const extraCart of options.extraCarts ?? []) {
    exportArgs.push(path.relative(cwd, path.resolve(extraCart)));
  }

  const command = buildExportCommand(
    binaryPath,
    path.relative(cwd, resolvedCart),
    exportArgs.join(" "),
  );
  const processResult = await runExternal(
    command.command,
    command.args,
    cwd,
    DEFAULT_TIMEOUT_MS * 3,
  );
  const files = await listExportFiles(outputPath);
  return {
    success: processResult.exitCode === 0 && files.length > 0,
    exitCode: processResult.exitCode,
    outputPath,
    files,
    stdout: processResult.stdout,
    stderr: processResult.stderr,
  };
}

function buildDriverCart(
  original: Cart,
  options: {
    frames: number;
    capture: "none" | "screen" | "gif";
    captureAt: number;
    trace: string[];
    input: RunInputFrame[];
  },
): Cart {
  return {
    ...original,
    code: [buildRuntimePrologue(options), ...original.code, buildRuntimeEpilogue(options.capture)],
  };
}

function buildRuntimePrologue(options: {
  frames: number;
  capture: string;
  captureAt: number;
  trace: string[];
  input: RunInputFrame[];
}): string {
  const traceLines = options.trace
    .map(
      (name) =>
        `printh("TRACE|"..__pm_frame.."|${escapeLuaString(name)}|"..tostr(${name}),"log.txt")`,
    )
    .join("\n  ");
  return [
    `__pm_frames=${options.frames}`,
    `__pm_capture="${escapeLuaString(options.capture)}"`,
    `__pm_capture_at=${options.captureAt}`,
    "__pm_frame=0",
    "__pm_cpu_sum=0",
    "__pm_cpu_peak=0",
    `__pm_input=${serializeInputScript(options.input)}`,
    "__pm_prev={}",
    "__pm_cur={}",
    "function __pm_has(list, value)",
    " for i=1,#list do if list[i]==value then return true end end",
    " return false",
    "end",
    "function __pm_next_frame()",
    " __pm_frame=__pm_frame+1",
    " __pm_prev=__pm_cur",
    " __pm_cur=__pm_input[__pm_frame] or {}",
    "end",
    "btn=function(i,p) return __pm_has(__pm_cur, i) end",
    "btnp=function(i,p) return __pm_has(__pm_cur, i) and not __pm_has(__pm_prev, i) end",
    "function __pm_finish_frame()",
    " local cpu=stat(1)",
    " __pm_cpu_sum=__pm_cpu_sum+cpu",
    " if cpu>__pm_cpu_peak then __pm_cpu_peak=cpu end",
    ...(traceLines ? [` ${traceLines}`] : []),
    ' if __pm_capture=="screen" and __pm_frame==__pm_capture_at then extcmd("set_filename","capture") extcmd("screen") end',
    " if __pm_frame>=__pm_frames then",
    '  if __pm_capture=="gif" then extcmd("set_filename","capture") extcmd("video") end',
    '  printh("PERF|"..tostr(__pm_cpu_sum/max(__pm_frame,1)).."|"..tostr(__pm_cpu_peak).."|"..__pm_frame,"log.txt")',
    "  stop()",
    " end",
    "end",
  ].join("\n");
}

function buildRuntimeEpilogue(capture: string): string {
  return [
    "local __pm_init=_init",
    "local __pm_update=_update",
    "local __pm_update60=_update60",
    "local __pm_draw=_draw",
    "function _init()",
    " srand(1)",
    capture === "gif" ? ' extcmd("set_filename","capture") extcmd("rec_frames")' : "",
    " if __pm_init then __pm_init() end",
    "end",
    "if __pm_update60 then",
    " function _update60() __pm_next_frame() __pm_update60() end",
    "elseif __pm_update then",
    " function _update() __pm_next_frame() __pm_update() end",
    "else",
    " function _update() __pm_next_frame() end",
    "end",
    "function _draw()",
    " if __pm_draw then __pm_draw() end",
    " __pm_finish_frame()",
    "end",
  ]
    .filter(Boolean)
    .join("\n");
}

function serializeInputScript(input: RunInputFrame[]): string {
  return input.length === 0
    ? "{}"
    : `{${input.map((entry) => `[${entry.frame}]={${entry.hold.join(",")}}`).join(",")}}`;
}

function normalizeInput(input: RunInputFrame[]): RunInputFrame[] {
  return input
    .filter((entry) => Number.isInteger(entry.frame) && entry.frame > 0)
    .map((entry) => ({
      frame: entry.frame,
      hold: [
        ...new Set(
          entry.hold.filter((value) => Number.isInteger(value) && value >= 0 && value <= 11),
        ),
      ],
    }))
    .sort((left, right) => left.frame - right.frame);
}

async function resolvePico8Binary(binaryPath?: string | null): Promise<string> {
  const report = await detectPico8Capability(binaryPath);
  if (!report.present || !report.binaryPath) {
    throw new Error("No PICO-8 program is installed, so running and exporting are unavailable.");
  }
  if (process.platform === "linux") {
    try {
      await access("/usr/bin/xvfb-run", constants.X_OK);
    } catch {
      throw new Error("Headless PICO-8 execution requires xvfb-run in this environment.");
    }
  }
  return report.binaryPath;
}

function buildRunCommand(
  binaryPath: string,
  driverPath: string,
  homeDir: string,
  rootDir: string,
  desktopDir: string,
  param?: string,
): { command: string; args: string[] } {
  const binaryArgs = [
    binaryPath,
    "-x",
    driverPath,
    "-home",
    homeDir,
    "-root_path",
    rootDir,
    "-desktop",
    desktopDir,
  ];
  if (param) binaryArgs.push("-p", param);
  return process.platform === "linux"
    ? { command: "/usr/bin/xvfb-run", args: ["-a", ...binaryArgs] }
    : { command: binaryPath, args: binaryArgs.slice(1) };
}

function buildExportCommand(
  binaryPath: string,
  cartArg: string,
  exportArgString: string,
): { command: string; args: string[] } {
  const binaryArgs = [binaryPath, cartArg, "-export", exportArgString];
  return process.platform === "linux"
    ? { command: "/usr/bin/xvfb-run", args: ["-a", ...binaryArgs] }
    : { command: binaryPath, args: binaryArgs.slice(1) };
}
