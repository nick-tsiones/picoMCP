import {
  assertWithinProjectBoundary,
  CartRepo,
  exportCart,
  exportSpriteSheet,
  getApiIndex,
  getPitfalls,
  importSpriteSheet,
  lintCart,
  minifyCode,
  parseCode,
  reportCartSize,
  runCart,
  type CartOverview,
  type CartSizeReport,
  type ExportCartOptions,
  type ExportCartResult,
  type MinifyResult,
  type RunCartOptions,
  type RunCartResult,
} from "@picomcp/core";
import { createMinimalPng, extractP8FromPng } from "@picomcp/core";
import { readFile, writeFile } from "node:fs/promises";

export {
  bulkSetFlagsCmd,
  getSpriteCmd,
  setSpriteCmd,
  getSpriteRangeCmd,
  setSpriteRangeCmd,
  getMapCellCmd,
  setMapCellCmd,
  getMapRegionCmd,
  setMapRegionCmd,
  getSfxCmd,
  setSfxCmd,
  listSfxCmd,
  getFlagsCmd,
  setFlagCmd,
} from "./commands-assets.js";
export type {
  SpriteResult,
  SpriteOkResult,
  SpriteRangeResult,
  MapCellResult,
  MapCellOkResult,
  MapRegionResult,
  SfxGetResult,
  SfxListResult,
  FlagsResult,
} from "./commands-assets.js";

const repo = new CartRepo();

export interface ReadOverviewResult {
  code: string;
  size: number;
  tabCount: number;
  hasSprites: boolean;
  hasMap: boolean;
  hasSfx: boolean;
  hasMusic: boolean;
  tokenCount: number;
  assets: string;
}

export interface ReadTabResult {
  tab: number;
  code: string;
}

export type WriteResult = CartSizeReport & { tab: number };

export interface ConvertResult {
  success: boolean;
  outputPath: string;
}

export type EditRangeResult = CartSizeReport & {
  replacedRange: { from: number; to: number };
  tabCount: number;
};

export type EditReplaceResult = CartSizeReport & { replaced: number };

export type EditAppendResult = CartSizeReport & { tabCount: number };

export interface RefApiResult {
  functions: unknown;
}

