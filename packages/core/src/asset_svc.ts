import { Cart } from "./cart_repo.js";
import { deflateSync, inflateSync } from "node:zlib";

export const SPRITE_COUNT = 256;

// PICO-8 16-color palette (RGBA)
export const PICO8_PALETTE: [number, number, number, number][] = [
  [0, 0, 0, 255],         // 0: black #000000
  [29, 43, 83, 255],      // 1: darkblue #1D2B53
  [126, 37, 83, 255],     // 2: darkpurple #7E2553
  [0, 135, 81, 255],      // 3: darkgreen #008751
  [171, 82, 54, 255],     // 4: brown #AB5236
  [95, 87, 79, 255],      // 5: darkgray #5F574F
  [194, 195, 199, 255],   // 6: lightgray #C2C3C7
  [255, 241, 232, 255],   // 7: white #FFF1E8
  [255, 0, 77, 255],      // 8: red #FF004D
  [255, 163, 0, 255],     // 9: orange #FFA300
  [255, 236, 39, 255],    // 10: yellow #FFEC27
  [0, 228, 54, 255],      // 11: green #00E436
  [41, 173, 255, 255],    // 12: blue #29ADFF
  [131, 118, 156, 255],   // 13: indigo #83769C
  [255, 119, 168, 255],   // 14: pink #FF77A8
  [255, 204, 170, 255],   // 15: peach #FFCCAA
];

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

  const oldValue = cart.flags[spriteIndex];
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
    if (values[i] < 0 || values[i] > 255) {
      throw new Error(`Flag value at index ${i} must be between 0 and 255, got ${values[i]}`);
    }
    if (cart.flags[i] !== values[i]) {
      changed++;
    }
    cart.flags[i] = values[i];
  }

  return {
    flags: getFlags(cart),
    changed,
  };
}

// ── Sprite types ────────────────────────────────────────────────────────────

/** A single 8×8 sprite as a flat array of 64 pixel values (0-15). Row-major. */
export type SpritePixels = number[];

/**
 * Ensure the gfx section has 128 rows of 64 bytes each, padding with zeros.
 * Returns a mutable reference (the cart's gfx array may be mutated in place).
 */
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

/**
 * Read sprite N (0-127) as an 8×8 array of pixel values (0-15).
 */
export function getSprite(gfx: number[][], n: number): SpritePixels {
  if (n < 0 || n > 127) throw new Error("Sprite index must be 0-127");
  const full = ensureFullGfx(gfx);
  const rowStart = (n % 16) * 8;
  const pixelColStart = Math.floor(n / 16) * 8;
  const pixels: number[] = [];
  for (let r = 0; r < 8; r++) {
    const row = full[rowStart + r]!;
    for (let pc = 0; pc < 8; pc++) {
      const byteCol = pixelColStart + Math.floor(pc / 2);
      const byteVal = row[byteCol] ?? 0;
      const isHigh = pc % 2 === 0;
      pixels.push(isHigh ? (byteVal >> 4) & 0x0f : byteVal & 0x0f);
    }
  }
  return pixels;
}

/**
 * Write sprite pixels into sprite slot N (0-127).
 */
