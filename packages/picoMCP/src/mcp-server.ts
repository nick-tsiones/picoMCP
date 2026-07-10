import { createInterface } from "node:readline";
import { MCP_TOOLS, type McpTool } from "./mcp-tools.js";
import {
  bulkSetFlagsCmd,
  convertCartridge,
  editAppendCmd,
  editRangeCmd,
  editReplaceCmd,
  exportCartridge,
  getFlagsCmd,
  getMapCellCmd,
  getMapRegionCmd,
  getSfxCmd,
  getSpriteCmd,
  getSpriteRangeCmd,
  lintCartridge,
  listSfxCmd,
  minifyCartridge,
  parseCartridge,
  readOverview,
  readTab,
  refApi,
  refPitfalls,
  runCartridge,
  setFlagCmd,
  setMapCellCmd,
  setMapRegionCmd,
  setSfxCmd,
  setSpriteCmd,
  setSpriteRangeCmd,
  sizeCartridge,
  spriteExportCmd,
  spriteImportCmd,
  writeCartridge,
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
  if (name === "picoMCP_write") {
    if (typeof args.code === "string" && args.code.length > 65536) {
      return "code exceeds PICO-8 character limit (65536 chars)";
    }
    if (typeof args.tab === "number" && (args.tab < 1 || args.tab > 256)) {
      return "tab must be 1-256";
    }
  }
  if (name === "picoMCP_sprite_set") {
    if (typeof args.pixels === "string") {
      const pixelValues = args.pixels.split(",").map((s) => parseInt(s.trim(), 10));
      for (const v of pixelValues) {
        if (!Number.isInteger(v) || v < 0 || v > 15) {
          return `Pixel value "${v}" must be 0-15`;
        }
      }
    }
  }
  if (name === "picoMCP_run") {
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
    case "picoMCP_read": {
      const fp = requireStr(filePath, "filePath");
      return readOverview(root, fp);
    }
    case "picoMCP_read_tab": {
      const fp = requireStr(filePath, "filePath");
      const tab = requireNum(args.tab, "tab");
      return readTab(root, fp, tab);
    }
    case "picoMCP_write": {
      const fp = requireStr(filePath, "filePath");
      const code = requireStr(args.code as string | undefined, "code");
      const tab = args.tab !== undefined ? requireNum(args.tab, "tab") : 1;
      return writeCartridge(root, fp, code, tab);
    }
    case "picoMCP_parse": {
      const fp = requireStr(filePath, "filePath");
      return parseCartridge(root, fp);
    }
    case "picoMCP_lint": {
      const fp = requireStr(filePath, "filePath");
      return lintCartridge(root, fp);
    }
    case "picoMCP_size": {
      const fp = requireStr(filePath, "filePath");
      return sizeCartridge(root, fp);
    }
    case "picoMCP_run": {
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
      });
    }
    case "picoMCP_export": {
      const fp = requireStr(filePath, "filePath");
      const to = requireStr(args.to as string | undefined, "to");
      if (to !== "web" && to !== "native") throw new Error('--to must be "web" or "native"');
      return exportCartridge(root, fp, {
        binaryPath: args.pico8 as string | undefined,
        format: to,
        outputPath: args.output as string | undefined,
      });
    }
    case "picoMCP_convert": {
      const fp = requireStr(filePath, "filePath");
      const to = requireStr(args.to as string | undefined, "to");
      if (to !== "p8.png" && to !== "p8") throw new Error('--to must be "p8.png" or "p8"');
      return convertCartridge(root, fp, to, args.output as string | undefined);
    }
    case "picoMCP_flags_get": {
      const fp = requireStr(filePath, "filePath");
      return getFlagsCmd(root, fp);
    }
    case "picoMCP_flags_set": {
      const fp = requireStr(filePath, "filePath");
      const sprite = requireNum(args.sprite, "sprite");
      const value = requireNum(args.value, "value");
      return setFlagCmd(root, fp, sprite - 1, value);
    }
    case "picoMCP_sprite_get": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      return getSpriteCmd(root, fp, index);
    }
    case "picoMCP_sprite_set": {
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
    case "picoMCP_map_get": {
      const fp = requireStr(filePath, "filePath");
      const x = requireNum(args.x, "x") - 1;
      const y = requireNum(args.y, "y") - 1;
      return getMapCellCmd(root, fp, x, y);
    }
    case "picoMCP_map_set": {
      const fp = requireStr(filePath, "filePath");
      const x = requireNum(args.x, "x") - 1;
      const y = requireNum(args.y, "y") - 1;
      const tile = requireNum(args.tile, "tile");
      if (tile > 256) throw new Error("tile must be 1-256");
      return setMapCellCmd(root, fp, x, y, tile - 1);
    }
    case "picoMCP_sfx_get": {
      const fp = requireStr(filePath, "filePath");
      const index = requireNum(args.index, "index") - 1;
      return getSfxCmd(root, fp, index);
    }
    case "picoMCP_sfx_set": {
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
    case "picoMCP_minify": {
      const fp = requireStr(filePath, "filePath");
      const rename = Boolean(args.rename);
      return minifyCartridge(root, fp, rename);
    }
    case "picoMCP_edit_range": {
      const fp = requireStr(filePath, "filePath");
      const from = requireNum(args.from, "from");
      const to = requireNum(args.to, "to");
      const code = requireStr(args.code as string | undefined, "code");
      return editRangeCmd(root, fp, from, to, code);
    }
    case "picoMCP_edit_replace": {
      const fp = requireStr(filePath, "filePath");
      const find = requireStr(args.find as string | undefined, "find");
      const replace = requireStr(args.replace as string | undefined, "replace");
      return editReplaceCmd(root, fp, find, replace);
    }
    case "picoMCP_edit_append": {
      const fp = requireStr(filePath, "filePath");
      const code = requireStr(args.code as string | undefined, "code");
      return editAppendCmd(root, fp, code);
    }
    case "picoMCP_flags_bulk": {
      const fp = requireStr(filePath, "filePath");
      const patternStr = requireStr(args.pattern as string | undefined, "pattern");
      const values = patternStr.split(",").map((s) => {
        const n = parseInt(s.trim(), 10);
        if (!Number.isInteger(n)) throw new Error(`Invalid flag value: "${s.trim()}"`);
        return n;
      });
      return bulkSetFlagsCmd(root, fp, values);
    }
    case "picoMCP_sprite_get_range": {
      const fp = requireStr(filePath, "filePath");
      const start = requireNum(args.start, "start") - 1;
      const end = requireNum(args.end, "end") - 1;
      return getSpriteRangeCmd(root, fp, start, end);
    }
    case "picoMCP_sprite_set_range": {
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
    case "picoMCP_sprite_export": {
      const fp = requireStr(filePath, "filePath");
      const output = requireStr(args.output as string | undefined, "output");
      return spriteExportCmd(root, fp, output);
    }
    case "picoMCP_sprite_import": {
      const fp = requireStr(filePath, "filePath");
      const input = requireStr(args.input as string | undefined, "input");
      return spriteImportCmd(root, fp, input);
    }
    case "picoMCP_map_get_region": {
      const fp = requireStr(filePath, "filePath");
      const x = requireNum(args.x, "x") - 1;
      const y = requireNum(args.y, "y") - 1;
      const w = requireNum(args.width, "width");
      const h = requireNum(args.height, "height");
      return getMapRegionCmd(root, fp, x, y, w, h);
    }
    case "picoMCP_map_set_region": {
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
    case "picoMCP_sfx_list": {
      const fp = requireStr(filePath, "filePath");
      return listSfxCmd(root, fp);
    }
    case "picoMCP_ref_api":
      return refApi();
    case "picoMCP_ref_pitfalls":
      return refPitfalls();
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