export interface RefPitfallsResult {
  pitfalls: unknown;
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

export async function readOverview(root: string, filePath: string): Promise<ReadOverviewResult> {
  const cart = await repo.load(root, filePath);
  const overview = repo.overview(cart);
  return {
    code: overview.code,
    size: overview.tabCount,
    tabCount: overview.tabCount,
    hasSprites: overview.hasSprites,
    hasMap: overview.hasMap,
    hasSfx: overview.hasSfx,
    hasMusic: overview.hasMusic,
    tokenCount: overview.tokenCount,
    assets: summaryOfAssets(overview),
  };
}

export async function readTab(
  root: string,
  filePath: string,
  tabIndex: number,
): Promise<ReadTabResult> {
  const cart = await repo.load(root, filePath);
  if (tabIndex < 1 || tabIndex > cart.code.length) {
    throw new Error(`Tab ${tabIndex} does not exist. Cartridge has ${cart.code.length} tab(s).`);
  }
  return { tab: tabIndex, code: cart.code[tabIndex - 1] ?? "" };
}

export async function writeCartridge(
  root: string,
  filePath: string,
  code: string,
  tabIndex: number,
): Promise<WriteResult> {
  let cart = await repo.loadOrCreate(root, filePath);
  while (cart.code.length < tabIndex) {
    cart.code.push("");
  }
  cart.code[tabIndex - 1] = code;
  await repo.save(root, filePath, cart);
  const report = reportCartSize(cart);
  return { ...report, tab: tabIndex };
}

export async function parseCartridge(root: string, filePath: string): Promise<unknown> {
  const cart = await repo.load(root, filePath);
  return parseCode(cart);
}

export async function lintCartridge(root: string, filePath: string): Promise<unknown> {
  const cart = await repo.load(root, filePath);
  return lintCart(cart);
}

export async function sizeCartridge(root: string, filePath: string): Promise<CartSizeReport> {
  const cart = await repo.load(root, filePath);
  return reportCartSize(cart);
}

export async function runCartridge(
  root: string,
  filePath: string,
  options: RunCartOptions,
): Promise<RunCartResult> {
  return runCart(root, filePath, options);
}

export async function exportCartridge(
  root: string,
  filePath: string,
  options: ExportCartOptions,
): Promise<ExportCartResult> {
  return exportCart(root, filePath, options);
}

export async function convertCartridge(
  root: string,
  filePath: string,
  toFormat: string,
  outputPath?: string,
): Promise<ConvertResult> {
  await assertWithinProjectBoundary(root, filePath);
  if (toFormat === "p8.png") {
    const p8Data = await readFile(filePath);
    const pngData = createMinimalPng(p8Data);
    const dest = outputPath || filePath.replace(/\.p8$/i, ".p8.png");
    await assertWithinProjectBoundary(root, dest);
    await writeFile(dest, pngData);
    return { success: true, outputPath: dest };
  }
  const pngData = await readFile(filePath);
  const p8Data = extractP8FromPng(pngData);
  if (!p8Data) {
    throw new Error("No .p8 data found in the .p8.png file");
  }
  const dest = outputPath || filePath.replace(/\.p8\.png$/i, ".p8");
  await assertWithinProjectBoundary(root, dest);
  await writeFile(dest, p8Data);
  return { success: true, outputPath: dest };
}

export async function spriteExportCmd(
  root: string,
  filePath: string,
  outputPath: string,
): Promise<{ ok: boolean; outputPath: string; message: string }> {
  await assertWithinProjectBoundary(root, outputPath);
  const cart = await repo.load(root, filePath);
  const pngData = exportSpriteSheet(cart.gfx);
  await writeFile(outputPath, pngData);
  return { ok: true, outputPath, message: "Sprite sheet exported as PNG" };
}

export async function spriteImportCmd(
  root: string,
  filePath: string,
  inputPath: string,
): Promise<{ ok: boolean; message: string }> {
  await assertWithinProjectBoundary(root, inputPath);
  const pngData = await readFile(inputPath);
  const cart = await repo.load(root, filePath);
  const result = importSpriteSheet(cart.gfx, pngData);
  if (!result.replaced) {
    throw new Error(result.reason);
  }
  await repo.save(root, filePath, cart);
  return { ok: true, message: result.reason };
}

export async function minifyCartridge(
  root: string,
  filePath: string,
  rename: boolean,
): Promise<MinifyResult> {
  const cart = await repo.load(root, filePath);
  const result = minifyCode(cart, { rename });
  await repo.save(root, filePath, cart);
  return result;
}

export async function editRangeCmd(
  root: string,
  filePath: string,
  fromLine: number,
  toLine: number,
  code: string,
): Promise<EditRangeResult> {
  const cart = await repo.load(root, filePath);
  if (fromLine < 1) throw new Error("--from must be a positive integer");
  if (toLine < 1) throw new Error("--to must be a positive integer");
  if (fromLine > toLine) throw new Error("--from must be less than or equal to --to");

  if (fromLine > cart.code.length) {
    throw new Error(`Tab ${fromLine} does not exist. Cartridge has ${cart.code.length} tab(s).`);
  }
  if (toLine > cart.code.length) {
    throw new Error(`Tab ${toLine} does not exist. Cartridge has ${cart.code.length} tab(s).`);
  }

  cart.code = [
    ...cart.code.slice(0, fromLine - 1),
    ...code.split("\n"),
    ...cart.code.slice(toLine),
  ];
  await repo.save(root, filePath, cart);
  const report = reportCartSize(cart);
  return { ...report, replacedRange: { from: fromLine, to: toLine }, tabCount: cart.code.length };
}

export async function editReplaceCmd(
  root: string,
  filePath: string,
  find: string,
  replace: string,
): Promise<EditReplaceResult> {
  const cart = await repo.load(root, filePath);
  let replacedCount = 0;

  for (let i = 0; i < cart.code.length; i++) {
    const original = cart.code[i] ?? "";
    const updated = original.split(find).join(replace);
    if (updated !== original) {
      const escapedFind = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      replacedCount += (original.match(new RegExp(escapedFind, "g")) || []).length;
      cart.code[i] = updated;
    }
  }

  if (replacedCount === 0) {
    throw new Error("The find text was not found in the cartridge code");
  }

  await repo.save(root, filePath, cart);
  const report = reportCartSize(cart);
  return { ...report, replaced: replacedCount };
}

export async function editAppendCmd(
  root: string,
  filePath: string,
  code: string,
): Promise<EditAppendResult> {
  const cart = await repo.load(root, filePath);
  cart.code = [...cart.code, ...code.split("\n")];
  await repo.save(root, filePath, cart);
  const report = reportCartSize(cart);
  return { ...report, tabCount: cart.code.length };
}

export async function refApi(): Promise<RefApiResult> {
  const api = getApiIndex();
  return { functions: api };
}

export async function refPitfalls(): Promise<RefPitfallsResult> {
  const pitfalls = getPitfalls();
  return { pitfalls };
}
