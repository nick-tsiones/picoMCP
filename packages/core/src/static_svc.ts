import { Cart } from "./cart_repo.js";
import { deflateSync } from "node:zlib";

export const PICO8_CHAR_LIMIT = 65536;

export interface CartSizeReport {
  charCount: number;
  limit: number;
  headroom: number;
  aboveLimit: boolean;
  atLimit: boolean;
  status: "above" | "below" | "at";
  message: string;
}

export function reportCartSize(cart: Cart): CartSizeReport {
  // Count characters in the full serialized source code (approximate)
  // We use the joined code tabs for a practical measure
  const code = cart.code.join("\n");
  const charCount = code.length;

  const headroom = PICO8_CHAR_LIMIT - charCount;
  const aboveLimit = charCount > PICO8_CHAR_LIMIT;
  const atLimit = charCount === PICO8_CHAR_LIMIT;

  let status: "above" | "below" | "at";
  let message: string;

  if (atLimit) {
    status = "at";
    message = `Cartridge exactly reaches the limit of ${PICO8_CHAR_LIMIT} characters.`;
  } else if (aboveLimit) {
    status = "above";
    message = `Cartridge exceeds the token limit by ${charCount - PICO8_CHAR_LIMIT} characters.`;
  } else {
    status = "below";
    message = `Cartridge has ${headroom} characters of headroom remaining.`;
  }

  return { charCount, limit: PICO8_CHAR_LIMIT, headroom, aboveLimit, atLimit, status, message };
}

export interface ParseReport {
  valid: boolean;
  errors: string[];
  code: string;
  tabCount: number;
}

export function parseCode(cart: Cart): ParseReport {
  const errors: string[] = [];
  const code = cart.code.join("\n");

  for (let tabIdx = 0; tabIdx < cart.code.length; tabIdx++) {
    const tab = cart.code[tabIdx];
    const tabErrors = validateLuaSyntax(tab, tabIdx + 1);
    errors.push(...tabErrors);
  }

  return {
    valid: errors.length === 0,
    errors,
    code,
    tabCount: cart.code.length,
  };
}

function validateLuaSyntax(source: string, tab: number): string[] {
  const errors: string[] = [];

  // Check balanced parentheses
  let parenDepth = 0;
  let bracketDepth = 0;
  let braceDepth = 0;

  // Check balanced quotes
  let inSingleQuote = false;
  let inDoubleQuote = false;

  // Track long string / long comment syntax [[ ... ]] and --[[ ... ]]
  let inLongString = false;
  let inLongComment = false;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    const prev = i > 0 ? source[i - 1] : "";

    // Check for long bracket start/end [[ or ]]
    if (ch === "[" && source[i + 1] === "[" && !inSingleQuote && !inDoubleQuote) {
      if (prev === "-" && source[i - 2] === "-") {
        inLongComment = true;
      } else {
        inLongString = true;
      }
      i += 1; // skip next [
      continue;
    }
    if (ch === "]" && source[i + 1] === "]" && !inSingleQuote && !inDoubleQuote) {
      if (inLongComment) {
        inLongComment = false;
        i += 1;
        continue;
      }
      if (inLongString) {
        inLongString = false;
        i += 1;
        continue;
      }
      // Unmatched ]] outside long string/comment
      errors.push(`Tab ${tab}: unexpected "]]" at position ${i}`);
      continue;
    }

    if (inLongString || inLongComment) continue;

    // Check string escaping
    if (ch === "\\" && (inSingleQuote || inDoubleQuote)) {
      i += 1; // skip escaped char
      continue;
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (inSingleQuote || inDoubleQuote) continue;

    if (ch === "(") parenDepth++;
    if (ch === ")") {
      parenDepth--;
      if (parenDepth < 0) {
        errors.push(`Tab ${tab}: unexpected ")" at position ${i}`);
        parenDepth = 0;
      }
    }
    if (ch === "[") bracketDepth++;
    if (ch === "]") {
      bracketDepth--;
      if (bracketDepth < 0) {
        errors.push(`Tab ${tab}: unexpected "]" at position ${i}`);
        bracketDepth = 0;
      }
    }
    if (ch === "{") braceDepth++;
    if (ch === "}") {
      braceDepth--;
      if (braceDepth < 0) {
        errors.push(`Tab ${tab}: unexpected "}" at position ${i}`);
        braceDepth = 0;
      }
    }
  }

  // Check unclosed quotes
  if (inSingleQuote) {
    errors.push(`Tab ${tab}: unclosed single quote`);
  }
  if (inDoubleQuote) {
    errors.push(`Tab ${tab}: unclosed double quote`);
  }

  // Check unclosed long constructs
  if (inLongString) {
    errors.push(`Tab ${tab}: unclosed long string "[["`);
  }
  if (inLongComment) {
    errors.push(`Tab ${tab}: unclosed long comment "--[["`);
  }

  // Check unbalanced brackets
  if (parenDepth > 0) {
    errors.push(`Tab ${tab}: ${parenDepth} unclosed parenthesis(es)`);
  }
  if (bracketDepth > 0) {
    errors.push(`Tab ${tab}: ${bracketDepth} unclosed bracket(s)`);
  }
  if (braceDepth > 0) {
    errors.push(`Tab ${tab}: ${braceDepth} unclosed brace(s)`);
  }

  return errors;
}

