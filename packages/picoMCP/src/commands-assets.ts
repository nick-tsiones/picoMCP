import {
  CartRepo,
  bulkSetFlags,
  copySprite,
  drawSpriteCircle,
  drawSpriteLine,
  drawSpriteRect,
  fillSprite,
  fillSpriteRange,
  fillMapRect,
  fillMapCircle,
  drawMapLine,
  getFlags,
  getMapCell,
  getMapRegion,
  getSfx,
  getSprite,
  getSpriteRange,
  listSfx,
  mirrorSprite,
  parseSfxTone,
  renderSpriteAscii,
  renderSpriteAsciiAnsi,
  setFlag,
  setMapCell,
  setMapRegion,
  setSfx,
  setSprite,
  setSpriteRange,
  type Sfx,
} from "@picomcp/core";

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

export async function fillSpriteCmd(
  root: string,
  filePath: string,
  index: number,
  color: number,
): Promise<{ index: number; ok: boolean }> {
  const cart = await repo.load(root, filePath);
  fillSprite(cart.gfx, index, color);
  await repo.save(root, filePath, cart);
  return { index, ok: true };
}

export async function fillSpriteRangeCmd(
  root: string,
  filePath: string,
  start: number,
  end: number,
  colors: number[],
): Promise<{ ok: boolean; count: number }> {
  const cart = await repo.load(root, filePath);
  fillSpriteRange(cart.gfx, start, end, colors);
  await repo.save(root, filePath, cart);
  return { ok: true, count: end - start + 1 };
}

export async function copySpriteCmd(
  root: string,
  filePath: string,
  from: number,
  to: number,
): Promise<{ from: number; to: number; ok: boolean }> {
  const cart = await repo.load(root, filePath);
  copySprite(cart.gfx, from, to);
  await repo.save(root, filePath, cart);
  return { from, to, ok: true };
}

export async function mirrorSpriteCmd(
  root: string,
  filePath: string,
  index: number,
  horizontal: boolean,
  vertical: boolean,
): Promise<{ index: number; ok: boolean }> {
  const cart = await repo.load(root, filePath);
  mirrorSprite(cart.gfx, index, horizontal, vertical);
  await repo.save(root, filePath, cart);
  return { index, ok: true };
}

export async function drawSpriteRectCmd(
  root: string,
  filePath: string,
  index: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  fill: boolean,
): Promise<{ index: number; ok: boolean }> {
  const cart = await repo.load(root, filePath);
  drawSpriteRect(cart.gfx, index, x, y, w, h, color, fill);
  await repo.save(root, filePath, cart);
  return { index, ok: true };
}

export async function drawSpriteCircleCmd(
  root: string,
  filePath: string,
  index: number,
  cx: number,
  cy: number,
  radius: number,
  color: number,
  fill: boolean,
): Promise<{ index: number; ok: boolean }> {
  const cart = await repo.load(root, filePath);
  drawSpriteCircle(cart.gfx, index, cx, cy, radius, color, fill);
  await repo.save(root, filePath, cart);
  return { index, ok: true };
}

export async function drawSpriteLineCmd(
  root: string,
  filePath: string,
  index: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
): Promise<{ index: number; ok: boolean }> {
  const cart = await repo.load(root, filePath);
  drawSpriteLine(cart.gfx, index, x1, y1, x2, y2, color);
  await repo.save(root, filePath, cart);
  return { index, ok: true };
}

export async function previewSpriteCmd(
  root: string,
  filePath: string,
  index: number,
  ansi: boolean,
): Promise<{ index: number; ascii: string }> {
  const cart = await repo.load(root, filePath);
  const ascii = ansi ? renderSpriteAsciiAnsi(cart.gfx, index) : renderSpriteAscii(cart.gfx, index);
  return { index, ascii };
}

export async function fillMapRectCmd(
  root: string,
  filePath: string,
  x: number,
  y: number,
  w: number,
  h: number,
  tile: number,
): Promise<{ ok: boolean; x: number; y: number; w: number; h: number }> {
  const cart = await repo.load(root, filePath);
  fillMapRect(cart.map, x, y, w, h, tile);
  await repo.save(root, filePath, cart);
  return { ok: true, x, y, w, h };
}

export async function drawMapLineCmd(
  root: string,
  filePath: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tile: number,
  width: number,
): Promise<{ ok: boolean }> {
  const cart = await repo.load(root, filePath);
  drawMapLine(cart.map, x1, y1, x2, y2, tile, width);
  await repo.save(root, filePath, cart);
  return { ok: true };
}

export async function fillMapCircleCmd(
  root: string,
  filePath: string,
  cx: number,
  cy: number,
  radius: number,
  tile: number,
): Promise<{ ok: boolean }> {
  const cart = await repo.load(root, filePath);
  fillMapCircle(cart.map, cx, cy, radius, tile);
  await repo.save(root, filePath, cart);
  return { ok: true };
}

export async function setSfxToneCmd(
  root: string,
  filePath: string,
  index: number,
  notesStr: string,
  instr: number,
  vol: number,
  fx: number,
  speed: number,
): Promise<{ index: number; ok: boolean }> {
  const cart = await repo.load(root, filePath);
  const sfx = parseSfxTone(notesStr, instr, vol, fx, speed);
  setSfx(cart.sfx, index, sfx);
  await repo.save(root, filePath, cart);
  return { index, ok: true };
}
