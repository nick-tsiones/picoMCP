import {
  bulkSetFlagsCmd,
  copySpriteCmd,
  drawSpriteLineCmd,
  drawSpriteCircleCmd,
  drawSpriteRectCmd,
  drawMapLineCmd,
  editAppendCmd,
  editDeleteCmd,
  editInsertCmd,
  editRangeCmd,
  editReplaceCmd,
  fillSpriteCmd,
  fillSpriteRangeCmd,
  fillMapRectCmd,
  fillMapCircleCmd,
  getFlagsCmd,
  getMapCellCmd,
  getMapRegionCmd,
  getSfxCmd,
  getSpriteCmd,
  getSpriteRangeCmd,
  listSfxCmd,
  mirrorSpriteCmd,
  previewSpriteCmd,
  setFlagCmd,
  setMapCellCmd,
  setMapRegionCmd,
  setSfxCmd,
  setSfxToneCmd,
  setSpriteCmd,
  setSpriteRangeCmd,
  spriteExportCmd,
  spriteImportCmd,
} from "./commands.js";
import {
  output,
  numberOpt,
  parseNonNegativeInteger,
  parsePositiveInteger,
  requiredArg,
  stringOpt,
} from "./dispatch-cli.js";

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
        parseNonNegativeInteger(requiredArg(idx, "--index"), "sprite index"),
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
        parseNonNegativeInteger(requiredArg(idx, "--index"), "sprite index"),
        pixels,
      ),
      json,
    );
  } else if (spriteAction === "get-range") {
    const start = parseNonNegativeInteger(
      requiredArg(stringOpt(options.start), "--start"),
      "--start",
    );
    const end = parseNonNegativeInteger(requiredArg(stringOpt(options.end), "--end"), "--end");
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
  } else if (spriteAction === "fill") {
    const idx = parseNonNegativeInteger(
      requiredArg(stringOpt(options.index), "--index"),
      "sprite index",
    );
    const color = parseNonNegativeInteger(
      requiredArg(stringOpt(options.color), "--color"),
      "color",
    );
    if (color > 15) throw new Error("--color must be 0-15");
    output(
      await fillSpriteCmd(root, requiredArg(spriteTarget, "cartridge file path"), idx, color),
      json,
    );
  } else if (spriteAction === "fill-range") {
    const start = parseNonNegativeInteger(
      requiredArg(stringOpt(options.start), "--start"),
      "--start",
    );
    const end = parseNonNegativeInteger(requiredArg(stringOpt(options.end), "--end"), "--end");
    const colorsStr = requiredArg(stringOpt(options.colors), "--colors");
    const colors = colorsStr.split(",").map((s) => {
      const n = parseInt(s.trim(), 10);
      if (!Number.isInteger(n) || n < 0 || n > 15)
        throw new Error(`Color "${s.trim()}" must be 0-15`);
      return n;
    });
    output(
      await fillSpriteRangeCmd(
        root,
        requiredArg(spriteTarget, "cartridge file path"),
        start,
        end,
        colors,
      ),
      json,
    );
  } else if (spriteAction === "copy") {
    const from = parseNonNegativeInteger(requiredArg(stringOpt(options.from), "--from"), "--from");
    const to = parseNonNegativeInteger(requiredArg(stringOpt(options.to), "--to"), "--to");
    output(
      await copySpriteCmd(root, requiredArg(spriteTarget, "cartridge file path"), from, to),
      json,
    );
  } else if (spriteAction === "mirror") {
    const idx = parseNonNegativeInteger(
      requiredArg(stringOpt(options.index), "--index"),
      "sprite index",
    );
    const horizontal = Boolean(options.horizontal);
    const vertical = Boolean(options.vertical);
    output(
      await mirrorSpriteCmd(
        root,
        requiredArg(spriteTarget, "cartridge file path"),
        idx,
        horizontal,
        vertical,
      ),
      json,
    );
  } else if (spriteAction === "draw-rect") {
    const idx = parseNonNegativeInteger(
      requiredArg(stringOpt(options.index), "--index"),
      "sprite index",
    );
    const x = parseNonNegativeInteger(requiredArg(stringOpt(options.x), "--x"), "--x");
    const y = parseNonNegativeInteger(requiredArg(stringOpt(options.y), "--y"), "--y");
    const w = parsePositiveInteger(requiredArg(stringOpt(options.width), "--width"), "--width");
    const h = parsePositiveInteger(requiredArg(stringOpt(options.height), "--height"), "--height");
    const color = parseNonNegativeInteger(
      requiredArg(stringOpt(options.color), "--color"),
      "color",
    );
    if (color > 15) throw new Error("--color must be 0-15");
    const doFill = !options.stroke;
    output(
      await drawSpriteRectCmd(
        root,
        requiredArg(spriteTarget, "cartridge file path"),
        idx,
        x,
        y,
        w,
        h,
        color,
        doFill,
      ),
      json,
    );
  } else if (spriteAction === "draw-circle") {
    const idx = parseNonNegativeInteger(
      requiredArg(stringOpt(options.index), "--index"),
      "sprite index",
    );
    const cx = parseNonNegativeInteger(requiredArg(stringOpt(options.cx), "--cx"), "--cx");
    const cy = parseNonNegativeInteger(requiredArg(stringOpt(options.cy), "--cy"), "--cy");
    const radius = parsePositiveInteger(
      requiredArg(stringOpt(options.radius), "--radius"),
      "--radius",
    );
    const color = parseNonNegativeInteger(
      requiredArg(stringOpt(options.color), "--color"),
      "color",
    );
    if (color > 15) throw new Error("--color must be 0-15");
    const doFill = !options.stroke;
    output(
      await drawSpriteCircleCmd(
        root,
        requiredArg(spriteTarget, "cartridge file path"),
        idx,
        cx,
        cy,
        radius,
        color,
        doFill,
      ),
      json,
    );
  } else if (spriteAction === "draw-line") {
    const idx = parseNonNegativeInteger(
      requiredArg(stringOpt(options.index), "--index"),
      "sprite index",
    );
    const x1 = parseNonNegativeInteger(requiredArg(stringOpt(options.x1), "--x1"), "--x1");
    const y1 = parseNonNegativeInteger(requiredArg(stringOpt(options.y1), "--y1"), "--y1");
    const x2 = parseNonNegativeInteger(requiredArg(stringOpt(options.x2), "--x2"), "--x2");
    const y2 = parseNonNegativeInteger(requiredArg(stringOpt(options.y2), "--y2"), "--y2");
    const color = parseNonNegativeInteger(
      requiredArg(stringOpt(options.color), "--color"),
      "color",
    );
    if (color > 15) throw new Error("--color must be 0-15");
    output(
      await drawSpriteLineCmd(
        root,
        requiredArg(spriteTarget, "cartridge file path"),
        idx,
        x1,
        y1,
        x2,
        y2,
        color,
      ),
      json,
    );
  } else if (spriteAction === "preview") {
    const idx = parseNonNegativeInteger(
      requiredArg(stringOpt(options.index), "--index"),
      "sprite index",
    );
    const ansi = Boolean(options.ansi);
    output(
      await previewSpriteCmd(root, requiredArg(spriteTarget, "cartridge file path"), idx, ansi),
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
  } else if (mapAction === "fill") {
    const x = parsePositiveInteger(requiredArg(stringOpt(options.x), "--x"), "--x") - 1;
    const y = parsePositiveInteger(requiredArg(stringOpt(options.y), "--y"), "--y") - 1;
    const w = parsePositiveInteger(requiredArg(stringOpt(options.width), "--width"), "--width");
    const h = parsePositiveInteger(requiredArg(stringOpt(options.height), "--height"), "--height");
    const tileRaw =
      parsePositiveInteger(requiredArg(stringOpt(options.tile), "--tile"), "--tile") - 1;
    output(
      await fillMapRectCmd(
        root,
        requiredArg(mapTarget, "cartridge file path"),
        x,
        y,
        w,
        h,
        tileRaw,
      ),
      json,
    );
  } else if (mapAction === "draw-line") {
    const x1 = parsePositiveInteger(requiredArg(stringOpt(options.x1), "--x1"), "--x1") - 1;
    const y1 = parsePositiveInteger(requiredArg(stringOpt(options.y1), "--y1"), "--y1") - 1;
    const x2 = parsePositiveInteger(requiredArg(stringOpt(options.x2), "--x2"), "--x2") - 1;
    const y2 = parsePositiveInteger(requiredArg(stringOpt(options.y2), "--y2"), "--y2") - 1;
    const tileRaw =
      parsePositiveInteger(requiredArg(stringOpt(options.tile), "--tile"), "--tile") - 1;
    const lineWidth = parsePositiveInteger(stringOpt(options.width) ?? "1", "--width");
    output(
      await drawMapLineCmd(
        root,
        requiredArg(mapTarget, "cartridge file path"),
        x1,
        y1,
        x2,
        y2,
        tileRaw,
        lineWidth,
      ),
      json,
    );
  } else if (mapAction === "draw-circle") {
    const cx = parsePositiveInteger(requiredArg(stringOpt(options.cx), "--cx"), "--cx") - 1;
    const cy = parsePositiveInteger(requiredArg(stringOpt(options.cy), "--cy"), "--cy") - 1;
    const radius = parsePositiveInteger(
      requiredArg(stringOpt(options.radius), "--radius"),
      "--radius",
    );
    const tileRaw =
      parsePositiveInteger(requiredArg(stringOpt(options.tile), "--tile"), "--tile") - 1;
    output(
      await fillMapCircleCmd(
        root,
        requiredArg(mapTarget, "cartridge file path"),
        cx,
        cy,
        radius,
        tileRaw,
      ),
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
        parseNonNegativeInteger(requiredArg(idx, "--index"), "sfx index"),
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
        parseNonNegativeInteger(requiredArg(idx, "--index"), "sfx index"),
        data,
      ),
      json,
    );
  } else if (sfxAction === "list") {
    output(await listSfxCmd(root, requiredArg(sfxTarget, "cartridge file path")), json);
  } else if (sfxAction === "tone") {
    const idx = parseNonNegativeInteger(
      requiredArg(stringOpt(options.index), "--index"),
      "sfx index",
    );
    const notesStr = requiredArg(stringOpt(options.notes), "--notes");
    const instr = numberOpt(options.instr) ?? 0;
    const vol = numberOpt(options.vol) ?? 4;
    const fx = numberOpt(options.fx) ?? 0;
    const speed = numberOpt(options.speed) ?? 8;
    output(
      await setSfxToneCmd(
        root,
        requiredArg(sfxTarget, "cartridge file path"),
        idx,
        notesStr,
        instr,
        vol,
        fx,
        speed,
      ),
      json,
    );
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
  } else if (editAction === "insert") {
    const atLine = parsePositiveInteger(requiredArg(stringOpt(options.at), "--at"), "--at");
    const code = requiredArg(stringOpt(options.code), "--code");
    output(
      await editInsertCmd(root, requiredArg(editTarget, "cartridge file path"), atLine, code),
      json,
    );
  } else if (editAction === "delete") {
    const fromLine = parsePositiveInteger(requiredArg(stringOpt(options.from), "--from"), "--from");
    const toLine = parsePositiveInteger(requiredArg(stringOpt(options.to), "--to"), "--to");
    output(
      await editDeleteCmd(root, requiredArg(editTarget, "cartridge file path"), fromLine, toLine),
      json,
    );
  } else {
    throw new Error(`Unknown edit action: ${editAction}`);
  }
}