export interface ConvertResult {
  success: boolean;
  outputPath: string;
  error?: string;
}

// PICO-8 .p8.png format: PNG image with the .p8 data stored in a "p8" chunk or as simple embedded data
// For simplicity, we create a minimal valid PNG with the .p8 content in a custom "p8 " chunk

function createMinimalPng(p8Data: Buffer): Buffer {
  // Build a minimal PNG with a custom "p8 " chunk containing the .p8 data
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); // PNG signature

  // IHDR chunk: 1x1 pixel, 8-bit grayscale
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0); // width
  ihdrData.writeUInt32BE(1, 4); // height
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 0; // color type (grayscale)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createPngChunk("IHDR", ihdrData);

  // IDAT chunk: compressed pixel data (single pixel)
  const rawPixelData = Buffer.from([0, 0]); // filter byte + pixel
  const compressed = deflateSync(rawPixelData);
  const idatChunk = createPngChunk("IDAT", compressed);

  // Custom "p8  " chunk with the .p8 content
  const p8Chunk = createPngChunk("p8  ", p8Data);

  // IEND chunk
  const iendChunk = createPngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, p8Chunk, idatChunk, iendChunk]);
}

function createPngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuffer, data]));

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation for PNG
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
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function extractP8FromPng(pngData: Buffer): Buffer | null {
  // Walk through PNG chunks looking for "p8  "
  let offset = 8; // skip PNG signature
  while (offset < pngData.length - 12) {
    const length = pngData.readUInt32BE(offset);
    const type = pngData.slice(offset + 4, offset + 8).toString("ascii");
    const data = pngData.slice(offset + 8, offset + 8 + length);

    if (type === "p8  ") {
      return data;
    }

    if (type === "IEND") break;

    offset += 12 + length; // length + type + data + crc
  }
  return null;
}

export { createMinimalPng, extractP8FromPng };

// ── Code minification ──────────────────────────────────────────────────────

export interface MinifyResult {
  originalChars: number;
  minifiedChars: number;
  charsSaved: number;
  renamed: boolean;
  /** Map of original name → shortened name (only when renaming is enabled) */
  renameMap?: Record<string, string>;
}

/**
 * Minify PICO-8 Lua code.
 *
 * - Strips comments: `--` to end of line and `--[[ ... ]]` blocks
 * - Collapses multiple spaces to single
 * - Removes blank lines (lines that are empty or whitespace-only)
 * - Optionally renames identifiers to shorter names
 *
 * Returns a report with the character savings and the minified code.
 * The cart.code array is modified in place.
 */
export function minifyCode(cart: Cart, options: { rename?: boolean } = {}): MinifyResult {
  const originalCode = cart.code.join("\n");
  const originalChars = originalCode.length;

  // Process each tab
  const minifiedTabs: string[] = [];
  for (const tab of cart.code) {
    let processed = stripComments(tab);
    processed = collapseWhitespace(processed);
    if (processed.trim() === "") continue; // skip blank tabs
    minifiedTabs.push(processed);
  }

  let minifiedCode = minifiedTabs.join("\n");

  let renameMap: Record<string, string> | undefined;
  if (options.rename) {
    const result = renameIdentifiers(minifiedCode);
    minifiedCode = result.code;
    renameMap = result.renameMap;
  }

  // Update cart in place
  cart.code = minifiedCode ? minifiedCode.split("\n").filter((line) => line.trim() !== "") : [];

  const minifiedChars = minifiedCode.length;

  return {
    originalChars,
    minifiedChars,
    charsSaved: originalChars - minifiedChars,
    renamed: options.rename ?? false,
    renameMap,
  };
}

/**
 * Strip Lua comments:
 * - `--` to end of line
 * - `--[[ ... ]]` blocks (multi-line)
 */
