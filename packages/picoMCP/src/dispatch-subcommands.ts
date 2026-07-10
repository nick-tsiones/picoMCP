import {
  bulkSetFlagsCmd,
  editAppendCmd,
  editRangeCmd,
  editReplaceCmd,
  getFlagsCmd,
  getMapCellCmd,
  getMapRegionCmd,
  getSfxCmd,
  getSpriteCmd,
  getSpriteRangeCmd,
  listSfxCmd,
  setFlagCmd,
  setMapCellCmd,
  setMapRegionCmd,
  setSfxCmd,
  setSpriteCmd,
  setSpriteRangeCmd,
  spriteExportCmd,
  spriteImportCmd,
} from "./commands.js";
import { output, parsePositiveInteger, requiredArg, stringOpt } from "./dispatch-cli.js";

export async function dispatchSprite(
  root: string,
  spriteAction: string | undefined,
  spriteTarget: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (spriteAction === "get") {
    const idx = options.index as string | undefined;
    output(
      await getSpriteCmd(
        root,
        requiredArg(spriteTarget, "cartridge file path"),
        parsePositiveInteger(requiredArg(idx, "--index"), "sprite index") - 1,
      ),
      json,
    );
  } else if (spriteAction === "set") {
    const idx = options.index as string | undefined;
    const pixelsStr = requiredArg(stringOpt(options.pixels), "--pixels");
    const pixels = pixelsStr.split(",").map((s) => {
      const n = parseInt(s.trim(), 10);
      if (!Number.isInteger(n) || n < 0 || n > 15)
        throw new Error(`Pixel value "${s.trim()}" must be 0-15`);
      return n;
    });
    if (pixels.length !== 64)
      throw new Error("--pixels must contain exactly 64 comma-separated values (8x8)");
    output(
      await setSpriteCmd(
        root,
        requiredArg(spriteTarget, "cartridge file path"),
        parsePositiveInteger(requiredArg(idx, "--index"), "sprite index") - 1,
        pixels,
      ),
      json,
    );
  } else if (spriteAction === "get-range") {
    const start =
      parsePositiveInteger(requiredArg(stringOpt(options.start), "--start"), "--start") - 1;
    const end = parsePositiveInteger(requiredArg(stringOpt(options.end), "--end"), "--end") - 1;
    output(
      await getSpriteRangeCmd(root, requiredArg(spriteTarget, "cartridge file path"), start, end),
      json,
    );
  } else if (spriteAction === "set-range") {
    const spritesStr = requiredArg(stringOpt(options.sprites), "--sprites");
    let entries: { index: number; pixels: number[] }[];
    try {
      entries = JSON.parse(spritesStr) as typeof entries;
    } catch {
      throw new Error("--sprites must be valid JSON array of {index, pixels}");
    }
    for (const entry of entries) {
      if (
        typeof entry.index !== "number" ||
        !Array.isArray(entry.pixels) ||
        entry.pixels.length !== 64
      )
        throw new Error(
          "Each sprite entry must have index (number) and pixels (array of 64 numbers)",
        );
    }
    output(
      await setSpriteRangeCmd(root, requiredArg(spriteTarget, "cartridge file path"), entries),
      json,
    );
  } else if (spriteAction === "export") {
    output(
      await spriteExportCmd(
        root,
        requiredArg(spriteTarget, "cartridge file path"),
        requiredArg(stringOpt(options.output), "--output (PNG file path)"),
      ),
      json,
    );
  } else if (spriteAction === "import") {
    output(
      await spriteImportCmd(
        root,
        requiredArg(spriteTarget, "cartridge file path"),
        requiredArg(stringOpt(options.input), "--input (PNG file path)"),
      ),
      json,
    );
  } else {
    throw new Error(`Unknown sprite action: ${spriteAction}`);
  }
}

