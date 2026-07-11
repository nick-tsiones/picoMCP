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

export function fillSprite(gfx: number[][], n: number, color: number): void {
  if (n < 0 || n > 255) throw new Error("Sprite index must be 0-255");
  if (color < 0 || color > 15) throw new Error("Color must be 0-15");
  const pixels = Array.from({ length: 64 }, () => color) as number[];
  setSprite(gfx, n, pixels);
}

export function fillSpriteRange(
  gfx: number[][],
  start: number,
  end: number,
  colors: number[],
): void {
  if (start < 0 || end > 255 || start > end)
    throw new Error("Sprite range must be 0-255 and start <= end");
  const count = end - start + 1;
  for (let i = 0; i < count; i++) {
    const color = colors[i] ?? colors[colors.length - 1] ?? 0;
    fillSprite(gfx, start + i, color);
  }
}

export function copySprite(gfx: number[][], from: number, to: number): void {
  const pixels = getSprite(gfx, from);
  setSprite(gfx, to, pixels);
}

export function mirrorSprite(
  gfx: number[][],
  n: number,
  horizontal: boolean,
  vertical: boolean,
): void {
  const pixels = getSprite(gfx, n);
  const mirrored: number[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const srcC = horizontal ? 7 - c : c;
      const srcR = vertical ? 7 - r : r;
      mirrored.push(pixels[srcR * 8 + srcC]!);
    }
  }
  setSprite(gfx, n, mirrored);
}

export function drawSpriteRect(
  gfx: number[][],
  n: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  fill: boolean,
): void {
  const pixels = getSprite(gfx, n);
  for (let r = y; r < y + h && r < 8; r++) {
    for (let c = x; c < x + w && c < 8; c++) {
      if (r < 0 || c < 0) continue;
      if (fill || r === y || r === y + h - 1 || c === x || c === x + w - 1) {
        pixels[r * 8 + c] = color;
      }
    }
  }
  setSprite(gfx, n, pixels);
}

export function drawSpriteCircle(
  gfx: number[][],
  n: number,
  cx: number,
  cy: number,
  radius: number,
  color: number,
  fill: boolean,
): void {
  const pixels = getSprite(gfx, n);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const dx = c - cx;
      const dy = r - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (fill ? dist <= radius : dist >= radius - 0.5 && dist <= radius + 0.5) {
        pixels[r * 8 + c] = color;
      }
    }
  }
  setSprite(gfx, n, pixels);
}

export function drawSpriteLine(
  gfx: number[][],
  n: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: number,
): void {
  const pixels = getSprite(gfx, n);
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1;
  let y = y1;
  while (true) {
    if (x >= 0 && x < 8 && y >= 0 && y < 8) pixels[y * 8 + x] = color;
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  setSprite(gfx, n, pixels);
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

export function fillMapRect(
  map: number[][],
  x: number,
  y: number,
  w: number,
  h: number,
  tile: number,
): void {
  if (x < 0 || y < 0 || x + w > 128 || y + h > 64) throw new Error("Map region out of range");
  if (tile < 0 || tile > 255) throw new Error("Tile must be 0-255");
  const full = ensureFullMap(map);
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      full[row]![col] = tile;
    }
  }
}

