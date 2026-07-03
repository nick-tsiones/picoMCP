// ── PICO-8 API Reference ────────────────────────────────────────────────────

export interface ApiFunction {
  name: string;
  args: string;
  description: string;
}

export const PICO8_API: ApiFunction[] = [
  // Graphics
  { name: "cls", args: "[col]", description: "Clear screen. col defaults to 0 (black)." },
  { name: "camera", args: "[x y]", description: "Set screen scroll offset. Camera(0,0) resets." },
  { name: "circ", args: "x y r [col]", description: "Draw a circle outline." },
  { name: "circfill", args: "x y r [col]", description: "Draw a filled circle." },
  { name: "clip", args: "[x y w h]", description: "Set screen clipping region. clip() resets." },
  { name: "color", args: "col", description: "Set default drawing color." },
  { name: "cursor", args: "x y [col]", description: "Set cursor position for print()." },
  { name: "fget", args: "n [f]", description: "Get sprite flag f (0-7) for sprite n. Returns all flags if f omitted." },
  { name: "fillp", args: "pat", description: "Set fill pattern (bits 0x0-0xf). Default 0x0 (solid)." },
  { name: "fset", args: "n [f] v", description: "Set sprite flag f (0-7) for sprite n to boolean v." },
  { name: "line", args: "x0 y0 x1 y1 [col]", description: "Draw a line." },
  { name: "map", args: "cel_x cel_y sx sy cel_w cel_h [layer]", description: "Draw a map section starting at cel_x,cel_y on screen at sx,sy." },
  { name: "mget", args: "x y", description: "Get map tile at (x, y)." },
  { name: "mset", args: "x y v", description: "Set map tile at (x, y) to value v." },
  { name: "pal", args: "[c0 c1 [p]]", description: "Swap color c0 to c1. pal() resets. p=0 screen, p=1 draw." },
  { name: "palt", args: "[c t]", description: "Set color c transparency. palt() resets (black transparent)." },
  { name: "pget", args: "x y", description: "Get pixel color at (x, y) on sprite sheet." },
  { name: "print", args: "str [x y [col]]", description: "Print a string. Uses cursor if x,y omitted." },
  { name: "pset", args: "x y [col]", description: "Set pixel at (x, y) on sprite sheet." },
  { name: "rect", args: "x0 y0 x1 y1 [col]", description: "Draw a rectangle outline." },
  { name: "rectfill", args: "x0 y0 x1 y1 [col]", description: "Draw a filled rectangle." },
  { name: "sget", args: "x y", description: "Get pixel color from sprite sheet at (x, y)." },
  { name: "spr", args: "n x y [w h] [flip_x] [flip_y]", description: "Draw sprite n at screen (x,y). w,h in sprites; default 1,1." },
  { name: "sset", args: "x y [col]", description: "Set pixel on sprite sheet at (x, y)." },
  { name: "sspr", args: "sx sy sw sh dx dy [dw dh] [flip_x] [flip_y]", description: "Draw a region from sprite sheet (sx,sy,sw,sh) to screen (dx,dy,dw,dh)." },
  { name: "tline", args: "x0 y0 x1 y1 mx my [mdx mdy]", description: "Draw a textured line with offset (mx,my)." },

  // Input
  { name: "btn", args: "i [p]", description: "Return true if button i held by player p (default 0)." },
  { name: "btnp", args: "i [p]", description: "Return true if button i just pressed (player p)." },
  { name: "key", args: "", description: "Return the key code of the last keyboard key pressed." },
  { name: "keyp", args: "", description: "Return true when a keyboard key is first pressed." },
  { name: "mouse", args: "", description: "Return {x, y, left, middle, right, wheel_x, wheel_y}." },

  // Audio
  { name: "music", args: "[n [fade_len [channel_mask]]]", description: "Play music n (0-63). -1 stops. fade_len in ms." },
  { name: "sfx", args: "n [channel [offset [length]]]", description: "Play SFX n (0-63) on given channel (0-3)." },

  // Math
  { name: "abs", args: "x", description: "Absolute value." },
  { name: "atan2", args: "dx dy", description: "Angle of vector (dx,dy) in radians [0..1)." },
  { name: "band", args: "x y", description: "Bitwise AND." },
  { name: "bnot", args: "x", description: "Bitwise NOT." },
  { name: "bor", args: "x y", description: "Bitwise OR." },
  { name: "bxor", args: "x y", description: "Bitwise XOR." },
  { name: "ceil", args: "x", description: "Round up to nearest integer." },
  { name: "cos", args: "x", description: "Cosine of x (0..1 = 0..2π)." },
  { name: "flr", args: "x", description: "Floor: round down to nearest integer." },
  { name: "max", args: "x y", description: "Maximum of two values." },
  { name: "mid", args: "x y z", description: "Middle value (clamp x between y and z)." },
  { name: "min", args: "x y", description: "Minimum of two values." },
  { name: "rnd", args: "[limit]", description: "Random number. rnd(n) → 0..n-1. rnd() → 0..1." },
  { name: "sgn", args: "x", description: "Sign: -1, 0, or 1." },
  { name: "shl", args: "x bits", description: "Bitwise shift left." },
  { name: "shr", args: "x bits", description: "Bitwise shift right (logical)." },
  { name: "sin", args: "x", description: "Sine of x (0..1 = 0..2π)." },
  { name: "sqrt", args: "x", description: "Square root." },
  { name: "srand", args: "seed", description: "Seed the random number generator." },

  // Tables / Data
  { name: "add", args: "t v [index]", description: "Add v to table t. Append if no index." },
  { name: "all", args: "t", description: "Iterator over all non-nil values in sequence t." },
  { name: "count", args: "t", description: "Count non-nil entries in table t." },
  { name: "del", args: "t v", description: "Remove first occurrence of v from table t." },
  { name: "deli", args: "t i", description: "Remove item at index i from table t." },
  { name: "foreach", args: "t fn", description: "Call fn(v) for each v in table t." },
  { name: "pairs", args: "t", description: "Iterator over all key-value pairs in table t." },

  // Strings
  { name: "sub", args: "str start [end]", description: "Substring from start to end (1-indexed, inclusive)." },
  { name: "split", args: "str [sep]", description: "Split string into table. Default sep=','." },
  { name: "tonum", args: "str", description: "Convert string to number. Returns nil on failure." },
  { name: "tostr", args: "val", description: "Convert any value to string." },
  { name: "chr", args: "n", description: "Character from ordinal n." },
  { name: "ord", args: "str [index]", description: "Ordinal of character at index (default 1)." },

  // Memory / Peek / Poke
  { name: "cstore", args: "addr val", description: "Write a 32-bit value to cartridge ROM. addr in 0x0000-0x0fff." },
  { name: "memcpy", args: "dest src len", description: "Copy len bytes from src address to dest address." },
  { name: "memset", args: "addr val len", description: "Set len bytes at addr to val." },
  { name: "peek", args: "addr [n]", description: "Read byte at addr. n=1,2,4 bytes (default 1)." },
  { name: "peek2", args: "addr", description: "Read 16-bit value at addr." },
  { name: "peek4", args: "addr", description: "Read 32-bit value at addr." },
  { name: "poke", args: "addr val", description: "Write byte val to addr." },
  { name: "poke2", args: "addr val", description: "Write 16-bit val to addr." },
  { name: "poke4", args: "addr val", description: "Write 32-bit val to addr." },
  { name: "reload", args: "dest src len [filename]", description: "Load data from cartridge ROM into memory." },
  { name: "cstore", args: "addr val", description: "Write 32-bit val to cartridge ROM (0x0000-0x0fff)." },

  // Cartridge / System
  { name: "cartdata", args: "id", description: "Open persistent cart data (64 numbers). Must be called once." },
  { name: "dget", args: "index", description: "Read number from cartdata at index (0-63)." },
  { name: "dset", args: "index value", description: "Write number to cartdata at index (0-63)." },
  { name: "extcmd", args: "cmd", description: "Execute special command (screenshot, label, etc)." },
  { name: "flip", args: "", description: "Flip screen buffer (swap). Required after drawing." },
  { name: "load", args: "filename", description: "Load a cartridge by filename." },
  { name: "menuitem", args: "index [label callback]", description: "Add a pause menu item." },
  { name: "printh", args: "str [filename] [overwrite] [save_to_desktop]", description: "Print to host console or file." },
  { name: "run", args: "", description: "Restart the cartridge from _init()." },
  { name: "stat", args: "n", description: "Get system stat: 0=memory, 1=CPU%, 4=clipboard, 6=param, 16-19=SFX info." },
  { name: "time", args: "", description: "Return seconds since cartridge started." },
  { name: "t", args: "", description: "Return fraction of second since cartridge started (0..1)." },

  // Map / Level
  { name: "mapdraw", args: "layer cel_x cel_y sx sy cel_w cel_h [sx2 sy2]", description: "Map draw helper. layer 0=shared, 1=screen." },
  { name: "tilemap_set", args: "map_x map_y sx sy sw sh [layer]", description: "Extended map drawing. layer 0=shared, 1=screen." },
];

