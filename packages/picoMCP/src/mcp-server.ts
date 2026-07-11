import { createInterface } from "node:readline";
import { MCP_TOOLS, type McpTool } from "./mcp-tools.js";
import {
  bulkSetFlagsCmd,
  checkCartridgeCmd,
  convertCartridge,
  copySpriteCmd,
  drawSpriteCircleCmd,
  drawSpriteRectCmd,
  drawSpriteLineCmd,
  drawMapLineCmd,
  editAppendCmd,
  editDeleteCmd,
  editInsertCmd,
  editRangeCmd,
  editReplaceCmd,
  exportCartridge,
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
  initCartridgeCmd,
  lintCartridge,
  listSfxCmd,
  minifyCartridge,
  mirrorSpriteCmd,
  parseCartridge,
  previewSpriteCmd,
  readOverview,
  readTab,
  refApi,
  refPitfalls,
  runCartridge,
  setFlagCmd,
  setMapCellCmd,
  setMapRegionCmd,
  setSfxCmd,
  setSfxToneCmd,
  setSpriteCmd,
  setSpriteRangeCmd,
  sizeCartridge,
  spriteExportCmd,
  spriteImportCmd,
  writeCartridge,
  writeCartridgeFromFile,
} from "./commands.js";
import { resolveProjectRoot, ProjectBoundaryError, type RunInputFrame } from "@picomcp/core";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

const SERVER_INFO = {
  name: "picoMCP",
  version: "0.1.0",
};

function reply(id: number | string | null | undefined, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function errorReply(
  id: number | string | null | undefined,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, data } };
}

function send(response: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(response) + "\n");
}

function findTool(name: string): McpTool | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}

function validateSchema(
  args: Record<string, unknown>,
  schema: McpTool["inputSchema"],
): string | null {
  if (schema.required) {
    for (const key of schema.required) {
      if (args[key] === undefined || args[key] === null) {
        return `Missing required field: ${key}`;
      }
    }
  }
  for (const [key, value] of Object.entries(args)) {
    const prop = schema.properties[key] as { type?: string } | undefined;
    if (prop && prop.type && value !== undefined && value !== null) {
      if (prop.type === "string" && typeof value !== "string") {
        return `Field "${key}" must be a string, got ${typeof value}`;
      }
      if (prop.type === "number" && typeof value !== "number") {
        return `Field "${key}" must be a number, got ${typeof value}`;
      }
      if (prop.type === "boolean" && typeof value !== "boolean") {
        return `Field "${key}" must be a boolean, got ${typeof value}`;
      }
    }
  }
  return null;
}

function validateLimits(name: string, args: Record<string, unknown>): string | null {
  if (name === "picomcp_write") {
    if (typeof args.code === "string" && args.code.length > 65536) {
      return "code exceeds PICO-8 character limit (65536 chars)";
    }
    if (typeof args.tab === "number" && (args.tab < 1 || args.tab > 256)) {
      return "tab must be 1-256";
    }
  }
  if (name === "picomcp_sprite_set") {
    if (typeof args.pixels === "string") {
      const pixelValues = args.pixels.split(",").map((s) => parseInt(s.trim(), 10));
      for (const v of pixelValues) {
        if (!Number.isInteger(v) || v < 0 || v > 15) {
          return `Pixel value "${v}" must be 0-15`;
        }
      }
    }
  }
  if (name === "picomcp_run") {
    if (typeof args.frames === "number" && (args.frames < 1 || args.frames > 36000)) {
      return "frames must be 1-36000";
    }
    if (typeof args.timeoutMs === "number" && args.timeoutMs > 300000) {
      return "timeoutMs must not exceed 300000 (5 minutes)";
    }
  }
  return null;
}

