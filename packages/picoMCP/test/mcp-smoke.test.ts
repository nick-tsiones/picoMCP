import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const picoMCPPath = path.resolve(__dirname, "../dist/index.mjs");

function sendRpc(child: ChildProcess, request: object): Promise<object> {
  let buf = "";
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.stdout!.removeListener("data", onData);
      reject(new Error("timeout waiting for MCP response"));
    }, 10000);
    const onData = (chunk: Buffer) => {
      buf += chunk.toString();
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        clearTimeout(timeout);
        child.stdout!.removeListener("data", onData);
        try {
          resolve(JSON.parse(buf.slice(0, nl).trim()));
        } catch {
          reject(new Error(`Failed to parse MCP response: ${buf.slice(0, nl)}`));
        }
      }
    };
    child.stdout!.on("data", onData);
    child.stdin!.write(JSON.stringify(request) + "\n");
  });
}

interface McpResponse {
  result?: { tools?: unknown[]; content?: Array<{ type: string; text: string }>; isError?: boolean };
}

describe("picoMCP MCP server smoke", () => {
  let child: ChildProcess;

  beforeEach(() => {
    child = spawn("node", [picoMCPPath, "serve"], {
      stdio: ["pipe", "pipe", "inherit"],
    });
  });

  afterEach(() => {
    child.kill();
  });

  it("tools/list returns tools", async () => {
    await sendRpc(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", clientInfo: { name: "test" } },
    });
    const result = (await sendRpc(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    })) as McpResponse;
    expect(result.result?.tools).toBeInstanceOf(Array);
    expect(result.result!.tools!.length).toBeGreaterThan(0);
  });

  it("tools/call with picoMCP_read returns content", async () => {
    await sendRpc(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", clientInfo: { name: "test" } },
    });
    const result = (await sendRpc(child, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "picoMCP_read", arguments: { filePath: "nonexistent.p8" } },
    })) as McpResponse;
    expect(result.result?.content).toBeInstanceOf(Array);
    expect(result.result!.content!.length).toBeGreaterThan(0);
  });
});
