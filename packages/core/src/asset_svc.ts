import { Cart } from "./cart_repo.js";

export const SPRITE_COUNT = 256;

export function getFlags(cart: Cart): number[] {
  // Ensure we always return exactly 256 flags
  const flags = cart.flags.slice(0, SPRITE_COUNT);
  while (flags.length < SPRITE_COUNT) {
    flags.push(0);
  }
  return flags;
}

export interface SetFlagResult {
  spriteIndex: number;
  oldValue: number;
  newValue: number;
  flags: number[];
}

export function setFlag(cart: Cart, spriteIndex: number, value: number): SetFlagResult {
  if (spriteIndex < 0 || spriteIndex >= SPRITE_COUNT) {
    throw new Error(`Sprite index must be between 0 and ${SPRITE_COUNT - 1}, got ${spriteIndex}`);
  }
  if (value < 0 || value > 255) {
    throw new Error(`Flag value must be between 0 and 255, got ${value}`);
  }

  // Ensure flags array has enough elements
  while (cart.flags.length <= spriteIndex) {
    cart.flags.push(0);
  }

  const oldValue = cart.flags[spriteIndex] ?? 0;
  cart.flags[spriteIndex] = value;

  return {
    spriteIndex,
    oldValue,
    newValue: value,
    flags: getFlags(cart),
  };
}

export interface BulkSetFlagsResult {
  flags: number[];
  changed: number;
}

export function bulkSetFlags(cart: Cart, values: number[]): BulkSetFlagsResult {
  if (values.length !== SPRITE_COUNT) {
    throw new Error(`Expected ${SPRITE_COUNT} flag values, got ${values.length}`);
  }

  let changed = 0;
  for (let i = 0; i < SPRITE_COUNT; i++) {
    const value = values[i] ?? 0;
    if (value < 0 || value > 255) {
      throw new Error(`Flag value at index ${i} must be between 0 and 255, got ${value}`);
    }
    if (cart.flags[i] !== value) {
      changed++;
    }
    cart.flags[i] = value;
  }

  return {
    flags: getFlags(cart),
    changed,
  };
}

export type SpritePixels = number[];
function ensureFullGfx(gfx: number[][]): number[][] {
  for (let row = 0; row < 128; row++) {
    if (!gfx[row]) gfx[row] = [];
    const r = gfx[row]!;
    for (let col = 0; col < 64; col++) {
      if (r[col] === undefined) r[col] = 0;
    }
  }
  return gfx;
}

export function getSprite(gfx: number[][], n: number): SpritePixels {
  if (n < 0 || n > 255) throw new Error("Sprite index must be 0-255");
  const full = ensureFullGfx(gfx);
  const rowStart = Math.floor(n / 16) * 8;
  const byteColStart = (n % 16) * 4;
  const pixels: number[] = [];
  for (let r = 0; r < 8; r++) {
    const row = full[rowStart + r]!;
    for (let pc = 0; pc < 8; pc++) {
      const byteCol = byteColStart + Math.floor(pc / 2);
      const byteVal = row[byteCol] ?? 0;
      const isHigh = pc % 2 === 0;
      pixels.push(isHigh ? (byteVal >> 4) & 0x0f : byteVal & 0x0f);
    }
  }
  return pixels;
}

export function setSprite(gfx: number[][], n: number, pixels: SpritePixels): void {
  if (n < 0 || n > 255) throw new Error("Sprite index must be 0-255");
  if (pixels.length !== 64) throw new Error("Sprite must be exactly 64 pixels (8×8)");
  const full = ensureFullGfx(gfx);
  const rowStart = Math.floor(n / 16) * 8;
  const byteColStart = (n % 16) * 4;
  for (let r = 0; r < 8; r++) {
    const row = full[rowStart + r]!;
    for (let pc = 0; pc < 8; pc++) {
      const byteCol = byteColStart + Math.floor(pc / 2);
      const px = pixels[r * 8 + pc]!;
      if (px < 0 || px > 15) throw new Error(`Pixel value ${px} out of range (0-15)`);
      const isHigh = pc % 2 === 0;
      if (isHigh) {
        row[byteCol] = ((px & 0x0f) << 4) | (row[byteCol]! & 0x0f);
      } else {
        row[byteCol] = (row[byteCol]! & 0xf0) | (px & 0x0f);
      }
    }
  }
}

export function getSpriteRange(
  gfx: number[][],
  start: number,
  end: number,
): { index: number; pixels: SpritePixels }[] {
  if (start < 0 || end > 255 || start > end) {
    throw new Error("Sprite range must be within 0-255 and start <= end");
  }
  const result: { index: number; pixels: SpritePixels }[] = [];
  for (let i = start; i <= end; i++) {
    result.push({ index: i, pixels: getSprite(gfx, i) });
  }
  return result;
}

export function setSpriteRange(
  gfx: number[][],
  entries: { index: number; pixels: SpritePixels }[],
): void {
  for (const { index, pixels } of entries) {
    setSprite(gfx, index, pixels);
  }
}

function ensureFullMap(map: number[][]): number[][] {
  for (let row = 0; row < 64; row++) {
    if (!map[row]) map[row] = [];
    const r = map[row]!;
    for (let col = 0; col < 128; col++) {
      if (r[col] === undefined) r[col] = 0;
    }
  }
  return map;
}

export function getMapCell(map: number[][], x: number, y: number): number {
  if (x < 0 || x > 127 || y < 0 || y > 63) {
    throw new Error("Map coordinates out of range: x=0-127, y=0-63");
  }
  const full = ensureFullMap(map);
  return full[y]![x]!;
}