function stripComments(code: string): string {
  // First, remove multi-line comments --[[ ... ]]
  let result = "";
  let i = 0;
  while (i < code.length) {
    // Check for --[[
    if (code[i] === "-" && code[i + 1] === "-" && code[i + 2] === "[" && code[i + 3] === "[") {
      // Skip to matching ]] or end of string
      i += 4;
      while (i < code.length - 1) {
        if (code[i] === "]" && code[i + 1] === "]") {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }
    // Check for -- (single-line comment)
    if (code[i] === "-" && code[i + 1] === "-") {
      // A -- that is not followed by [[ is a single-line comment
      if (code[i + 2] !== "[" || code[i + 3] !== "[") {
        // Skip to end of line
        while (i < code.length && code[i] !== "\n") {
          i++;
        }
        // Keep the newline
        if (i < code.length) {
          result += "\n";
          i++;
        }
        continue;
      }
    }
    // Check for string literals (so we don't strip -- inside strings)
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      result += quote;
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === "\\") {
          result += code[i];
          i++;
        }
        if (i < code.length) {
          result += code[i];
          i++;
        }
      }
      if (i < code.length) {
        result += code[i];
        i++;
      }
      continue;
    }
    result += code[i];
    i++;
  }
  return result;
}

/**
 * Collapse multiple spaces into single spaces and remove leading/trailing
 * whitespace from each line.
 */
function collapseWhitespace(code: string): string {
  const lines = code.split("\n");
  const processed = lines
    .map((line) => {
      // Replace multiple spaces/tabs with single space
      const trimmed = line.replace(/[ \t]+/g, " ").trim();
      return trimmed;
    })
    .filter((line) => line !== ""); // Remove blank lines
  return processed.join("\n");
}

/**
 * Simple identifier renaming: finds Lua identifiers (not keywords, not strings)
 * and renames them to a, b, c, ..., z, a1, b1, ...
 */
const LUA_KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function",
  "goto", "if", "in", "local", "nil", "not", "or", "repeat", "return",
  "then", "true", "until", "while",
]);

// PICO-8 built-ins to preserve
const PICO8_BUILTINS = new Set([
  "_init", "_update", "_draw", "cls", "print", "spr", "sspr", "map", "mapdraw",
  "sfx", "music", "btn", "btnp", "rnd", "srand", "flr", "ceil", "abs", "min",
  "max", "mid", "cos", "sin", "atan2", "sqrt", "band", "bor", "bxor", "bnot",
  "shl", "shr", "lshr", "rotl", "rotr", "sget", "sset", "fget", "fset",
  "mget", "mset", "peek", "poke", "poke2", "poke4", "memcpy", "memset",
  "reload", "cstore", "cartdata", "dget", "dset", "sub", "add", "del", "deli",
  "all", "foreach", "pairs", "ipairs", "count", "t", "time", "stat",
  "extcmd", "menuitem", "printh", "type", "tostr", "tonum", "cursor",
  "color", "pset", "pget", "line", "rect", "rectfill", "circ", "circfill",
  "oval", "ovalfill", "pal", "palt", "fillp", "clip", "camera", "fade",
  "run", "stop", "resume",
]);

function renameIdentifiers(code: string): { code: string; renameMap: Record<string, string> } {
  // Extract identifiers (simplified: word-like tokens not in strings/comments)
  const identifierPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  const identifiers = new Set<string>();
  let match: RegExpExecArray | null;

  // First pass: find all identifiers, skipping strings and comments
  const stripped = stripComments(code);
  // Remove string contents for identifier extraction
  const noStrings = stripped.replace(/(["'])(?:\\.|.)*?\1/g, '""');
  while ((match = identifierPattern.exec(noStrings)) !== null) {
    const name = match[0];
    if (!LUA_KEYWORDS.has(name) && !PICO8_BUILTINS.has(name)) {
      identifiers.add(name);
    }
  }

  // Generate short names
  const sorted = [...identifiers].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const renameMap: Record<string, string> = {};
  const shortNames = generateShortNames(sorted.length);
  for (let i = 0; i < sorted.length; i++) {
    renameMap[sorted[i]!] = shortNames[i]!;
  }

  // Second pass: replace identifiers in the actual code (respecting word boundaries)
  // Sort by length descending to avoid partial replacements
  let result = code;
  for (const original of sorted) {
    const short = renameMap[original]!;
    // Replace only whole-word occurrences, but preserve string contents
    result = replaceIdentifiersInCode(result, original, short);
  }

  return { code: result, renameMap };
}

function generateShortNames(count: number): string[] {
  const names: string[] = [];
  const letters = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < count; i++) {
    if (i < 26) {
      names.push(letters[i]!);
    } else {
      const num = Math.floor(i / 26);
      names.push(`${letters[i % 26]}${num}`);
    }
  }
  return names;
}

function replaceIdentifiersInCode(code: string, original: string, replacement: string): string {
  // Walk through the code, respecting strings
  let result = "";
  let i = 0;
  while (i < code.length) {
    // Skip strings
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i]!;
      result += quote;
      i++;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === "\\") {
          result += code[i];
          i++;
        }
        if (i < code.length) {
          result += code[i];
          i++;
        }
      }
      if (i < code.length) {
        result += code[i];
        i++;
      }
      continue;
    }
    // Check for identifier match at word boundary
    if (code.slice(i, i + original.length) === original) {
      const before = i > 0 ? code[i - 1] : " ";
      const after = i + original.length < code.length ? code[i + original.length] : " ";
      const isWordBoundary =
        !/[a-zA-Z0-9_]/.test(before!) && !/[a-zA-Z0-9_]/.test(after!);
      if (isWordBoundary) {
        result += replacement;
        i += original.length;
        continue;
      }
    }
    result += code[i];
    i++;
  }
  return result;
}

