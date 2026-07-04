import { deflateSync } from "node:zlib";

function createPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuffer, data]));

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] ?? 0;
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createMinimalPng(p8Data: Buffer): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0);
  ihdrData.writeUInt32BE(1, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 0;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createPngChunk("IHDR", ihdrData);

  const rawPixelData = Buffer.from([0, 0]);
  const compressed = deflateSync(rawPixelData);
  const idatChunk = createPngChunk("IDAT", compressed);
  const p8Chunk = createPngChunk("p8  ", p8Data);
  const iendChunk = createPngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, p8Chunk, idatChunk, iendChunk]);
}

export function extractP8FromPng(pngData: Buffer): Buffer | null {
  let offset = 8;
  while (offset < pngData.length - 12) {
    const length = pngData.readUInt32BE(offset);
    const type = pngData.slice(offset + 4, offset + 8).toString("ascii");
    const data = pngData.slice(offset + 8, offset + 8 + length);

    if (type === "p8  ") return data;
    if (type === "IEND") break;

    offset += 12 + length;
  }
  return null;
}
