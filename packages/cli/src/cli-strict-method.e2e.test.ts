import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import {
  expectQdFailure,
  installCliFixture,
  qd,
  qdJson,
  qdJsonAllowExit,
  root,
} from "./cli-e2e-fixtures.js";

installCliFixture();

describe("qd strict orchestration method", () => {
  it("refuses summary-only completion for implementation nodes", async () => {
    await qd("setup", "--no-hooks");
    await qd(
      "node",
      "add",
      "--id",
      "real-api-node",
      "--title",
      "Real API integration",
      "--spec",
      "Use the verified provider API shape against the configured test endpoint.",
      "--acceptance",
      "A live smoke request succeeds and the response is parsed into the project model.",
      "--verify",
      'type=command,value="node scripts/smoke-provider.mjs"',
    );

    await expectQdFailure(
      /completion report|real validation|evidence|ready for independent audit/i,
      "complete",
      "real-api-node",
      "--summary",
      "Implemented and seems fine.",
    );
    await writeFile(
      path.join(root, "wrong-completion.json"),
      `${JSON.stringify({
        nodeId: "other-node",
        summary: "Wrong node report.",
        changedFiles: ["src/provider.ts"],
        acceptanceEvidence: [
          {
            criterion: "Provider smoke succeeds.",
            status: "passed",
            evidence: "reports/provider-smoke.md",
          },
        ],
        commandsRun: [
          {
            command: "node scripts/smoke-provider.mjs",
            status: "passed",
            evidence: "logs/provider-smoke.log",
          },
        ],
        evidence: ["reports/provider-completion.md"],
        realWorldValidation: {
          required: true,
          status: "passed",
          evidence: "reports/provider-smoke.md",
        },
        unverifiedItems: [],
        dagChangesNeeded: [],
      })}\n`,
      "utf8",
    );
    await expectQdFailure(
      /completion report nodeId other-node does not match real-api-node/,
      "advance",
      "real-api-node",
      "--from-report",
      "wrong-completion.json",
      "--json",
    );
    await expectQdFailure(
      /completion report nodeId other-node does not match real-api-node/,
      "complete",
      "real-api-node",
      "--from-report",
      "wrong-completion.json",
      "--json",
    );
  });

  it("rejects clean audit reports that omit real-world validation evidence", async () => {
    await qd("setup", "--no-hooks");
    await qd(
      "node",
      "add",
      "--id",
      "audit-target",
      "--title",
      "Provider audit target",
      "--spec",
      "Fetch provider data from the real configured endpoint.",
      "--acceptance",
      "The provider endpoint is reached and the observed response shape is handled.",
      "--verify",
      'type=command,value="node scripts/provider-smoke.mjs"',
    );
    const audit = await qdJson("audit", "start", "audit-target", "--json");
    await writeFile(
      path.join(root, "weak-audit-report.json"),
      `${JSON.stringify({ nodeId: "audit-target", findings: [] })}\n`,
      "utf8",
    );

    await expectQdFailure(
      /real-world validation|verification evidence|acceptance.*review/i,
      "audit",
      "validate",
      "weak-audit-report.json",
    );
    await expectQdFailure(
      /real-world validation|verification evidence|acceptance.*review/i,
      "audit",
      "pass",
      "audit-target",
      "--run-id",
      audit.id,
      "--from-report",
      "weak-audit-report.json",
    );
  });

  it("supports structured blocker and unblock escape hatches without returning blocked work as ready", async () => {
    await qd("setup", "--no-hooks");
    await qd(
      "node",
      "add",
      "--id",
      "credential-node",
      "--title",
      "Credential-gated provider smoke",
      "--spec",
      "Call the provider with the project credential.",
      "--acceptance",
      "The credential works against the real provider endpoint.",
    );

    const blocked = await qdJson(
      "block",
      "credential-node",
      "--type",
      "credential",
      "--reason",
      "Local provider API key is expired; live validation cannot run.",
      "--owner",
      "trevor",
      "--needed",
      "Refresh the key and prove GET /v1/accounts succeeds.",
      "--evidence",
      "logs/provider-401.log",
      "--json",
    );
    expect(blocked.node).toMatchObject({
      id: "credential-node",
      status: "blocked",
      blocked_by: "credential",
    });
    expect(await qdJson("ready", "--json")).toEqual([]);
    const gate = await qdJsonAllowExit("gate", "credential-node", "--json");
    expect(gate.exitCode).toBe(1);
    expect(gate.json.explanations).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "nodeBlocked" })]),
    );

    const unblocked = await qdJson(
      "unblock",
      "credential-node",
      "--summary",
      "Credential refreshed and live account lookup succeeded.",
      "--evidence",
      "reports/provider-access-restored.md",
      "--json",
    );
    expect(unblocked.node).toMatchObject({
      id: "credential-node",
      status: "ready",
      blocked_by: null,
      blocked_reason: null,
    });
    await writeFile(
      path.join(root, "blocker-report.json"),
      `${JSON.stringify({
        nodeId: "credential-node",
        type: "provider",
        reason: "Provider test-mode API is returning 503.",
        owner: "provider-support",
        needed: "Provider test-mode API returns a successful health check.",
        evidence: "logs/provider-503.log",
      })}\n`,
      "utf8",
    );
    expect(
      (await qdJson("block", "credential-node", "--from-report", "blocker-report.json", "--json"))
        .node,
    ).toMatchObject({ status: "blocked", blocked_by: "provider" });
    await writeFile(
      path.join(root, "unblock-report.json"),
      `${JSON.stringify({
        nodeId: "credential-node",
        summary: "Provider health check is passing again.",
        evidence: "reports/provider-health-restored.md",
      })}\n`,
      "utf8",
    );
    expect(
      (await qdJson("unblock", "credential-node", "--from-report", "unblock-report.json", "--json"))
        .node,
    ).toMatchObject({ status: "ready", blocked_by: null });
  });

  it("forces the reality contract into help and generated prompts", async () => {
    await qd("setup", "--no-hooks");
    await qd(
      "node",
      "add",
      "--id",
      "prompt-node",
      "--title",
      "Prompt node",
      "--spec",
      "Implement behavior only after source-of-truth research is complete.",
      "--acceptance",
      "The implementation is validated against the real environment.",
    );

    expect(await qd("help", "reality")).toMatch(/Research precedes roadmap|Reality contract/i);
    expect(await qd("help", "specs")).toMatch(/executable contract|acceptance/i);
    expect(await qd("help", "audits")).toMatch(/CI is not an audit|evidence/i);
    expect(await qd("prompt", "plan")).toMatch(/Reality contract|Do not invent/i);
    expect(await qd("prompt", "implement", "prompt-node")).toMatch(
      /Reality contract|Do not invent|real validation/i,
    );
    expect(await qd("prompt", "audit", "prompt-node")).toMatch(
      /Missing evidence.*P1|CI is not an audit|real-world validation/i,
    );
  });

  it("publishes strict method schemas for agent-authored contracts", async () => {
    await qd("setup", "--no-hooks");
    const schemas = await qdJson("schema", "list", "--json");
    expect(schemas).toEqual(
      expect.arrayContaining([
        "spec",
        "milestone",
        "research-report",
        "completion-report",
        "audit-report",
        "finding",
        "blocker",
        "reality-check",
      ]),
    );

    expect(await qdJson("schema", "print", "completion-report", "--json")).toMatchObject({
      type: "object",
      required: expect.arrayContaining([
        "nodeId",
        "acceptanceEvidence",
        "commandsRun",
        "evidence",
        "unverifiedItems",
      ]),
    });
    expect(await qdJson("schema", "print", "audit-report", "--json")).toMatchObject({
      type: "object",
      required: expect.arrayContaining([
        "nodeId",
        "acceptanceReviewed",
        "verificationEvidence",
        "realWorldValidation",
        "findings",
      ]),
    });
    expect(await qdJson("schema", "print", "blocker", "--json")).toMatchObject({
      type: "object",
      required: expect.arrayContaining(["nodeId", "type", "reason", "owner", "needed"]),
    });
  });
});
