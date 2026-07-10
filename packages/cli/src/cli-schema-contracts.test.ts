import { describe, expect, it } from "vite-plus/test";
import {
  ASSIGNMENT_ROLES,
  BLOCKER_TYPES,
  PRIORITIES,
  VERIFICATION_TYPES,
  WAVE_KINDS,
} from "./enums.js";
import {
  assignmentSchema,
  auditReportSchema,
  blockerReportSchema,
  completionReportSchema,
  externalCiSchema,
  findingImportSchema,
  milestoneSchema,
  specSchema,
  unblockReportSchema,
  validateAssignmentReport,
  validateAuditReport,
  validateBlockerReport,
  validateCompletionReport,
  validateUnblockReport,
  validateVerificationReport,
  verificationSchema,
  waveSchema,
} from "./schemas.js";

describe("CLI schema contracts", () => {
  it("publishes exact JSON schema contracts", () => {
    expect(auditReportSchema()).toEqual({
      type: "object",
      required: [
        "nodeId",
        "acceptanceReviewed",
        "verificationEvidence",
        "realWorldValidation",
        "findings",
      ],
      properties: {
        nodeId: { type: "string" },
        node_id: { type: "string" },
        acceptanceReviewed: {
          type: "array",
          items: expect.objectContaining({ required: ["criterion", "status", "evidence"] }),
        },
        verificationEvidence: {
          type: "object",
          required: ["diffReviewed", "completionReportReviewed", "verificationEvidenceReviewed"],
          properties: {
            diffReviewed: { type: "boolean" },
            completionReportReviewed: { type: "boolean" },
            verificationEvidenceReviewed: { type: "boolean" },
          },
        },
        realWorldValidation: {
          type: "object",
          required: ["required", "status", "evidence"],
          properties: {
            required: { type: "boolean" },
            status: { enum: ["passed", "not_required", "failed", "blocked"] },
            evidence: { type: "string" },
            reason: { type: "string" },
          },
        },
        findings: {
          type: "array",
          items: {
            type: "object",
            required: ["severity", "title", "evidence", "observed", "expected", "classification"],
            properties: {
              severity: { enum: PRIORITIES },
              title: { type: "string" },
              evidence: { type: "string" },
              observed: { type: "string" },
              path: { type: "string" },
              line: { type: "number" },
              expected: { type: "string" },
              acceptanceCriterion: { type: "string" },
              reproduction: { type: "string" },
              classification: {
                enum: [
                  "implementation",
                  "spec-gap",
                  "research-gap",
                  "environment",
                  "credential",
                  "provider",
                  "data",
                  "policy",
                  "regression",
                ],
              },
              suggested_fix: { type: "string" },
              suggestedFix: { type: "string" },
            },
          },
        },
      },
    });
    const auditSchema = auditReportSchema() as {
      properties: { findings: { items: Record<string, unknown> } };
    };
    expect(findingImportSchema()).toEqual(auditSchema.properties.findings.items);
    expect(completionReportSchema()).toEqual({
      type: "object",
      required: [
        "nodeId",
        "summary",
        "changedFiles",
        "acceptanceEvidence",
        "commandsRun",
        "evidence",
        "realWorldValidation",
        "unverifiedItems",
        "dagChangesNeeded",
      ],
      properties: {
        nodeId: { type: "string" },
        node_id: { type: "string" },
        summary: { type: "string" },
        changedFiles: { type: "array", items: { type: "string" } },
        commits: { type: "array", items: { type: "string" } },
        acceptanceEvidence: {
          type: "array",
          items: {
            type: "object",
            required: ["criterion", "status", "evidence"],
            properties: {
              criterion: { type: "string" },
              status: { enum: ["passed", "failed"] },
              evidence: { type: "string" },
            },
          },
        },
        commandsRun: {
          type: "array",
          items: {
            type: "object",
            required: ["command", "status", "evidence"],
            properties: {
              command: { type: "string" },
              status: { enum: ["passed", "failed"] },
              evidence: { type: "string" },
            },
          },
        },
        evidence: { type: "array", items: { type: "string" } },
        realWorldValidation: {
          type: "object",
          required: ["required", "status", "evidence"],
          properties: {
            required: { type: "boolean" },
            status: { enum: ["passed", "not_required"] },
            evidence: { type: "string" },
          },
        },
        unverifiedItems: { type: "array", items: { type: "string" } },
        dagChangesNeeded: { type: "array", items: { type: "string" } },
      },
    });
    expect(blockerReportSchema()).toEqual({
      type: "object",
      required: ["nodeId", "type", "reason", "owner", "needed", "evidence"],
      properties: {
        nodeId: { type: "string" },
        node_id: { type: "string" },
        type: { enum: BLOCKER_TYPES },
        reason: { type: "string" },
        owner: { type: "string" },
        needed: { type: "string" },
        evidence: { type: "string" },
      },
    });
    expect(unblockReportSchema()).toEqual({
      type: "object",
      required: ["nodeId", "summary", "evidence"],
      properties: {
        nodeId: { type: "string" },
        node_id: { type: "string" },
        summary: { type: "string" },
        evidence: { type: "string" },
        fromRun: { type: "string" },
        from_run: { type: "string" },
      },
    });
    expect(specSchema()).toEqual({
      type: "object",
      required: ["objective", "acceptance", "verification", "requiredEvidence"],
      properties: {
        objective: { type: "string" },
        nonGoals: { type: "array", items: { type: "string" } },
        acceptance: { type: "array", items: { type: "string" } },
        verification: { type: "array", items: verificationSchema() },
        realWorldDependencies: { type: "array", items: { type: "string" } },
        environmentRequirements: { type: "array", items: { type: "string" } },
        requiredEvidence: { type: "array", items: { type: "string" } },
        auditFocus: { type: "array", items: { type: "string" } },
        assumptions: { type: "array", items: { type: "string" } },
        rollbackOrRecovery: { type: "string" },
      },
    });
    expect(milestoneSchema()).toEqual({
      type: "object",
      required: ["name", "rank", "capability", "entryCriteria", "exitCriteria"],
      properties: {
        name: { type: "string" },
        rank: { type: "number" },
        capability: { type: "string" },
        entryCriteria: { type: "array", items: { type: "string" } },
        exitCriteria: { type: "array", items: { type: "string" } },
        requiredValidationNodes: { type: "array", items: { type: "string" } },
        realWorldDemo: { type: "string" },
        nonGoals: { type: "array", items: { type: "string" } },
      },
    });
    expect(assignmentSchema()).toEqual({
      type: "object",
      required: ["nodeId", "role", "owner"],
      properties: {
        nodeId: { type: "string" },
        role: { enum: ASSIGNMENT_ROLES },
        owner: { type: "string" },
        branch: { type: "string" },
        worktreePath: { type: "string" },
        scope: { type: "string" },
      },
    });
    expect(verificationSchema()).toEqual({
      type: "object",
      required: ["type", "value"],
      properties: { type: { enum: VERIFICATION_TYPES }, value: { type: "string" } },
    });
    expect(externalCiSchema()).toEqual({
      type: "object",
      required: ["nodeId", "status", "summary"],
      properties: {
        nodeId: { type: "string" },
        status: { enum: ["passed", "failed"] },
        summary: { type: "string" },
        provider: { type: "string" },
        externalId: { type: "string" },
        url: { type: "string" },
        gitSha: { type: "string" },
      },
    });
    expect(waveSchema()).toEqual({
      type: "object",
      required: ["kind", "summary"],
      properties: {
        kind: { enum: WAVE_KINDS },
        summary: { type: "string" },
        nodes: { type: "array", items: { type: "string" } },
        assignments: { type: "array", items: { type: "string" } },
      },
    });
  });

  it("validates structured report inputs loudly", () => {
    expect(
      validateAuditReport({
        nodeId: "a",
        acceptanceReviewed: [
          { criterion: "Feature works", status: "passed", evidence: "reports/audit.md" },
        ],
        verificationEvidence: {
          diffReviewed: true,
          completionReportReviewed: true,
          verificationEvidenceReviewed: true,
        },
        realWorldValidation: {
          required: true,
          status: "passed",
          evidence: "reports/live-api.md",
        },
        findings: [
          {
            severity: "P1",
            title: "Bug",
            evidence: "Observed failure.",
            observed: "It failed.",
            expected: "It works.",
            classification: "implementation",
          },
        ],
      }),
    ).toEqual({ ok: true, findings: 1, realWorldValidation: "passed" });
    expect(() =>
      validateAuditReport({
        nodeId: "a",
        acceptanceReviewed: [{ criterion: "x", status: "passed", evidence: "x" }],
        verificationEvidence: {
          diffReviewed: true,
          completionReportReviewed: true,
          verificationEvidenceReviewed: true,
        },
        realWorldValidation: { required: false, status: "not_required", evidence: "n/a" },
        findings: "none",
      }),
    ).toThrow(/findings must be an array/);
    expect(() =>
      validateAuditReport({
        nodeId: "a",
        acceptanceReviewed: [{ criterion: "x", status: "passed", evidence: "x" }],
        verificationEvidence: {
          diffReviewed: true,
          completionReportReviewed: true,
          verificationEvidenceReviewed: true,
        },
        realWorldValidation: { required: false, status: "not_required", evidence: "n/a" },
        findings: [{ severity: "P9", title: "Bug", evidence: "x" }],
      }),
    ).toThrow(/severity/);

    expect(
      validateCompletionReport({
        nodeId: "a",
        summary: "Ready for audit.",
        changedFiles: [],
        commits: ["abc1234"],
        acceptanceEvidence: [{ criterion: "Feature works", status: "failed", evidence: "log" }],
        commandsRun: [{ command: "just test", status: "failed", evidence: "log" }],
        evidence: ["reports/completion.md"],
        realWorldValidation: { required: false, status: "not_required", evidence: "docs-only" },
        unverifiedItems: [],
        dagChangesNeeded: [],
      }),
    ).toEqual({ ok: true, summary: "Ready for audit." });
    expect(() =>
      validateCompletionReport({
        nodeId: "a",
        summary: "Missing change evidence.",
        changedFiles: [],
        acceptanceEvidence: [{ criterion: "Feature works", status: "passed", evidence: "log" }],
        commandsRun: [{ command: "just test", status: "passed", evidence: "log" }],
        evidence: ["reports/completion.md"],
        realWorldValidation: { required: false, status: "not_required", evidence: "docs-only" },
        unverifiedItems: [],
        dagChangesNeeded: [],
      }),
    ).toThrow(/changedFiles or commits/);
    expect(() =>
      validateCompletionReport({
        nodeId: "a",
        summary: "Bad acceptance status.",
        changedFiles: ["src/a.ts"],
        acceptanceEvidence: [{ criterion: "Feature works", status: "unknown", evidence: "log" }],
        commandsRun: [{ command: "just test", status: "passed", evidence: "log" }],
        evidence: ["reports/completion.md"],
        realWorldValidation: { required: false, status: "not_required", evidence: "docs-only" },
        unverifiedItems: [],
        dagChangesNeeded: [],
      }),
    ).toThrow(/acceptanceEvidence.*status/);
    expect(() =>
      validateCompletionReport({
        nodeId: "a",
        summary: "Bad command status.",
        changedFiles: ["src/a.ts"],
        acceptanceEvidence: [{ criterion: "Feature works", status: "passed", evidence: "log" }],
        commandsRun: [{ command: "just test", status: "unknown", evidence: "log" }],
        evidence: ["reports/completion.md"],
        realWorldValidation: { required: false, status: "not_required", evidence: "docs-only" },
        unverifiedItems: [],
        dagChangesNeeded: [],
      }),
    ).toThrow(/commandsRun.*status/);
    expect(() =>
      validateCompletionReport({
        nodeId: "a",
        summary: "Missing artifact.",
        changedFiles: ["src/a.ts"],
        acceptanceEvidence: [{ criterion: "Feature works", status: "passed", evidence: "log" }],
        commandsRun: [{ command: "just test", status: "passed", evidence: "log" }],
        evidence: [],
        realWorldValidation: { required: false, status: "not_required", evidence: "docs-only" },
        unverifiedItems: [],
        dagChangesNeeded: [],
      }),
    ).toThrow(/evidence must include at least one artifact/);
    expect(() =>
      validateCompletionReport({
        nodeId: "a",
        summary: "Contradictory real validation.",
        changedFiles: ["src/a.ts"],
        acceptanceEvidence: [{ criterion: "Feature works", status: "passed", evidence: "log" }],
        commandsRun: [{ command: "just test", status: "passed", evidence: "log" }],
        evidence: ["reports/completion.md"],
        realWorldValidation: { required: true, status: "not_required", evidence: "n/a" },
        unverifiedItems: [],
        dagChangesNeeded: [],
      }),
    ).toThrow(/cannot be not_required/);
    expect(() =>
      validateCompletionReport({
        nodeId: "a",
        summary: "Incomplete.",
        changedFiles: ["src/a.ts"],
        acceptanceEvidence: [{ criterion: "Feature works", status: "passed", evidence: "log" }],
        commandsRun: [{ command: "just test", status: "passed", evidence: "log" }],
        evidence: ["reports/completion.md"],
        realWorldValidation: { required: true, status: "passed", evidence: "live smoke" },
        unverifiedItems: ["API response not checked"],
        dagChangesNeeded: [],
      }),
    ).toThrow(/unverifiedItems/);

    expect(
      validateBlockerReport({
        nodeId: "a",
        type: "credential",
        reason: "API key expired.",
        owner: "dev",
        needed: "Refresh key.",
        evidence: "logs/401.log",
      }),
    ).toEqual({ ok: true });
    expect(() =>
      validateBlockerReport({ nodeId: "a", type: "soft", reason: "x", owner: "o", needed: "n" }),
    ).toThrow(/blocker report.type/);
    expect(
      validateUnblockReport({
        nodeId: "a",
        summary: "Key refreshed.",
        evidence: "reports/live-api.md",
      }),
    ).toEqual({ ok: true });
    expect(() => validateUnblockReport({ nodeId: "a", summary: "ok" })).toThrow(
      /evidence is required/,
    );

    expect(validateAssignmentReport({ node_id: "a", role: "worker", owner: "agent" })).toEqual({
      ok: true,
    });
    expect(() => validateAssignmentReport({ nodeId: "a", role: "bad", owner: "agent" })).toThrow(
      /role/,
    );
    expect(() => validateAssignmentReport({ nodeId: "a", role: "worker" })).toThrow(
      /owner is required/,
    );

    expect(validateVerificationReport({ nodeId: "a", status: "passed" })).toEqual({ ok: true });
    expect(validateVerificationReport({ node_id: "a", status: "failed" })).toEqual({ ok: true });
    expect(() => validateVerificationReport({ nodeId: "a", status: "skipped" })).toThrow(
      /passed or failed/,
    );
  });
});
