import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { assertWithinProjectBoundary } from "./path_guard.js";

export interface CartOverview {
  code: string;
  tabCount: number;
  hasSprites: boolean;
  hasMap: boolean;
  hasSfx: boolean;
  hasMusic: boolean;
  tokenCount: number;
}

export interface Cart {
  version: number;
  code: string[];
  gfx: number[][];
  flags: number[];
  map: number[][];
  sfx: unknown[];
  music: unknown[];
  label: number[][] | null;
}

const SECTION_HEADERS = [
  "__lua__",
  "__gfx__",
  "__gff__",
  "__label__",
  "__map__",
  "__sfx__",
  "__music__",
] as const;

type Section = (typeof SECTION_HEADERS)[number];

function serializeHexRows(rows: number[][]): string {
  return rows.map((row) => row.map((v) => v.toString(16).padStart(2, "0")).join("")).join("\n");
}

function parseHexRows(raw: string): number[][] {
  const lines = raw.trim().split("\n").filter(Boolean);
  return lines.map((line) => {
    const bytes: number[] = [];
    for (let i = 0; i < line.length; i += 2) {
      bytes.push(parseInt(line.slice(i, i + 2), 16));
    }
    return bytes;
  });
}

function parseP8(content: string): Cart {
  const sections: Record<Section, string> = {
    __lua__: "",
    __gfx__: "",
    __gff__: "",
    __label__: "",
    __map__: "",
    __sfx__: "",
    __music__: "",
  };

  let version = 0;
  let currentSection: Section | null = null;
  const lines = content.split("\n");

  for (const line of lines) {
    if (line === "__lua__") {
      currentSection = "__lua__";
      continue;
    }
    if (line === "__gfx__") {
      currentSection = "__gfx__";
      continue;
    }
    if (line === "__gff__") {
      currentSection = "__gff__";
      continue;
    }
    if (line === "__label__") {
      currentSection = "__label__";
      continue;
    }
    if (line === "__map__") {
      currentSection = "__map__";
      continue;
    }
    if (line === "__sfx__") {
      currentSection = "__sfx__";
      continue;
    }
    if (line === "__music__") {
      currentSection = "__music__";
      continue;
    }
    if (currentSection === null) {
      // Header lines: "pico-8 cartridge // ...", "version N"
      const versionMatch = line.match(/^version\s+(\d+)/i);
      const versionNumber = versionMatch?.[1];
      if (versionNumber) {
        version = parseInt(versionNumber, 10);
      }
      continue;
    }
    sections[currentSection] += (sections[currentSection] ? "\n" : "") + line;
  }

  // Parse code tabs: split on "-->8" markers
  const codeBlock = sections.__lua__.trim();
  const code: string[] = codeBlock
    ? codeBlock
        .split(/\n-->8\n?/)
        .map((tab) => tab.trim())
        .filter(Boolean)
    : [];

  // Parse gfx section
  const gfx: number[][] = sections.__gfx__.trim() ? parseHexRows(sections.__gfx__) : [];

  // Parse gff (flags) section: each line is hex pairs
  const flags: number[] = sections.__gff__.trim()
    ? sections.__gff__
        .trim()
        .split("\n")
        .flatMap((line) => {
          const bytes: number[] = [];
          for (let i = 0; i < line.length; i += 2) {
            bytes.push(parseInt(line.slice(i, i + 2), 16));
          }
          return bytes;
        })
    : [];

  // Parse map section
  const map: number[][] = sections.__map__.trim() ? parseHexRows(sections.__map__) : [];

  // Parse sfx section (keep as simple strings for now)
  const sfx: unknown[] = sections.__sfx__.trim()
    ? sections.__sfx__.trim().split("\n").filter(Boolean)
    : [];

  // Parse music section
  const music: unknown[] = sections.__music__.trim()
    ? sections.__music__.trim().split("\n").filter(Boolean)
    : [];

  // Parse label section
  const label: number[][] | null = sections.__label__.trim()
    ? parseHexRows(sections.__label__)
    : null;

  return { version, code, gfx, flags, map, sfx, music, label };
}

function serializeP8(cart: Cart): string {
  const lines: string[] = [];
  lines.push("pico-8 cartridge // http://www.pico-8.com");
  lines.push(`version ${cart.version}`);

  // __lua__ section
  lines.push("__lua__");
  if (cart.code.length > 0) {
    lines.push(cart.code.join("\n-->8\n"));
  }

  // __gfx__ section
  lines.push("__gfx__");
  if (cart.gfx.length > 0) {
    lines.push(serializeHexRows(cart.gfx));
  }

  // __gff__ section
  lines.push("__gff__");
  if (cart.flags.length > 0) {
    // Write flags in rows of 128 bytes (256 hex chars) matching PICO-8 convention
    const hex = cart.flags.map((v) => v.toString(16).padStart(2, "0")).join("");
    const rowSize = 256; // 128 bytes = 256 hex chars
    for (let i = 0; i < hex.length; i += rowSize) {
      lines.push(hex.slice(i, i + rowSize));
    }
  }

  // __label__ section
  lines.push("__label__");
  if (cart.label && cart.label.length > 0) {
    lines.push(serializeHexRows(cart.label));
  }

  // __map__ section
  lines.push("__map__");
  if (cart.map.length > 0) {
    lines.push(serializeHexRows(cart.map));
  }

  // __sfx__ section
  lines.push("__sfx__");
  if (cart.sfx.length > 0) {
    lines.push(cart.sfx.map(String).join("\n"));
  }

  // __music__ section
  lines.push("__music__");
  if (cart.music.length > 0) {
    lines.push(cart.music.map(String).join("\n"));
  }

  // Trailing newline
  lines.push("");

  return lines.join("\n");
}

function countTokens(code: string): number {
  // Simplified token counting: count non-whitespace characters
  // Each PICO-8 token is roughly 1 character (keywords, operators, etc.)
  // For now, count characters in the code to approximate
  return code.replace(/\s+/g, " ").trim().length || 0;
}

function emptyCart(): Cart {
  return {
    version: 42,
    code: [],
    gfx: [],
    flags: [],
    map: [],
    sfx: [],
    music: [],
    label: null,
  };
}

export class CartRepo {
  async load(root: string, filePath: string): Promise<Cart> {
    await assertWithinProjectBoundary(root, filePath);
    let content: string;
    try {
      content = await readFile(filePath, "utf-8");
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "ENOENT"
      ) {
        throw new Error("cartridge was not found");
      }
      throw error;
    }
    return parseP8(content);
  }

  async loadOrCreate(root: string, filePath: string): Promise<Cart> {
    try {
      return await this.load(root, filePath);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "cartridge was not found") {
        return emptyCart();
      }
      throw error;
    }
  }

  async save(root: string, filePath: string, cart: Cart): Promise<void> {
    await assertWithinProjectBoundary(root, filePath);
    const serialized = serializeP8(cart);
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });
    const tmpPath = path.join(os.tmpdir(), `cart-${randomUUID()}.p8`);
    await writeFile(tmpPath, serialized, "utf-8");
    await rename(tmpPath, filePath);
  }

  overview(cart: Cart): CartOverview {
    const code = cart.code.join("\n");
    return {
      code,
      tabCount: cart.code.length,
      hasSprites: cart.gfx.length > 0 && cart.gfx.some((row) => row.some((b) => b !== 0)),
      hasMap: cart.map.length > 0 && cart.map.some((row) => row.some((b) => b !== 0)),
      hasSfx: cart.sfx.length > 0,
      hasMusic: cart.music.length > 0,
      tokenCount: countTokens(code),
    };
  }
}
