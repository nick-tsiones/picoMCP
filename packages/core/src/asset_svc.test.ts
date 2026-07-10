import { describe, expect, it } from "vite-plus/test";
import { getSprite, setSprite, getSpriteRange, setSpriteRange } from "./asset_svc.js";

function emptyGfx(): number[][] {
  return [];
}

describe("getSprite / setSprite coordinate mapping", () => {
  it("round-trips a sprite at index 0", () => {
    const gfx = emptyGfx();
    const pixels = new Array(64).fill(0);
    pixels[0] = 8;
    setSprite(gfx, 0, pixels);
    const result = getSprite(gfx, 0);
    expect(result).toEqual(pixels);
  });

  it("round-trips a sprite at index 1", () => {
    const gfx = emptyGfx();
    const pixels = new Array(64).fill(0);
    pixels[0] = 8;
    setSprite(gfx, 1, pixels);
    const result = getSprite(gfx, 1);
    expect(result).toEqual(pixels);
  });

  it("round-trips a sprite at index 16", () => {
    const gfx = emptyGfx();
    const pixels = new Array(64).fill(0);
    pixels[0] = 11;
    setSprite(gfx, 16, pixels);
    const result = getSprite(gfx, 16);
    expect(result).toEqual(pixels);
  });

  it("round-trips a sprite at index 255 (last sprite)", () => {
    const gfx = emptyGfx();
    const pixels = new Array(64).fill(0);
    pixels[63] = 2;
    setSprite(gfx, 255, pixels);
    const result = getSprite(gfx, 255);
    expect(result).toEqual(pixels);
  });

  it("sprite at index 1 is visible in correct byte position of gfx data", () => {
    const gfx = emptyGfx();
    const pixels = new Array(64).fill(0);
    // Set a red pixel (color 8) at top-left of sprite 1
    pixels[0] = 8;
    setSprite(gfx, 1, pixels);

    // Sprite 1: row = floor(1/16)*8 = 0, col = (1%16)*8 = 8 pixels = 4 bytes
    // Top-left pixel (0,0) of sprite = pixel row 0, pixel col 8
    // In gfx: row 0, byte col 4, high nibble
    const byteVal = gfx[0]![4]!;
    const highNibble = (byteVal >> 4) & 0x0f;
    expect(highNibble).toBe(8);
  });

  it("sprite at index 18 stores pixel in correct byte position", () => {
    const gfx = emptyGfx();
    const pixels = new Array(64).fill(0);
    // Set bottom-right pixel of sprite 18 to color 4
    pixels[63] = 4;
    setSprite(gfx, 18, pixels);

    // Sprite 18: row = floor(18/16)*8 = 8, col = (18%16)*8 = 16 pixels
    // Bottom-right pixel (7,7) of sprite = pixel row 15, pixel col 23
    // In gfx: row 15, byte col floor(23/2) = 11, low nibble (odd pixel col)
    const byteVal = gfx[15]![11]!;
    const lowNibble = byteVal & 0x0f;
    expect(lowNibble).toBe(4);
  });

  it("does not clobber adjacent sprite when writing sprite 1", () => {
    const gfx = emptyGfx();
    const zeroes = new Array(64).fill(0);
    const ones = new Array(64).fill(1);
    setSprite(gfx, 0, ones);
    setSprite(gfx, 1, zeroes);

    const sprite0 = getSprite(gfx, 0);
    expect(sprite0).toEqual(ones);
  });

  it("rejects index out of range", () => {
    const gfx = emptyGfx();
    const pixels = new Array(64).fill(0);
    expect(() => setSprite(gfx, -1, pixels)).toThrow("Sprite index must be 0-255");
    expect(() => setSprite(gfx, 256, pixels)).toThrow("Sprite index must be 0-255");
    expect(() => getSprite(gfx, -1)).toThrow("Sprite index must be 0-255");
    expect(() => getSprite(gfx, 256)).toThrow("Sprite index must be 0-255");
  });

  it("allows indices 128-255 (extended range)", () => {
    const gfx = emptyGfx();
    const pixels = new Array(64).fill(0);
    for (const idx of [128, 200, 255]) {
      pixels[idx % 16] = 3;
      setSprite(gfx, idx, pixels);
      expect(getSprite(gfx, idx)).toEqual(pixels);
      pixels[idx % 16] = 0;
    }
  });
});

describe("getSpriteRange / setSpriteRange", () => {
  it("round-trips a range of sprites", () => {
    const gfx = emptyGfx();
    const pixels0 = new Array(64).fill(1);
    const pixels1 = new Array(64).fill(2);
    const pixels255 = new Array(64).fill(3);
    const sprites = [
      { index: 0, pixels: pixels0 },
      { index: 1, pixels: pixels1 },
      { index: 255, pixels: pixels255 },
    ];
    setSpriteRange(gfx, sprites);
    const result = getSpriteRange(gfx, 0, 255);
    expect(result[0]!.pixels).toEqual(pixels0);
    expect(result[1]!.pixels).toEqual(pixels1);
    expect(result[255]!.pixels).toEqual(pixels255);
  });

  it("rejects range out of bounds", () => {
    const gfx = emptyGfx();
    expect(() => getSpriteRange(gfx, 0, 256)).toThrow("0-255");
  });
});