export function drawMapLine(
  map: number[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tile: number,
  width: number,
): void {
  const halfW = Math.floor(width / 2);
  for (let w = -halfW; w < width - halfW; w++) {
    drawMapSingleLine(
      map,
      x1 + (Math.abs(y2 - y1) > 0 ? w : 0),
      y1 + (Math.abs(x2 - x1) > 0 ? w : 0),
      x2 + (Math.abs(y2 - y1) > 0 ? w : 0),
      y2 + (Math.abs(x2 - x1) > 0 ? w : 0),
      tile,
    );
  }
}

function drawMapSingleLine(
  map: number[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  tile: number,
): void {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;
  let x = x1;
  let y = y1;
  const full = ensureFullMap(map);
  while (true) {
    if (x >= 0 && x < 128 && y >= 0 && y < 64) full[y]![x] = tile;
    if (x === x2 && y === y2) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

export function fillMapCircle(
  map: number[][],
  cx: number,
  cy: number,
  radius: number,
  tile: number,
): void {
  const full = ensureFullMap(map);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 128; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        full[y]![x] = tile;
      }
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

export function parseSfxLine(line: string): Sfx {
  if (line.length < 8) {
    return { notes: [], speed: 0, loopStart: 0, loopEnd: 0 };
  }

  const _editorMode = parseInt(line.slice(0, 2), 16);
  const speed = parseInt(line.slice(2, 4), 16);
  const loopStart = parseInt(line.slice(4, 6), 16);
  const loopEnd = parseInt(line.slice(6, 8), 16);

  const notes: SfxNote[] = [];
  for (let i = 0; i < 32; i++) {
    const offset = 8 + i * 5;
    if (offset + 5 > line.length) break;
    const pitch = parseInt(line.slice(offset, offset + 2), 16);
    const instr = parseInt(line[offset + 2]!, 16);
    const vol = parseInt(line[offset + 3]!, 16);
    const fx = parseInt(line[offset + 4]!, 16);
    notes.push({ pitch, instr, vol, fx });
  }

  return { notes, speed, loopStart, loopEnd };
}

export function serializeSfxLine(sfx: Sfx): string {
  let line = "";
  line += "00";
  line += (sfx.speed & 0xff).toString(16).padStart(2, "0");
  line += (sfx.loopStart & 0xff).toString(16).padStart(2, "0");
  line += (sfx.loopEnd & 0xff).toString(16).padStart(2, "0");
  for (let i = 0; i < 32; i++) {
    const note = sfx.notes[i];
    if (note) {
      line += (note.pitch & 0x3f).toString(16).padStart(2, "0");
      line += (note.instr & 0x0f).toString(16)[0]!;
      line += (note.vol & 0x07).toString(16)[0]!;
      line += (note.fx & 0x07).toString(16)[0]!;
    } else {
      line += "00000";
    }
  }
  return line;
}

export function getSfx(sfx: unknown[], n: number): Sfx {
  if (n < 0 || n > 63) throw new Error("SFX index must be 0-63");
  const raw = sfx[n];
  if (raw == null || raw === "" || typeof raw !== "string" || raw.length < 8) {
    return { notes: [], speed: 0, loopStart: 0, loopEnd: 0 };
  }
  return parseSfxLine(raw);
}

export function setSfx(sfx: unknown[], n: number, entry: Sfx): void {
  if (n < 0 || n > 63) throw new Error("SFX index must be 0-63");
  const EMPTY_SFX_LINE = "0".repeat(168);
  while (sfx.length <= n) sfx.push(EMPTY_SFX_LINE);
  sfx[n] = serializeSfxLine(entry);
}

export function listSfx(sfx: unknown[]): { index: number; noteCount: number }[] {
  const result: { index: number; noteCount: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const entry = getSfx(sfx, i);
    const noteCount = entry.notes.filter(
      (n) => n.pitch !== 0 || n.instr !== 0 || n.vol !== 0 || n.fx !== 0,
    ).length;
    result.push({ index: i, noteCount });
  }
  return result;
}

const NOTE_TO_PITCH: Record<string, number> = {
  c: 0,
  "c#": 1,
  d: 2,
  "d#": 3,
  e: 4,
  f: 5,
  "f#": 6,
  g: 7,
  "g#": 8,
  a: 9,
  "a#": 10,
  b: 11,
};

export function parseSfxTone(
  notesStr: string,
  instr: number,
  vol: number,
  fx: number,
  speed: number,
): Sfx {
  const notes: SfxNote[] = [];
  const parts = notesStr.split(/[\s,;]+/).filter(Boolean);
  for (const part of parts) {
    const match = part.match(/^([a-gA-G]#?)(\d)$/);
    if (match) {
      const noteName = match[1]!.toLowerCase();
      const octave = parseInt(match[2]!, 10);
      const basePitch = NOTE_TO_PITCH[noteName];
      if (basePitch !== undefined) {
        notes.push({
          pitch: Math.min(63, Math.max(0, basePitch + octave * 12)),
          instr,
          vol,
          fx,
        });
      }
    }
  }
  return { notes, speed, loopStart: 0, loopEnd: 0 };
}

export const PICO8_COLOR_NAMES: Record<number, string> = {
  0: "black",
  1: "darkblue",
  2: "darkpurple",
  3: "darkgreen",
  4: "brown",
  5: "darkgray",
  6: "lightgray",
  7: "white",
  8: "red",
  9: "orange",
  10: "yellow",
  11: "green",
  12: "blue",
  13: "indigo",
  14: "pink",
  15: "peach",
};

export const PICO8_COLOR_SYMBOLS: Record<number, string> = {
  0: ".",
  1: "b",
  2: "p",
  3: "g",
  4: "n",
  5: "d",
  6: "l",
  7: "w",
  8: "r",
  9: "o",
  10: "y",
  11: "G",
  12: "B",
  13: "i",
  14: "P",
  15: "e",
};

export function renderSpriteAscii(gfx: number[][], n: number): string {
  const pixels = getSprite(gfx, n);
  let result = `Sprite ${n} (8x8):\n`;
  for (let r = 0; r < 8; r++) {
    result += "  ";
    for (let c = 0; c < 8; c++) {
      const px = pixels[r * 8 + c]!;
      result += PICO8_COLOR_SYMBOLS[px] ?? "?";
    }
    result += "\n";
  }
  return result;
}

export function renderSpriteAsciiAnsi(gfx: number[][], n: number): string {
  const PICO8_ANSI: Record<number, [number, number, number]> = {
    0: [0, 0, 0],
    1: [29, 43, 83],
    2: [126, 37, 83],
    3: [0, 135, 81],
    4: [171, 82, 54],
    5: [95, 87, 79],
    6: [194, 195, 199],
    7: [255, 241, 232],
    8: [255, 0, 77],
    9: [255, 163, 0],
    10: [255, 236, 39],
    11: [0, 228, 54],
    12: [41, 173, 255],
    13: [131, 118, 156],
    14: [255, 119, 168],
    15: [255, 204, 170],
  };
  const pixels = getSprite(gfx, n);
  let result = `Sprite ${n} (8x8):\n`;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const px = pixels[r * 8 + c]!;
      const [red, green, blue] = PICO8_ANSI[px] ?? [0, 0, 0];
      result += `\x1b[48;2;${red};${green};${blue}m  \x1b[0m`;
    }
    result += "\n";
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
