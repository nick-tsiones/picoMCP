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
];
