import { resolveProjectRoot, type RunInputFrame } from "@cat-cave/qdcli-core";
import { readFile } from "node:fs/promises";
import {
  convertCartridge,
  exportCartridge,
  lintCartridge,
  minifyCartridge,
  parseCartridge,
  readOverview,
  readTab,
  refApi,
  refPitfalls,
  runCartridge,
  sizeCartridge,
  writeCartridge,
} from "./commands.js";
import {
  dispatchEdit,
  dispatchFlags,
  dispatchMap,
  dispatchSfx,
  dispatchSprite,
} from "./dispatch-subcommands.js";
import { HELP_TEXT } from "./help.js";

interface ParsedArgs {
  command: string[];
  options: Record<string, string | string[] | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const command: string[] = [];
  const options: Record<string, string | string[] | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
      const key = rawKey;
      if (!key) continue;
      const next = argv[i + 1];
      const hasInlineValue = inlineValue !== undefined;
      const value = hasInlineValue ? inlineValue : next && !next.startsWith("-") ? next : true;
      if (!hasInlineValue && value !== true) i += 1;
      options[key] = value;
    } else {
      command.push(arg);
    }
  }
  return { command, options };
}

export function requiredArg(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function parsePositiveInteger(value: string, key: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${key} must be a positive integer`);
  return parsed;
}

export function stringOpt(value: string | string[] | boolean | undefined): string | undefined {
  if (Array.isArray(value)) return value.at(-1);
  return typeof value === "string" ? value : undefined;
}

export function numberOpt(value: string | string[] | boolean | undefined): number | undefined {
  const text = stringOpt(value);
  if (!text) return undefined;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new Error(`Expected number, got ${text}`);
  return parsed;
}

export function output(value: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (Array.isArray(value)) {
    console.table(value);
    return;
  }
  if (typeof value === "string") {
    console.log(value);
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

function outputError(message: string, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ error: message, message }, null, 2));
  } else {
    console.error(message);
  }
  process.exitCode = 1;
}

async function handleRuntimeError(error: unknown, json: boolean): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("No PICO-8 program is installed")) {
    outputError("No PICO-8 program is installed, so running and exporting are unavailable.", json);
    process.exitCode = 4;
    return;
  }
  if (message.includes("Headless PICO-8 execution requires xvfb-run")) {
    outputError(message, json);
    process.exitCode = 4;
    return;
  }
  if (message === "cartridge was not found" || message.includes("outside the project boundary")) {
    outputError(message, json);
    process.exitCode = message === "cartridge was not found" ? 3 : 6;
    return;
  }
  throw error;
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const [group, action, extra] = args.command;
  const json = Boolean(args.options.json);

  if (args.options.version || group === "version" || group === "--version" || group === "-v") {
    console.log("picoMCP 0.1.0");
    return;
  }

  if (!group || group === "help" || group === "--help" || group === "-h") {
    console.log(HELP_TEXT);
    return;
  }

  if (group === "serve") {
    const { startMcpServer } = await import("./mcp-server.js");
    await startMcpServer();
    return;
  }

  const root = await resolveProjectRoot({
    root: stringOpt(args.options.root),
    allowMissing: true,
  });

  if (group === "ref") return handleRef(root, action, extra, json);
  if (group === "convert") return handleConvert(root, action, args.options, json);

  try {
    switch (group) {
      case "read":
        return handleRead(root, action, args.options, json);
      case "write":
        return handleWrite(root, action, args.options, json);
      case "parse":
        output(await parseCartridge(root, requiredArg(action, "cartridge file path")), json);
        return;
      case "lint":
        output(await lintCartridge(root, requiredArg(action, "cartridge file path")), json);
        return;
      case "size":
        output(await sizeCartridge(root, requiredArg(action, "cartridge file path")), json);
        return;
      case "run":
        return handleRun(root, action, args.options, json);
      case "export":
        return handleExport(root, action, args.options, json);
      case "sprite":
        await dispatchSprite(root, action, extra, args.options, json);
        return;
      case "map":
        await dispatchMap(root, action, extra, args.options, json);
        return;
      case "sfx":
        await dispatchSfx(root, action, extra, args.options, json);
        return;
      case "flags":
        await dispatchFlags(root, action, extra, args.options, json);
        return;
      case "minify": {
        const filePath = requiredArg(action, "cartridge file path");
        const rename = Boolean(args.options.rename);
        output(await minifyCartridge(root, filePath, rename), json);
        return;
      }
      case "edit":
        await dispatchEdit(root, action, extra, args.options, json);
        return;
      default:
        throw new Error(`Unknown command: ${group}`);
    }
  } catch (error: unknown) {
    await handleRuntimeError(error, json);
    if (error instanceof Error) {
      if (error.message === "cartridge was not found") {
        outputError("cartridge was not found", json);
        return;
      }
      if ((error as { code?: string }).code === "OUTSIDE_PROJECT") {
        outputError(error.message, json);
        return;
      }
    }
    outputError(error instanceof Error ? error.message : String(error), json);
  }
}

async function handleRead(
  root: string,
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const tabStr = stringOpt(options.tab);
  const filePath = requiredArg(action, "cartridge file path");
  if (tabStr) {
    const tabIndex = parsePositiveInteger(tabStr, "--tab");
    output(await readTab(root, filePath, tabIndex), json);
  } else {
    output(await readOverview(root, filePath), json);
  }
}

async function handleWrite(
  root: string,
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const filePath = requiredArg(action, "cartridge file path");
  const code = requiredArg(stringOpt(options.code), "--code");
  const tabStr = stringOpt(options.tab);
  const tabIndex = tabStr ? parsePositiveInteger(tabStr, "--tab") : 1;
  output(await writeCartridge(root, filePath, code, tabIndex), json);
}

async function parseInputOption(
  value: string,
): Promise<RunInputFrame[]> {
  let raw: string;
  if (value.startsWith("@")) {
    raw = await readFile(value.slice(1), "utf8");
  } else {
    raw = value;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("--input must be valid JSON or @file.json with valid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("--input must be a JSON array of {frame, hold} entries");
  }
  for (const entry of parsed) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      typeof (entry as Record<string, unknown>).frame !== "number" ||
      !Array.isArray((entry as Record<string, unknown>).hold)
    ) {
      throw new Error('Each --input entry must have "frame" (number) and "hold" (array of numbers)');
    }
  }
  return parsed as RunInputFrame[];
}

async function handleRun(
  root: string,
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const filePath = requiredArg(action, "cartridge file path");
  const inputRaw = stringOpt(options.input);
  const input = inputRaw ? await parseInputOption(inputRaw) : undefined;
  const result = await runCartridge(root, filePath, {
    binaryPath: stringOpt(options.pico8),
    frames: numberOpt(options.frames),
    capture: (stringOpt(options.capture) as "none" | "screen" | "gif" | undefined) ?? "none",
    captureAt: numberOpt(options["capture-at"]),
    param: stringOpt(options.param),
    input,
  });
  output(result, json);
  if (!result.success) process.exitCode = result.timedOut || result.error ? 5 : 1;
}

async function handleExport(
  root: string,
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const filePath = requiredArg(action, "cartridge file path");
  const format = requiredArg(stringOpt(options.to), "--to");
  if (format !== "web" && format !== "native") {
    throw new Error('--to must be "web" or "native"');
  }
  const result = await exportCartridge(root, filePath, {
    binaryPath: stringOpt(options.pico8),
    format,
    outputPath: stringOpt(options.output),
  });
  output(result, json);
  if (!result.success) process.exitCode = 5;
}

async function handleRef(
  _root: string,
  action: string | undefined,
  extra: string | undefined,
  json: boolean,
): Promise<void> {
  if (action === "api" || (action === undefined && extra === "api")) {
    output(await refApi(), json);
    return;
  }
  if (action === "pitfalls" || (action === undefined && extra === "pitfalls")) {
    output(await refPitfalls(), json);
    return;
  }
  throw new Error(`Unknown ref action: ${action}`);
}

async function handleConvert(
  _root: string,
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const filePath = requiredArg(action, "cartridge file path");
  const toFormat = requiredArg(stringOpt(options.to), "--to");
  if (toFormat !== "p8.png" && toFormat !== "p8") {
    throw new Error('--to must be "p8.png" or "p8"');
  }
  try {
    const result = await convertCartridge(filePath, toFormat, stringOpt(options.output));
    output(result, json);
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (
        (error as { code?: string }).code === "ENOENT" ||
        error.message === "cartridge was not found"
      ) {
        outputError("cartridge was not found", json);
        return;
      }
      if ((error as { code?: string }).code === "OUTSIDE_PROJECT") {
        outputError(error.message, json);
        return;
      }
    }
    throw error;
  }
}