export function setMapCell(map: number[][], x: number, y: number, tile: number): void {
  if (x < 0 || x > 127 || y < 0 || y > 63) {
    throw new Error("Map coordinates out of range: x=0-127, y=0-63");
  }
  if (tile < 0 || tile > 255) {
    throw new Error("Tile value must be 0-255");
  }
  const full = ensureFullMap(map);
  full[y]![x] = tile;
}

export function getMapRegion(
  map: number[][],
  x: number,
  y: number,
  w: number,
  h: number,
): number[][] {
  if (x < 0 || y < 0 || x + w > 128 || y + h > 64) {
    throw new Error("Map region out of range");
  }
  const full = ensureFullMap(map);
  const region: number[][] = [];
  for (let row = y; row < y + h; row++) {
    region.push(full[row]!.slice(x, x + w));
  }
  return region;
}

export function setMapRegion(map: number[][], x: number, y: number, values: number[][]): void {
  const h = values.length;
  const w = h > 0 ? (values[0]?.length ?? 0) : 0;
  if (x < 0 || y < 0 || x + w > 128 || y + h > 64) {
    throw new Error("Map region out of range");
  }
  const full = ensureFullMap(map);
  for (let row = 0; row < h; row++) {
    const srcRow = values[row]!;
    for (let col = 0; col < w; col++) {
      const tile = srcRow[col]!;
      if (tile < 0 || tile > 255) throw new Error(`Tile value ${tile} out of range (0-255)`);
      full[y + row]![x + col] = tile;
    }
  }
}

export interface SfxNote {
  pitch: number; // 0-63
  instr: number; // 0-15
  vol: number; // 0-7
  fx: number; // 0-7
}

export interface Sfx {
  notes: SfxNote[];
  speed: number; // 0-255
  loopStart: number; // 0-31
  loopEnd: number; // 0-31
}

function parseSfxLine(line: string): Sfx {
  const bytes: number[] = [];
  for (let i = 0; i < line.length; i += 2) {
    bytes.push(parseInt(line.slice(i, i + 2), 16));
  }

  const _editorMode = bytes[0] ?? 0;
  const speed = bytes[1] ?? 0;
  const loopStart = bytes[2] ?? 0;
  const loopEnd = bytes[3] ?? 0;

  const notes: SfxNote[] = [];
  for (let i = 4; i + 1 < bytes.length; i += 2) {
    const byte0 = bytes[i]!;
    const byte1 = bytes[i + 1]!;
    const pitch = (byte0 >> 2) & 0x3f;
    const instr = byte0 & 0x03;
    const vol = (byte1 >> 5) & 0x07;
    const fx = (byte1 >> 2) & 0x07;
    notes.push({ pitch, instr, vol, fx });
    if (notes.length >= 32) break;
  }

  return { notes, speed, loopStart, loopEnd };
}

function serializeSfxLine(sfx: Sfx): string {
  const bytes: number[] = [];
  bytes.push(0);
  bytes.push(sfx.speed & 0xff);
  bytes.push(sfx.loopStart & 0x3f);
  bytes.push(sfx.loopEnd & 0x3f);
  for (const note of sfx.notes) {
    const byte0 = ((note.pitch & 0x3f) << 2) | (note.instr & 0x03);
    const byte1 = ((note.vol & 0x07) << 5) | ((note.fx & 0x07) << 2);
    bytes.push(byte0, byte1);
  }
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function getSfx(sfx: unknown[], n: number): Sfx {
  if (n < 0 || n > 63) throw new Error("SFX index must be 0-63");
  const raw = sfx[n];
  if (raw == null || raw === "" || raw === "00000000") {
    return { notes: [], speed: 0, loopStart: 0, loopEnd: 0 };
  }
  if (typeof raw === "string") return parseSfxLine(raw);
  return { notes: [], speed: 0, loopStart: 0, loopEnd: 0 };
}

export function setSfx(sfx: unknown[], n: number, entry: Sfx): void {
  if (n < 0 || n > 63) throw new Error("SFX index must be 0-63");
  // Pad with a minimal non-empty SFX line so empty entries survive
  // the .filter(Boolean) in parseP8.
  const EMPTY_SFX_LINE = "00000000";
  while (sfx.length <= n) sfx.push(EMPTY_SFX_LINE);
  sfx[n] = serializeSfxLine(entry);
}

export function listSfx(sfx: unknown[]): { index: number; noteCount: number }[] {
  const result: { index: number; noteCount: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const entry = getSfx(sfx, i);
    result.push({ index: i, noteCount: entry.notes.length });
  }
  return result;
}

export function syncGfxToMap(cart: Cart): void {
  ensureFullGfx(cart.gfx);
  ensureFullMap(cart.map);
  for (let r = 0; r < 64; r++) {
    const gfxRow = cart.gfx[64 + r]!;
    const mapRow = cart.map[32 + r]!;
    for (let c = 0; c < 64; c++) {
      mapRow[c] = gfxRow[c]!;
    }
  }
}

export function syncMapToGfx(cart: Cart): void {
  ensureFullGfx(cart.gfx);
  ensureFullMap(cart.map);
  for (let r = 0; r < 64; r++) {
    const mapRow = cart.map[32 + r]!;
    const gfxRow = cart.gfx[64 + r]!;
    for (let c = 0; c < 64; c++) {
      gfxRow[c] = mapRow[c]!;
    }
  }
}

export {
  exportSpriteSheet,
  importSpriteSheet,
  PICO8_PALETTE,
  type ImportSpriteSheetResult,
} from "./asset-png.js";