export interface LintIssue {
  line: number;
  column: number;
  message: string;
  severity: "error" | "warning";
}

export interface LintReport {
  issues: LintIssue[];
  tabCount: number;
}

export const PICO8_TOKEN_LIMIT = 8192;

// Deprecated PICO-8 functions that should be avoided
const DEPRECATED_FUNCTIONS: Record<string, string> = {
  "mapdraw": "mapdraw was removed in PICO-8 0.1.12; use map() instead",
};

/**
 * Lint a cartridge for common PICO-8 issues.
 */
export function lintCart(cart: Cart): LintReport {
  const issues: LintIssue[] = [];

  for (let tabIdx = 0; tabIdx < cart.code.length; tabIdx++) {
    const tab = cart.code[tabIdx]!;
    const lines = tab.split("\n");

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx]!;
      const lineNum = lineIdx + 1;

      // Check for deprecated function calls
      for (const [fn, msg] of Object.entries(DEPRECATED_FUNCTIONS)) {
        const regex = new RegExp(`\\b${fn}\\s*\\(`);
        const match = regex.exec(line);
        if (match) {
          issues.push({
            line: lineNum,
            column: match.index + 1,
            message: msg,
            severity: "warning",
          });
        }
      }

      // Check for overlong variable names
      const identifierPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
      let idMatch: RegExpExecArray | null;
      while ((idMatch = identifierPattern.exec(line)) !== null) {
        const before = line.slice(0, idMatch.index);
        const singleQuotes = (before.match(/(?<!\\)'/g) || []).length;
        const doubleQuotes = (before.match(/(?<!\\)"/g) || []).length;
        if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) continue;

        const name = idMatch[0];
        if (name.length > 20 && !LUA_KEYWORDS.has(name) && !PICO8_BUILTINS.has(name)) {
          issues.push({
            line: lineNum,
            column: idMatch.index + 1,
            message: `Variable name "${name}" is very long (${name.length} chars); consider using a shorter name`,
            severity: "warning",
          });
          identifierPattern.lastIndex = idMatch.index + name.length;
        }
      }

      // Check for assignment without local
      const assignMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
      if (assignMatch) {
        const before = line.slice(0, assignMatch.index!);
        const varName = assignMatch[1]!;
        if (
          !/\blocal\b/.test(before) &&
          !/\bfor\b/.test(before) &&
          !PICO8_BUILTINS.has(varName) &&
          !LUA_KEYWORDS.has(varName) &&
          !/\.\s*$/.test(before) &&
          !/\[\s*$/.test(before)
        ) {
          issues.push({
            line: lineNum,
            column: assignMatch.index! + 1,
            message: `"${varName}" is assigned without "local"; consider using "local ${varName} = ..."`,
            severity: "warning",
          });
        }
      }
    }
  }

  // Check total token count
  const fullCode = cart.code.join("\n");
  const tokenCount = countApproxTokens(fullCode);
  if (tokenCount > PICO8_TOKEN_LIMIT) {
    issues.push({
      line: 0,
      column: 0,
      message: `Cartridge exceeds PICO-8 token limit: ~${tokenCount} tokens (limit: ${PICO8_TOKEN_LIMIT})`,
      severity: "error",
    });
  }

  return { issues, tabCount: cart.code.length };
}

/**
 * Approximate PICO-8 token count.
 */
function countApproxTokens(code: string): number {
  const stripped = stripComments(code);
  const noStrings = stripped.replace(/(["'])(?:\\.|.)*?\1/g, '""');

  const tokens = noStrings
    .split(/[\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  let count = 0;
  for (const token of tokens) {
    const subtokens = token.split(
      /([+\-*/%^#=<>~&|;,{}()\[\].:])/g,
    ).filter(Boolean);
    count += subtokens.length;
  }
  return count;
}