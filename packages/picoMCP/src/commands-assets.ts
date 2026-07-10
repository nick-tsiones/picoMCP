import {
  CartRepo,
  bulkSetFlags,
  getFlags,
  getMapCell,
  getMapRegion,
  getSfx,
  getSprite,
  getSpriteRange,
  listSfx,
  setFlag,
  setMapCell,
  setMapRegion,
  setSfx,
  setSprite,
  setSpriteRange,
  type Sfx,
} from "@cat-cave/qdcli-core";

const repo = new CartRepo();

export interface SpriteResult {
  index: number;
  pixels: number[];
}

export interface SpriteOkResult {
  index: number;
  ok: boolean;
}

export interface SpriteRangeResult {
  sprites: { index: number; pixels: number[] }[];
}

export interface MapCellResult {
  x: number;
  y: number;
  tile: number;
}

export interface MapCellOkResult {
  x: number;
  y: number;
  tile: number;
  ok: boolean;
}

export interface MapRegionResult {
  x: number;
  y: number;
  w: number;
  h: number;
  region: number[][];
}

export type SfxGetResult = Sfx & { index: number };

export type SfxListResult = { sfx: { index: number; noteCount: number }[] };

export interface FlagsResult {
  flags: number[];
}

export async function getSpriteCmd(
  root: string,
  filePath: string,
  index: number,
): Promise<SpriteResult> {
  const cart = await repo.load(root, filePath);
  const pixels = getSprite(cart.gfx, index);
  return { index, pixels };
}

export async function setSpriteCmd(
  root: string,
  filePath: string,
  index: number,
  pixels: number[],
): Promise<SpriteOkResult> {
  const cart = await repo.load(root, filePath);
  setSprite(cart.gfx, index, pixels);
  await repo.save(root, filePath, cart);
  return { index, ok: true };
}

export async function getSpriteRangeCmd(
  root: string,
  filePath: string,
  start: number,
  end: number,
): Promise<SpriteRangeResult> {
  const cart = await repo.load(root, filePath);
  const sprites = getSpriteRange(cart.gfx, start, end);
  return { sprites };
}

export async function setSpriteRangeCmd(
  root: string,
  filePath: string,
  entries: { index: number; pixels: number[] }[],
): Promise<{ ok: boolean; count: number }> {
  const cart = await repo.load(root, filePath);
  setSpriteRange(cart.gfx, entries);
  await repo.save(root, filePath, cart);
  return { ok: true, count: entries.length };
}

export async function getMapCellCmd(
  root: string,
  filePath: string,
  x: number,
  y: number,
): Promise<MapCellResult> {
  const cart = await repo.load(root, filePath);
  const tile = getMapCell(cart.map, x, y);
  return { x, y, tile };
}

export async function setMapCellCmd(
  root: string,
  filePath: string,
  x: number,
  y: number,
  tile: number,
): Promise<MapCellOkResult> {
  const cart = await repo.load(root, filePath);
  setMapCell(cart.map, x, y, tile);
  await repo.save(root, filePath, cart);
  return { x, y, tile, ok: true };
}

export async function getMapRegionCmd(
  root: string,
  filePath: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<MapRegionResult> {
  const cart = await repo.load(root, filePath);
  const region = getMapRegion(cart.map, x, y, w, h);
  return { x, y, w, h, region };
}

export async function setMapRegionCmd(
  root: string,
  filePath: string,
  x: number,
  y: number,
  values: number[][],
): Promise<{ ok: boolean; x: number; y: number; w: number; h: number }> {
  const cart = await repo.load(root, filePath);
  setMapRegion(cart.map, x, y, values);
  await repo.save(root, filePath, cart);
  return { ok: true, x, y, w: values[0]?.length ?? 0, h: values.length };
}

export async function getSfxCmd(
  root: string,
  filePath: string,
  index: number,
): Promise<SfxGetResult> {
  const cart = await repo.load(root, filePath);
  const sfx = getSfx(cart.sfx, index);
  return { index, ...sfx };
}

export async function setSfxCmd(
  root: string,
  filePath: string,
  index: number,
  data: {
    notes?: Sfx["notes"];
    speed?: number;
    loopStart?: number;
    loopEnd?: number;
  },
): Promise<{ index: number; ok: boolean }> {
  const cart = await repo.load(root, filePath);
  const sfx: Sfx = {
    notes: data.notes ?? [],
    speed: data.speed ?? 0,
    loopStart: data.loopStart ?? 0,
    loopEnd: data.loopEnd ?? 0,
  };
  setSfx(cart.sfx, index, sfx);
  await repo.save(root, filePath, cart);
  return { index, ok: true };
}

export async function listSfxCmd(root: string, filePath: string): Promise<SfxListResult> {
  const cart = await repo.load(root, filePath);
  const entries = listSfx(cart.sfx);
  return { sfx: entries };
}

export async function getFlagsCmd(root: string, filePath: string): Promise<FlagsResult> {
  const cart = await repo.load(root, filePath);
  return { flags: getFlags(cart) };
}

export async function setFlagCmd(
  root: string,
  filePath: string,
  spriteIndex: number,
  value: number,
): Promise<unknown> {
  const cart = await repo.load(root, filePath);
  const result = setFlag(cart, spriteIndex, value);
  await repo.save(root, filePath, cart);
  return result;
}

export async function bulkSetFlagsCmd(
  root: string,
  filePath: string,
  values: number[],
): Promise<unknown> {
  const cart = await repo.load(root, filePath);
  const result = bulkSetFlags(cart, values);
  await repo.save(root, filePath, cart);
  return result;
}
