import { blockNode, completeNode, unblockNode, type BlockerType } from "@cat-cave/qdcli-core";
import { output, required, requiredArg, stringOpt } from "./args.js";
import { isBlockerType, strictEnum } from "./enums.js";
import { readJson } from "./file-io.js";
import { asRecord, requiredNodeStringField, stringAt } from "./object-utils.js";
import {
  validateBlockerReport,
  validateCompletionReport,
  validateUnblockReport,
} from "./schemas.js";

export async function blockCommand(
  root: string,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const report = options["from-report"]
    ? await readJson(root, required(options["from-report"], "--from-report"))
    : null;
  if (report) {
    validateBlockerReport(report);
    const record = asRecord(report, "blocker report");
    return output(
      {
        ok: true,
        node: await blockNode(root, requiredNodeId(report, nodeId, "blocker report"), {
          type: requiredNodeStringField(record, "type", "blocker report") as BlockerType,
          reason: requiredNodeStringField(record, "reason", "blocker report"),
          owner: requiredNodeStringField(record, "owner", "blocker report"),
          needed: requiredNodeStringField(record, "needed", "blocker report"),
          evidence: requiredNodeStringField(record, "evidence", "blocker report"),
        }),
      },
      json,
    );
  }
  return output(
    {
      ok: true,
      node: await blockNode(root, requiredArg(nodeId, "node id"), {
        type: strictEnum(required(options.type, "--type"), isBlockerType, "--type"),
        reason: required(options.reason, "--reason"),
        owner: required(options.owner, "--owner"),
        needed: required(options.needed, "--needed"),
        evidence: required(options.evidence, "--evidence"),
      }),
    },
    json,
  );
}

export async function completeCommand(
  root: string,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (!options["from-report"]) {
    throw new Error(
      "qd complete requires --from-report <completion-report.json>. Completion means ready for independent audit and must include acceptance evidence, commands run, real-world validation status, artifacts, and zero unverified items.",
    );
  }
  const reportPath = required(options["from-report"], "--from-report");
  const report = await readJson(root, reportPath);
  const validated = validateCompletionReport(report);
  return output(
    await completeNode(root, requiredNodeId(report, nodeId, "completion report"), {
      summary: validated.summary,
      reportPath,
    }),
    json,
  );
}

export async function unblockCommand(
  root: string,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const report = options["from-report"]
    ? await readJson(root, required(options["from-report"], "--from-report"))
    : null;
  if (report) {
    validateUnblockReport(report);
    const record = asRecord(report, "unblock report");
    return output(
      {
        ok: true,
        node: await unblockNode(root, requiredNodeId(report, nodeId, "unblock report"), {
          fromRunId: stringAt(record, "fromRun") ?? stringAt(record, "from_run") ?? null,
          summary: requiredNodeStringField(record, "summary", "unblock report"),
          evidence: requiredNodeStringField(record, "evidence", "unblock report"),
        }),
      },
      json,
    );
  }
  return output(
    {
      ok: true,
      node: await unblockNode(root, requiredArg(nodeId, "node id"), {
        fromRunId: stringOpt(options["from-run"]) ?? null,
        summary: required(options.summary, "--summary"),
        evidence: stringOpt(options.evidence) ?? null,
      }),
    },
    json,
  );
}

function requiredNodeId(report: unknown, fallback: string | undefined, context: string): string {
  const record = asRecord(report, context);
  const reportNodeId = requiredNodeStringField(record, "nodeId", context, "node_id");
  if (fallback && fallback !== reportNodeId) {
    throw new Error(`${context} nodeId ${reportNodeId} does not match ${fallback}`);
  }
  return fallback ?? reportNodeId;
}