export async function dispatchMap(
  root: string,
  mapAction: string | undefined,
  mapTarget: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (mapAction === "get") {
    const x = parsePositiveInteger(requiredArg(stringOpt(options.x), "--x"), "--x") - 1;
    const y = parsePositiveInteger(requiredArg(stringOpt(options.y), "--y"), "--y") - 1;
    output(await getMapCellCmd(root, requiredArg(mapTarget, "cartridge file path"), x, y), json);
  } else if (mapAction === "set") {
    const x = parsePositiveInteger(requiredArg(stringOpt(options.x), "--x"), "--x") - 1;
    const y = parsePositiveInteger(requiredArg(stringOpt(options.y), "--y"), "--y") - 1;
    const tile = parsePositiveInteger(requiredArg(stringOpt(options.tile), "--tile"), "--tile");
    if (tile > 256) throw new Error("--tile must be 1-256");
    output(
      await setMapCellCmd(root, requiredArg(mapTarget, "cartridge file path"), x, y, tile - 1),
      json,
    );
  } else if (mapAction === "get-region") {
    const x = parsePositiveInteger(requiredArg(stringOpt(options.x), "--x"), "--x") - 1;
    const y = parsePositiveInteger(requiredArg(stringOpt(options.y), "--y"), "--y") - 1;
    const w = parsePositiveInteger(requiredArg(stringOpt(options.width), "--width"), "--width");
    const h = parsePositiveInteger(requiredArg(stringOpt(options.height), "--height"), "--height");
    output(
      await getMapRegionCmd(root, requiredArg(mapTarget, "cartridge file path"), x, y, w, h),
      json,
    );
  } else if (mapAction === "set-region") {
    const x = parsePositiveInteger(requiredArg(stringOpt(options.x), "--x"), "--x") - 1;
    const y = parsePositiveInteger(requiredArg(stringOpt(options.y), "--y"), "--y") - 1;
    const valuesStr = requiredArg(stringOpt(options.values), "--values");
    let values: number[][];
    try {
      values = JSON.parse(valuesStr) as typeof values;
    } catch {
      throw new Error("--values must be valid JSON 2D array of tile indices");
    }
    output(
      await setMapRegionCmd(root, requiredArg(mapTarget, "cartridge file path"), x, y, values),
      json,
    );
  } else {
    throw new Error(`Unknown map action: ${mapAction}`);
  }
}

export async function dispatchSfx(
  root: string,
  sfxAction: string | undefined,
  sfxTarget: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (sfxAction === "get") {
    const idx = options.index as string | undefined;
    output(
      await getSfxCmd(
        root,
        requiredArg(sfxTarget, "cartridge file path"),
        parsePositiveInteger(requiredArg(idx, "--index"), "sfx index") - 1,
      ),
      json,
    );
  } else if (sfxAction === "set") {
    const idx = options.index as string | undefined;
    const dataStr = requiredArg(stringOpt(options.data), "--data");
    let data: {
      notes?: { pitch: number; instr: number; vol: number; fx: number }[];
      speed?: number;
      loopStart?: number;
      loopEnd?: number;
    };
    try {
      data = JSON.parse(dataStr) as typeof data;
    } catch {
      throw new Error("--data must be valid JSON with notes, speed, loopStart, loopEnd");
    }
    output(
      await setSfxCmd(
        root,
        requiredArg(sfxTarget, "cartridge file path"),
        parsePositiveInteger(requiredArg(idx, "--index"), "sfx index") - 1,
        data,
      ),
      json,
    );
  } else if (sfxAction === "list") {
    output(await listSfxCmd(root, requiredArg(sfxTarget, "cartridge file path")), json);
  } else {
    throw new Error(`Unknown sfx action: ${sfxAction}`);
  }
}

export async function dispatchFlags(
  root: string,
  flagsAction: string | undefined,
  flagsTarget: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (flagsAction === "get") {
    output(await getFlagsCmd(root, requiredArg(flagsTarget, "cartridge file path")), json);
  } else if (flagsAction === "set") {
    const sprite = parsePositiveInteger(
      requiredArg(stringOpt(options.sprite), "--sprite"),
      "--sprite",
    );
    const value = parsePositiveInteger(requiredArg(stringOpt(options.value), "--value"), "--value");
    output(
      await setFlagCmd(root, requiredArg(flagsTarget, "cartridge file path"), sprite - 1, value),
      json,
    );
  } else if (flagsAction === "bulk") {
    const patternStr = requiredArg(stringOpt(options.pattern), "--pattern");
    const values = patternStr.split(",").map((s) => {
      const n = parseInt(s.trim(), 10);
      if (!Number.isInteger(n)) throw new Error(`Invalid flag value: "${s.trim()}"`);
      return n;
    });
    output(
      await bulkSetFlagsCmd(root, requiredArg(flagsTarget, "cartridge file path"), values),
      json,
    );
  } else {
    throw new Error(`Unknown flags action: ${flagsAction}`);
  }
}

export async function dispatchEdit(
  root: string,
  editTarget: string | undefined,
  editAction: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (editAction === "range") {
    const fromLine = parsePositiveInteger(requiredArg(stringOpt(options.from), "--from"), "--from");
    const toLine = parsePositiveInteger(requiredArg(stringOpt(options.to), "--to"), "--to");
    const code = requiredArg(stringOpt(options.code), "--code");
    output(
      await editRangeCmd(
        root,
        requiredArg(editTarget, "cartridge file path"),
        fromLine,
        toLine,
        code,
      ),
      json,
    );
  } else if (editAction === "replace") {
    const find = requiredArg(stringOpt(options.find), "--find");
    const replace = requiredArg(stringOpt(options.replace), "--replace");
    output(
      await editReplaceCmd(root, requiredArg(editTarget, "cartridge file path"), find, replace),
      json,
    );
  } else if (editAction === "append") {
    const code = requiredArg(stringOpt(options.code), "--code");
    output(await editAppendCmd(root, requiredArg(editTarget, "cartridge file path"), code), json);
  } else {
    throw new Error(`Unknown edit action: ${editAction}`);
  }
}