export function setSprite(gfx: number[][], n: number, pixels: SpritePixels): void {
  if (n < 0 || n > 127) throw new Error("Sprite index must be 0-127");
  if (pixels.length !== 64) throw new Error("Sprite must be exactly 64 pixels (8×8)");
  const full = ensureFullGfx(gfx);
  const rowStart = (n % 16) * 8;
  const pixelColStart = Math.floor(n / 16) * 8;
  for (let r = 0; r < 8; r++) {
    const row = full[rowStart + r]!;
    for (let pc = 0; pc < 8; pc++) {
      const byteCol = pixelColStart + Math.floor(pc / 2);
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

/**
 * Read a range of sprites [start, end] inclusive.
 */
export function getSpriteRange(
  gfx: number[][],
  start: number,
  end: number,
): { index: number; pixels: SpritePixels }[] {
  if (start < 0 || end > 127 || start > end) {
    throw new Error("Sprite range must be within 0-127 and start <= end");
  }
  const result: { index: number; pixels: SpritePixels }[] = [];
  for (let i = start; i <= end; i++) {
    result.push({ index: i, pixels: getSprite(gfx, i) });
  }
  return result;
}

/**
 * Write sprites from a list of {index, pixels} entries.
 */
export function setSpriteRange(
  gfx: number[][],
  entries: { index: number; pixels: SpritePixels }[],
): void {
  for (const { index, pixels } of entries) {
    setSprite(gfx, index, pixels);
  }
}

// ── Map helpers ─────────────────────────────────────────────────────────────

/** Ensure the map section has 64 rows of 128 bytes each, padding with zeros. */
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

/**
 * Get a single map cell at (x, y). x: 0-127, y: 0-63.
 */
export function getMapCell(map: number[][], x: number, y: number): number {
  if (x < 0 || x > 127 || y < 0 || y > 63) {
    throw new Error("Map coordinates out of range: x=0-127, y=0-63");
  }
  const full = ensureFullMap(map);
  return full[y]![x]!;
}

/**
 * Set a single map cell at (x, y) to tile value (0-255).
 */
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

/**
 * Get a rectangular region of the map.
 */
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

/**
 * Set a rectangular region of the map.
 */
export function setMapRegion(
  map: number[][],
  x: number,
  y: number,
  values: number[][],
): void {
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

// ── SFX types ───────────────────────────────────────────────────────────────

export interface SfxNote {
  pitch: number; // 0-63
  instr: number; // 0-15
  vol: number;   // 0-7
  fx: number;    // 0-7
}

export interface Sfx {
  notes: SfxNote[];
  speed: number;     // 0-255
  loopStart: number; // 0-31
  loopEnd: number;   // 0-31
}

/**
 * Parse a single SFX line from the P8 __sfx__ section into an Sfx object.
 */
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

/**
 * Serialize an Sfx object to a P8 SFX line.
 */
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

/**
 * Get a single SFX by index (0-63).
 */
export function getSfx(sfx: unknown[], n: number): Sfx {
  if (n < 0 || n > 63) throw new Error("SFX index must be 0-63");
  const raw = sfx[n];
  if (raw == null || raw === "" || raw === "00000000") {
    return { notes: [], speed: 0, loopStart: 0, loopEnd: 0 };
  }
  if (typeof raw === "string") return parseSfxLine(raw);
  return { notes: [], speed: 0, loopStart: 0, loopEnd: 0 };
}

/**
 * Set a single SFX at index (0-63).
 */
export function setSfx(sfx: unknown[], n: number, entry: Sfx): void {
  if (n < 0 || n > 63) throw new Error("SFX index must be 0-63");
  // Pad with a minimal non-empty SFX line so empty entries survive
  // the .filter(Boolean) in parseP8.
  const EMPTY_SFX_LINE = "00000000";
  while (sfx.length <= n) sfx.push(EMPTY_SFX_LINE);
  sfx[n] = serializeSfxLine(entry);
}

/**
 * List all SFX entries with index and note count.
 */
export function listSfx(sfx: unknown[]): { index: number; noteCount: number }[] {
  const result: { index: number; noteCount: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const entry = getSfx(sfx, i);
    result.push({ index: i, noteCount: entry.notes.length });
  }
  return result;
}

// ── Shared-storage aliasing helpers ─────────────────────────────────────────

/**
 * After modifying gfx rows 64-127, sync the corresponding bytes into
 * map rows 32-63 (gfx row 64+r ↔ map row 32+r for r in 0..63).
 */
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

/**
 * After modifying map rows 32-63, sync the corresponding bytes into
 * gfx rows 64-127.
 */
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

// ── Sprite sheet PNG export/import ───────────────────────────────────────────

/**
 * Convert the 128×128 gfx pixel array to a PNG Buffer.
 * Each byte in gfx encodes two horizontally adjacent 4-bit pixels (high nibble first).
 * The resulting image is 128×128 pixels in RGBA format.
 */
export function exportSpriteSheet(gfx: number[][]): Buffer {
  const full = ensureFullGfx(gfx);
  const width = 128;
  const height = 128;

  // Build raw pixel data: for each row, filter byte (0) + RGBA pixels
  const rawRows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = full[y]!;
    // Filter byte (0 = no filter) + 128 pixels × 4 bytes RGBA
    const rowData = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x++) {
      const byteIdx = Math.floor(x / 2);
      const byteVal = row[byteIdx] ?? 0;
      const isHigh = x % 2 === 0;
      const colorIdx = isHigh ? (byteVal >> 4) & 0x0f : byteVal & 0x0f;
      const [r, g, b, a] = PICO8_PALETTE[colorIdx]!;
      const offset = 1 + x * 4;
      rowData[offset] = r;
      rowData[offset + 1] = g;
      rowData[offset + 2] = b;
      rowData[offset + 3] = a;
    }
    rawRows.push(rowData);
  }
  const rawData = Buffer.concat(rawRows);
  const compressed = deflateSync(rawData);

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createAssetPngChunk("IHDR", ihdrData);

  // IDAT chunk
  const idatChunk = createAssetPngChunk("IDAT", compressed);

  // IEND chunk
  const iendChunk = createAssetPngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

export interface ImportSpriteSheetResult {
  replaced: boolean;
  reason: string;
}

/**
 * Decode a PNG image and replace the cart's gfx data with colour-fitted pixel data.
 * Each pixel in the PNG is matched to the nearest PICO-8 palette color.
 * The PNG must be at least 1×1; its pixel data is read row-by-row and mapped
 * into the 128×128 gfx array (clamped to 128×128).
 */
export function importSpriteSheet(gfx: number[][], pngData: Buffer): ImportSpriteSheetResult {
  // Parse PNG chunks
  let offset = 8; // skip signature
  let width = 0;
  let height = 0;
  let compressedData: Buffer | null = null;

  while (offset < pngData.length - 12) {
    const length = pngData.readUInt32BE(offset);
    const type = pngData.slice(offset + 4, offset + 8).toString("ascii");
    const data = pngData.slice(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    }
    if (type === "IDAT") {
      // Concatenate all IDAT chunks
      compressedData = compressedData ? Buffer.concat([compressedData, data]) : data;
    }
    if (type === "IEND") break;

    offset += 12 + length;
  }

  if (width === 0 || height === 0 || !compressedData) {
    return { replaced: false, reason: "Invalid or empty PNG image" };
  }

  // Decompress pixel data
  let rawData: Buffer;
  try {
    rawData = inflateSync(compressedData);
  } catch {
    return { replaced: false, reason: "Failed to decompress PNG pixel data" };
  }

  // Determine bytes per pixel based on color type from IHDR
  // We handle RGBA (4 bytes) and RGB (3 bytes) with re-reading the IHDR
  // Re-read IHDR for color type
  offset = 8;
  let colorType = 6; // default RGBA
  while (offset < pngData.length - 12) {
    const length = pngData.readUInt32BE(offset);
    const type = pngData.slice(offset + 4, offset + 8).toString("ascii");
    if (type === "IHDR") {
      colorType = pngData[offset + 8 + 9]!; // byte 9 of IHDR data
      break;
    }
    offset += 12 + length;
  }

  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (bpp === 0) {
    return { replaced: false, reason: `Unsupported PNG color type: ${colorType}. Only RGB and RGBA are supported.` };
  }

  // Parse scanlines
  const scanlines: Array<{ filter: number; pixels: Array<[number, number, number, number]> }> = [];
  let pos = 0;
  for (let y = 0; y < height; y++) {
    if (pos >= rawData.length) break;
    const filter = rawData[pos]!;
    pos++;
    const pixels: Array<[number, number, number, number]> = [];
    for (let x = 0; x < width; x++) {
      if (pos + bpp > rawData.length) break;
      const r = rawData[pos]!;
      const g = rawData[pos + 1]!;
      const b = rawData[pos + 2]!;
      const a = bpp >= 4 ? rawData[pos + 3]! : 255;
      pos += bpp;
      pixels.push([r, g, b, a]);
    }
    scanlines.push({ filter, pixels });
  }

  if (scanlines.length === 0 || scanlines[0]!.pixels.length === 0) {
    return { replaced: false, reason: "PNG image contains no pixel data" };
  }

  // Apply PNG filter (only filter 0 = None is properly handled for simplicity;
  // we also handle Sub filter for robustness)
  const unfilteredPixels: Array<[number, number, number, number]>[] = [];
  for (let y = 0; y < scanlines.length; y++) {
    const { filter, pixels } = scanlines[y]!;
    const prevRow = y > 0 ? unfilteredPixels[y - 1]! : null;
    const row: Array<[number, number, number, number]> = [];

    for (let x = 0; x < pixels.length; x++) {
      const [r, g, b, a] = pixels[x]!;
      if (filter === 0) {
        row.push([r, g, b, a]);
      } else if (filter === 1) {
        // Sub: add value of pixel to the left
        const left = x > 0 ? row[x - 1]! : [0, 0, 0, 0];
        row.push([(r + left[0]) & 0xff, (g + left[1]) & 0xff, (b + left[2]) & 0xff, (a + left[3]) & 0xff]);
      } else if (filter === 2) {
        // Up: add value of pixel above
        const above = prevRow ? (prevRow[x] ?? [0, 0, 0, 0]) : [0, 0, 0, 0];
        row.push([(r + above[0]) & 0xff, (g + above[1]) & 0xff, (b + above[2]) & 0xff, (a + above[3]) & 0xff]);
      } else {
        // For unsupported filters, treat as None
        row.push([r, g, b, a]);
      }
    }
    unfilteredPixels.push(row);
  }

  // Colour-fit each pixel to nearest PICO-8 palette color
  const full = ensureFullGfx(gfx);
  const outW = Math.min(width, 128);
  const outH = Math.min(height, 128);

  for (let y = 0; y < outH; y++) {
    const row = full[y]!;
    const srcRow = unfilteredPixels[y]!;
    for (let x = 0; x < outW; x++) {
      const [r, g, b] = srcRow[x]!;
      // Find nearest palette color
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < 16; i++) {
        const [pr, pg, pb] = PICO8_PALETTE[i]!;
        const dr = r - pr;
        const dg = g - pg;
        const db = b - pb;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      // Write to the gfx byte array
      const byteIdx = Math.floor(x / 2);
      const isHigh = x % 2 === 0;
      const oldByte = row[byteIdx] ?? 0;
      if (isHigh) {
        row[byteIdx] = ((bestIdx & 0x0f) << 4) | (oldByte & 0x0f);
      } else {
        row[byteIdx] = (oldByte & 0xf0) | (bestIdx & 0x0f);
      }
    }
  }

  return { replaced: true, reason: `Imported ${outW}×${outH} pixel data, colour-fitted to PICO-8 palette` };
}

// ── PNG helpers (shared with static_svc pattern) ──────────────────────────────

function createAssetPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = assetCrc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

const ASSET_CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  ASSET_CRC_TABLE[n] = c;
}

function assetCrc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = ASSET_CRC_TABLE[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}