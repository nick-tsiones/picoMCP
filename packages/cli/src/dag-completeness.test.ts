import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import specDag from "../../../roadmap/spec-dag.json" with { type: "json" };
import dagPlan from "../../../roadmap/dag-plan.json" with { type: "json" };

const FLASH_AGENT_NAMES = ["deepseek-v4-flash-implementor", "deepseek-v4-flash-auditor"] as const;

describe("DAG completeness and dependency integrity", () => {
  it("keeps spec and plan aligned for remaining node completeness", () => {
    const specNodes = specDag.nodes as Array<{
      id: string;
      status?: string;
      verification?: unknown[];
      blocked_by?: unknown;
    }>;
    const planNodes = dagPlan.nodes as Array<{
      id: string;
      verification?: unknown[];
      blocked_by?: unknown;
    }>;
    const planIds = new Set(planNodes.map((node) => node.id));

    expect(specNodes.length).toBeGreaterThan(0);
    expect(planNodes.length).toBeGreaterThan(0);
    expect(planIds.size).toBe(planNodes.length);

    for (const node of specNodes) {
      const planned = planNodes.find((candidate) => candidate.id === node.id);
      expect(planned, `missing plan node for ${node.id}`).toBeDefined();
      expect(planned?.verification?.length ?? 0).toBe(node.verification?.length ?? 0);
    }

    const specIds = new Set(specNodes.map((node) => node.id));
    for (const node of planNodes) {
      expect(specIds.has(node.id)).toBe(true);
    }

    const unfinished = specNodes.filter((node) => node.status !== "done");
    expect(unfinished.map((node) => node.id)).toEqual([
      "environment-and-capability-detection",
      "running-a-cartridge-headlessly",
      "exporting-a-distributable",
    ]);
  });

  it("ensures every node dependency resolves to an existing node and no self-cycles exist", () => {
    const nodes = specDag.nodes as Array<{
      id: string;
      blocked_by?: string | null;
      milestone?: string;
    }>;
    const ids = new Set(nodes.map((node) => node.id));

    for (const node of nodes) {
      expect(ids.has(node.id)).toBe(true);
      if (node.blocked_by) {
        if (Array.isArray(node.blocked_by)) {
          for (const dependency of node.blocked_by) {
            expect(ids.has(dependency)).toBe(true);
            expect(dependency).not.toBe(node.id);
          }
        }
      }
    }
  });

  it("routes every develop-batch subagent invocation through DeepSeek V4 Flash", async () => {
    const text = readFileSync(
      new URL("../../../.agents/skills/develop-batch/SKILL.md", import.meta.url),
      "utf8",
    );
    for (const name of FLASH_AGENT_NAMES) {
      expect(text).toContain(name);
    }
    expect(text).toContain("deepseek-v4-flash");
    expect(text).toContain("model: deepseek/deepseek-v4-pro");
    expect(text).toContain("deepseek-v4-flash-implementor");
    expect(text).toContain("deepseek-v4-flash-auditor");
  });
});
