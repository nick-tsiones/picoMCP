import {
  CartRepo,
  bulkSetFlags,
  detectPico8Capability,
  getFlags,
  lintCart,
  parseCode,
  reportCartSize,
  setFlag,
  type CartOverview,
} from "@cat-cave/qdcli-core";
import { output, requiredArg, parsePositiveInteger } from "./args.js";
import { readFile, writeFile } from "node:fs/promises";
import { createMinimalPng, extractP8FromPng } from "@cat-cave/qdcli-core";

const repo = new CartRepo();

export async function readOverviewCommand(
  root: string,
  filePath: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  try {
    const cart = await repo.load(root, resolvedPath);
    const overview = repo.overview(cart);
    outputOverview(overview, json);
  } catch (error: unknown) {
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
    throw error;
  }
}

export async function readTabCommand(
  root: string,
  filePath: string | undefined,
  tabIndexRaw: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const tabIndex = parsePositiveInteger(requiredArg(tabIndexRaw, "tab index"), "tab index");
  try {
    const cart = await repo.load(root, resolvedPath);
    const codeLines = cart.code;
    if (tabIndex < 1 || tabIndex > codeLines.length) {
      throw new Error(`Tab ${tabIndex} does not exist. Cartridge has ${codeLines.length} tab(s).`);
    }
    const code = codeLines[tabIndex - 1];
    if (json) {
      console.log(JSON.stringify({ tab: tabIndex, code }, null, 2));
    } else {
      console.log(code);
    }
  } catch (error: unknown) {
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
    throw error;
  }
}

// Node 1: cart size
export async function sizeCommand(
  root: string,
  filePath: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  try {
    const cart = await repo.load(root, resolvedPath);
    const report = reportCartSize(cart);
    output(report, json);
  } catch (error: unknown) {
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
    throw error;
  }
}

// Node 2: cart parse
export async function parseCommand(
  root: string,
  filePath: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  try {
    const cart = await repo.load(root, resolvedPath);
    const report = parseCode(cart);
    output(report, json);
  } catch (error: unknown) {
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
    throw error;
  }
}

// Node 1: cart write
export async function writeCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const code = requiredArg(stringOpt(options.code), "--code");
  const tabStr = stringOpt(options.tab);
  const tabIndex = tabStr ? parsePositiveInteger(tabStr, "--tab") : 1;

  try {
    let cart = await repo.loadOrCreate(root, resolvedPath);

    // Adjust code array size to accommodate the target tab
    while (cart.code.length < tabIndex) {
      cart.code.push("");
    }
    cart.code[tabIndex - 1] = code;

    await repo.save(root, resolvedPath, cart);
    const report = reportCartSize(cart);
    output({ ...report, tab: tabIndex }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function runCartCommand(
  root: string,
  filePath: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");

  try {
    await repo.load(root, resolvedPath);
    const capability = await detectPico8Capability();
    if (!capability.present) {
      outputError(
        "No PICO-8 program is installed, so running and exporting are unavailable.",
        json,
      );
      process.exitCode = 1;
      return;
    }
    output(
      {
        success: false,
        runnable: capability.runtime.runnable,
        exportable: capability.runtime.exportable,
        binaryPath: capability.binaryPath,
        message:
          "PICO-8 is installed and runtime work is available in this environment, but headless execution is implemented in the runtime DAG slice.",
      },
      json,
    );
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

// Node 2: cart lint
export async function lintCommand(
  root: string,
  filePath: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  try {
    const cart = await repo.load(root, resolvedPath);
    const report = lintCart(cart);
    output(report, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

// Node 3: cart convert
export async function convertCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const outputPath = options.output as string | undefined;
  const toFormat = options.to as string | undefined;

  if (!toFormat || (toFormat !== "p8.png" && toFormat !== "p8")) {
    throw new Error('--to must be "p8.png" or "p8"');
  }

  try {
    if (toFormat === "p8.png") {
      // Convert .p8 -> .p8.png
      const p8Data = await readFile(resolvedPath);
      const pngData = createMinimalPng(p8Data);
      const dest = outputPath || resolvedPath.replace(/\.p8$/i, ".p8.png");
      await writeFile(dest, pngData);
      output({ success: true, outputPath: dest }, json);
    } else {
      // Convert .p8.png -> .p8
      const pngData = await readFile(resolvedPath);
      const p8Data = extractP8FromPng(pngData);
      if (!p8Data) {
        throw new Error("No .p8 data found in the .p8.png file");
      }
      const dest = outputPath || resolvedPath.replace(/\.p8\.png$/i, ".p8");
      await writeFile(dest, p8Data);
      output({ success: true, outputPath: dest }, json);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      if ((error as { code?: string }).code === "ENOENT") {
        outputError("cartridge was not found", json);
        return;
      }
      if (error.message === "cartridge was not found") {
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

// Node 4: cart flags get
export async function flagsGetCommand(
  root: string,
  filePath: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  try {
    const cart = await repo.load(root, resolvedPath);
    const flags = getFlags(cart);
    output({ flags }, json);
  } catch (error: unknown) {
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
    throw error;
  }
}

// Node 4: cart flags set
export async function flagsSetCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const spriteStr = options.sprite as string | undefined;
  const valueStr = options.value as string | undefined;

  const spriteIndex = parsePositiveInteger(requiredArg(spriteStr, "--sprite"), "--sprite");
  const value = parsePositiveInteger(requiredArg(valueStr, "--value"), "--value");

  try {
    const cart = await repo.load(root, resolvedPath);
    const result = setFlag(cart, spriteIndex - 1, value);
    await repo.save(root, resolvedPath, cart);
    output(result, json);
  } catch (error: unknown) {
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
    throw error;
  }
}

// Node 4: cart flags bulk
export async function flagsBulkCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const patternStr = stringOpt(options.pattern);

  if (!patternStr) {
    throw new Error("--pattern is required (256 comma-separated values 0-255)");
  }

  const values = patternStr.split(",").map((s) => {
    const n = parseInt(s.trim(), 10);
    if (!Number.isInteger(n)) throw new Error(`Invalid flag value: "${s.trim()}"`);
    return n;
  });

  try {
    const cart = await repo.load(root, resolvedPath);
    const result = bulkSetFlags(cart, values);
    await repo.save(root, resolvedPath, cart);
    output(result, json);
  } catch (error: unknown) {
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
    throw error;
  }
}

function outputOverview(overview: CartOverview, json: boolean): void {
  output(
    {
      code: overview.code,
      size: overview.tabCount,
      tabCount: overview.tabCount,
      hasSprites: overview.hasSprites,
      hasMap: overview.hasMap,
      hasSfx: overview.hasSfx,
      hasMusic: overview.hasMusic,
      tokenCount: overview.tokenCount,
      assets: summaryOfAssets(overview),
    },
    json,
  );
}

function outputError(message: string, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ error: message, message }, null, 2));
  } else {
    console.error(message);
  }
}

function summaryOfAssets(overview: CartOverview): string {
  const parts: string[] = [];
  if (overview.hasSprites) parts.push("sprites");
  if (overview.hasMap) parts.push("map");
  if (overview.hasSfx) parts.push("sfx");
  if (overview.hasMusic) parts.push("music");
  if (parts.length === 0) return "none";
  return parts.join(", ");
}

function stringOpt(value: string | string[] | boolean | undefined): string | undefined {
  if (Array.isArray(value)) return value.at(-1);
  return typeof value === "string" ? value : undefined;
}

function handleCartError(error: unknown, json: boolean): void {
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
  throw error;
}
