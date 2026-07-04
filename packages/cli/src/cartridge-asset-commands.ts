import {
  CartRepo,
  exportSpriteSheet,
  getMapCell,
  getMapRegion,
  getSfx,
  getSprite,
  getSpriteRange,
  importSpriteSheet,
  listSfx,
  setMapCell,
  setMapRegion,
  setSfx,
  setSprite,
  setSpriteRange,
} from "@cat-cave/qdcli-core";
import { output, parsePositiveInteger, requiredArg } from "./args.js";
import { readFile, writeFile } from "node:fs/promises";

const repo = new CartRepo();

export async function spriteGetCommand(
  root: string,
  filePath: string | undefined,
  indexStr: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const spriteIndex =
    parsePositiveInteger(requiredArg(indexStr, "sprite index"), "sprite index") - 1;
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
  const spriteIndex =
    parsePositiveInteger(requiredArg(indexStr, "sprite index"), "sprite index") - 1;
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
  let entries: { index: number; pixels: number[] }[];
  try {
    entries = JSON.parse(spritesStr) as { index: number; pixels: number[] }[];
  } catch {
    throw new Error("--sprites must be valid JSON array of {index, pixels}");
  }
  for (const entry of entries) {
    if (
      typeof entry.index !== "number" ||
      !Array.isArray(entry.pixels) ||
      entry.pixels.length !== 64
    ) {
      throw new Error(
        "Each sprite entry must have index (number) and pixels (array of 64 numbers)",
      );
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

export async function sfxGetCommand(
  root: string,
  filePath: string | undefined,
  indexStr: string | undefined,
  json: boolean,
): Promise<void> {
  const resolvedPath = requiredArg(filePath, "cartridge file path");
  const sfxIndex = parsePositiveInteger(requiredArg(indexStr, "sfx index"), "sfx index") - 1;
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
  const sfxIndex = parsePositiveInteger(requiredArg(indexStr, "sfx index"), "sfx index") - 1;
  const dataStr = requiredArg(stringOpt(options.data), "--data");
  let data: {
    notes?: { pitch: number; instr: number; vol: number; fx: number }[];
    speed?: number;
    loopStart?: number;
    loopEnd?: number;
  };
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

function stringOpt(value: string | string[] | boolean | undefined): string | undefined {
  if (Array.isArray(value)) return value.at(-1);
  return typeof value === "string" ? value : undefined;
}

function outputError(message: string, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ error: message, message }, null, 2));
  } else {
    console.error(message);
  }
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