async function callTool(
  name: string,
  args: Record<string, unknown>,
  root: string,
): Promise<unknown> {
  const filePath = args.filePath as string | undefined;

  switch (name) {
    case "picomcp_read": {
      const fp = requireStr(filePath, "filePath");
      return readOverview(root, fp);
    }
    case "picomcp_read_tab": {
      const fp = requireStr(filePath, "filePath");
      const tab = requireNum(args.tab, "tab");
      return readTab(root, fp, tab);
    }
    case "picomcp_write": {
      const fp = requireStr(filePath, "filePath");
      const codeFilePath = args.codeFile as string | undefined;
      if (codeFilePath) {
        const tab = args.tab !== undefined ? requireNum(args.tab, "tab") : 1;
        return writeCartridgeFromFile(root, fp, codeFilePath, tab);
      }
      const code = requireStr(args.code as string | undefined, "code");
      const tab = args.tab !== undefined ? requireNum(args.tab, "tab") : 1;
      return writeCartridge(root, fp, code, tab);
    }
    case "picomcp_init": {
      const fp = requireStr(filePath, "filePath");
      return initCartridgeCmd(root, fp);
    }
    case "picomcp_check": {
      const fp = requireStr(filePath, "filePath");
      return checkCartridgeCmd(root, fp);
    }
    case "picomcp_parse": {
      const fp = requireStr(filePath, "filePath");
      return parseCartridge(root, fp);
    }
    case "picomcp_lint": {
      const fp = requireStr(filePath, "filePath");
      return lintCartridge(root, fp);
    }
    case "picomcp_size": {
      const fp = requireStr(filePath, "filePath");
      return sizeCartridge(root, fp);
    }
    case "picomcp_run": {
      const fp = requireStr(filePath, "filePath");
      let input: RunInputFrame[] | undefined;
      if (args.input !== undefined) {
        const inputStr = args.input as string;
        let parsed: unknown;
        try {
          parsed = JSON.parse(inputStr);
        } catch {
          throw new Error("input must be a valid JSON array");
        }
        if (!Array.isArray(parsed)) {
          throw new Error("input must be a JSON array of {frame, hold} entries");
        }
        for (const entry of parsed) {
          if (
            typeof entry !== "object" ||
            entry === null ||
            typeof (entry as Record<string, unknown>).frame !== "number" ||
            !Array.isArray((entry as Record<string, unknown>).hold)
          ) {
            throw new Error(
              'Each input entry must have "frame" (number) and "hold" (array of numbers)',
            );
          }
        }
        input = parsed as RunInputFrame[];
      }
      return runCartridge(root, fp, {
        binaryPath: args.pico8 as string | undefined,
        frames: args.frames as number | undefined,
        capture: (args.capture as "none" | "screen" | "gif" | undefined) ?? "none",
        captureAt: args.captureAt as number | undefined,
        param: args.param as string | undefined,
        input,
        timeoutMs: args.timeoutMs as number | undefined,
      });
    }
    case "picomcp_export": {
      const fp = requireStr(filePath, "filePath");
      const to = requireStr(args.to as string | undefined, "to");
      if (to !== "web" && to !== "native") throw new Error('--to must be "web" or "native"');
      return exportCartridge(root, fp, {
        binaryPath: args.pico8 as string | undefined,
        format: to,
        outputPath: args.output as string | undefined,
      });
    }
    case "picomcp_convert": {
      const fp = requireStr(filePath, "filePath");
      const to = requireStr(args.to as string | undefined, "to");
      if (to !== "p8.png" && to !== "p8") throw new Error('--to must be "p8.png" or "p8"');
      return convertCartridge(root, fp, to, args.output as string | undefined);
    }
    case "picomcp_flags_get": {
      const fp = requireStr(filePath, "filePath");
      return getFlagsCmd(root, fp);
    }
    case "picomcp_flags_set": {
      const fp = requireStr(filePath, "filePath");
      const sprite = requireNum(args.sprite, "sprite");
      const value = requireNum(args.value, "value");
      return setFlagCmd(root, fp, sprite - 1, value);
    }
    case "picomcp_sprite_get": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      return getSpriteCmd(root, fp, index);
    }
    case "picomcp_sprite_set": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      const pixelsStr = requireStr(args.pixels as string | undefined, "pixels");
      const pixels = pixelsStr.split(",").map((s) => {
        const n = parseInt(s.trim(), 10);
        if (!Number.isInteger(n) || n < 0 || n > 15) {
          throw new Error(`Pixel value "${s.trim()}" must be 0-15`);
        }
        return n;
      });
      if (pixels.length !== 64) throw new Error("pixels must contain exactly 64 values (8x8)");
      return setSpriteCmd(root, fp, index, pixels);
    }
    case "picomcp_map_get": {
      const fp = requireStr(filePath, "filePath");
      const x = requireNum(args.x, "x") - 1;
      const y = requireNum(args.y, "y") - 1;
      return getMapCellCmd(root, fp, x, y);
    }
    case "picomcp_map_set": {
      const fp = requireStr(filePath, "filePath");
      const x = requireNum(args.x, "x") - 1;
      const y = requireNum(args.y, "y") - 1;
      const tile = requireNum(args.tile, "tile");
      if (tile > 256) throw new Error("tile must be 1-256");
      return setMapCellCmd(root, fp, x, y, tile - 1);
    }
    case "picomcp_sfx_get": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      return getSfxCmd(root, fp, index);
    }
    case "picomcp_sfx_set": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      const dataStr = requireStr(args.data as string | undefined, "data");
      let data: {
        notes?: { pitch: number; instr: number; vol: number; fx: number }[];
        speed?: number;
        loopStart?: number;
        loopEnd?: number;
      };
      try {
        data = JSON.parse(dataStr) as typeof data;
      } catch {
        throw new Error("data must be valid JSON with notes, speed, loopStart, loopEnd");
      }
      return setSfxCmd(root, fp, index, data);
    }
    case "picomcp_minify": {
      const fp = requireStr(filePath, "filePath");
      const rename = Boolean(args.rename);
      return minifyCartridge(root, fp, rename);
    }
    case "picomcp_edit_range": {
      const fp = requireStr(filePath, "filePath");
      const from = requireNum(args.from, "from");
      const to = requireNum(args.to, "to");
      const code = requireStr(args.code as string | undefined, "code");
      return editRangeCmd(root, fp, from, to, code);
    }
    case "picomcp_edit_replace": {
      const fp = requireStr(filePath, "filePath");
      const find = requireStr(args.find as string | undefined, "find");
      const replace = requireStr(args.replace as string | undefined, "replace");
      return editReplaceCmd(root, fp, find, replace);
    }
    case "picomcp_edit_append": {
      const fp = requireStr(filePath, "filePath");
      const code = requireStr(args.code as string | undefined, "code");
      return editAppendCmd(root, fp, code);
    }
    case "picomcp_flags_bulk": {
      const fp = requireStr(filePath, "filePath");
      const patternStr = requireStr(args.pattern as string | undefined, "pattern");
      const values = patternStr.split(",").map((s) => {
        const n = parseInt(s.trim(), 10);
        if (!Number.isInteger(n)) throw new Error(`Invalid flag value: "${s.trim()}"`);
        return n;
      });
      return bulkSetFlagsCmd(root, fp, values);
    }
    case "picomcp_sprite_get_range": {
      const fp = requireStr(filePath, "filePath");
      const start = requireNum(args.start, "start") - 1;
      const end = requireNum(args.end, "end") - 1;
      return getSpriteRangeCmd(root, fp, start, end);
    }
    case "picomcp_sprite_set_range": {
      const fp = requireStr(filePath, "filePath");
      const spritesStr = requireStr(args.sprites as string | undefined, "sprites");
      let entries: { index: number; pixels: number[] }[];
      try {
        entries = JSON.parse(spritesStr) as typeof entries;
      } catch {
        throw new Error("sprites must be valid JSON array of {index, pixels}");
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
      return setSpriteRangeCmd(root, fp, entries);
    }
    case "picomcp_sprite_export": {
      const fp = requireStr(filePath, "filePath");
      const output = requireStr(args.output as string | undefined, "output");
      return spriteExportCmd(root, fp, output);
    }
    case "picomcp_sprite_import": {
      const fp = requireStr(filePath, "filePath");
      const input = requireStr(args.input as string | undefined, "input");
      return spriteImportCmd(root, fp, input);
    }
    case "picomcp_map_get_region": {
      const fp = requireStr(filePath, "filePath");
      const x = requireNum(args.x, "x") - 1;
      const y = requireNum(args.y, "y") - 1;
      const w = requireNum(args.width, "width");
      const h = requireNum(args.height, "height");
      return getMapRegionCmd(root, fp, x, y, w, h);
    }
    case "picomcp_map_set_region": {
      const fp = requireStr(filePath, "filePath");
      const x = requireNum(args.x, "x") - 1;
      const y = requireNum(args.y, "y") - 1;
      const valuesStr = requireStr(args.values as string | undefined, "values");
      let values: number[][];
      try {
        values = JSON.parse(valuesStr) as typeof values;
      } catch {
        throw new Error("values must be valid JSON 2D array of tile indices");
      }
      return setMapRegionCmd(root, fp, x, y, values);
    }
    case "picomcp_sfx_list": {
      const fp = requireStr(filePath, "filePath");
      return listSfxCmd(root, fp);
    }
    case "picomcp_ref_api":
      return refApi();
    case "picomcp_ref_pitfalls":
      return refPitfalls();
    case "picomcp_sprite_fill": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      const color = requireNum(args.color, "color");
      if (color < 0 || color > 15) throw new Error("color must be 0-15");
      return fillSpriteCmd(root, fp, index, color);
    }
    case "picomcp_sprite_fill_range": {
      const fp = requireStr(filePath, "filePath");
      const start = requireNum(args.start, "start") - 1;
      const end = requireNum(args.end, "end") - 1;
      const colorsStr = requireStr(args.colors as string | undefined, "colors");
      const colors = colorsStr.split(",").map((s) => {
        const n = parseInt(s.trim(), 10);
        if (!Number.isInteger(n) || n < 0 || n > 15)
          throw new Error(`Color "${s.trim()}" must be 0-15`);
        return n;
      });
      return fillSpriteRangeCmd(root, fp, start, end, colors);
    }
    case "picomcp_sprite_copy": {
      const fp = requireStr(filePath, "filePath");
      const from = requireNum(args.from, "from") - 1;
      const to = requireNum(args.to, "to") - 1;
      return copySpriteCmd(root, fp, from, to);
    }
    case "picomcp_sprite_mirror": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      const horizontal = Boolean(args.horizontal);
      const vertical = Boolean(args.vertical);
      return mirrorSpriteCmd(root, fp, index, horizontal, vertical);
    }
    case "picomcp_sprite_draw_rect": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      const x = requireNum(args.x, "x");
      const y = requireNum(args.y, "y");
      const w = requireNum(args.width, "width");
      const h = requireNum(args.height, "height");
      const color = requireNum(args.color, "color");
      if (color < 0 || color > 15) throw new Error("color must be 0-15");
      const stroke = Boolean(args.stroke);
      return drawSpriteRectCmd(root, fp, index, x, y, w, h, color, !stroke);
    }
    case "picomcp_sprite_draw_circle": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      const cx = requireNum(args.cx, "cx");
      const cy = requireNum(args.cy, "cy");
      const radius = requireNum(args.radius, "radius");
      const color = requireNum(args.color, "color");
      if (color < 0 || color > 15) throw new Error("color must be 0-15");
      const stroke = Boolean(args.stroke);
      return drawSpriteCircleCmd(root, fp, index, cx, cy, radius, color, !stroke);
    }
    case "picomcp_sprite_draw_line": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      const x1 = requireNum(args.x1, "x1");
      const y1 = requireNum(args.y1, "y1");
      const x2 = requireNum(args.x2, "x2");
      const y2 = requireNum(args.y2, "y2");
      const color = requireNum(args.color, "color");
      if (color < 0 || color > 15) throw new Error("color must be 0-15");
      return drawSpriteLineCmd(root, fp, index, x1, y1, x2, y2, color);
    }
    case "picomcp_sprite_preview": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      const ansi = Boolean(args.ansi);
      return previewSpriteCmd(root, fp, index, ansi);
    }
    case "picomcp_map_fill": {
      const fp = requireStr(filePath, "filePath");
      const x = requireNum(args.x, "x") - 1;
      const y = requireNum(args.y, "y") - 1;
      const w = requireNum(args.width, "width");
      const h = requireNum(args.height, "height");
      const tile = requireNum(args.tile, "tile");
      if (tile > 256) throw new Error("tile must be 1-256");
      return fillMapRectCmd(root, fp, x, y, w, h, tile - 1);
    }
    case "picomcp_map_draw_line": {
      const fp = requireStr(filePath, "filePath");
      const x1 = requireNum(args.x1, "x1") - 1;
      const y1 = requireNum(args.y1, "y1") - 1;
      const x2 = requireNum(args.x2, "x2") - 1;
      const y2 = requireNum(args.y2, "y2") - 1;
      const tile = requireNum(args.tile, "tile");
      if (tile > 256) throw new Error("tile must be 1-256");
      const lineWidth = requireNum(args.width ?? 1, "width");
      return drawMapLineCmd(root, fp, x1, y1, x2, y2, tile - 1, lineWidth);
    }
    case "picomcp_map_draw_circle": {
      const fp = requireStr(filePath, "filePath");
      const cx = requireNum(args.cx, "cx") - 1;
      const cy = requireNum(args.cy, "cy") - 1;
      const radius = requireNum(args.radius, "radius");
      const tile = requireNum(args.tile, "tile");
      if (tile > 256) throw new Error("tile must be 1-256");
      return fillMapCircleCmd(root, fp, cx, cy, radius, tile - 1);
    }
    case "picomcp_sfx_tone": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      const notesStr = requireStr(args.notes as string | undefined, "notes");
      const instr = (args.instr as number | undefined) ?? 0;
      const vol = (args.vol as number | undefined) ?? 4;
      const fx = (args.fx as number | undefined) ?? 0;
      const speed = (args.speed as number | undefined) ?? 8;
      return setSfxToneCmd(root, fp, index, notesStr, instr, vol, fx, speed);
    }
    case "picomcp_edit_insert": {
      const fp = requireStr(filePath, "filePath");
      const at = requireNum(args.at, "at");
      const code = requireStr(args.code as string | undefined, "code");
      return editInsertCmd(root, fp, at, code);
    }
    case "picomcp_edit_delete": {
      const fp = requireStr(filePath, "filePath");
      const from = requireNum(args.from, "from");
      const to = requireNum(args.to, "to");
      return editDeleteCmd(root, fp, from, to);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function requireStr(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requireNum(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value))
    throw new Error(`${name} must be an integer`);
  return value;
}

