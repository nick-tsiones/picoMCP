import { deflateSync, inflateSync } from "node:zlib";

export const PICO8_PALETTE: [number, number, number, number][] = [
  [0, 0, 0, 255],
  [29, 43, 83, 255],
  [126, 37, 83, 255],
  [0, 135, 81, 255],
  [171, 82, 54, 255],
  [95, 87, 79, 255],
  [194, 195, 199, 255],
  [255, 241, 232, 255],
  [255, 0, 77, 255],
  [255, 163, 0, 255],
  [255, 236, 39, 255],
  [0, 228, 54, 255],
  [41, 173, 255, 255],
  [131, 118, 156, 255],
  [255, 119, 168, 255],
  [255, 204, 170, 255],
];

export interface ImportSpriteSheetResult {
  replaced: boolean;
  reason: string;
}

export function exportSpriteSheet(gfx: number[][]): Buffer {
  const full = ensureFullGfx(gfx);
  const width = 128;
  const height = 128;
  const rawRows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = full[y]!;
    const rowData = Buffer.alloc(1 + width * 4);
    for (let x = 0; x < width; x++) {
      const byteIdx = Math.floor(x / 2);
      const byteVal = row[byteIdx] ?? 0;
      const colorIdx = x % 2 === 0 ? (byteVal >> 4) & 0x0f : byteVal & 0x0f;
      const [r, g, b, a] = PICO8_PALETTE[colorIdx]!;
      const offset = 1 + x * 4;
      rowData[offset] = r;
      rowData[offset + 1] = g;
      rowData[offset + 2] = b;
      rowData[offset + 3] = a;
    }
    rawRows.push(rowData);
  }

  const compressed = deflateSync(Buffer.concat(rawRows));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  return Buffer.concat([
    signature,
    createAssetPngChunk("IHDR", ihdrData),
    createAssetPngChunk("IDAT", compressed),
    createAssetPngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function importSpriteSheet(gfx: number[][], pngData: Buffer): ImportSpriteSheetResult {
  let offset = 8;
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
    if (type === "IDAT")
      compressedData = compressedData ? Buffer.concat([compressedData, data]) : data;
    if (type === "IEND") break;
    offset += 12 + length;
  }

  if (width === 0 || height === 0 || !compressedData) {
    return { replaced: false, reason: "Invalid or empty PNG image" };
  }

  let rawData: Buffer;
  try {
    rawData = inflateSync(compressedData);
  } catch {
    return { replaced: false, reason: "Failed to decompress PNG pixel data" };
  }

  offset = 8;
  let colorType = 6;
  while (offset < pngData.length - 12) {
    const length = pngData.readUInt32BE(offset);
    const type = pngData.slice(offset + 4, offset + 8).toString("ascii");
    if (type === "IHDR") {
      colorType = pngData[offset + 17] ?? 6;
      break;
    }
    offset += 12 + length;
  }

  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (bpp === 0) {
    return {
      replaced: false,
      reason: `Unsupported PNG color type: ${colorType}. Only RGB and RGBA are supported.`,
    };
  }

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
        const left: [number, number, number, number] = x > 0 ? row[x - 1]! : [0, 0, 0, 0];
        row.push([
          (r + left[0]) & 0xff,
          (g + left[1]) & 0xff,
          (b + left[2]) & 0xff,
          (a + left[3]) & 0xff,
        ]);
      } else if (filter === 2) {
        const above: [number, number, number, number] = prevRow
          ? (prevRow[x] ?? [0, 0, 0, 0])
          : [0, 0, 0, 0];
        row.push([
          (r + above[0]) & 0xff,
          (g + above[1]) & 0xff,
          (b + above[2]) & 0xff,
          (a + above[3]) & 0xff,
        ]);
      } else {
        row.push([r, g, b, a]);
      }
    }
    unfilteredPixels.push(row);
  }

  const full = ensureFullGfx(gfx);
  const outW = Math.min(width, 128);
  const outH = Math.min(height, 128);
  for (let y = 0; y < outH; y++) {
    const row = full[y]!;
    const srcRow = unfilteredPixels[y]!;
    for (let x = 0; x < outW; x++) {
      const [r, g, b] = srcRow[x]!;
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < 16; i++) {
        const [pr, pg, pb] = PICO8_PALETTE[i]!;
        const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      const byteIdx = Math.floor(x / 2);
      const oldByte = row[byteIdx] ?? 0;
      row[byteIdx] =
        x % 2 === 0
          ? ((bestIdx & 0x0f) << 4) | (oldByte & 0x0f)
          : (oldByte & 0xf0) | (bestIdx & 0x0f);
    }
  }

  return {
    replaced: true,
    reason: `Imported ${outW}×${outH} pixel data, colour-fitted to PICO-8 palette`,
  };
}

function ensureFullGfx(gfx: number[][]): number[][] {
  for (let row = 0; row < 128; row++) {
    if (!gfx[row]) gfx[row] = [];
    const currentRow = gfx[row]!;
    for (let col = 0; col < 64; col++) {
      if (currentRow[col] === undefined) currentRow[col] = 0;
    }
  }
  return gfx;
}

function createAssetPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, "ascii");
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(assetCrc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

const ASSET_CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  ASSET_CRC_TABLE[n] = c;
}

function assetCrc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    crc = ASSET_CRC_TABLE[(crc ^ (data[i] ?? 0)) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
