import {
  ASSIGNMENT_ROLES,
  BLOCKER_TYPES,
  PRIORITIES,
  VERIFICATION_TYPES,
  WAVE_KINDS,
  isAssignmentRole,
  isPriority,
  strictEnum,
} from "./enums.js";
import { asRecord, requiredNodeStringField, valueAtPath } from "./object-utils.js";

const acceptanceEvidenceItem = {
  type: "object",
  required: ["criterion", "status", "evidence"],
  properties: {
    criterion: { type: "string" },
    status: { enum: ["passed", "failed"] },
    evidence: { type: "string" },
  },
};

const findingItem = {
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
};

export function auditReportSchema(): Record<string, unknown> {
  return {
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
      acceptanceReviewed: { type: "array", items: acceptanceEvidenceItem },
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
        items: findingItem,
      },
    },
  };
}

export function completionReportSchema(): Record<string, unknown> {
  return {
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
      acceptanceEvidence: { type: "array", items: acceptanceEvidenceItem },
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
  };
}

export function specSchema(): Record<string, unknown> {
  return {
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
  };
}

export function milestoneSchema(): Record<string, unknown> {
  return {
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
  };
}

export function blockerReportSchema(): Record<string, unknown> {
  return {
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
  };
}

export function unblockReportSchema(): Record<string, unknown> {
  return {
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
  };
}

export function findingImportSchema(): Record<string, unknown> {
  return findingItem;
}

export function assignmentSchema(): Record<string, unknown> {
  return {
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
  };
}

export function verificationSchema(): Record<string, unknown> {
  return {
    type: "object",
    required: ["type", "value"],
    properties: {
      type: { enum: VERIFICATION_TYPES },
      value: { type: "string" },
    },
  };
}

export function externalCiSchema(): Record<string, unknown> {
  return {
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
  };
}

export function waveSchema(): Record<string, unknown> {
  return {
    type: "object",
    required: ["kind", "summary"],
    properties: {
      kind: { enum: WAVE_KINDS },
      summary: { type: "string" },
      nodes: { type: "array", items: { type: "string" } },
      assignments: { type: "array", items: { type: "string" } },
    },
  };
}

export function validateAuditReport(value: unknown): {
  ok: true;
  findings: number;
  realWorldValidation: "passed" | "not_required" | "failed" | "blocked";
} {
  const report = asRecord(value, "audit report");
  requiredNodeStringField(report, "nodeId", "audit report", "node_id");
  validateAcceptanceEvidence(
    report.acceptanceReviewed ?? report.acceptanceReview,
    "audit report.acceptanceReviewed",
  );
  const evidenceReview = asRecord(
    report.verificationEvidence ?? report.evidenceReview,
    "audit report.verificationEvidence",
  );
  requireBoolean(evidenceReview.diffReviewed, "audit report.evidenceReview.diffReviewed");
  requireBoolean(
    evidenceReview.completionReportReviewed,
    "audit report.evidenceReview.completionReportReviewed",
  );
  requireBoolean(
    evidenceReview.verificationEvidenceReviewed,
    "audit report.evidenceReview.verificationEvidenceReviewed",
  );
  const realWorldValidation = validateRealWorldValidation(
    report.realWorldValidation,
    "audit report.realWorldValidation",
    ["passed", "not_required", "failed", "blocked"],
  );
  const findings = valueAtPath(report, "findings");
  if (!Array.isArray(findings)) throw new Error("audit report findings must be an array");
  for (const [index, finding] of findings.entries()) {
    const item = asRecord(finding, `findings[${index}]`);
    strictEnum(
      requiredNodeStringField(item, "severity", `findings[${index}]`),
      isPriority,
      "severity",
    );
    requiredNodeStringField(item, "title", `findings[${index}]`);
    requiredNodeStringField(item, "evidence", `findings[${index}]`);
    requiredNodeStringField(item, "observed", `findings[${index}]`);
    requiredNodeStringField(item, "expected", `findings[${index}]`);
    requiredNodeStringField(item, "classification", `findings[${index}]`);
  }
  return { ok: true, findings: findings.length, realWorldValidation };
}