function parseRequestBody(line: string): JsonRpcRequest | null {
  try {
    const parsed = JSON.parse(line) as JsonRpcRequest;
    if (parsed.jsonrpc !== "2.0") return null;
    if (!parsed.method) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function startMcpServer(): Promise<void> {
  let root = "";

  process.stdin.setEncoding("utf-8");

  const rl = createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    const request = parseRequestBody(line);
    if (!request) continue;

    try {
      switch (request.method) {
        case "initialize": {
          const initResult = {
            protocolVersion: "2024-11-05",
            serverInfo: SERVER_INFO,
            capabilities: { tools: {} },
          };
          send(reply(request.id, initResult));
          break;
        }
        case "notifications/initialized":
          break;
        case "tools/list": {
          send(reply(request.id, { tools: MCP_TOOLS }));
          break;
        }
        case "tools/call": {
          const params = request.params as
            | { name?: string; arguments?: Record<string, unknown> }
            | undefined;
          const toolName = params?.name;
          const toolArgs = params?.arguments ?? {};

          if (!toolName) {
            send(errorReply(request.id, -32602, "Missing tool name"));
            break;
          }

          const tool = findTool(toolName);
          if (!tool) {
            send(errorReply(request.id, -32601, `Unknown tool: ${toolName}`));
            break;
          }

          const schemaError = validateSchema(toolArgs, tool.inputSchema);
          if (schemaError) {
            send(errorReply(request.id, -32602, schemaError));
            break;
          }

          const limitError = validateLimits(toolName, toolArgs);
          if (limitError) {
            send(errorReply(request.id, -32602, limitError));
            break;
          }

          try {
            if (!root) {
              root = await resolveProjectRoot({ allowMissing: true });
            }
            const result = await callTool(toolName, toolArgs, root);
            send(
              reply(request.id, {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
              }),
            );
          } catch (error: unknown) {
            if (error instanceof ProjectBoundaryError) {
              send(errorReply(request.id, -32602, error.message));
            } else {
              const message = error instanceof Error ? error.message : String(error);
              send(errorReply(request.id, -32603, message));
            }
          }
          break;
        }
        default:
          send(errorReply(request.id, -32601, `Method not found: ${request.method}`));
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      send(errorReply(request.id, -32603, message));
    }
  }
}
