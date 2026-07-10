import { exportCart, runCart } from "@cat-cave/qdcli-core";
import { numberOpt, output, requiredArg, stringListOpt, stringOpt } from "./args.js";

export async function runCartCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  try {
    const result = await runCart(root, resolvedPath, {
      binaryPath: stringOpt(options.pico8),
      frames: numberOpt(options.frames),
      capture: (stringOpt(options.capture) as "none" | "screen" | "gif" | undefined) ?? "none",
      captureAt: numberOpt(options["capture-at"]),
      trace: parseCommaList(options.trace),
      input: parseInputFrames(options.buttons),
      timeoutMs: numberOpt(options["timeout-ms"]),
      outputDir: stringOpt(options["output-dir"]),
      param: stringOpt(options.param),
    });
    output(result, json);
    if (!result.success) process.exitCode = result.timedOut || result.error ? 5 : 1;
  } catch (error: unknown) {
    handleRuntimeError(error, json);
  }
}

export async function exportCartCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const format = stringOpt(options.to);
  if (format !== "web" && format !== "native") {
    throw new Error('--to must be "web" or "native"');
  }
  try {
    const result = await exportCart(root, resolvedPath, {
      binaryPath: stringOpt(options.pico8),
      format,
      outputPath: stringOpt(options.output),
      extraCarts: parseCommaList(options["extra-carts"]),
      iconIndex: numberOpt(options["icon-index"]),
      iconSize: numberOpt(options["icon-size"]),
      iconTransparent: numberOpt(options["icon-transparent"]),
    });
    output(result, json);
    if (!result.success) process.exitCode = 5;
  } catch (error: unknown) {
    handleRuntimeError(error, json);
  }
}

function parseCommaList(value: string | string[] | boolean | undefined): string[] {
  return stringListOpt(value)
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseInputFrames(
  value: string | string[] | boolean | undefined,
): Array<{ frame: number; hold: number[] }> {
  const text = stringOpt(value);
  if (!text) return [];
  const parsed = JSON.parse(text) as Array<{ frame: number; hold: number[] }>;
  if (!Array.isArray(parsed)) throw new Error("--buttons must be a JSON array");
  return parsed;
}

function handleRuntimeError(error: unknown, json: boolean): void {
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

function outputError(message: string, json: boolean): void {
  if (json) console.log(JSON.stringify({ error: message, message }, null, 2));
  else console.error(message);
}