export function validateCompletionReport(value: unknown): { ok: true; summary: string } {
  const report = asRecord(value, "completion report");
  requiredNodeStringField(report, "nodeId", "completion report", "node_id");
  const summary = requiredNodeStringField(report, "summary", "completion report");
  const changedFiles = stringArrayField(report.changedFiles, "completion report.changedFiles");
  const commits =
    report.commits === undefined
      ? []
      : stringArrayField(report.commits, "completion report.commits");
  if (changedFiles.length === 0 && commits.length === 0) {
    throw new Error("completion report requires changedFiles or commits evidence");
  }
  validateAcceptanceEvidence(report.acceptanceEvidence, "completion report.acceptanceEvidence");
  validateCommandEvidence(report.commandsRun, "completion report.commandsRun");
  if (stringArrayField(report.evidence, "completion report.evidence").length === 0) {
    throw new Error("completion report.evidence must include at least one artifact");
  }
  validateRealWorldValidation(report.realWorldValidation, "completion report.realWorldValidation", [
    "passed",
    "not_required",
  ]);
  const unverified = stringArrayField(report.unverifiedItems, "completion report.unverifiedItems");
  if (unverified.length > 0) {
    throw new Error(
      `completion report has unverifiedItems; block or split the node instead: ${unverified.join("; ")}`,
    );
  }
  stringArrayField(report.dagChangesNeeded, "completion report.dagChangesNeeded");
  return { ok: true, summary };
}

export function validateBlockerReport(value: unknown): { ok: true } {
  const report = asRecord(value, "blocker report");
  requiredNodeStringField(report, "nodeId", "blocker report", "node_id");
  const type = requiredNodeStringField(report, "type", "blocker report");
  if (!BLOCKER_TYPES.includes(type)) {
    throw new Error(`blocker report.type must be one of ${BLOCKER_TYPES.join(", ")}`);
  }
  requiredNodeStringField(report, "reason", "blocker report");
  requiredNodeStringField(report, "owner", "blocker report");
  requiredNodeStringField(report, "needed", "blocker report");
  requiredNodeStringField(report, "evidence", "blocker report");
  return { ok: true };
}

export function validateUnblockReport(value: unknown): { ok: true } {
  const report = asRecord(value, "unblock report");
  requiredNodeStringField(report, "nodeId", "unblock report", "node_id");
  requiredNodeStringField(report, "summary", "unblock report");
  requiredNodeStringField(report, "evidence", "unblock report");
  return { ok: true };
}

export function validateAssignmentReport(value: unknown): { ok: true } {
  const report = asRecord(value, "assignment report");
  requiredNodeStringField(report, "nodeId", "assignment report", "node_id");
  strictEnum(
    requiredNodeStringField(report, "role", "assignment report"),
    isAssignmentRole,
    "role",
  );
  requiredNodeStringField(report, "owner", "assignment report");
  return { ok: true };
}

export function validateVerificationReport(value: unknown): { ok: true } {
  const report = asRecord(value, "verification report");
  requiredNodeStringField(report, "nodeId", "verification report", "node_id");
  const status = requiredNodeStringField(report, "status", "verification report");
  if (status !== "passed" && status !== "failed") {
    throw new Error("verification report status must be passed or failed");
  }
  return { ok: true };
}

function validateAcceptanceEvidence(value: unknown, context: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${context} must be a non-empty array`);
  }
  for (const [index, item] of value.entries()) {
    const record = asRecord(item, `${context}[${index}]`);
    requiredNodeStringField(record, "criterion", `${context}[${index}]`);
    const status = requiredNodeStringField(record, "status", `${context}[${index}]`);
    if (status !== "passed" && status !== "failed") {
      throw new Error(`${context}[${index}].status must be passed or failed`);
    }
    requiredNodeStringField(record, "evidence", `${context}[${index}]`);
  }
}

function validateCommandEvidence(value: unknown, context: string): void {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${context} must be a non-empty array`);
  }
  for (const [index, item] of value.entries()) {
    const record = asRecord(item, `${context}[${index}]`);
    requiredNodeStringField(record, "command", `${context}[${index}]`);
    const status = requiredNodeStringField(record, "status", `${context}[${index}]`);
    if (status !== "passed" && status !== "failed") {
      throw new Error(`${context}[${index}].status must be passed or failed`);
    }
    requiredNodeStringField(record, "evidence", `${context}[${index}]`);
  }
}

function validateRealWorldValidation<T extends string>(
  value: unknown,
  context: string,
  allowedStatuses: readonly T[],
): T {
  const record = asRecord(value, context);
  requireBoolean(record.required, `${context}.required`);
  const status = requiredNodeStringField(record, "status", context) as T;
  if (!allowedStatuses.includes(status)) {
    throw new Error(`${context}.status must be ${allowedStatuses.join(" or ")}`);
  }
  requiredNodeStringField(record, "evidence", context);
  if (record.required === true && status === "not_required") {
    throw new Error(`${context}.status cannot be not_required when required is true`);
  }
  return status;
}

function stringArrayField(value: unknown, context: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${context} must be a non-empty string array`);
  }
  return value;
}

function requireBoolean(value: unknown, context: string): void {
  if (typeof value !== "boolean") throw new Error(`${context} must be boolean`);
}
