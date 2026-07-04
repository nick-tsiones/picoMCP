import { beforeEach, describe, expect, it } from "vite-plus/test";
import { installCliFixture, qd, qdJson, qdJsonAllowExit, root } from "./cli-e2e-fixtures.js";

installCliFixture();

describe("toolbox contract", () => {
  beforeEach(async () => {
    await qd("setup", "--no-hooks");
  });

  // Behavior: toolbox-contract/the-toolbox-reports-its-capabilities
  it("reports available capabilities and commands", async () => {
    const result = await qdJson("toolbox", "capabilities", "--json");

    expect(result.capabilities).toBeDefined();
    expect(result.capabilities.static).toBeDefined();
    expect(Array.isArray(result.capabilities.static)).toBe(true);
    expect(result.capabilities.runtime).toBeDefined();
    expect(Array.isArray(result.capabilities.runtime)).toBe(true);

    expect(result.commands).toBeDefined();
    expect(Array.isArray(result.commands)).toBe(true);
    expect(result.commands.length).toBeGreaterThan(0);

    // Verify each command has a command and description
    for (const cmd of result.commands) {
      expect(typeof cmd.command).toBe("string");
      expect(typeof cmd.description).toBe("string");
    }

    // Key commands should be present
    const commandNames = result.commands.map((c: { command: string }) => c.command);
    expect(commandNames).toContain("cart overview");
    expect(commandNames).toContain("cart write");
    expect(commandNames).toContain("cart edit range");
    expect(commandNames).toContain("cart edit replace");
    expect(commandNames).toContain("cart edit append");
    expect(commandNames).toContain("toolbox capabilities");
  });

  // Also test: toolbox without subcommand shows capabilities (default)
  it("shows capabilities when no subcommand is given", async () => {
    const result = await qdJson("toolbox", "--json");

    expect(result.capabilities).toBeDefined();
    expect(result.commands).toBeDefined();
  });

  // Behavior: toolbox-contract/commands-outside-the-contract-are-refused
  it("refuses unknown toolbox commands with a consistent error shape", async () => {
    const result = await qdJsonAllowExit("toolbox", "nonexistent_command", "--json");

    expect(result.json.error).toBeDefined();
    expect(result.json.message).toBeDefined();
    expect(result.json.error).toContain("nonexistent_command");
    expect(result.json.error).toContain("not a toolbox command");
  });

  // Behavior: toolbox-contract/errors-are-reported-in-a-consistent-shape
  it("reports errors with both error and message keys", async () => {
    // Test with a cart command that will error (nonexistent cartridge)
    const result = await qdJsonAllowExit("cart", "size", "/nonexistent/path/cart.p8", "--json");

    expect(result.json.error).toBeDefined();
    expect(result.json.message).toBeDefined();
    expect(typeof result.json.error).toBe("string");
    expect(typeof result.json.message).toBe("string");
  });

  // Verify that unmatched cart replace also uses consistent error shape
  it("cart edit replace reports nothing matched with consistent error shape", async () => {
    const { writeFile } = await import("node:fs/promises");
    const path = await import("node:path");

    // Create a simple cartridge in the project root
    const cartPath = path.default.join(root, "simple.p8");
    const content = `pico-8 cartridge // http://www.pico-8.com
version 42
__lua__
print("hello world")
__gfx__
__gff__
__map__
__sfx__
__music__
`;
    await writeFile(cartPath, content);

    const result = await qdJson(
      "cart",
      "edit",
      "replace",
      cartPath,
      "--find",
      "ZZZ_NONEXISTENT_ZZZ",
      "--replace",
      "foo",
      "--json",
    );

    expect(result.error).toBe("nothing matched");
    expect(result.message).toBeDefined();
  });
});
