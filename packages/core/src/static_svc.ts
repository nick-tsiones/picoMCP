import { Cart } from "./cart_repo.js";

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
    const tab = cart.code[tabIdx] ?? "";
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

    if (
      ch === "-" &&
      source[i + 1] === "-" &&
      !inSingleQuote &&
      !inDoubleQuote &&
      !inLongString &&
      !inLongComment
    ) {
      if (source[i + 2] === "[" && source[i + 3] === "[") {
        i += 4;
        inLongComment = true;
        continue;
      }
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }

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