// ── Pitfalls ─────────────────────────────────────────────────────────────────

export interface Pitfall {
  title: string;
  problem: string;
  remedy: string;
}

export const PICO8_PITFALLS: Pitfall[] = [
  {
    title: "Forgetting flip() after draw",
    problem: "Graphics are drawn into an off-screen buffer. Without calling flip(), nothing appears on screen.",
    remedy: "Always call flip() at the end of _draw() to swap buffers.",
  },
  {
    title: "Mixed tab indentation in Lua",
    problem: "PICO-8 requires tabs for indentation in the code editor. Mixing spaces and tabs can cause syntax errors or unexpected token counts.",
    remedy: "Use only tabs for indentation. The PICO-8 editor enforces this; external editors do not.",
  },
  {
    title: "Sprite sheet / map memory sharing",
    problem: "The bottom half of the sprite sheet (gfx rows 64-127) shares memory with the bottom half of the map (map rows 32-63). Editing one silently changes the other.",
    remedy: "Be aware of the aliasing. Keep sprites in the top half (0-63) if you need a full 64-row map, or reserve map rows 32-63 for sprite overflow.",
  },
  {
    title: "Token limit (8192 tokens)",
    problem: "PICO-8 cartridges are limited to 8192 tokens (compressed code units). Exceeding this limit prevents the cartridge from running.",
    remedy: "Minify code, use shorter variable names, move data to strings or the map, and use external tools to count tokens during development.",
  },
  {
    title: "Cart RAM (cartdata) 64-number limit",
    problem: "cartdata() only persists 64 numbers (256 bytes). Storing more data requires encoding into fewer slots or using external storage.",
    remedy: "Pack booleans into bits, use one number to store multiple flags, or store strings encoded across multiple slots.",
  },
  {
    title: "Lua arrays are 1-indexed",
    problem: "PICO-8 Lua uses 1-based indexing for tables. Using index 0 returns nil, which can cause subtle bugs.",
    remedy: "Always start array indices at 1. The # operator returns the length based on 1-indexed sequences.",
  },
  {
    title: "No continue statement in Lua",
    problem: "PICO-8's Lua dialect does not support the continue keyword in loops. Using goto for continue-like behavior is error-prone.",
    remedy: "Use if/else blocks or reverse the condition to skip code execution. Avoid goto patterns when possible.",
  },
  {
    title: "Variable scoping is global by default",
    problem: "Variables declared without 'local' are global, which can lead to accidental overwrites and hard-to-debug issues.",
    remedy: "Always declare variables with 'local'. Use _init() to initialize globals explicitly.",
  },
  {
    title: "SFX note encoding confusion",
    problem: "SFX notes encode pitch, instrument, volume, and effect in compact bit fields. Manual editing without understanding the encoding corrupts SFX data.",
    remedy: "Use the PICO-8 SFX editor or a tool that understands the binary format. Each note is 2 bytes: key(6) + instrument(2), volume(3) + effect(3) + custom(2).",
  },
  {
    title: "Color palette indices and transparency",
    problem: "PICO-8 has 16 fixed colors (0-15). Color 0 (black) is transparent by default via palt(). Setting other colors as transparent can cause unexpected drawing behavior.",
    remedy: "Use palt() to control which colors are transparent. palt() with no args resets to default (only black transparent).",
  },
  {
    title: "Screen coordinates are 128x128 but display varies",
    problem: "PICO-8 draws to a 128x128 internal buffer, but display scaling can cause blurring or aspect ratio issues.",
    remedy: "Design for 128x128. Use clip() to restrict drawing regions. Test at 1x and scaled resolutions.",
  },
  {
    title: "String character limit in code",
    problem: "Long strings in PICO-8 code consume many tokens. A string of 100 characters may use 100+ tokens depending on content.",
    remedy: "Store large text blocks as comments or in the map data. Use short string literals and build output programmatically.",
  },
  {
    title: "No bitwise NOT (~) on 32-bit values",
    problem: "PICO-8 numbers are 16.16 fixed point. bnot() works on the lower 16 bits only, which can surprise developers expecting 32-bit behavior.",
    remedy: "Use band() with a mask to limit results to 16 bits. Test bitwise operations with known inputs.",
  },
  {
    title: "Coroutine limits",
    problem: "PICO-8 supports cocreate()/coresume() but only a limited number of coroutines can be active. Hitting the limit causes runtime errors.",
    remedy: "Limit coroutine usage. Reuse coroutines or use update-based patterns instead of yielding.",
  },
  {
    title: "Code reload during dev keeps global state",
    problem: "When you reload a cartridge during development, global variables from the previous run may persist, leading to inconsistent state.",
    remedy: "Initialize all state in _init() and call run() to reset. Be aware that external editors do not always reset state.",
  },
];

// ── Public helpers ───────────────────────────────────────────────────────────

/** Return all API functions as a plain array. */
export function getApiIndex(): ApiFunction[] {
  return PICO8_API;
}

/** Return all pitfalls as a plain array. */
export function getPitfalls(): Pitfall[] {
  return PICO8_PITFALLS;
}