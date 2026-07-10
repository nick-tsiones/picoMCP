import type { Cart } from "./cart_repo.js";

export interface MinifyResult {
  originalChars: number;
  minifiedChars: number;
  charsSaved: number;
  renamed: boolean;
  renameMap?: Record<string, string>;
}

const LUA_KEYWORDS = new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "goto",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
]);

const PICO8_BUILTINS = new Set([
  "_init",
  "_update",
  "_draw",
  "cls",
  "print",
  "spr",
  "sspr",
  "map",
  "mapdraw",
  "sfx",
  "music",
  "btn",
  "btnp",
  "rnd",
  "srand",
  "flr",
  "ceil",
  "abs",
  "min",
  "max",
  "mid",
  "cos",
  "sin",
  "atan2",
  "sqrt",
  "band",
  "bor",
  "bxor",
  "bnot",
  "shl",
  "shr",
  "lshr",
  "rotl",
  "rotr",
  "sget",
  "sset",
  "fget",
  "fset",
  "mget",
  "mset",
  "peek",
  "poke",
  "poke2",
  "poke4",
  "memcpy",
  "memset",
  "reload",
  "cstore",
  "cartdata",
  "dget",
  "dset",
  "sub",
  "add",
  "del",
  "deli",
  "all",
  "foreach",
  "pairs",
  "ipairs",
  "count",
  "t",
  "time",
  "stat",
  "extcmd",
  "menuitem",
  "printh",
  "type",
  "tostr",
  "tonum",
  "cursor",
  "color",
  "pset",
  "pget",
  "line",
  "rect",
  "rectfill",
  "circ",
  "circfill",
  "oval",
  "ovalfill",
  "pal",
  "palt",
  "fillp",
  "clip",
  "camera",
  "fade",
  "run",
  "stop",
  "resume",
]);

const DEPRECATED_FUNCTIONS: Record<string, string> = {
  mapdraw: "mapdraw was removed in PICO-8 0.1.12; use map() instead",
};

export const PICO8_TOKEN_LIMIT = 8192;

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

export function minifyCode(cart: Cart, options: { rename?: boolean } = {}): MinifyResult {
  const originalCode = cart.code.join("\n");
  const originalChars = originalCode.length;
  const minifiedTabs: string[] = [];

  for (const tab of cart.code) {
    let processed = stripComments(tab);
    processed = collapseWhitespace(processed);
    if (processed.trim() === "") continue;
    minifiedTabs.push(processed);
  }

  let minifiedCode = minifiedTabs.join("\n");
  let renameMap: Record<string, string> | undefined;
  if (options.rename) {
    const result = renameIdentifiers(minifiedCode);
    minifiedCode = result.code;
    renameMap = result.renameMap;
  }

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

function stripComments(code: string): string {
  let result = "";
  let i = 0;
  while (i < code.length) {
    if (code[i] === "-" && code[i + 1] === "-" && code[i + 2] === "[" && code[i + 3] === "[") {
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
    if (code[i] === "-" && code[i + 1] === "-") {
      if (code[i + 2] !== "[" || code[i + 3] !== "[") {
        while (i < code.length && code[i] !== "\n") i++;
        if (i < code.length) {
          result += "\n";
          i++;
        }
        continue;
      }
    }
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
    result += code[i];
    i++;
  }
  return result;
}

function collapseWhitespace(code: string): string {
  return code
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => line !== "")
    .join("\n");
}

function renameIdentifiers(code: string): { code: string; renameMap: Record<string, string> } {
  const identifierPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  const identifiers = new Set<string>();
  let match: RegExpExecArray | null;
  const stripped = stripComments(code);
  const noStrings = stripped.replace(/(["'])(?:\\.|.)*?\1/g, '""');

  while ((match = identifierPattern.exec(noStrings)) !== null) {
    const name = match[0];
    if (!LUA_KEYWORDS.has(name) && !PICO8_BUILTINS.has(name)) identifiers.add(name);
  }

  const sorted = [...identifiers].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const renameMap: Record<string, string> = {};
  const shortNames = generateShortNames(sorted.length);
  for (let i = 0; i < sorted.length; i++) {
    renameMap[sorted[i]!] = shortNames[i]!;
  }

  let result = code;
  for (const original of sorted) {
    result = replaceIdentifiersInCode(result, original, renameMap[original]!);
  }
  return { code: result, renameMap };
}

function generateShortNames(count: number): string[] {
  const names: string[] = [];
  const letters = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < count; i++) {
    if (i < 26) names.push(letters[i]!);
    else names.push(`${letters[i % 26]}${Math.floor(i / 26)}`);
  }
  return names;
}

function replaceIdentifiersInCode(code: string, original: string, replacement: string): string {
  let result = "";
  let i = 0;
  while (i < code.length) {
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
    if (code.slice(i, i + original.length) === original) {
      const before = i > 0 ? (code[i - 1] ?? " ") : " ";
      const after = i + original.length < code.length ? (code[i + original.length] ?? " ") : " ";
      const isWordBoundary = !/[a-zA-Z0-9_]/.test(before) && !/[a-zA-Z0-9_]/.test(after);
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

export function lintCart(cart: Cart): LintReport {
  const issues: LintIssue[] = [];

  for (let tabIdx = 0; tabIdx < cart.code.length; tabIdx++) {
    const tab = cart.code[tabIdx] ?? "";
    const lines = tab.split("\n");

    let functionDepth = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx] ?? "";
      const lineNum = lineIdx + 1;

      const funcCount = (line.match(/\bfunction\b/g) || []).length;
      const endCount = (line.match(/\bend\b/g) || []).length;
      functionDepth += funcCount;

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

      const assignMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
      if (assignMatch) {
        const before = line.slice(0, assignMatch.index ?? 0);
        const varName = assignMatch[1]!;
        if (
          !/\blocal\b/.test(before) &&
          !/\bfor\b/.test(before) &&
          !PICO8_BUILTINS.has(varName) &&
          !LUA_KEYWORDS.has(varName) &&
          !/\.\s*$/.test(before) &&
          !/\[\s*$/.test(before) &&
          functionDepth === 0
        ) {
          issues.push({
            line: lineNum,
            column: (assignMatch.index ?? 0) + 1,
            message: `"${varName}" is assigned without "local"; consider using "local ${varName} = ..."`,
            severity: "warning",
          });
        }
      }

      functionDepth -= endCount;
    }
  }

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

function countApproxTokens(code: string): number {
  const stripped = stripComments(code);
  const noStrings = stripped.replace(/(["'])(?:\\.|.)*?\1/g, '""');
  const tokens = noStrings
    .split(/[\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  let count = 0;
  for (const token of tokens) {
    count += token.split(/([+\-*/%^#=<>~&|;,{}()[\].:])/g).filter(Boolean).length;
  }
  return count;
}
