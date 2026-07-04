import { detectPico8Capability } from "@cat-cave/qdcli-core";
import { output } from "./args.js";

export async function capabilityCommand(json: boolean): Promise<void> {
  const pico8 = await detectPico8Capability();
  output(
    {
      capabilities: {
        static: [
          "code editing",
          "sprite editing",
          "map editing",
          "sfx editing",
          "flag editing",
          "linting",
          "minification",
          "format conversion",
          "size reporting",
        ],
        runtime: pico8.present ? ["running cartridges", "exporting builds"] : [],
      },
      commands: [
        { command: "cart overview", description: "Read an overview of a cartridge" },
        { command: "cart tab", description: "Read a single tab of code" },
        { command: "cart size", description: "Report cartridge size against PICO-8 limits" },
        { command: "cart parse", description: "Parse and validate cartridge code syntax" },
        { command: "cart write", description: "Write code to a cartridge tab" },
        {
          command: "cart run",
          description: "Check whether a cartridge can run in this environment",
        },
        { command: "cart lint", description: "Lint cartridge code for common issues" },
        { command: "cart convert", description: "Convert between .p8 and .p8.png formats" },
        { command: "cart minify", description: "Minify cartridge code" },
        {
          command: "cart edit range",
          description: "Replace a specific range of lines in a cartridge",
        },
        { command: "cart edit replace", description: "Find and replace text in a cartridge" },
        { command: "cart edit append", description: "Append code to the end of a cartridge" },
        { command: "cart flags get", description: "Read all sprite flags" },
        { command: "cart flags set", description: "Set a single sprite flag" },
        { command: "cart flags bulk", description: "Set all sprite flags at once" },
        { command: "cart sprite get", description: "Read a sprite as an 8x8 colour grid" },
        { command: "cart sprite set", description: "Write a sprite from an 8x8 colour grid" },
        { command: "cart sprite get-range", description: "Read a range of sprites" },
        { command: "cart sprite set-range", description: "Write a range of sprites" },
        { command: "cart sprite export", description: "Export the sprite sheet as a PNG" },
        { command: "cart sprite import", description: "Import a sprite sheet from a PNG" },
        { command: "cart map get", description: "Read a single map cell" },
        { command: "cart map set", description: "Write a single map cell" },
        { command: "cart map get-region", description: "Read a rectangular region of the map" },
        { command: "cart map set-region", description: "Write a rectangular region of the map" },
        { command: "cart sfx get", description: "Read a sound effect" },
        { command: "cart sfx set", description: "Write a sound effect" },
        { command: "cart sfx list", description: "List all defined sound effects" },
        { command: "ref api", description: "Retrieve the PICO-8 function reference" },
        { command: "ref pitfalls", description: "Retrieve the guide to PICO-8 pitfalls" },
        {
          command: "toolbox capabilities",
          description: "Report available toolbox capabilities and commands",
        },
      ],
      runtime: {
        available: pico8.present,
        pico8,
      },
    },
    json,
  );
}
