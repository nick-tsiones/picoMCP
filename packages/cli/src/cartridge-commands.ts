import {
  CartRepo,
  bulkSetFlags,
  getFlags,
  parseCode,
  reportCartSize,
  setFlag,
  type CartOverview,
  getSprite,
  setSprite,
  getSpriteRange,
  setSpriteRange,
  getMapCell,
  setMapCell,
  getMapRegion,
  setMapRegion,
  getSfx,
  setSfx,
  listSfx,
  exportSpriteSheet,
  importSpriteSheet,
  minifyCode,
  lintCart,
} from "@cat-cave/qdcli-core";
import { output, requiredArg, parsePositiveInteger } from "./args.js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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
  const tabIndex = parsePositiveInteger(
    requiredArg(tabIndexRaw, "tab index"),
    "tab index",
  );
  try {
    const cart = await repo.load(root, resolvedPath);
    const codeLines = cart.code;
    if (tabIndex < 1 || tabIndex > codeLines.length) {
      throw new Error(
        `Tab ${tabIndex} does not exist. Cartridge has ${codeLines.length} tab(s).`,
      );
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
    const ext = path.extname(resolvedPath).toLowerCase();

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

  const spriteIndex = parsePositiveInteger(
    requiredArg(spriteStr, "--sprite"),
    "--sprite",
  );
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

// ── Sprite commands ─────────────────────────────────────────────────────────

export async function spriteGetCommand(
  root: string,
  filePath: string | undefined,
  indexStr: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const spriteIndex = parsePositiveInteger(
    requiredArg(indexStr, "sprite index"),
    "sprite index",
  ) - 1; // 1-indexed input, 0-indexed internal
  try {
    const cart = await repo.load(root, resolvedPath);
    const pixels = getSprite(cart.gfx, spriteIndex);
    output({ index: spriteIndex, pixels }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function spriteSetCommand(
  root: string,
  filePath: string | undefined,
  indexStr: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const spriteIndex = parsePositiveInteger(
    requiredArg(indexStr, "sprite index"),
    "sprite index",
  ) - 1;
  const pixelsStr = requiredArg(stringOpt(options.pixels), "--pixels");
  const pixels = pixelsStr.split(",").map((s) => {
    const n = parseInt(s.trim(), 10);
    if (!Number.isInteger(n) || n < 0 || n > 15) {
      throw new Error(`Pixel value "${s.trim()}" must be 0-15`);
    }
    return n;
  });
  if (pixels.length !== 64) {
    throw new Error("--pixels must contain exactly 64 comma-separated values (8x8)");
  }
  try {
    const cart = await repo.load(root, resolvedPath);
    setSprite(cart.gfx, spriteIndex, pixels);
    await repo.save(root, resolvedPath, cart);
    output({ index: spriteIndex, ok: true }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function spriteGetRangeCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const startStr = requiredArg(stringOpt(options.start), "--start");
  const endStr = requiredArg(stringOpt(options.end), "--end");
  const start = parsePositiveInteger(startStr, "--start") - 1;
  const end = parsePositiveInteger(endStr, "--end") - 1;
  try {
    const cart = await repo.load(root, resolvedPath);
    const sprites = getSpriteRange(cart.gfx, start, end);
    output({ sprites }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function spriteSetRangeCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const spritesStr = requiredArg(stringOpt(options.sprites), "--sprites");
  // --sprites is JSON: [{"index":0,"pixels":[...]}, ...]
  let entries: { index: number; pixels: number[] }[];
  try {
    entries = JSON.parse(spritesStr) as { index: number; pixels: number[] }[];
  } catch {
    throw new Error("--sprites must be valid JSON array of {index, pixels}");
  }
  for (const entry of entries) {
    if (typeof entry.index !== "number" || !Array.isArray(entry.pixels) || entry.pixels.length !== 64) {
      throw new Error("Each sprite entry must have index (number) and pixels (array of 64 numbers)");
    }
  }
  try {
    const cart = await repo.load(root, resolvedPath);
    setSpriteRange(cart.gfx, entries);
    await repo.save(root, resolvedPath, cart);
    output({ ok: true, count: entries.length }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

// ── Map commands ────────────────────────────────────────────────────────────

export async function mapGetCommand(
  root: string,
  filePath: string | undefined,
  xStr: string | undefined,
  yStr: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const x = parsePositiveInteger(requiredArg(xStr, "x coordinate"), "x") - 1;
  const y = parsePositiveInteger(requiredArg(yStr, "y coordinate"), "y") - 1;
  try {
    const cart = await repo.load(root, resolvedPath);
    const tile = getMapCell(cart.map, x, y);
    output({ x, y, tile }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function mapSetCommand(
  root: string,
  filePath: string | undefined,
  xStr: string | undefined,
  yStr: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const x = parsePositiveInteger(requiredArg(xStr, "x coordinate"), "x") - 1;
  const y = parsePositiveInteger(requiredArg(yStr, "y coordinate"), "y") - 1;
  const tileStr = requiredArg(stringOpt(options.tile), "--tile");
  const tile = parsePositiveInteger(tileStr, "--tile");
  if (tile > 256) throw new Error("--tile must be 1-256 (0-255 internally)");
  try {
    const cart = await repo.load(root, resolvedPath);
    setMapCell(cart.map, x, y, tile - 1);
    await repo.save(root, resolvedPath, cart);
    output({ x, y, tile: tile - 1, ok: true }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function mapGetRegionCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const x = parsePositiveInteger(requiredArg(stringOpt(options.x), "--x"), "--x") - 1;
  const y = parsePositiveInteger(requiredArg(stringOpt(options.y), "--y"), "--y") - 1;
  const w = parsePositiveInteger(requiredArg(stringOpt(options.width), "--width"), "--width");
  const h = parsePositiveInteger(requiredArg(stringOpt(options.height), "--height"), "--height");
  try {
    const cart = await repo.load(root, resolvedPath);
    const region = getMapRegion(cart.map, x, y, w, h);
    output({ x, y, w, h, region }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function mapSetRegionCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const x = parsePositiveInteger(requiredArg(stringOpt(options.x), "--x"), "--x") - 1;
  const y = parsePositiveInteger(requiredArg(stringOpt(options.y), "--y"), "--y") - 1;
  const valuesStr = requiredArg(stringOpt(options.values), "--values");
  let values: number[][];
  try {
    values = JSON.parse(valuesStr) as number[][];
  } catch {
    throw new Error("--values must be valid JSON 2D array of tile indices");
  }
  try {
    const cart = await repo.load(root, resolvedPath);
    setMapRegion(cart.map, x, y, values);
    await repo.save(root, resolvedPath, cart);
    output({ ok: true, x, y, w: values[0]?.length ?? 0, h: values.length }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

// ── SFX commands ────────────────────────────────────────────────────────────

export async function sfxGetCommand(
  root: string,
  filePath: string | undefined,
  indexStr: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const sfxIndex = parsePositiveInteger(
    requiredArg(indexStr, "sfx index"),
    "sfx index",
  ) - 1;
  try {
    const cart = await repo.load(root, resolvedPath);
    const sfx = getSfx(cart.sfx, sfxIndex);
    output({ index: sfxIndex, ...sfx }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function sfxSetCommand(
  root: string,
  filePath: string | undefined,
  indexStr: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const sfxIndex = parsePositiveInteger(
    requiredArg(indexStr, "sfx index"),
    "sfx index",
  ) - 1;
  const dataStr = requiredArg(stringOpt(options.data), "--data");
  let data: { notes?: { pitch: number; instr: number; vol: number; fx: number }[]; speed?: number; loopStart?: number; loopEnd?: number };
  try {
    data = JSON.parse(dataStr) as typeof data;
  } catch {
    throw new Error("--data must be valid JSON with notes, speed, loopStart, loopEnd");
  }
  const sfx = {
    notes: data.notes ?? [],
    speed: data.speed ?? 0,
    loopStart: data.loopStart ?? 0,
    loopEnd: data.loopEnd ?? 0,
  };
  try {
    const cart = await repo.load(root, resolvedPath);
    setSfx(cart.sfx, sfxIndex, sfx);
    await repo.save(root, resolvedPath, cart);
    output({ index: sfxIndex, ok: true }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function sfxListCommand(
  root: string,
  filePath: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  try {
    const cart = await repo.load(root, resolvedPath);
    const entries = listSfx(cart.sfx);
    output({ sfx: entries }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

// ── Sprite sheet export/import ─────────────────────────────────────────────

export async function spriteExportCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const outputPath = requiredArg(stringOpt(options.output), "--output (PNG file path)");

  if (!outputPath.toLowerCase().endsWith(".png")) {
    throw new Error("Output file must have a .png extension");
  }

  try {
    const cart = await repo.load(root, resolvedPath);
    const pngData = exportSpriteSheet(cart.gfx);
    await writeFile(outputPath, pngData);
    output({ ok: true, outputPath, message: "Sprite sheet exported as PNG" }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

export async function spriteImportCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const inputPath = requiredArg(stringOpt(options.input), "--input (PNG file path)");

  if (!inputPath.toLowerCase().endsWith(".png")) {
    throw new Error("Input file must be a .png file");
  }

  try {
    const pngData = await readFile(inputPath);
    const cart = await repo.load(root, resolvedPath);
    const result = importSpriteSheet(cart.gfx, pngData);
    if (!result.replaced) {
      throw new Error(result.reason);
    }
    await repo.save(root, resolvedPath, cart);
    output({ ok: true, message: result.reason }, json);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "cartridge was not found") {
      outputError("cartridge was not found", json);
      return;
    }
    handleCartError(error, json);
  }
}

// ── Minify command ────────────────────────────────────────────────────────

export async function minifyCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const rename = Boolean(options.rename);

  try {
    const cart = await repo.load(root, resolvedPath);
    const result = minifyCode(cart, { rename });
    await repo.save(root, resolvedPath, cart);
    output(result, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

// ── Edit commands ──────────────────────────────────────────────────────────

// Node: cart edit range
export async function editRangeCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const fromStr = requiredArg(stringOpt(options.from), "--from");
  const toStr = requiredArg(stringOpt(options.to), "--to");
  const code = requiredArg(stringOpt(options.code), "--code");

  const fromLine = parsePositiveInteger(fromStr, "--from");
  const toLine = parsePositiveInteger(toStr, "--to");

  if (fromLine > toLine) {
    throw new Error("--from must be less than or equal to --to");
  }

  try {
    const cart = await repo.load(root, resolvedPath);

    if (fromLine > cart.code.length) {
      outputError(
        `Tab ${fromLine} does not exist. Cartridge has ${cart.code.length} tab(s).`,
        json,
      );
      return;
    }
    if (toLine > cart.code.length) {
      outputError(
        `Tab ${toLine} does not exist. Cartridge has ${cart.code.length} tab(s).`,
        json,
      );
      return;
    }

    // Replace the range: lines are 1-indexed externally, 0-indexed internally
    const codeLines = code.split("\n");
    const before = cart.code.slice(0, fromLine - 1);
    const after = cart.code.slice(toLine);
    cart.code = [...before, ...codeLines, ...after];

    await repo.save(root, resolvedPath, cart);
    const report = reportCartSize(cart);
    output(
      {
        ...report,
        replacedRange: { from: fromLine, to: toLine },
        tabCount: cart.code.length,
      },
      json,
    );
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

// Node: cart edit replace
export async function editReplaceCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const find = requiredArg(stringOpt(options.find), "--find");
  const replace = requiredArg(stringOpt(options.replace), "--replace");

  try {
    const cart = await repo.load(root, resolvedPath);
    let replacedCount = 0;

    for (let i = 0; i < cart.code.length; i++) {
      const original = cart.code[i];
      const updated = original.split(find).join(replace);
      if (updated !== original) {
        replacedCount += (original.match(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
        cart.code[i] = updated;
      }
    }

    if (replacedCount === 0) {
      output({ error: "nothing matched", message: "The find text was not found in the cartridge code" }, json);
      return;
    }

    await repo.save(root, resolvedPath, cart);
    const report = reportCartSize(cart);
    output({ ...report, replaced: replacedCount }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
}

// Node: cart edit append
export async function editAppendCommand(
  root: string,
  filePath: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const code = requiredArg(stringOpt(options.code), "--code");

  try {
    const cart = await repo.load(root, resolvedPath);
    const codeLines = code.split("\n");
    cart.code = [...cart.code, ...codeLines];

    await repo.save(root, resolvedPath, cart);
    const report = reportCartSize(cart);
    output({ ...report, tabCount: cart.code.length }, json);
  } catch (error: unknown) {
    handleCartError(error, json);
  }
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