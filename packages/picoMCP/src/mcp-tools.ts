export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const MCP_TOOLS: McpTool[] = [
  {
    name: "picomcp_read",
    description:
      "Read an overview of a PICO-8 cartridge including code, tab count, token count, and asset summary",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the .p8 or .p8.png cartridge file" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_read_tab",
    description: "Read a single code tab from a PICO-8 cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        tab: { type: "number", description: "Tab index (1-based)" },
      },
      required: ["filePath", "tab"],
    },
  },
  {
    name: "picomcp_write",
    description:
      "Write code to a PICO-8 cartridge tab, creating the cartridge if it does not exist",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        code: { type: "string", description: "Lua code to write" },
        tab: { type: "number", description: "Target tab index (1-based, default: 1)" },
      },
      required: ["filePath", "code"],
    },
  },
  {
    name: "picomcp_parse",
    description: "Parse and validate PICO-8 cartridge code syntax",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_lint",
    description: "Lint PICO-8 cartridge code for common issues",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_size",
    description: "Report cartridge size against PICO-8 limits",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_run",
    description: "Run a PICO-8 cartridge headlessly and return output",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        pico8: { type: "string", description: "Path to PICO-8 binary (optional)" },
        frames: { type: "number", description: "Number of frames to run (default: 30)" },
        capture: {
          type: "string",
          description: "Capture mode: none, screen, or gif (default: none)",
        },
        captureAt: { type: "number", description: "Frame to capture at (default: frames)" },
        param: { type: "string", description: "Parameter string to pass to the cartridge" },
        timeoutMs: { type: "number", description: "Timeout in milliseconds (default: 10000)" },
        input: {
          type: "string",
          description:
            "JSON array of {frame, hold} entries for scripted button injection (hold: array of PICO-8 button numbers 0-11)",
        },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_export",
    description: "Export a PICO-8 cartridge as a web build or native binary",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        to: { type: "string", description: "Export format: web or native" },
        pico8: { type: "string", description: "Path to PICO-8 binary (optional)" },
        output: { type: "string", description: "Output path (optional)" },
      },
      required: ["filePath", "to"],
    },
  },
  {
    name: "picomcp_convert",
    description: "Convert between .p8 and .p8.png cartridge formats",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        to: { type: "string", description: "Target format: p8.png or p8" },
        output: { type: "string", description: "Output path (optional)" },
      },
      required: ["filePath", "to"],
    },
  },
  {
    name: "picomcp_flags_get",
    description: "Read all sprite flags from a PICO-8 cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_flags_set",
    description: "Set a single sprite flag on a PICO-8 cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        sprite: { type: "number", description: "Sprite index (1-based, 1-256)" },
        value: { type: "number", description: "Flag value (0-255)" },
      },
      required: ["filePath", "sprite", "value"],
    },
  },
  {
    name: "picomcp_sprite_get",
    description: "Read a sprite as an 8x8 colour grid",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "Sprite index (1-based, 1-256)" },
      },
      required: ["filePath", "index"],
    },
  },
  {
    name: "picomcp_sprite_set",
    description: "Write a sprite from an 8x8 colour grid (64 values, 0-15)",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "Sprite index (1-based, 1-256)" },
        pixels: { type: "string", description: "64 comma-separated values (0-15)" },
      },
      required: ["filePath", "index", "pixels"],
    },
  },
  {
    name: "picomcp_map_get",
    description: "Read a single cell from the cartridge map",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        x: { type: "number", description: "X coordinate (1-based)" },
        y: { type: "number", description: "Y coordinate (1-based)" },
      },
      required: ["filePath", "x", "y"],
    },
  },
  {
    name: "picomcp_map_set",
    description: "Set a single cell on the cartridge map",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        x: { type: "number", description: "X coordinate (1-based)" },
        y: { type: "number", description: "Y coordinate (1-based)" },
        tile: { type: "number", description: "Tile index (1-based, 1-256)" },
      },
      required: ["filePath", "x", "y", "tile"],
    },
  },
  {
    name: "picomcp_sfx_get",
    description: "Read a sound effect from a PICO-8 cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "SFX index (1-based)" },
      },
      required: ["filePath", "index"],
    },
  },
  {
    name: "picomcp_sfx_set",
    description: "Write a sound effect to a PICO-8 cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "SFX index (1-based)" },
        data: { type: "string", description: "JSON with notes, speed, loopStart, loopEnd" },
      },
      required: ["filePath", "index", "data"],
    },
  },
  {
    name: "picomcp_minify",
    description: "Minify PICO-8 cartridge code to save space",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        rename: { type: "boolean", description: "Rename variables for maximum compression" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_edit_range",
    description: "Replace a specific range of lines in a cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        from: { type: "number", description: "Start line (1-based)" },
        to: { type: "number", description: "End line (1-based, inclusive)" },
        code: { type: "string", description: "New code to insert" },
      },
      required: ["filePath", "from", "to", "code"],
    },
  },
  {
    name: "picomcp_edit_replace",
    description: "Find and replace text in a cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        find: { type: "string", description: "Text to find" },
        replace: { type: "string", description: "Replacement text" },
      },
      required: ["filePath", "find", "replace"],
    },
  },
  {
    name: "picomcp_edit_append",
    description: "Append code to the end of a cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        code: { type: "string", description: "Code to append" },
      },
      required: ["filePath", "code"],
    },
  },
  {
    name: "picomcp_flags_bulk",
    description: "Set all sprite flags at once on a PICO-8 cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        pattern: {
          type: "string",
          description: "256 comma-separated values (0-255)",
        },
      },
      required: ["filePath", "pattern"],
    },
  },
  {
    name: "picomcp_sprite_get_range",
    description: "Read a range of sprites from a PICO-8 cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        start: { type: "number", description: "Start sprite index (1-based)" },
        end: { type: "number", description: "End sprite index (1-based)" },
      },
      required: ["filePath", "start", "end"],
    },
  },
  {
    name: "picomcp_sprite_set_range",
    description: "Write a range of sprites to a PICO-8 cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        sprites: {
          type: "string",
          description:
            "JSON array of {index, pixels} where pixels is an array of 64 numbers (0-15)",
        },
      },
      required: ["filePath", "sprites"],
    },
  },
  {
    name: "picomcp_sprite_export",
    description: "Export the sprite sheet as a PNG image",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        output: { type: "string", description: "Output PNG file path" },
      },
      required: ["filePath", "output"],
    },
  },
  {
    name: "picomcp_sprite_import",
    description: "Import a sprite sheet from a PNG image",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        input: { type: "string", description: "Input PNG file path" },
      },
      required: ["filePath", "input"],
    },
  },
  {
    name: "picomcp_map_get_region",
    description: "Read a rectangular region of the cartridge map",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        x: { type: "number", description: "X coordinate (1-based)" },
        y: { type: "number", description: "Y coordinate (1-based)" },
        width: { type: "number", description: "Width in tiles" },
        height: { type: "number", description: "Height in tiles" },
      },
      required: ["filePath", "x", "y", "width", "height"],
    },
  },
  {
    name: "picomcp_map_set_region",
    description: "Write a rectangular region of the cartridge map",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        x: { type: "number", description: "X coordinate (1-based)" },
        y: { type: "number", description: "Y coordinate (1-based)" },
        values: { type: "string", description: "JSON 2D array of tile indices" },
      },
      required: ["filePath", "x", "y", "values"],
    },
  },
  {
    name: "picomcp_sfx_list",
    description: "List all defined sound effects in a PICO-8 cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_ref_api",
    description: "Retrieve the PICO-8 function reference",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "picomcp_ref_pitfalls",
    description: "Retrieve the guide to PICO-8 Lua pitfalls",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "picomcp_init",
    description: "Create a new PICO-8 cartridge with boilerplate _init/_update/_draw code stubs",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path for the new cartridge file" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_check",
    description: "Run parse + lint + size validation on a PICO-8 cartridge in one call",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_write",
    description:
      "Write code to a PICO-8 cartridge tab, creating the cartridge if it does not exist. Supports --code-file for reading from disk.",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        code: { type: "string", description: "Lua code to write" },
        codeFile: { type: "string", description: "Path to a .lua file containing code to write" },
        tab: { type: "number", description: "Target tab index (1-based, default: 1)" },
      },
      required: ["filePath"],
    },
  },
  {
    name: "picomcp_sprite_fill",
    description: "Fill an 8x8 sprite with a solid color (0-15)",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "Sprite index (1-based, 1-256)" },
        color: { type: "number", description: "PICO-8 color index (0-15)" },
      },
      required: ["filePath", "index", "color"],
    },
  },
  {
    name: "picomcp_sprite_fill_range",
    description: "Fill a range of sprites with solid colors",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        start: { type: "number", description: "First sprite index (1-based)" },
        end: { type: "number", description: "Last sprite index (1-based)" },
        colors: { type: "string", description: "Comma-separated color indices (0-15)" },
      },
      required: ["filePath", "start", "end", "colors"],
    },
  },
  {
    name: "picomcp_sprite_copy",
    description: "Copy a sprite from one index to another",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        from: { type: "number", description: "Source sprite index (1-based)" },
        to: { type: "number", description: "Destination sprite index (1-based)" },
      },
      required: ["filePath", "from", "to"],
    },
  },
  {
    name: "picomcp_sprite_mirror",
    description: "Mirror a sprite horizontally and/or vertically",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "Sprite index (1-based, 1-256)" },
        horizontal: { type: "boolean", description: "Mirror horizontally" },
        vertical: { type: "boolean", description: "Mirror vertically" },
      },
      required: ["filePath", "index"],
    },
  },
  {
    name: "picomcp_sprite_draw_rect",
    description: "Draw a filled or outlined rectangle on a sprite",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "Sprite index (1-based, 1-256)" },
        x: { type: "number", description: "X offset (0-based, 0-7)" },
        y: { type: "number", description: "Y offset (0-based, 0-7)" },
        width: { type: "number", description: "Width of rectangle" },
        height: { type: "number", description: "Height of rectangle" },
        color: { type: "number", description: "PICO-8 color index (0-15)" },
        stroke: { type: "boolean", description: "If true, draw outline only" },
      },
      required: ["filePath", "index", "x", "y", "width", "height", "color"],
    },
  },
  {
    name: "picomcp_sprite_draw_circle",
    description: "Draw a filled or outlined circle on a sprite",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "Sprite index (1-based, 1-256)" },
        cx: { type: "number", description: "Center X (0-based, 0-7)" },
        cy: { type: "number", description: "Center Y (0-based, 0-7)" },
        radius: { type: "number", description: "Radius in pixels" },
        color: { type: "number", description: "PICO-8 color index (0-15)" },
        stroke: { type: "boolean", description: "If true, draw outline only" },
      },
      required: ["filePath", "index", "cx", "cy", "radius", "color"],
    },
  },
  {
    name: "picomcp_sprite_draw_line",
    description: "Draw a line on a sprite",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "Sprite index (1-based, 1-256)" },
        x1: { type: "number", description: "Start X (0-based, 0-7)" },
        y1: { type: "number", description: "Start Y (0-based, 0-7)" },
        x2: { type: "number", description: "End X (0-based, 0-7)" },
        y2: { type: "number", description: "End Y (0-based, 0-7)" },
        color: { type: "number", description: "PICO-8 color index (0-15)" },
      },
      required: ["filePath", "index", "x1", "y1", "x2", "y2", "color"],
    },
  },
  {
    name: "picomcp_sprite_preview",
    description: "Get an ASCII-art preview of a sprite",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "Sprite index (1-based, 1-256)" },
        ansi: { type: "boolean", description: "Use ANSI color codes for terminal preview" },
      },
      required: ["filePath", "index"],
    },
  },
  {
    name: "picomcp_map_fill",
    description: "Fill a rectangular region of the map with a single tile value",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        x: { type: "number", description: "X coordinate (1-based, 1-128)" },
        y: { type: "number", description: "Y coordinate (1-based, 1-64)" },
        width: { type: "number", description: "Width of region" },
        height: { type: "number", description: "Height of region" },
        tile: { type: "number", description: "Tile value (1-based, 1-256)" },
      },
      required: ["filePath", "x", "y", "width", "height", "tile"],
    },
  },
  {
    name: "picomcp_map_draw_line",
    description: "Draw a line of tiles on the map",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        x1: { type: "number", description: "Start X (1-based, 1-128)" },
        y1: { type: "number", description: "Start Y (1-based, 1-64)" },
        x2: { type: "number", description: "End X (1-based, 1-128)" },
        y2: { type: "number", description: "End Y (1-based, 1-64)" },
        tile: { type: "number", description: "Tile value (1-based, 1-256)" },
        width: { type: "number", description: "Line width in tiles" },
      },
      required: ["filePath", "x1", "y1", "x2", "y2", "tile"],
    },
  },
  {
    name: "picomcp_map_draw_circle",
    description: "Draw a filled circle of tiles on the map",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        cx: { type: "number", description: "Center X (1-based, 1-128)" },
        cy: { type: "number", description: "Center Y (1-based, 1-64)" },
        radius: { type: "number", description: "Radius in tiles" },
        tile: { type: "number", description: "Tile value (1-based, 1-256)" },
      },
      required: ["filePath", "cx", "cy", "radius", "tile"],
    },
  },
  {
    name: "picomcp_sfx_tone",
    description: "Set an SFX using compact musical notation (e.g. C4,E4,G4)",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        index: { type: "number", description: "SFX index (1-based, 1-64)" },
        notes: { type: "string", description: 'Notes in compact notation, e.g. "C4,E4,G4,B4"' },
        instr: { type: "number", description: "Instrument/waveform index (0-15, default: 0)" },
        vol: { type: "number", description: "Volume (0-7, default: 4)" },
        fx: { type: "number", description: "Effect (0-7, default: 0)" },
        speed: { type: "number", description: "Playback speed (default: 8)" },
      },
      required: ["filePath", "index", "notes"],
    },
  },
  {
    name: "picomcp_edit_insert",
    description: "Insert code at a specific line in the cartridge without replacing existing lines",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        at: { type: "number", description: "Line number to insert before (1-based)" },
        code: { type: "string", description: "Lua code to insert" },
      },
      required: ["filePath", "at", "code"],
    },
  },
  {
    name: "picomcp_edit_delete",
    description: "Delete a range of lines from the cartridge",
    inputSchema: {
      type: "object",
      properties: {
        filePath: { type: "string", description: "Path to the cartridge file" },
        from: { type: "number", description: "First line to delete (1-based)" },
        to: { type: "number", description: "Last line to delete (1-based)" },
      },
      required: ["filePath", "from", "to"],
    },
  },
];
