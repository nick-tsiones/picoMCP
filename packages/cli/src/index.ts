import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createReadStream, readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import {
  addEdge,
  addAssignment,
  addFinding,
  addNode,
  addNodeNote,
  addNodesBulk,
  addWaveAssignment,
  addWaveNode,
  adaptImportSource,
  analyticsReport,
  cancelNode,
  ciFail,
  claimNode,
  completeNode,
  completeAssignment,
  completeWave,
  criticalPathReport,
  deterministicGraphSnapshot,
  disposeFinding,
  etaReport,
  finishRun,
  getProjectPaths,
  gateNode,
  getNode,
  getRun,
  graphSnapshot,
  initProject,
  listNodeNotes,
  listEdges,
  listAssignments,
  listFindings,
  listNodes,
  listRuns,
  listRegistry,
  listWaveMemberships,
  listWaves,
  latestRun,
  markMerged,
  promoteFindings,
  readConfig,
  recordCiResult,
  replaceGraphSnapshot,
  readyNodes,
  registerGroup,
  registerMilestone,
  registerProject,
  recordCheckResult,
  removeEdge,
  resolveFinding,
  resolveProjectRoot,
  restoreGraphSnapshot,
  setupProject,
  startRun,
  startWave,
  stats,
  unblockNode,
  updateNode,
  validateGraph,
  velocityReport,
  workspaceGraph,
  workspaceReady,
  workspaceStatus,
  writeConfig,
  type QdConfig,
  type AddNodeInput,
  type BlockerType,
  type EdgeType,
  type FindingStatus,
  type ImportAdapter,
  type GraphSnapshot,
  type NoteKind,
  type NodeKind,
  type NodeStatus,
  type Priority,
  type QdRun,
  type Risk,
  type VerificationEntry,
} from "@cat-cave/qdcli-core";
import { promptText, skillText } from "./prompts.js";

interface ParsedArgs {
  command: string[];
  options: Record<string, string | string[] | boolean>;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const [group, action, extra] = args.command;
  const json = Boolean(args.options.json);

  if (args.options.version || group === "version" || group === "--version" || group === "-v") {
    console.log(cliVersion());
    return;
  }

  if (!group || group === "help" || group === "--help" || group === "-h") {
    const topic = group === "help" ? action : undefined;
    if (topic) console.log(topicHelp(topic));
    else console.log(helpText());
    return;
  }

  if (args.options.help || args.options.h) {
    console.log(commandHelp(group, action));
    return;
  }

  if (group === "view" && args.options.check) {
    return viewCommand("", args.options, json);
  }

  const root = await resolveProjectRoot({
    root: stringOpt(args.options.root),
    allowMissing: group === "init" || group === "setup",
  });

  switch (group) {
    case "init":
      await initProject(root);
      return output({ ok: true, message: "Initialized .qd" }, json);
    case "setup":
      await setupProject(root);
      await installSkill(root);
      if (args.options["print-agent-url"]) {
        console.log("https://github.com/cat-cave/qdcli/blob/main/docs/llms.md");
        return;
      }
      return output(
        {
          ok: true,
          hooks: args.options["no-hooks"] ? "skipped" : "not-installed",
          message: "Initialized qd and installed skills.sh skill",
        },
        json,
      );
    case "doctor":
      return doctor(root, args.options, json);
    case "status":
      return output(await stats(root), json);
    case "ready":
      return output(
        formatRows(filterNodes(await readyNodes(root), args.options), args.options),
        json,
      );
    case "graph":
      return graph(root, args.options, json);
    case "validate":
      return validation(root, json);
    case "config":
      return configCommand(root, action, extra, args.command.slice(3), args.options, json);
    case "import":
      return importCommand(root, args.options, json);
    case "sync":
      return syncCommand(root, args.options, json);
    case "export":
      return exportCommand(root, args.options, json);
    case "group":
      return registryCommand(root, "groups", action, args.options, json);
    case "project":
      return registryCommand(root, "projects", action, args.options, json);
    case "node":
      return nodeCommand(root, action, extra, args.options, json);
    case "nodes":
      return nodesCommand(root, action, args.options, json);
    case "note":
      return noteCommand(root, action, extra, args.options, json);
    case "assignment":
      return assignmentCommand(root, action, extra, args.options, json);
    case "wave":
      return waveCommand(root, action, extra, args.command.slice(2), args.options, json);
    case "worktree":
      return worktreeCommand(root, action, extra, args.options, json);
    case "run":
      return runCommand(root, action, extra, args.options, json);
    case "state":
      return stateCommand(root, action, args.options, json);
    case "env":
      return envCommand(action, args.options, json);
    case "schema":
      return schemaCommand(action, extra, json);
    case "unblock":
      return output(
        await unblockNode(root, requiredArg(action, "node id"), {
          fromRunId: required(args.options["from-run"], "--from-run"),
          summary: required(args.options.summary, "--summary"),
        }),
        json,
      );
    case "merge-ready":
      return readinessCommand(root, action, "merge", json);
    case "completion-ready":
      return readinessCommand(root, action, "completion", json);
    case "edge":
      return edgeCommand(root, action, args.command.slice(2), args.options, json);
    case "claim":
      return claimCommand(root, action, args.options, json);
    case "start":
      return output(await startRun(root, requiredArg(action, "node id"), "implement"), json);
    case "complete":
      return output(
        await completeNode(
          root,
          requiredArg(action, "node id"),
          required(args.options.summary, "--summary"),
        ),
        json,
      );
    case "audit":
      return auditCommand(root, action, extra, args.options, json);
    case "finding":
      return findingCommand(root, action, extra, args.options, json);
    case "promote-findings":
      return output(
        { promoted: await promoteFindings(root, requiredArg(action, "node id")) },
        json,
      );
    case "gate":
      return gate(root, requiredArg(action, "node id"), json);
    case "advance":
      return advanceCommand(root, action, args.options, json);
    case "diff":
      return diffCommand(root, action, args.options, json);
    case "ci":
      return ciCommand(root, action, extra, args.options, json);
    case "check":
      return checkCommand(root, action, extra, args.options, json);
    case "verification":
      return verificationCommand(root, action, extra, args.options, json);
    case "merge":
      return mergeCommand(root, action, args.options, json);
    case "plan":
      return planCommand(root, action, args.options, json);
    case "milestone":
      return milestoneCommand(root, action, extra, args.options, json);
    case "velocity":
      return output(await velocityReport(root, numberOpt(args.options.window) ?? 7), json);
    case "critical-path":
      return output(
        await criticalPathReport(root, stringOpt(args.options.milestone) ?? null),
        json,
      );
    case "eta":
      return output(
        await etaReport(
          root,
          stringOpt(args.options.milestone) ?? null,
          numberOpt(args.options.window) ?? 7,
        ),
        json,
      );
    case "stats":
      return output(
        await analyticsReport(root, {
          milestone: stringOpt(args.options.milestone) ?? null,
          windowDays: numberOpt(args.options.window) ?? 7,
        }),
        json,
      );
    case "snapshot":
      return snapshotCommand(root, args.options, json);
    case "prompt":
      return promptCommand(root, action, extra, args.options, json);
    case "agent":
      return agentCommand(root, action, extra, args.options, json);
    case "workspace":
      return workspaceCommand(action, args.options, json);
    case "view":
      return viewCommand(root, args.options, json);
    default:
      throw new Error(`Unknown command: ${group}`);
  }
}

async function doctor(
  root: string,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const strict = Boolean(options.strict);
  const validationResult = await validateGraph(root, { strict });
  const config = await readConfig(root);
  const configErrors: string[] = [];
  const configWarnings: string[] = [];
  const sourceCheckout = await isSourceCheckout();
  const viewer = await viewerRuntime();
  if (!config.checkCommand.trim()) configWarnings.push("check_command is empty");
  if (!config.ciCommand.trim()) configErrors.push("ci_command is empty");
  if (!["squash", "merge", "rebase"].includes(config.mergeStrategy)) {
    configErrors.push("merge_strategy must be squash, merge, or rebase");
  }
  if (config.ciProvider === "github") {
    if (!config.ciRepo.trim()) configErrors.push("ci_repo is required when ci_provider is github");
    if (!config.ciWorkflow.trim()) {
      configErrors.push("ci_workflow is required when ci_provider is github");
    }
    if (config.ciAuth !== "gh-cli") configErrors.push("ci_auth must be gh-cli");
  }
  const result = {
    ok: validationResult.ok && configErrors.length === 0,
    strict,
    checks: {
      initialized: true,
      schema: true,
      graph: validationResult.ok,
      config: configErrors.length === 0,
    },
    runtime: {
      sourceCheckout,
      viewer,
      skills: "embedded",
    },
    config,
    errors: [...validationResult.errors, ...configErrors],
    warnings: [...validationResult.warnings, ...configWarnings],
  };
  output(result, json);
  if (!result.ok) process.exitCode = 1;
}

async function configCommand(
  root: string,
  action: string | undefined,
  key: string | undefined,
  positionals: string[],
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const config = await readConfig(root);
  if (action === "show" || !action) return output(config, json);
  if (action === "get") {
    const configKey = requiredArg(key, "config key");
    return output({ key: configKey, value: getConfigValue(config, configKey) }, json);
  }
  if (action === "set") {
    const configKey = requiredArg(key, "config key");
    const value = stringOpt(options.value) ?? positionals[0] ?? "";
    const next =
      configKey === "ci-provider" || configKey === "ci_provider"
        ? setCiProviderConfig(config, value, options)
        : setConfigValue(config, configKey, requiredArg(value || undefined, "--value"));
    await writeConfig(root, next);
    return output(next, json);
  }
  throw new Error(`Unknown config action: ${action}`);
}

async function workspaceCommand(
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const workspaceOptions = {
    configPath: stringOpt(options.config),
    repos: stringListOpt(options.repo),
  };
  if (action === "status" || !action) {
    const result = await workspaceStatus(workspaceOptions);
    output(result, json);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (action === "ready") return output(await workspaceReady(workspaceOptions), json);
  if (action === "graph") return output(await workspaceGraph(workspaceOptions), json);
  throw new Error(`Unknown workspace action: ${action}`);
}

async function graph(
  root: string,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const format = stringOpt(options.format) ?? (json ? "json" : "table");
  const snapshot = await graphSnapshot(root);
  if (format === "json") return output(snapshot, true);
  if (format === "mermaid") {
    console.log(toMermaid(snapshot));
    return;
  }
  if (format === "dot") {
    console.log(toDot(snapshot));
    return;
  }
  output(snapshot.nodes, false);
}

async function exportCommand(
  root: string,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const snapshot = filterSnapshot(await graphSnapshot(root), {
    statuses: parseStatusList(options.status),
    milestone: stringOpt(options.milestone),
  });
  if (options.fields) {
    if (options.out) throw new Error("qd export --fields cannot be combined with --out");
    return output(formatRows(snapshot.nodes, options), json);
  }
  const exported = options.deterministic ? deterministicGraphSnapshot(snapshot) : snapshot;
  const config = await readConfig(root);
  const outPath = stringOpt(options.out) ?? config.exportDefaultOut;
  if (!outPath) return output(exported, true);

  const resolvedOut = path.resolve(root, outPath);
  await mkdir(path.dirname(resolvedOut), { recursive: true });
  await writeFile(resolvedOut, `${JSON.stringify(exported, null, 2)}\n`, "utf8");
  if (!options["no-hooks"]) {
    const hook = config.exportCanonicalizeCommand || config.hooks.postExport;
    if (hook.trim()) {
      await runPolicyHook(root, hook, {
        out: resolvedOut,
        root,
      });
    }
  }
  return output(
    {
      ok: true,
      path: path.relative(root, resolvedOut),
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      findings: snapshot.findings.length,
      runs: snapshot.runs.length,
      nodeNotes: snapshot.node_notes.length,
    },
    json,
  );
}

async function validation(root: string, json: boolean): Promise<void> {
  const result = await validateGraph(root);
  output(result, json);
  if (!result.ok) process.exitCode = 1;
}

async function snapshotCommand(
  root: string,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const milestone = stringOpt(options.milestone) ?? null;
  const graph = await graphSnapshot(root);
  const result = {
    schemaVersion: 1,
    status: await stats(root),
    ready: await readyNodes(root),
    openFindings: graph.findings.filter((finding) => finding.status === "open"),
    criticalPath: await criticalPathReport(root, milestone),
  };
  output(result, json);
}

async function nodeCommand(
  root: string,
  action: string | undefined,
  id: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "add") {
    return output(await addNode(root, await nodeInputFromOptions(root, options)), json);
  }
  if (action === "note") return nodeNoteCommand(root, id, options, json);
  if (action === "show") return nodeShowCommand(root, id, options, json);
  if (action === "list" || !action)
    return output(formatRows(filterNodes(await listNodes(root), options), options), json);
  if (action === "cancel") return output(await cancelNode(root, requiredArg(id, "node id")), json);
  if (action === "edit") {
    return output(
      await updateNode(
        root,
        requiredArg(id, "node id"),
        await nodeUpdateFromOptions(root, options),
      ),
      json,
    );
  }
  throw new Error(`Unknown node action: ${action}`);
}

async function nodesCommand(
  root: string,
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action !== "add-bulk") throw new Error(`Unknown nodes action: ${action}`);
  const raw = await readJson(root, required(options["from-json"], "--from-json"));
  const rawNodes: unknown[] | undefined = Array.isArray(raw)
    ? (raw as unknown[])
    : Array.isArray(asRecord(raw, "--from-json").nodes)
      ? (asRecord(raw, "--from-json").nodes as unknown[])
      : undefined;
  if (!rawNodes) throw new Error("--from-json must contain an array or an object with nodes[]");
  const nodes = rawNodes.map((rawNode, index) => normalizeNodeInput(rawNode, `nodes[${index}]`));

  const source = Array.isArray(raw) ? null : asRecord(raw, "--from-json");
  if (source?.edges !== undefined && !Array.isArray(source.edges)) {
    throw new Error("--from-json edges must be an array when provided");
  }
  const rawEdges = source?.edges ?? [];
  const edges = [];
  for (const [index, rawEdge] of rawEdges.entries()) {
    const edge = asRecord(rawEdge, `edges[${index}]`);
    edges.push({
      from: requiredNodeStringField(edge, "from", `edges[${index}]`, "from_node"),
      to: requiredNodeStringField(edge, "to", `edges[${index}]`, "to_node"),
      type: strictOptionalEnum(
        optionalStringField(edge, "type", `edges[${index}]`),
        isEdgeType,
        `edges[${index}].type`,
        "requires",
      ),
    });
  }
  return output(await addNodesBulk(root, { nodes, edges }), json);
}

async function nodeShowCommand(
  root: string,
  id: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const nodeId = requiredArg(id, "node id");
  const node = await getNode(root, nodeId);
  if (options.summary || options["no-big-text"]) {
    return output(
      {
        id: node.id,
        title: node.title,
        kind: node.kind,
        milestone: node.milestone,
        status: node.status,
        priority: node.priority,
        risk: node.risk,
        owner: node.owner,
        branch: node.branch,
        group_name: node.group_name,
        projects: node.projects,
        blocked_by: node.blocked_by,
        blocked_reason: node.blocked_reason,
        blocked_owner: node.blocked_owner,
        check_command: node.check_command,
        ci_command: node.ci_command,
      },
      json,
    );
  }
  if (!options.full && !options.include) return output(node, json);
  const include = new Set(
    (stringOpt(options.include) ?? "findings,notes,runs,audits")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const allowedIncludes = new Set(["findings", "notes", "runs", "audits"]);
  for (const item of include) {
    if (!allowedIncludes.has(item)) {
      throw new Error(`--include contains unknown section: ${item}`);
    }
  }
  const result: Record<string, unknown> = { node };
  if (include.has("findings")) result.findings = await listFindings(root, { nodeId });
  if (include.has("notes")) result.notes = await listNodeNotes(root, nodeId);
  if (include.has("runs") || include.has("audits")) {
    const runs = await listRuns(root, nodeId);
    if (include.has("runs")) result.runs = runs;
    if (include.has("audits")) result.audits = runs.filter((run) => run.kind === "audit");
  }
  return output(result, json);
}

async function noteCommand(
  root: string,
  action: string | undefined,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const id = requiredArg(nodeId, "node id");
  if (action === "add")
    return output(
      await addNodeNote(root, id, required(options.text, "--text"), {
        kind: strictEnumOpt(options.kind, isNoteKind, "--kind", "note"),
        evidence: stringOpt(options.evidence),
      }),
      json,
    );
  if (action === "list" || !action)
    return output(await listNodeNotes(root, id, { kinds: parseNoteKindList(options.kind) }), json);
  throw new Error(`Unknown note action: ${action}`);
}

async function claimCommand(
  root: string,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const config = await readConfig(root);
  if (!options["no-hooks"] && config.hooks.preClaim.trim()) {
    await runPolicyHook(root, config.hooks.preClaim, { root, node: nodeId ?? "" });
  }
  const node = await claimNode(root, {
    id: nodeId,
    agent: required(options.agent, "--agent"),
    branch: stringOpt(options.branch),
  });
  if (!options["no-hooks"] && config.hooks.postClaim.trim()) {
    await runPolicyHook(root, config.hooks.postClaim, {
      root,
      node: node.id,
      branch: node.branch ?? "",
    });
  }
  return output(node, json);
}

async function mergeCommand(
  root: string,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const id = requiredArg(nodeId, "node id");
  const config = await readConfig(root);
  if (!options["no-hooks"] && config.hooks.preMerge.trim()) {
    await runPolicyHook(root, config.hooks.preMerge, { root, node: id });
  }
  const node = await markMerged(
    root,
    id,
    strictEnumOpt(options.strategy, isMergeStrategy, "--strategy", "squash"),
    {
      commitSha:
        stringOpt(options["use-existing-commit"]) ?? stringOpt(options["already-merged-at"]),
    },
  );
  if (!options["no-hooks"] && config.hooks.postMerge.trim()) {
    await runPolicyHook(root, config.hooks.postMerge, { root, node: id });
  }
  return output(node, json);
}

async function edgeCommand(
  root: string,
  action: string | undefined,
  values: string[],
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "add") {
    return output(
      await addEdge(
        root,
        requiredArg(values[0], "from node"),
        requiredArg(values[1], "to node"),
        strictEnumOpt(options.type, isEdgeType, "--type", "requires"),
      ),
      json,
    );
  }
  if (action === "remove") {
    await removeEdge(
      root,
      requiredArg(values[0], "from node"),
      requiredArg(values[1], "to node"),
      strictEnumOpt(options.type, isEdgeType, "--type", "requires"),
    );
    return output({ ok: true }, json);
  }
  if (action === "list" || !action) return output(await listEdges(root), json);
  throw new Error(`Unknown edge action: ${action}`);
}

async function findingCommand(
  root: string,
  action: string | undefined,
  nodeOrFinding: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "add" && options["from-report"]) {
    return output(
      await importFindingsFromReport(
        root,
        required(options["from-report"], "--from-report"),
        nodeOrFinding,
      ),
      json,
    );
  }
  if (action === "add") {
    return output(
      await addFinding(root, requiredArg(nodeOrFinding, "node id"), {
        severity: strictEnum(required(options.severity, "--severity"), isPriority, "--severity"),
        title: required(options.title, "--title"),
        evidence: required(options.evidence, "--evidence"),
        path: stringOpt(options.path),
        line: numberOpt(options.line),
        expected: stringOpt(options.expected),
        suggestedFix: stringOpt(options["suggested-fix"]),
      }),
      json,
    );
  }
  if (action === "resolve")
    return output(await resolveFinding(root, requiredArg(nodeOrFinding, "finding id")), json);
  if (action === "dispose") {
    const disposition = required(options.disposition, "--disposition");
    const status =
      disposition === "accepted-risk" || disposition === "dismissed"
        ? "dismissed"
        : disposition === "resolved"
          ? "resolved"
          : disposition === "follow-up-node" || disposition === "promoted"
            ? "promoted"
            : null;
    if (!status)
      throw new Error(
        "--disposition must be resolved, follow-up-node, promoted, dismissed, or accepted-risk",
      );
    return output(
      await disposeFinding(root, requiredArg(nodeOrFinding, "finding id"), {
        status,
        rationale: required(options.rationale, "--rationale"),
      }),
      json,
    );
  }
  if (action === "promote") {
    const findingId = requiredArg(nodeOrFinding, "finding id");
    const finding = (await listFindings(root)).find((item) => item.id === findingId);
    if (!finding) throw new Error(`Finding not found: ${findingId}`);
    if (finding.severity === "P0" || finding.severity === "P1") {
      throw new Error("P0/P1 findings must be resolved, not promoted into non-blocking follow-up");
    }
    const targetNode = stringOpt(options.node);
    if (targetNode) {
      const node = await getNode(root, targetNode);
      const disposed = await disposeFinding(root, findingId, {
        status: "promoted",
        rationale: required(options.rationale, "--rationale"),
      });
      await addNodeNote(root, node.id, `Promoted finding ${findingId}: ${disposed.title}`, {
        kind: "audit-disposition",
        evidence: `finding:${findingId}`,
      });
      return output({ finding: disposed, node }, json);
    }
    const node = await addNode(root, {
      title: stringOpt(options.title) ?? finding.title,
      kind: "audit-fix",
      priority: finding.severity,
      risk: finding.severity === "P2" ? "medium" : "low",
      spec: [finding.evidence, finding.suggested_fix].filter(Boolean).join("\n\n"),
      acceptance: stringOpt(options.acceptance) ?? finding.expected ?? "Finding is addressed.",
      verification: stringListOpt(options.verification).map(parseVerification),
      context: finding.path ? `${finding.path}${finding.line ? `:${finding.line}` : ""}` : null,
      statusReason: `Promoted from finding ${finding.id} on node ${finding.node_id}.`,
    });
    const disposed = await disposeFinding(root, findingId, {
      status: "promoted",
      rationale: stringOpt(options.rationale) ?? `Promoted to ${node.id}`,
    });
    return output({ finding: disposed, node }, json);
  }
  if (action === "list" || !action) {
    if (options.open && options.status) throw new Error("Use either --open or --status, not both");
    return output(
      await listFindings(root, {
        nodeId: stringOpt(options.node),
        status: options.open ? "open" : strictEnumOpt(options.status, isFindingStatus, "--status"),
        severities: parseSeverityList(options.severity),
      }),
      json,
    );
  }
  throw new Error(`Unknown finding action: ${action}`);
}

async function auditCommand(
  root: string,
  action: string | undefined,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "start") {
    return output(
      await startRun(root, requiredArg(nodeId, "node id"), "audit", {
        auditKind: stringOpt(options.kind) ?? "general",
        agent: stringOpt(options.auditor) ?? stringOpt(options.agent),
        summary: stringOpt(options.summary),
      }),
      json,
    );
  }
  if (action === "validate") {
    return output(
      validateAuditReport(await readJson(root, nodeId ?? required(options.file, "--file"))),
      json,
    );
  }
  if (action && !["pass", "fail", "dispose", "cancel", "supersede", "list"].includes(action)) {
    return output(await startRun(root, requiredArg(action, "node id"), "audit"), json);
  }
  if (action === "list") {
    return output(
      await listRuns(root, {
        nodeId: stringOpt(options.node),
        status: stringOpt(options.status),
        kind: "audit",
      }),
      json,
    );
  }
  if (action === "pass") {
    const id = requiredArg(nodeId, "node id");
    const auditRun = await selectedAuditRun(root, id, options);
    const imported = await importFindingsFromReport(
      root,
      required(options["from-report"], "--from-report"),
      id,
      { allowEmpty: true },
    );
    await finishRun(root, auditRun.id, {
      status: "passed",
      summary: `Audit passed from ${required(options["from-report"], "--from-report")}`,
      reportPath: required(options["from-report"], "--from-report"),
    });
    const gate = await gateNode(root, id);
    if (!gate.ok) {
      output(
        {
          ok: false,
          code: "auditNotClean",
          nodeId: id,
          imported,
          blocking: gate.blocking,
          remaining: gate.blocking.length,
        },
        json,
      );
      process.exitCode = 1;
      return;
    }
    const promoted = await promoteFindings(root, id);
    const openFindings = await listFindings(root, { nodeId: id, status: "open" });
    return output(
      {
        ok: true,
        nodeId: id,
        imported,
        promoted,
        remaining: openFindings.length,
      },
      json,
    );
  }
  if (action === "fail") {
    const id = requiredArg(nodeId, "node id");
    const auditRun = await selectedAuditRun(root, id, options);
    const imported = await importFindingsFromReport(
      root,
      required(options["from-report"], "--from-report"),
      id,
      { allowEmpty: true },
    );
    const finished = await finishRun(root, auditRun.id, {
      status: "failed",
      summary:
        stringOpt(options.summary) ??
        `Audit failed from ${required(options["from-report"], "--from-report")}`,
      reportPath: required(options["from-report"], "--from-report"),
    });
    return output({ ok: false, nodeId: id, run: finished, imported }, json);
  }
  if (action === "dispose" || action === "cancel" || action === "supersede") {
    requiredArg(nodeId, "node id");
    const runId = required(options["run-id"], "--run-id");
    const status =
      action === "dispose" ? "cancelled" : action === "cancel" ? "cancelled" : "superseded";
    return output(
      await finishRun(root, runId, {
        status,
        rationale: required(options.rationale, "--rationale"),
        summary: `${action}: ${required(options.rationale, "--rationale")}`,
      }),
      json,
    );
  }
  throw new Error(`Unknown audit action: ${action}`);
}

async function selectedAuditRun(
  root: string,
  nodeId: string,
  options: Record<string, string | string[] | boolean>,
): Promise<QdRun> {
  const runId = stringOpt(options["run-id"]);
  if (runId) {
    const runRow = await getRun(root, runId);
    if (runRow.node_id !== nodeId)
      throw new Error(`Audit run ${runId} does not belong to ${nodeId}`);
    if (runRow.kind !== "audit") throw new Error(`Run ${runId} is not an audit run`);
    return runRow;
  }
  const running = await listRuns(root, { nodeId, kind: "audit", status: "running" });
  if (running.length === 0) {
    throw new Error(`No running audit found for ${nodeId}; pass --run-id for a specific audit`);
  }
  if (running.length > 1) {
    throw new Error(`Multiple running audits found for ${nodeId}; pass --run-id`);
  }
  const runRow = running[0];
  if (!runRow) throw new Error(`No running audit found for ${nodeId}`);
  return runRow;
}

async function gate(root: string, nodeId: string, json: boolean): Promise<void> {
  const config = await readConfig(root);
  if (config.hooks.preGate.trim())
    await runPolicyHook(root, config.hooks.preGate, { root, node: nodeId });
  const result = await gateNode(root, nodeId);
  const node = await getNode(root, nodeId);
  const latestCheck = await latestRun(root, nodeId, "check");
  const latestCi = await latestRun(root, nodeId, "ci");
  const openFollowups = await listFindings(root, {
    nodeId,
    status: "open",
    severities: ["P2", "P3"],
  });
  const enriched = {
    ...result,
    checks: {
      latestCheck: latestCheck ?? null,
      latestCi: latestCi ?? null,
      undisposedP2P3: openFollowups,
    },
    next: nextStepForNode(node, result, latestCheck ?? null, latestCi ?? null),
  };
  output(enriched, json);
  if (!result.ok) process.exitCode = 1;
}

async function runCommand(
  root: string,
  action: string | undefined,
  id: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "list" || !action) {
    return output(
      await listRuns(root, {
        nodeId: stringOpt(options.node),
        status: stringOpt(options.status),
        kind: strictEnumOpt(options.kind, isRunKind, "--kind"),
      }),
      json,
    );
  }
  if (action === "show") return output(await getRun(root, requiredArg(id, "run id")), json);
  if (action === "cancel") {
    return output(
      await finishRun(root, requiredArg(id, "run id"), {
        status: "cancelled",
        rationale: required(options.rationale, "--rationale"),
        summary: required(options.rationale, "--rationale"),
      }),
      json,
    );
  }
  if (action === "supersede") {
    return output(
      await finishRun(root, requiredArg(id, "run id"), {
        status: "superseded",
        supersededBy: required(options.by, "--by"),
        rationale: required(options.rationale, "--rationale"),
        summary: required(options.rationale, "--rationale"),
      }),
      json,
    );
  }
  throw new Error(`Unknown run action: ${action}`);
}

async function assignmentCommand(
  root: string,
  action: string | undefined,
  id: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "add") {
    if (options["from-json"]) {
      const raw = asRecord(
        await readJson(root, required(options["from-json"], "--from-json")),
        "--from-json",
      );
      return output(
        await addAssignment(root, {
          nodeId: requiredNodeStringField(raw, "nodeId", "--from-json", "node_id"),
          role: strictEnum(
            requiredNodeStringField(raw, "role", "--from-json"),
            isAssignmentRole,
            "role",
          ),
          owner: requiredNodeStringField(raw, "owner", "--from-json"),
          branch: optionalStringField(raw, "branch", "--from-json"),
          worktreePath:
            optionalStringField(raw, "worktreePath", "--from-json") ??
            optionalStringField(raw, "worktree_path", "--from-json"),
          scope: optionalStringField(raw, "scope", "--from-json"),
        }),
        json,
      );
    }
    return output(
      await addAssignment(root, {
        nodeId: requiredArg(id, "node id"),
        role: strictEnum(required(options.role, "--role"), isAssignmentRole, "--role"),
        owner: required(options.owner, "--owner"),
        branch: stringOpt(options.branch),
        worktreePath: stringOpt(options.worktree),
        scope: stringOpt(options.scope),
      }),
      json,
    );
  }
  if (action === "validate") {
    return output(
      validateAssignmentReport(await readJson(root, id ?? required(options.file, "--file"))),
      json,
    );
  }
  if (action === "complete" || action === "fail" || action === "cancel") {
    if (options["from-json"]) {
      const raw = asRecord(
        await readJson(root, required(options["from-json"], "--from-json")),
        "--from-json",
      );
      return output(
        await completeAssignment(root, requiredArg(id, "assignment id"), {
          status: action === "complete" ? "complete" : action === "fail" ? "failed" : "cancelled",
          summary: requiredNodeStringField(raw, "summary", "--from-json"),
          commits: strictStringArrayField(raw, "commits", "--from-json"),
          evidence: strictStringArrayField(raw, "evidence", "--from-json"),
        }),
        json,
      );
    }
    return output(
      await completeAssignment(root, requiredArg(id, "assignment id"), {
        status: action === "complete" ? "complete" : action === "fail" ? "failed" : "cancelled",
        summary: required(options.summary, "--summary"),
        commits: stringListOpt(options.commit),
        evidence: stringListOpt(options.evidence),
      }),
      json,
    );
  }
  if (action === "list" || !action) {
    return output(
      await listAssignments(root, {
        nodeId: stringOpt(options.node),
        status: strictEnumOpt(options.status, isAssignmentStatus, "--status"),
      }),
      json,
    );
  }
  throw new Error(`Unknown assignment action: ${action}`);
}

async function waveCommand(
  root: string,
  action: string | undefined,
  id: string | undefined,
  positionals: string[],
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "start") {
    return output(
      await startWave(root, {
        kind: strictEnumOpt(options.kind, isWaveKind, "--kind", "implementation"),
        summary: required(options.summary, "--summary"),
      }),
      json,
    );
  }
  if (action === "add-node") {
    await addWaveNode(root, requiredArg(id, "wave id"), requiredArg(positionals[0], "node id"));
    return output({ ok: true }, json);
  }
  if (action === "add-assignment") {
    await addWaveAssignment(
      root,
      requiredArg(id, "wave id"),
      requiredArg(positionals[0], "assignment id"),
    );
    return output({ ok: true }, json);
  }
  if (action === "complete" || action === "cancel") {
    return output(
      await completeWave(root, requiredArg(id, "wave id"), {
        status: action === "cancel" ? "cancelled" : "complete",
        summary: required(options.summary, "--summary"),
      }),
      json,
    );
  }
  if (action === "status" || action === "list" || !action) {
    return output(
      { waves: await listWaves(root), memberships: await listWaveMemberships(root) },
      json,
    );
  }
  throw new Error(`Unknown wave action: ${action}`);
}

async function worktreeCommand(
  root: string,
  action: string | undefined,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "list" || action === "status" || !action) {
    const worktrees = await gitWorktrees(root);
    const node = nodeId ? await getNode(root, nodeId) : null;
    const filtered = node?.branch
      ? worktrees.filter((worktree) => worktree.branch === node.branch)
      : worktrees;
    return output(filtered, json);
  }
  if (action === "create") {
    const node = await getNode(root, requiredArg(nodeId, "node id"));
    const kind = stringOpt(options.kind) ?? "spec";
    const branch = stringOpt(options.branch) ?? `${kind}/${node.id}`;
    const worktreePath = path.resolve(root, required(options.path, "--path"));
    const existing = await gitWorktrees(root);
    if (existing.some((worktree) => worktree.branch === branch)) {
      throw new Error(`Branch is already checked out in a worktree: ${branch}`);
    }
    if (existing.some((worktree) => path.resolve(worktree.path) === worktreePath)) {
      throw new Error(`Worktree path is already in use: ${worktreePath}`);
    }
    const branchExists = await captureCommand("git", ["rev-parse", "--verify", branch], root);
    const args =
      branchExists.code === 0
        ? ["worktree", "add", worktreePath, branch]
        : ["worktree", "add", "-b", branch, worktreePath, "HEAD"];
    const result = await captureCommand("git", args, root);
    if (result.code !== 0) throw new Error(`git worktree add failed: ${result.stderr}`);
    const updated = await updateNode(root, node.id, { branch });
    return output({ ok: true, node: updated, branch, worktree: worktreePath }, json);
  }
  if (action === "cleanup") {
    const node = await getNode(root, requiredArg(nodeId, "node id"));
    if (!node.branch) throw new Error(`Node ${node.id} has no branch`);
    const worktree = (await gitWorktrees(root)).find((entry) => entry.branch === node.branch);
    if (!worktree) throw new Error(`No worktree found for branch ${node.branch}`);
    const dirty = await captureCommand("git", ["-C", worktree.path, "status", "--porcelain"], root);
    if (dirty.code !== 0) throw new Error(`git status failed: ${dirty.stderr}`);
    if (dirty.stdout.trim()) throw new Error(`Refusing to remove dirty worktree: ${worktree.path}`);
    if (options["merged-only"]) {
      const merged = await captureCommand(
        "git",
        ["branch", "--merged", "main", "--format", "%(refname:short)"],
        root,
      );
      if (!merged.stdout.split(/\r?\n/).includes(node.branch)) {
        throw new Error(`Refusing cleanup because branch is not merged into main: ${node.branch}`);
      }
    }
    const removed = await captureCommand("git", ["worktree", "remove", worktree.path], root);
    if (removed.code !== 0) throw new Error(`git worktree remove failed: ${removed.stderr}`);
    return output({ ok: true, removed: worktree.path, branch: node.branch }, json);
  }
  throw new Error(`Unknown worktree action: ${action}`);
}

async function gitWorktrees(
  root: string,
): Promise<Array<{ path: string; branch: string | null; head: string | null }>> {
  const result = await captureCommand("git", ["worktree", "list", "--porcelain"], root);
  if (result.code !== 0) throw new Error(`git worktree list failed: ${result.stderr}`);
  const entries: Array<{ path: string; branch: string | null; head: string | null }> = [];
  let current: { path: string; branch: string | null; head: string | null } | null = null;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      if (current) entries.push(current);
      current = null;
      continue;
    }
    if (line.startsWith("worktree ")) current = { path: line.slice(9), branch: null, head: null };
    else if (line.startsWith("HEAD ") && current) current.head = line.slice(5);
    else if (line.startsWith("branch ") && current) current.branch = line.slice(18);
  }
  if (current) entries.push(current);
  return entries;
}

async function ciCommand(
  root: string,
  action: string | undefined,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "run")
    return runConfiguredCheck(root, requiredArg(nodeId, "node id"), "ci", options, json);
  if (action === "poll" || action === "wait") {
    return pollCi(root, requiredArg(nodeId, "node id"), options, json);
  }
  if (action === "start") {
    return output(
      await startRun(root, requiredArg(nodeId, "node id"), "ci", {
        summary: stringOpt(options.cmd),
      }),
      json,
    );
  }
  if (action === "pass")
    throw new Error(
      "Use qd ci record-pass <node> --summary <text> with --log-path, --url, or --external-id",
    );
  if (action === "record-pass") {
    const evidence = ciEvidence(options);
    return output(
      await recordCiResult(root, requiredArg(nodeId, "node id"), {
        status: "passed",
        summary: `${required(options.summary, "--summary")}\n${evidence.summary}`,
        logPath: evidence.logPath,
      }),
      json,
    );
  }
  if (action === "fail")
    return output(
      await ciFail(root, requiredArg(nodeId, "node id"), stringOpt(options.summary)),
      json,
    );
  throw new Error(`Unknown ci action: ${action}`);
}

async function pollCi(
  root: string,
  nodeId: string,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const config = await readConfig(root);
  const provider = stringOpt(options.provider) ?? config.ciProvider;
  if (provider !== "github") {
    throw new Error(
      provider === "none"
        ? "ci_provider is none. Configure a provider or pass --provider github."
        : `Unsupported CI provider: ${provider}`,
    );
  }
  const sha = stringOpt(options.sha) ?? (await latestMergeCommitSha(root, nodeId));
  if (!sha) {
    throw new Error(
      "No commit SHA found. Pass --sha, or record qd merge <node> --use-existing-commit <sha> first.",
    );
  }
  const result = await pollGitHubCi(root, nodeId, sha, config, options);
  output(result, json);
  if (!result.ok) process.exitCode = 1;
}

async function latestMergeCommitSha(root: string, nodeId: string): Promise<string | null> {
  const run = await latestRun(root, nodeId, "merge");
  const summary = run?.summary ?? "";
  const match = /\b[0-9a-f]{7,40}\b/i.exec(summary);
  return match?.[0] ?? null;
}

interface PolledCiRun {
  databaseId?: number;
  status?: string;
  conclusion?: string;
  url?: string;
  headSha?: string;
  name?: string;
  displayTitle?: string;
}

async function pollGitHubCi(
  root: string,
  nodeId: string,
  sha: string,
  config: QdConfig,
  options: Record<string, string | string[] | boolean>,
): Promise<Record<string, unknown> & { ok: boolean }> {
  const repo = stringOpt(options.repo) ?? config.ciRepo;
  const workflow = stringOpt(options.workflow) ?? config.ciWorkflow;
  const auth = stringOpt(options.auth) ?? config.ciAuth;
  if (!repo.trim()) throw new Error("--repo or ci_repo is required for GitHub CI polling");
  if (!workflow.trim())
    throw new Error("--workflow or ci_workflow is required for GitHub CI polling");
  if (auth !== "gh-cli") throw new Error("GitHub CI polling currently supports --auth gh-cli only");

  const intervalSeconds = numberOpt(options.interval) ?? 30;
  const timeoutSeconds = numberOpt(options.timeout) ?? 1800;
  if (intervalSeconds < 1) throw new Error("--interval must be at least 1 second");
  if (timeoutSeconds < 1) throw new Error("--timeout must be at least 1 second");
  const startedAt = Date.now();
  let lastRun: PolledCiRun | null = null;

  while (Date.now() - startedAt <= timeoutSeconds * 1000) {
    lastRun = await githubRunForSha(root, repo, workflow, sha);
    const conclusion = lastRun?.conclusion;
    const status = lastRun?.status;
    if (conclusion) {
      const ok = conclusion === "success";
      const evidence = lastRun?.url ?? String(lastRun?.databaseId ?? sha);
      const node = await recordCiResult(root, nodeId, {
        status: ok ? "passed" : "failed",
        summary: `GitHub CI ${ok ? "passed" : `failed (${conclusion})`}: ${evidence}`,
        logPath: null,
      });
      return {
        ok,
        provider: "github",
        repo,
        workflow,
        sha,
        run: lastRun,
        node,
      };
    }
    if (status === "completed" && !conclusion) {
      const node = await recordCiResult(root, nodeId, {
        status: "failed",
        summary: `GitHub CI completed without a conclusion for ${sha}`,
        logPath: null,
      });
      return {
        ok: false,
        provider: "github",
        repo,
        workflow,
        sha,
        run: lastRun,
        node,
      };
    }
    await sleep(intervalSeconds * 1000);
  }
  return {
    ok: false,
    provider: "github",
    repo,
    workflow,
    sha,
    run: lastRun,
    error: `Timed out after ${timeoutSeconds} seconds waiting for GitHub CI`,
  };
}

async function githubRunForSha(
  root: string,
  repo: string,
  workflow: string,
  sha: string,
): Promise<PolledCiRun | null> {
  const result = await captureCommand(
    "gh",
    [
      "run",
      "list",
      "--repo",
      repo,
      "--workflow",
      workflow,
      "--commit",
      sha,
      "--limit",
      "1",
      "--json",
      "databaseId,status,conclusion,url,headSha,name,displayTitle",
    ],
    root,
  );
  if (result.code !== 0) throw new Error(`gh run list failed: ${result.stderr.trim()}`);
  const parsed = JSON.parse(result.stdout || "[]") as unknown;
  if (!Array.isArray(parsed)) throw new Error("gh run list returned non-array JSON");
  return (parsed[0] as PolledCiRun | undefined) ?? null;
}

function ciEvidence(options: Record<string, string | string[] | boolean>): {
  summary: string;
  logPath?: string;
} {
  const logPath = stringOpt(options["log-path"]);
  const url = stringOpt(options.url);
  const externalId = stringOpt(options["external-id"]);
  if (!logPath && !url && !externalId) {
    throw new Error("CI pass recording requires --log-path, --url, or --external-id");
  }
  const parts = [
    logPath ? `log_path=${logPath}` : null,
    url ? `url=${url}` : null,
    externalId ? `external_id=${externalId}` : null,
  ].filter(Boolean);
  return { summary: `Evidence: ${parts.join(", ")}`, logPath };
}

async function checkCommand(
  root: string,
  action: string | undefined,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "run")
    return runConfiguredCheck(root, requiredArg(nodeId, "node id"), "check", options, json);
  throw new Error(`Unknown check action: ${action}`);
}

async function verificationCommand(
  root: string,
  action: string | undefined,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action !== "sign-off" && action !== "signoff") {
    if (action === "list" || !action) {
      const node = await getNode(root, requiredArg(nodeId, "node id"));
      return output({ nodeId: node.id, verification: node.verification }, json);
    }
    if (action === "validate") {
      return output(
        validateVerificationReport(
          await readJson(root, nodeId ?? required(options.file, "--file")),
        ),
        json,
      );
    }
    if (action === "record") {
      const report = asRecord(
        await readJson(root, required(options["from-json"], "--from-json")),
        "--from-json",
      );
      const id = requiredNodeStringField(report, "nodeId", "--from-json", "node_id");
      const status = requiredNodeStringField(report, "status", "--from-json");
      if (status !== "passed" && status !== "failed") {
        throw new Error("--from-json.status must be passed or failed");
      }
      const runRow = await startRun(root, id, "verification", {
        command: optionalStringField(report, "command", "--from-json"),
        provider: optionalStringField(report, "provider", "--from-json") ?? "external",
        summary: optionalStringField(report, "summary", "--from-json"),
        reportPath: optionalStringField(report, "evidence", "--from-json"),
      });
      const finished = await finishRun(root, runRow.id, {
        status,
        summary: optionalStringField(report, "summary", "--from-json") ?? `verification ${status}`,
        exitCode: optionalNumberField(report, "exitCode", "--from-json"),
      });
      return output(finished, json);
    }
    if (action === "run") {
      return verificationRunCommand(root, requiredArg(nodeId, "node id"), options, json);
    }
    throw new Error(`Unknown verification action: ${action}`);
  }
  const id = requiredArg(nodeId, "node id");
  const type = strictEnum(required(options.type, "--type"), isVerificationType, "--type");
  const note = required(options.note, "--note");
  const evidence = stringOpt(options.evidence);
  const node = await getNode(root, id);
  if (node.verification.length > 0 && !node.verification.some((entry) => entry.type === type)) {
    throw new Error(
      `Node ${id} has no ${type} verification entry. Sign off only declared verification gates.`,
    );
  }
  const text = [
    `Verification sign-off (${type}): ${note}`,
    evidence ? `Evidence: ${evidence}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const saved = await addNodeNote(root, id, text);
  return output(
    { ok: true, nodeId: id, type, note, evidence: evidence ?? null, noteRecord: saved },
    json,
  );
}

async function verificationRunCommand(
  root: string,
  nodeId: string,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const node = await getNode(root, nodeId);
  const only = stringOpt(options.only);
  const commands = node.verification
    .filter((entry) => entry.type === "command")
    .filter((entry) => !only || entry.value === only)
    .map((entry) => entry.value);
  if (commands.length === 0) {
    throw new Error(
      only
        ? `No matching command verification: ${only}`
        : "Node has no command verification entries",
    );
  }
  const results = [];
  for (const command of commands) {
    const runRow = await startRun(root, nodeId, "verification", {
      command,
      provider: "local",
      summary: `verification command started: ${command}`,
    });
    const paths = getProjectPaths(root);
    await mkdir(paths.logsDir, { recursive: true });
    const logPath = path.join(paths.logsDir, `verification-${nodeId}-${runRow.id}.log`);
    const execution = await runShellCommand(command, root, logPath);
    const status =
      execution.exitCode === 0 ? "passed" : execution.timedOut ? "timed_out" : "failed";
    const finished = await finishRun(root, runRow.id, {
      status,
      summary: `verification command ${status}: ${command}`,
      exitCode: execution.exitCode,
    });
    results.push({ ...finished, log_path: logPath });
  }
  output({ ok: results.every((runRow) => runRow.status === "passed"), runs: results }, json);
  if (results.some((runRow) => runRow.status !== "passed")) process.exitCode = 1;
}

async function advanceCommand(
  root: string,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const id = requiredArg(nodeId, "node id");
  const steps: Array<{ step: string; ok: boolean; detail?: unknown }> = [];
  let node = await getNode(root, id);

  if (!["review", "mergeable", "done"].includes(node.status)) {
    const summary = required(options.summary, "--summary");
    node = await completeNode(root, id, summary);
    steps.push({ step: "complete", ok: true, detail: { status: node.status } });
  }

  const gate = await gateNode(root, id);
  steps.push({ step: "gate", ok: gate.ok, detail: gate });
  if (!gate.ok) {
    output({ ok: false, stoppedAt: "gate", steps, node: await getNode(root, id) }, json);
    process.exitCode = 1;
    return;
  }

  const config = await readConfig(root);
  if (!options["skip-check"] && config.checkCommand.trim()) {
    const check = await executeConfiguredCheck(root, id, "check", options);
    steps.push({ step: "check", ok: check.ok, detail: check });
    if (!check.ok) {
      output({ ok: false, stoppedAt: "check", steps, node: await getNode(root, id) }, json);
      process.exitCode = check.exitCode;
      return;
    }
  }

  if (!options["skip-ci"] && config.ciCommand.trim()) {
    const ci = await executeConfiguredCheck(root, id, "ci", options);
    steps.push({ step: "ci", ok: ci.ok, detail: ci });
    if (!ci.ok) {
      output({ ok: false, stoppedAt: "ci", steps, node: await getNode(root, id) }, json);
      process.exitCode = ci.exitCode;
      return;
    }
  } else if (!options["skip-ci"] && !config.ciCommand.trim()) {
    throw new Error("ci_command is empty; configure it or pass --skip-ci explicitly");
  }

  node = await getNode(root, id);
  if (options.merge) {
    node = await markMerged(root, id, stringOpt(options.strategy) ?? "squash");
    steps.push({ step: "merge", ok: true, detail: { status: node.status } });
  }

  output(
    {
      ok: true,
      stoppedAt: node.status === "done" ? "done" : node.status,
      nextAction:
        node.status === "mergeable" && !options.merge
          ? "Perform the real git/GitHub merge, then run qd merge or qd advance --merge."
          : null,
      steps,
      node,
    },
    json,
  );
}

async function diffCommand(
  root: string,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const node = await getNode(root, requiredArg(nodeId, "node id"));
  if (!node.branch) throw new Error(`Node ${node.id} has no branch. Claim with --branch first.`);
  const base = stringOpt(options.base) ?? "main";
  const args = ["diff"];
  if (options["name-only"]) args.push("--name-only");
  let mergeBase: string | null = null;
  if (options["self-only"]) {
    const result = await captureCommand("git", ["merge-base", base, node.branch], root);
    if (result.code !== 0) {
      throw new Error(`git merge-base failed for ${base} and ${node.branch}: ${result.stderr}`);
    }
    mergeBase = result.stdout.trim();
    args.push(`${mergeBase}..${node.branch}`);
  } else {
    args.push(`${base}...${node.branch}`);
  }
  const result = await captureCommand("git", args, root);
  if (result.code !== 0) throw new Error(`git diff failed: ${result.stderr}`);
  if (json) {
    output(
      {
        nodeId: node.id,
        base,
        branch: node.branch,
        selfOnly: Boolean(options["self-only"]),
        mergeBase,
        diff: result.stdout,
      },
      true,
    );
    return;
  }
  process.stdout.write(result.stdout);
}

async function planCommand(
  root: string,
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "export")
    return graph(root, { ...options, format: stringOpt(options.format) ?? "json" }, json);
  if (action === "import") {
    throw new Error(
      "qd plan import is reserved for the next trial iteration; use qd node add and qd edge add for now",
    );
  }
  throw new Error(`Unknown plan action: ${action}`);
}

async function milestoneCommand(
  root: string,
  action: string | undefined,
  name: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "register") {
    return output(
      await registerMilestone(
        root,
        required(options.name, "--name"),
        requiredNumber(options.rank, "--rank"),
      ),
      json,
    );
  }
  if (action === "list") return output(await listRegistry(root, "milestones"), json);
  if (action === "status" || !action) {
    const milestone = name ?? stringOpt(options.milestone) ?? null;
    return output(
      await analyticsReport(root, {
        milestone,
        windowDays: numberOpt(options.window) ?? 7,
      }),
      json,
    );
  }
  if (action === "remaining") {
    const milestone = requiredArg(name, "milestone name");
    const graph = await graphSnapshot(root);
    return output(
      formatRows(
        graph.nodes.filter((node) => node.milestone === milestone && node.status !== "done"),
        options,
      ),
      json,
    );
  }
  if (action === "blockers") {
    const milestone = requiredArg(name, "milestone name");
    const graph = await graphSnapshot(root);
    const nodeIds = new Set(
      graph.nodes.filter((node) => node.milestone === milestone).map((node) => node.id),
    );
    const findings = graph.findings.filter(
      (finding) =>
        nodeIds.has(finding.node_id) &&
        finding.status === "open" &&
        (finding.severity === "P0" || finding.severity === "P1"),
    );
    const runningAudits = graph.runs.filter(
      (runRow) =>
        nodeIds.has(runRow.node_id) && runRow.kind === "audit" && runRow.status === "running",
    );
    const blockedNodes = graph.nodes.filter(
      (node) => node.milestone === milestone && node.status === "blocked",
    );
    return output({ milestone, findings, runningAudits, blockedNodes }, json);
  }
  if (action === "critical-path") {
    return output(await criticalPathReport(root, requiredArg(name, "milestone name")), json);
  }
  if (action === "next") {
    const milestone = requiredArg(name, "milestone name");
    const limit = numberOpt(options.limit);
    const nodes = (await readyNodes(root)).filter((node) => node.milestone === milestone);
    return output(formatRows(limit ? nodes.slice(0, limit) : nodes, options), json);
  }
  throw new Error(`Unknown milestone action: ${action}`);
}

async function registryCommand(
  root: string,
  table: "groups" | "projects",
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "register") {
    const name = required(options.name, "--name");
    return output(
      table === "groups" ? await registerGroup(root, name) : await registerProject(root, name),
      json,
    );
  }
  if (action === "list" || !action) return output(await listRegistry(root, table), json);
  throw new Error(`Unknown ${table} action: ${action}`);
}

async function nodeNoteCommand(
  root: string,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const id = requiredArg(nodeId, "node id");
  const mode = stringOpt(options.mode) ?? "add";
  if (mode === "list")
    return output(await listNodeNotes(root, id, { kinds: parseNoteKindList(options.kind) }), json);
  return output(
    await addNodeNote(root, id, required(options.text, "--text"), {
      kind: strictEnumOpt(options.kind, isNoteKind, "--kind", "note"),
      evidence: stringOpt(options.evidence),
    }),
    json,
  );
}

async function nodeInputFromOptions(
  root: string,
  options: Record<string, string | string[] | boolean>,
): Promise<AddNodeInput> {
  if (options["from-json"]) {
    return normalizeNodeInput(
      await readJson(root, required(options["from-json"], "--from-json")),
      "--from-json",
    );
  }
  const spec = options["spec-file"]
    ? await readTextFile(root, required(options["spec-file"], "--spec-file"))
    : required(options.spec, "--spec");
  const acceptance = options["acceptance-file"]
    ? await readTextFile(root, required(options["acceptance-file"], "--acceptance-file"))
    : required(options.acceptance, "--acceptance");
  return {
    id: stringOpt(options.id),
    title: required(options.title, "--title"),
    kind: strictEnumOpt(options.kind, isNodeKind, "--kind", "feature"),
    milestone: stringOpt(options.milestone),
    groupName: stringOpt(options.group),
    projects: stringListOpt(options.project),
    status: strictEnumOpt(options.status, isNodeStatus, "--status", "ready"),
    priority: strictEnumOpt(options.priority, isPriority, "--priority", "P2"),
    estimatePoints: numberOpt(options.estimate) ?? 1,
    risk: strictEnumOpt(options.risk, isRisk, "--risk", "medium"),
    spec,
    acceptance,
    validation: stringOpt(options.validation),
    verification: stringListOpt(options.verify).map(parseVerification),
    auditFocus: stringListOpt(options["audit-focus"]),
    context: stringOpt(options.context),
    statusReason: stringOpt(options["status-reason"]),
    checkCommand: stringOpt(options["check-command"]),
    ciCommand: stringOpt(options["ci-command"]),
    blockedBy: strictEnumOpt(options["blocked-by"], isBlockerType, "--blocked-by"),
    blockedReason: stringOpt(options["blocked-reason"]),
    blockedOwner: stringOpt(options["blocked-owner"]),
  };
}

async function nodeUpdateFromOptions(
  root: string,
  options: Record<string, string | string[] | boolean>,
): Promise<Parameters<typeof updateNode>[2]> {
  const fromJson = options["from-json"]
    ? normalizeNodeUpdate(
        await readJson(root, required(options["from-json"], "--from-json")),
        "--from-json",
      )
    : {};
  const spec = options["spec-file"]
    ? await readTextFile(root, required(options["spec-file"], "--spec-file"))
    : stringOpt(options.spec);
  const acceptance = options["acceptance-file"]
    ? await readTextFile(root, required(options["acceptance-file"], "--acceptance-file"))
    : stringOpt(options.acceptance);
  const blockedBy = strictEnumOpt(options["blocked-by"], isBlockerType, "--blocked-by");
  const status = strictEnumOpt(options.status, isNodeStatus, "--status");
  const clearBlocker = Boolean(options["clear-blocker"]);
  const updates = stripUndefinedValues({
    ...fromJson,
    title: stringOpt(options.title),
    kind: strictEnumOpt(options.kind, isNodeKind, "--kind"),
    milestone: stringOpt(options.milestone),
    group_name: stringOpt(options.group),
    projects: options.project ? stringListOpt(options.project) : undefined,
    status: blockedBy && !status ? "blocked" : status,
    priority: strictEnumOpt(options.priority, isPriority, "--priority"),
    estimatePoints: numberOpt(options.estimate),
    risk: strictEnumOpt(options.risk, isRisk, "--risk"),
    spec,
    acceptance,
    validation: stringOpt(options.validation),
    verification: options.verify ? stringListOpt(options.verify).map(parseVerification) : undefined,
    audit_focus: options["audit-focus"] ? stringListOpt(options["audit-focus"]) : undefined,
    context: stringOpt(options.context),
    status_reason: stringOpt(options["status-reason"]),
    check_command: stringOpt(options["check-command"]),
    ci_command: stringOpt(options["ci-command"]),
    branch: stringOpt(options.branch),
    blocked_by: clearBlocker ? null : blockedBy,
    blocked_reason: clearBlocker ? null : stringOpt(options["blocked-reason"]),
    blocked_owner: clearBlocker ? null : stringOpt(options["blocked-owner"]),
  }) as Parameters<typeof updateNode>[2];
  return updates;
}

function normalizeNodeInput(raw: unknown, context: string): AddNodeInput {
  const value = asRecord(raw, context);
  return {
    id: optionalStringField(value, "id", context),
    title: requiredNodeStringField(value, "title", context),
    kind: strictOptionalEnum(
      optionalStringField(value, "kind", context),
      isNodeKind,
      `${context}.kind`,
      "feature",
    ),
    milestone: optionalStringField(value, "milestone", context),
    groupName:
      optionalStringField(value, "groupName", context) ??
      optionalStringField(value, "group_name", context) ??
      optionalStringField(value, "group", context),
    projects: optionalStringArrayField(value, "projects", context) ?? [],
    status: strictOptionalEnum(
      optionalStringField(value, "status", context),
      isNodeStatus,
      `${context}.status`,
      "ready",
    ),
    priority: strictOptionalEnum(
      optionalStringField(value, "priority", context),
      isPriority,
      `${context}.priority`,
      "P2",
    ),
    estimatePoints:
      optionalNumberField(value, "estimatePoints", context) ??
      optionalNumberField(value, "estimate_points", context) ??
      optionalNumberField(value, "estimate", context) ??
      1,
    risk: strictOptionalEnum(
      optionalStringField(value, "risk", context),
      isRisk,
      `${context}.risk`,
      "medium",
    ),
    spec: requiredNodeStringField(value, "spec", context),
    acceptance: requiredNodeStringField(value, "acceptance", context),
    validation: optionalStringField(value, "validation", context),
    verification: normalizeVerificationArray(value.verification, `${context}.verification`),
    auditFocus:
      optionalStringArrayField(value, "auditFocus", context) ??
      optionalStringArrayField(value, "audit_focus", context) ??
      [],
    context: optionalStringField(value, "context", context),
    statusReason:
      optionalStringField(value, "statusReason", context) ??
      optionalStringField(value, "status_reason", context),
    checkCommand:
      optionalStringField(value, "checkCommand", context) ??
      optionalStringField(value, "check_command", context),
    ciCommand:
      optionalStringField(value, "ciCommand", context) ??
      optionalStringField(value, "ci_command", context),
    blockedBy:
      optionalEnumField(
        optionalStringField(value, "blockedBy", context) ??
          optionalStringField(value, "blocked_by", context),
        isBlockerType,
        `${context}.blocked_by`,
      ) ?? null,
    blockedReason:
      optionalStringField(value, "blockedReason", context) ??
      optionalStringField(value, "blocked_reason", context),
    blockedOwner:
      optionalStringField(value, "blockedOwner", context) ??
      optionalStringField(value, "blocked_owner", context),
  };
}

function normalizeNodeUpdate(raw: unknown, context: string): Parameters<typeof updateNode>[2] {
  const value = asRecord(raw, context);
  const blockedBy = optionalEnumField(
    optionalStringField(value, "blockedBy", context) ??
      optionalStringField(value, "blocked_by", context),
    isBlockerType,
    `${context}.blocked_by`,
  );
  const status = optionalEnumField(
    optionalStringField(value, "status", context),
    isNodeStatus,
    `${context}.status`,
  );
  return stripUndefinedValues({
    title: optionalStringField(value, "title", context),
    kind: optionalEnumField(
      optionalStringField(value, "kind", context),
      isNodeKind,
      `${context}.kind`,
    ),
    milestone: nullableStringField(value, "milestone", context),
    group_name:
      nullableStringField(value, "groupName", context) ??
      nullableStringField(value, "group_name", context) ??
      nullableStringField(value, "group", context),
    projects: optionalStringArrayField(value, "projects", context),
    status: blockedBy && !status ? "blocked" : status,
    priority: optionalEnumField(
      optionalStringField(value, "priority", context),
      isPriority,
      `${context}.priority`,
    ),
    estimatePoints:
      optionalNumberField(value, "estimatePoints", context) ??
      optionalNumberField(value, "estimate_points", context) ??
      optionalNumberField(value, "estimate", context),
    risk: optionalEnumField(optionalStringField(value, "risk", context), isRisk, `${context}.risk`),
    spec: optionalStringField(value, "spec", context),
    acceptance: optionalStringField(value, "acceptance", context),
    validation: nullableStringField(value, "validation", context),
    verification:
      value.verification === undefined
        ? undefined
        : normalizeVerificationArray(value.verification, `${context}.verification`),
    audit_focus:
      optionalStringArrayField(value, "auditFocus", context) ??
      optionalStringArrayField(value, "audit_focus", context),
    context: nullableStringField(value, "context", context),
    status_reason:
      nullableStringField(value, "statusReason", context) ??
      nullableStringField(value, "status_reason", context),
    check_command:
      nullableStringField(value, "checkCommand", context) ??
      nullableStringField(value, "check_command", context),
    ci_command:
      nullableStringField(value, "ciCommand", context) ??
      nullableStringField(value, "ci_command", context),
    branch: nullableStringField(value, "branch", context),
    blocked_by: blockedBy,
    blocked_reason:
      nullableStringField(value, "blockedReason", context) ??
      nullableStringField(value, "blocked_reason", context),
    blocked_owner:
      nullableStringField(value, "blockedOwner", context) ??
      nullableStringField(value, "blocked_owner", context),
  }) as Parameters<typeof updateNode>[2];
}

function qdNodeFromInput(
  input: AddNodeInput,
  id: string,
  now: string,
): GraphSnapshot["nodes"][number] {
  return {
    id,
    title: input.title,
    kind: input.kind ?? "feature",
    milestone: input.milestone ?? null,
    group_name: input.groupName ?? null,
    projects: input.projects ?? [],
    status: input.status ?? "ready",
    priority: input.priority ?? "P2",
    estimate_points: input.estimatePoints ?? 1,
    risk: input.risk ?? "medium",
    owner: null,
    branch: null,
    spec: input.spec,
    acceptance: input.acceptance,
    validation: input.validation ?? null,
    verification: input.verification ?? [],
    audit_focus: input.auditFocus ?? [],
    context: input.context ?? null,
    status_reason: input.statusReason ?? null,
    check_command: input.checkCommand ?? null,
    ci_command: input.ciCommand ?? null,
    blocked_by: input.blockedBy ?? null,
    blocked_reason: input.blockedReason ?? null,
    blocked_owner: input.blockedOwner ?? null,
    created_at: now,
    updated_at: now,
    claimed_at: null,
    done_at: null,
  };
}

function registriesFromNodes(
  nodes: GraphSnapshot["nodes"],
  now: string,
): GraphSnapshot["registries"] {
  return {
    groups: [...new Set(nodes.map((node) => node.group_name).filter(isNonEmptyString))]
      .sort()
      .map((name) => ({ name, created_at: now })),
    projects: [...new Set(nodes.flatMap((node) => node.projects))]
      .sort()
      .map((name) => ({ name, created_at: now })),
    milestones: [...new Set(nodes.map((node) => node.milestone).filter(isNonEmptyString))]
      .sort()
      .map((name, index) => ({ name, rank: index + 1, created_at: now })),
  };
}

async function readJson(root: string, filePath: string): Promise<unknown> {
  const text = await readTextFile(root, filePath);
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `Invalid JSON in ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function readTextFile(root: string, filePath: string): Promise<string> {
  return readFile(path.resolve(root, filePath), "utf8");
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredNodeStringField(
  value: Record<string, unknown>,
  key: string,
  context: string,
  fallbackKey?: string,
): string {
  const result =
    optionalStringField(value, key, context) ??
    (fallbackKey ? optionalStringField(value, fallbackKey, context) : undefined);
  if (!result) throw new Error(`${context}.${key} is required`);
  return result;
}

function optionalStringField(
  value: Record<string, unknown>,
  key: string,
  context: string,
): string | undefined {
  const raw = value[key];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") throw new Error(`${context}.${key} must be a string`);
  return raw;
}

function nullableStringField(
  value: Record<string, unknown>,
  key: string,
  context: string,
): string | null | undefined {
  const raw = value[key];
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") throw new Error(`${context}.${key} must be a string or null`);
  return raw;
}

function optionalNumberField(
  value: Record<string, unknown>,
  key: string,
  context: string,
): number | undefined {
  const raw = value[key];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new Error(`${context}.${key} must be a number`);
  }
  return raw;
}

function optionalStringArrayField(
  value: Record<string, unknown>,
  key: string,
  context: string,
): string[] | undefined {
  const raw = value[key];
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
    throw new Error(`${context}.${key} must be an array of strings`);
  }
  return raw;
}

function strictStringArrayField(
  value: Record<string, unknown>,
  key: string,
  context: string,
): string[] {
  return optionalStringArrayField(value, key, context) ?? [];
}

function normalizeVerificationArray(value: unknown, context: string): VerificationEntry[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${context} must be an array`);
  return value.map((entry, index) => {
    if (typeof entry === "string") return parseVerification(entry);
    const record = asRecord(entry, `${context}[${index}]`);
    const type = requiredNodeStringField(record, "type", `${context}[${index}]`);
    if (!isVerificationType(type)) {
      throw new Error(`${context}[${index}].type must be one of ${VERIFICATION_TYPES.join(", ")}`);
    }
    return {
      type,
      value: requiredNodeStringField(record, "value", `${context}[${index}]`),
    };
  });
}

async function importCommand(
  root: string,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const filePath = path.resolve(root, required(options.from, "--from"));
  const mappingPath = stringOpt(options["schema-mapping"]);
  const adapter = stringOpt(options.adapter);
  const dryRun = Boolean(options["dry-run"]);
  const verbose = Boolean(options.verbose);
  const allowDefaults = Boolean(options["allow-defaults"]);
  const merge = Boolean(options.merge);
  if (adapter && mappingPath) {
    throw new Error("qd import --adapter cannot be combined with --schema-mapping");
  }
  const source = adapter
    ? adaptImportSource(importAdapter(adapter), await readFile(filePath, "utf8"))
    : (JSON.parse(await readFile(filePath, "utf8")) as unknown);
  const canonicalSnapshot = adapter ? undefined : canonicalSnapshotFrom(source);
  if (canonicalSnapshot && !mappingPath) {
    const report = {
      ok: true,
      dryRun,
      format: "qd-export",
      nodesFound: canonicalSnapshot.nodes.length,
      edgesFound: canonicalSnapshot.edges.length,
      findingsFound: canonicalSnapshot.findings.length,
      runsFound: canonicalSnapshot.runs.length,
      nodeNotesFound: canonicalSnapshot.node_notes.length,
      importedNodes: dryRun ? 0 : canonicalSnapshot.nodes.length,
      importedEdges: dryRun ? 0 : canonicalSnapshot.edges.length,
      importedFindings: dryRun ? 0 : canonicalSnapshot.findings.length,
      importedRuns: dryRun ? 0 : canonicalSnapshot.runs.length,
      importedNodeNotes: dryRun ? 0 : canonicalSnapshot.node_notes.length,
    };
    if (!dryRun) {
      if (merge) await replaceGraphSnapshot(root, canonicalSnapshot);
      else await restoreGraphSnapshot(root, canonicalSnapshot);
    }
    return output(report, json);
  }
  const mapping = mappingPath
    ? (JSON.parse(await readFile(path.resolve(root, mappingPath), "utf8")) as ImportMapping)
    : defaultImportMapping;
  const nodes = strictArrayAtPath(source, mapping.nodesPath ?? "nodes", true);
  const edges = strictArrayAtPath(source, mapping.edgesPath ?? "edges", false);
  const report: ImportReport = {
    ok: true,
    dryRun,
    nodesFound: nodes.length,
    edgesFound: edges.length,
    importedNodes: 0,
    importedEdges: 0,
    defaults: [],
    droppedFields: [],
    warnings: [],
    errors: [],
    nodes: [],
    edges: [],
  };
  const importedNodes = [];
  const importedEdges = [];
  const plannedImportEdges: PlannedImportEdge[] = [];
  const plannedEdges = new Set<string>();
  const nodeKeysUsed = usedNodeMappingKeys(mapping);
  if (nodes.length === 0) report.errors.push(`No nodes found at ${mapping.nodesPath ?? "nodes"}`);

  const plannedNodes = nodes.flatMap((raw, index): PlannedImportNode[] => {
    try {
      const planned = mapImportNode(raw, index, mapping, report, verbose);
      const dropped = droppedTopLevelKeys(raw, nodeKeysUsed);
      if (dropped.length > 0) {
        report.droppedFields.push({
          nodeId: planned.input.id ?? planned.sourceId,
          fields: dropped,
        });
        if (verbose)
          importVerbose(`node ${planned.sourceId}: dropped unmapped fields ${dropped.join(", ")}`);
      }
      report.nodes.push(planned.input);
      return [planned];
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : String(error));
      return [];
    }
  });

  for (const [index, raw] of edges.entries()) {
    const from = stringAt(raw, mapping.edgeFrom ?? "from");
    const to = stringAt(raw, mapping.edgeTo ?? "to");
    if (!from || !to) {
      report.errors.push(
        `edges[${index}] must include ${mapping.edgeFrom ?? "from"} and ${mapping.edgeTo ?? "to"}`,
      );
      continue;
    }
    try {
      const type = strictOptionalEnum<EdgeType>(
        stringAt(raw, mapping.edgeType ?? "type"),
        isEdgeType,
        "edge.type",
        "requires",
      );
      planImportEdge({ from, to, type, source: "edges" }, plannedImportEdges, report, plannedEdges);
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (mapping.nodeEdges) {
    try {
      validateNodeEdgesMapping(mapping.nodeEdges);
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : String(error));
    }
    for (const planned of plannedNodes) {
      let refs: string[] = [];
      try {
        refs = strictStringArrayAt(
          planned.raw,
          mapping.nodeEdges.path,
          `node ${planned.sourceId}.nodeEdges`,
        );
      } catch (error) {
        report.errors.push(error instanceof Error ? error.message : String(error));
        continue;
      }
      if (refs.length === 0) continue;
      const type = mapping.nodeEdges.edgeType ?? "requires";
      if (!isEdgeType(type)) {
        report.errors.push(`nodeEdges.edgeType must be one of ${EDGE_TYPES.join(", ")}`);
        continue;
      }
      for (const ref of refs) {
        const edge =
          mapping.nodeEdges.edgeDirection === "deps-block-this-node"
            ? {
                from: ref,
                to: planned.sourceId,
                type,
                source: `nodeEdges:${mapping.nodeEdges.path}`,
              }
            : {
                from: planned.sourceId,
                to: ref,
                type,
                source: `nodeEdges:${mapping.nodeEdges.path}`,
              };
        planImportEdge(edge, plannedImportEdges, report, plannedEdges);
      }
    }
  }

  if (report.errors.length === 0) {
    const nodeIds = new Set(plannedNodes.map((node) => node.sourceId));
    if (nodeIds.size !== plannedNodes.length)
      report.errors.push("Import contains duplicate node ids");
    for (const edge of plannedImportEdges) {
      if (!nodeIds.has(edge.from))
        report.errors.push(`edge references missing from node: ${edge.from}`);
      if (!nodeIds.has(edge.to)) report.errors.push(`edge references missing to node: ${edge.to}`);
    }
    const cycle = findImportCycle(plannedImportEdges.filter((edge) => edge.type === "requires"));
    if (cycle) report.errors.push(`requires edge cycle detected: ${cycle.join(" -> ")}`);
  }

  if (report.errors.length === 0 && !dryRun) {
    if (!allowDefaults && report.defaults.length > 0) {
      report.errors.push(
        `Import would use ${report.defaults.length} defaulted field(s). Re-run with --allow-defaults if those defaults are intentional.`,
      );
    }
  }

  if (report.errors.length === 0 && !dryRun) {
    const existingNodes = await listNodes(root);
    if (existingNodes.length > 0 && !merge) {
      report.errors.push(
        "qd import requires an empty qd DAG. Run imports before creating nodes, use --merge for explicit sync semantics, or use --dry-run to inspect a mapping.",
      );
    }
  }

  if (report.errors.length === 0 && !dryRun) {
    if (merge) {
      const now = new Date().toISOString();
      const nodesForSnapshot = plannedNodes.map((node) =>
        qdNodeFromInput(node.input, node.input.id ?? node.sourceId, now),
      );
      const snapshot: GraphSnapshot = {
        schema_version: 1,
        exported_at: now,
        registries: registriesFromNodes(nodesForSnapshot, now),
        nodes: nodesForSnapshot,
        edges: plannedImportEdges.map((edge) => ({
          from_node: edge.from,
          to_node: edge.to,
          type: edge.type,
          created_at: now,
        })),
        findings: [],
        runs: [],
        node_notes: [],
        assignments: [],
        waves: [],
        wave_memberships: [],
      };
      await replaceGraphSnapshot(root, snapshot);
      importedNodes.push(...snapshot.nodes);
      importedEdges.push(...plannedImportEdges);
    } else {
      const created = await addNodesBulk(root, {
        nodes: plannedNodes.map((node) => node.input),
        edges: plannedImportEdges,
      });
      importedNodes.push(...created.nodes);
      importedEdges.push(...created.edges);
    }
  }

  if (dryRun && report.errors.length === 0) {
    importedNodes.push(...plannedNodes.map((node) => node.input));
    importedEdges.push(...plannedImportEdges);
  }

  report.importedNodes = importedNodes.length;
  report.importedEdges = importedEdges.length;
  report.ok = report.errors.length === 0;
  output(report, json);
  if (!report.ok) process.exitCode = 1;
}

async function syncCommand(
  root: string,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const filePath = path.resolve(root, required(options.from, "--from"));
  const snapshot = canonicalSnapshotFrom(JSON.parse(await readFile(filePath, "utf8")) as unknown);
  if (!snapshot) throw new Error("qd sync requires a canonical qd export JSON file");
  await replaceGraphSnapshot(root, snapshot);
  return output(
    {
      ok: true,
      path: path.relative(root, filePath),
      nodes: snapshot.nodes.length,
      edges: snapshot.edges.length,
      findings: snapshot.findings.length,
      runs: snapshot.runs.length,
      nodeNotes: snapshot.node_notes.length,
    },
    json,
  );
}

async function stateCommand(
  root: string,
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "diff") {
    const against = path.resolve(root, required(options["against-export"], "--against-export"));
    const exportSnapshot = canonicalSnapshotFrom(
      JSON.parse(await readFile(against, "utf8")) as unknown,
    );
    if (!exportSnapshot) throw new Error("--against-export must be a canonical qd export");
    const live = await graphSnapshot(root);
    const result = snapshotDiff(live, exportSnapshot);
    output(result, json);
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (action === "rebuild") {
    const from = path.resolve(root, required(options["from-export"], "--from-export"));
    const snapshot = canonicalSnapshotFrom(JSON.parse(await readFile(from, "utf8")) as unknown);
    if (!snapshot) throw new Error("--from-export must be a canonical qd export");
    await replaceGraphSnapshot(root, snapshot);
    return output({ ok: true, rebuiltFrom: path.relative(root, from) }, json);
  }
  if (action === "reconcile") {
    const prefer = stringOpt(options.prefer);
    if (prefer !== "export") throw new Error("state reconcile currently supports --prefer export");
    const from = path.resolve(root, required(options["from-export"], "--from-export"));
    const snapshot = canonicalSnapshotFrom(JSON.parse(await readFile(from, "utf8")) as unknown);
    if (!snapshot) throw new Error("--from-export must be a canonical qd export");
    await replaceGraphSnapshot(root, snapshot);
    return output({ ok: true, preferred: "export", source: path.relative(root, from) }, json);
  }
  throw new Error(`Unknown state action: ${action}`);
}

async function envCommand(
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action !== "check") throw new Error(`Unknown env action: ${action}`);
  const requiredNames = stringListOpt(options.required).flatMap((item) => item.split(","));
  const entries = requiredNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      present: process.env[name] !== undefined,
      value: options.mask ? "***" : null,
    }));
  const result = { ok: entries.every((entry) => entry.present), required: entries };
  output(result, json);
  if (!result.ok) process.exitCode = 1;
}

function schemaCommand(action: string | undefined, name: string | undefined, json: boolean): void {
  const schemas = {
    "audit-report": auditReportSchema(),
    "finding-import": findingImportSchema(),
    assignment: assignmentSchema(),
    verification: verificationSchema(),
    "external-ci": externalCiSchema(),
    wave: waveSchema(),
  };
  if (action === "list" || !action) return output(Object.keys(schemas), json);
  if (action === "print") {
    const schema = schemas[requiredArg(name, "schema name") as keyof typeof schemas];
    if (!schema) throw new Error(`Unknown schema: ${name}`);
    return output(schema, true);
  }
  throw new Error(`Unknown schema action: ${action}`);
}

async function readinessCommand(
  root: string,
  nodeId: string | undefined,
  kind: "merge" | "completion",
  json: boolean,
): Promise<void> {
  const id = requiredArg(nodeId, "node id");
  const node = await getNode(root, id);
  const gate = await gateNode(root, id);
  const latestCheck = await latestRun(root, id, "check");
  const latestCi = await latestRun(root, id, "ci");
  const result = {
    ok:
      gate.ok &&
      (kind === "completion" || node.status === "mergeable") &&
      (kind === "completion" || latestCi?.status === "passed"),
    kind,
    node,
    gate,
    latestCheck: latestCheck ?? null,
    latestCi: latestCi ?? null,
    next: nextStepForNode(node, gate, latestCheck ?? null, latestCi ?? null),
  };
  output(result, json);
  if (!result.ok) process.exitCode = 1;
}

async function promptCommand(
  root: string,
  action: string | undefined,
  id: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const kind = action ?? "plan";
  const node = (kind === "implement" || kind === "audit") && id ? await getNode(root, id) : null;
  const rulesPath =
    stringOpt(options["include-project-rules"]) ?? stringOpt(options["include-rules-file"]);
  const projectRules = rulesPath ? await readTextFile(root, rulesPath) : undefined;
  const auditBase = stringOpt(options.base) ?? "main";
  const auditDiffCommand =
    kind === "audit" && id ? `qd diff ${id} --self-only --base ${auditBase}` : undefined;
  const prompt = promptText(kind, node, { projectRules, auditDiffCommand });
  if (json) {
    output(
      {
        schemaVersion: 1,
        kind,
        nodeId: id ?? null,
        node,
        projectRulesPath: rulesPath ?? null,
        auditDiffCommand: auditDiffCommand ?? null,
        prompt,
      },
      true,
    );
    return;
  }
  if (action === "implement" && id) {
    console.log(prompt);
    return;
  }
  console.log(prompt);
}

async function runConfiguredCheck(
  root: string,
  nodeId: string,
  kind: "check" | "ci",
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const result = await executeConfiguredCheck(root, nodeId, kind, options);
  output(result, json);
  if (!result.ok) process.exitCode = result.exitCode;
}

async function executeConfiguredCheck(
  root: string,
  nodeId: string,
  kind: "check" | "ci",
  options: Record<string, string | string[] | boolean>,
): Promise<{
  ok: boolean;
  exitCode: number;
  command: string | null;
  logPath: string | null;
  node?: unknown;
  blocking?: unknown;
}> {
  const config = await readConfig(root);
  if (config.requireGateBeforeCi) {
    const gate = await gateNode(root, nodeId);
    if (!gate.ok) {
      return { ok: false, exitCode: 1, command: null, logPath: null, blocking: gate.blocking };
    }
  }

  if (config.requireCleanWorktree) await assertCleanWorktree(root, config.cleanWorktreeExcept);

  const node = await getNode(root, nodeId);
  const nodeCommand = kind === "ci" ? node.ci_command : node.check_command;
  const command =
    stringOpt(options.cmd) ??
    nodeCommand ??
    (kind === "ci" ? config.ciCommand : config.checkCommand);
  if (!command.trim()) throw new Error(`${kind}_command is empty; configure it or pass --cmd`);
  if (!options["no-hooks"] && config.hooks.preCheck.trim()) {
    await runPolicyHook(root, config.hooks.preCheck, { root, node: nodeId, command });
  }
  const paths = getProjectPaths(root);
  await mkdir(paths.logsDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const logPath = path.join(
    paths.logsDir,
    `${kind}-${nodeId}-${startedAt.replace(/[:.]/g, "-")}.log`,
  );
  const execution = await runShellCommand(command, root, logPath, {
    timeoutSeconds: kind === "ci" ? config.ciTimeoutSeconds : config.checkTimeoutSeconds,
    noOutputTimeoutSeconds:
      kind === "ci" ? config.ciNoOutputTimeoutSeconds : config.checkNoOutputTimeoutSeconds,
  });
  if (!options["no-hooks"] && config.hooks.postCheck.trim()) {
    await runPolicyHook(root, config.hooks.postCheck, {
      root,
      node: nodeId,
      command,
      log: logPath,
    });
  }
  const finishedAt = new Date().toISOString();
  const status = execution.exitCode === 0 ? "passed" : execution.timedOut ? "timed_out" : "failed";
  const recorder = kind === "ci" ? recordCiResult : recordCheckResult;
  const updatedNode = await recorder(root, nodeId, {
    status: status === "passed" ? "passed" : "failed",
    summary: `${kind} command ${status}: ${command}`,
    logPath,
    startedAt,
    finishedAt,
  });
  const result = {
    ok: execution.exitCode === 0,
    exitCode: execution.exitCode,
    timedOut: execution.timedOut,
    noOutputTimedOut: execution.noOutputTimedOut,
    command,
    logPath,
    node: updatedNode,
  };
  return result;
}

async function assertCleanWorktree(root: string, except: string[]): Promise<void> {
  const result = await captureCommand("git", ["status", "--porcelain"], root);
  if (result.code !== 0) throw new Error("require_clean_worktree is true, but git status failed");
  const dirtyLines = result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !isExceptedDirtyPath(line.slice(3), except));
  if (dirtyLines.length > 0) {
    throw new Error(`Worktree must be clean before CI/check runs:\n${dirtyLines.join("\n")}`);
  }
}

function isExceptedDirtyPath(filePath: string, except: string[]): boolean {
  return except.some(
    (entry) => filePath === entry || filePath.startsWith(entry.endsWith("/") ? entry : `${entry}/`),
  );
}

function runShellCommand(
  command: string,
  cwd: string,
  logPath: string,
  options: { timeoutSeconds?: number; noOutputTimeoutSeconds?: number } = {},
): Promise<{ exitCode: number; timedOut: boolean; noOutputTimedOut: boolean }> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let lastOutputAt = Date.now();
    let timedOut = false;
    let noOutputTimedOut = false;
    const child = spawn(command, {
      cwd,
      env: { ...process.env, QD_ROOT: cwd },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timeout =
      options.timeoutSeconds && options.timeoutSeconds > 0
        ? setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
          }, options.timeoutSeconds * 1000)
        : null;
    const noOutput =
      options.noOutputTimeoutSeconds && options.noOutputTimeoutSeconds > 0
        ? setInterval(
            () => {
              if (Date.now() - lastOutputAt > (options.noOutputTimeoutSeconds ?? 0) * 1000) {
                timedOut = true;
                noOutputTimedOut = true;
                child.kill("SIGTERM");
              }
            },
            Math.min((options.noOutputTimeoutSeconds ?? 1) * 1000, 30_000),
          )
        : null;
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      if (noOutput) clearInterval(noOutput);
    };
    child.stdout.on("data", (chunk: Buffer) => {
      lastOutputAt = Date.now();
      process.stdout.write(chunk);
      void appendFile(logPath, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      lastOutputAt = Date.now();
      process.stderr.write(chunk);
      void appendFile(logPath, chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });
    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ exitCode: signal ? 124 : (code ?? 1), timedOut, noOutputTimedOut });
    });
  });
}

async function runPolicyHook(
  root: string,
  command: string,
  placeholders: Record<string, string>,
): Promise<void> {
  const rendered = Object.entries(placeholders).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, shellQuote(value)),
    command,
  );
  const result = await captureShellCommand(rendered, root);
  if (result.code !== 0) {
    throw new Error(
      `Policy hook failed (${result.code}): ${rendered}\n${result.stderr || result.stdout}`,
    );
  }
}

function captureShellCommand(
  command: string,
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("exit", (code: number | null) =>
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
  });
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function captureCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("exit", (code: number | null) =>
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function agentCommand(
  root: string,
  action: string | undefined,
  targetArg: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "install") {
    const requested = targetArg ?? stringOpt(options.agent) ?? "skills-sh";
    const target = stringOpt(options.target);
    if (requested !== "skills-sh") {
      throw new Error("agent install target must be skills-sh");
    }
    await installSkill(root, target);
    return output(
      {
        ok: true,
        agent: requested,
        target: target ?? ".qd/skills/qd-dag/SKILL.md",
      },
      json,
    );
  }
  if (action === "doctor") return doctor(root, options, json);
  throw new Error(`Unknown agent action: ${action}`);
}

async function installSkill(root: string, target?: string): Promise<void> {
  const skillPath = path.resolve(root, target ?? ".qd/skills/qd-dag/SKILL.md");
  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(skillPath, skillText, "utf8");
}

interface ImportMapping {
  nodesPath?: string;
  edgesPath?: string;
  id?: string;
  title?: string;
  kind?: string;
  milestone?: string;
  group?: string;
  projects?: string;
  status?: string;
  priority?: string;
  estimate?: string;
  risk?: string;
  spec?: ImportTextMapping;
  acceptance?: ImportTextMapping;
  validation?: string;
  verification?: string;
  auditFocus?: string;
  context?: string;
  statusReason?: string;
  blockedBy?: string;
  blockedReason?: string;
  blockedOwner?: string;
  statusMap?: Record<string, NodeStatus>;
  nodeEdges?: ImportNodeEdgesMapping;
  edgeFrom?: string;
  edgeTo?: string;
  edgeType?: string;
}

type ImportTextMapping = string | ImportFoldMapping;

interface ImportFoldMapping {
  concat: string[];
  separator?: string;
  preamble?: Record<string, string>;
}

interface ImportNodeEdgesMapping {
  path: string;
  edgeDirection: "deps-block-this-node" | "this-node-blocks-deps";
  edgeType?: EdgeType;
}

interface ImportReport {
  ok: boolean;
  dryRun: boolean;
  nodesFound: number;
  edgesFound: number;
  importedNodes: number;
  importedEdges: number;
  defaults: Array<{ nodeId: string; field: string; value: string | number; reason: string }>;
  droppedFields: Array<{ nodeId: string; fields: string[] }>;
  warnings: string[];
  errors: string[];
  nodes: AddNodeInput[];
  edges: PlannedImportEdge[];
}

interface PlannedImportNode {
  sourceId: string;
  raw: unknown;
  input: AddNodeInput;
}

interface PlannedImportEdge {
  from: string;
  to: string;
  type: EdgeType;
  source: string;
}

const defaultImportMapping: ImportMapping = {
  nodesPath: "nodes",
  edgesPath: "edges",
  id: "id",
  title: "title",
  kind: "kind",
  milestone: "milestone",
  group: "group_name",
  projects: "projects",
  status: "status",
  priority: "priority",
  estimate: "estimate_points",
  risk: "risk",
  spec: "spec",
  acceptance: "acceptance",
  validation: "validation",
  verification: "verification",
  auditFocus: "audit_focus",
  context: "context",
  statusReason: "status_reason",
  blockedBy: "blocked_by",
  blockedReason: "blocked_reason",
  blockedOwner: "blocked_owner",
  edgeFrom: "from_node",
  edgeTo: "to_node",
  edgeType: "type",
};

const NODE_KINDS = ["feature", "fix", "refactor", "test", "docs", "infra", "audit-fix"] as const;
const IMPORT_ADAPTERS = ["roadmap-html", "markdown-checklist"] as const;
const NODE_STATUSES = [
  "draft",
  "ready",
  "claimed",
  "working",
  "review",
  "fixing",
  "ci",
  "mergeable",
  "done",
  "regressed",
  "blocked",
  "cancelled",
] as const;
const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;
const RISKS = ["low", "medium", "high"] as const;
const EDGE_TYPES = ["requires", "unblocks", "supersedes", "related"] as const;
const FINDING_STATUSES = ["open", "resolved", "promoted", "dismissed"] as const;
const VERIFICATION_TYPES = ["command", "manual", "url", "note"] as const;
const MERGE_STRATEGIES = ["squash", "merge", "rebase"] as const;
const BLOCKER_TYPES = ["manual", "external", "policy"] as const;
const RUN_KINDS = [
  "implement",
  "audit",
  "resolve",
  "check",
  "ci",
  "verification",
  "merge",
] as const;
const ASSIGNMENT_ROLES = [
  "planner",
  "worker",
  "auditor",
  "repair",
  "reviewer",
  "explorer",
] as const;
const ASSIGNMENT_STATUSES = ["open", "complete", "failed", "cancelled"] as const;
const WAVE_KINDS = ["implementation", "audit", "repair", "planning", "release"] as const;
const NOTE_KINDS = [
  "note",
  "blocker",
  "retry",
  "external-dependency",
  "operator-instruction",
  "audit-disposition",
  "live-run-attempt",
  "environment-preflight",
  "risk-acceptance",
  "migration-note",
] as const;

function mapImportNode(
  raw: unknown,
  index: number,
  mapping: ImportMapping,
  report: ImportReport,
  verbose: boolean,
): PlannedImportNode {
  const id = stringAt(raw, mapping.id ?? "id");
  if (!id) throw new Error(`nodes[${index}] is missing required id field (${mapping.id ?? "id"})`);
  const title = stringAt(raw, mapping.title ?? "title") ?? id;
  if (title === id && !stringAt(raw, mapping.title ?? "title")) {
    defaultImportValue(report, id, "title", id, `missing ${mapping.title ?? "title"}`);
  }
  const spec = textAt(raw, mapping.spec ?? "spec", `nodes[${index}].spec`);
  if (!spec) throw new Error(`node ${id}: mapped spec is required`);
  const acceptance = textAt(raw, mapping.acceptance ?? "acceptance", `nodes[${index}].acceptance`);
  if (!acceptance) throw new Error(`node ${id}: mapped acceptance is required`);

  const input: AddNodeInput = {
    id,
    title,
    kind: mappedEnum(raw, mapping.kind ?? "kind", isNodeKind, "kind", "feature", id, report),
    milestone: stringAt(raw, mapping.milestone ?? "milestone"),
    groupName: stringAt(raw, mapping.group ?? "group"),
    projects: strictStringArrayAt(raw, mapping.projects ?? "projects", `node ${id}.projects`),
    status: mappedStatus(raw, mapping, id, report),
    priority: mappedEnum(
      raw,
      mapping.priority ?? "priority",
      isPriority,
      "priority",
      "P2",
      id,
      report,
    ),
    estimatePoints: mappedEstimate(raw, mapping.estimate ?? "estimate", id, report),
    risk: mappedEnum(raw, mapping.risk ?? "risk", isRisk, "risk", "medium", id, report),
    spec,
    acceptance,
    validation: stringAt(raw, mapping.validation ?? "validation"),
    verification: strictVerificationArrayAt(
      raw,
      mapping.verification ?? "verification",
      `node ${id}.verification`,
    ),
    auditFocus: strictStringArrayAt(
      raw,
      mapping.auditFocus ?? "auditFocus",
      `node ${id}.auditFocus`,
    ),
    context: stringAt(raw, mapping.context ?? "context"),
    statusReason: stringAt(raw, mapping.statusReason ?? "statusReason"),
    blockedBy:
      optionalEnumField(
        stringAt(raw, mapping.blockedBy ?? "blocked_by"),
        isBlockerType,
        `node ${id}.blocked_by`,
      ) ?? null,
    blockedReason: stringAt(raw, mapping.blockedReason ?? "blocked_reason"),
    blockedOwner: stringAt(raw, mapping.blockedOwner ?? "blocked_owner"),
  };
  if (verbose)
    importVerbose(
      `node ${id}: status=${input.status} priority=${input.priority} risk=${input.risk}`,
    );
  return { sourceId: id, raw, input };
}

function mappedStatus(
  raw: unknown,
  mapping: ImportMapping,
  nodeId: string,
  report: ImportReport,
): NodeStatus {
  const sourceStatus = stringAt(raw, mapping.status ?? "status");
  if (!sourceStatus) {
    defaultImportValue(report, nodeId, "status", "ready", `missing ${mapping.status ?? "status"}`);
    return "ready";
  }
  const mapped = mapping.statusMap?.[sourceStatus];
  if (mapped) {
    if (!isNodeStatus(mapped))
      throw new Error(`statusMap.${sourceStatus} must be one of ${NODE_STATUSES.join(", ")}`);
    return mapped;
  }
  if (isNodeStatus(sourceStatus)) return sourceStatus;
  throw new Error(
    `node ${nodeId}: unknown status "${sourceStatus}"; add statusMap.${sourceStatus} to the import mapping`,
  );
}

function mappedEnum<T extends string>(
  raw: unknown,
  pathText: string,
  isValue: (value: string) => value is T,
  field: string,
  fallback: T,
  nodeId: string,
  report: ImportReport,
): T {
  const value = stringAt(raw, pathText);
  if (!value) {
    defaultImportValue(report, nodeId, field, fallback, `missing ${pathText}`);
    return fallback;
  }
  if (!isValue(value)) throw new Error(`node ${nodeId}: ${field} "${value}" is not valid`);
  return value;
}

function mappedEstimate(
  raw: unknown,
  pathText: string,
  nodeId: string,
  report: ImportReport,
): number {
  const value = valueAtPath(raw, pathText);
  if (value === undefined) {
    defaultImportValue(report, nodeId, "estimate_points", 1, `missing ${pathText}`);
    return 1;
  }
  const parsed = numberAt(raw, pathText);
  if (parsed === undefined || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`node ${nodeId}: estimate at ${pathText} must be a positive integer`);
  }
  return parsed;
}

function textAt(source: unknown, mapping: ImportTextMapping, label: string): string | undefined {
  if (typeof mapping === "string") {
    const value = valueAtPath(source, mapping);
    if (value === undefined) return undefined;
    if (typeof value !== "string")
      throw new Error(`${label}: ${mapping} must be a string or use a fold descriptor`);
    return value.trim() ? value : undefined;
  }
  if (!Array.isArray(mapping.concat) || mapping.concat.length === 0) {
    throw new Error(`${label}: fold descriptor requires a non-empty concat array`);
  }
  const parts: string[] = [];
  for (const pathText of mapping.concat) {
    const value = valueAtPath(source, pathText);
    if (value === undefined) continue;
    const preamble = mapping.preamble?.[pathText] ?? "";
    if (typeof value === "string") {
      if (value.trim()) parts.push(`${preamble}${value}`);
      continue;
    }
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      const items = value.filter((item) => item.trim());
      if (items.length > 0) parts.push(`${preamble}${items.join(mapping.separator ?? "\n")}`);
      continue;
    }
    throw new Error(`${label}: ${pathText} must be a string or string array`);
  }
  const text = parts.join("");
  return text.trim() ? text : undefined;
}

function planImportEdge(
  edge: PlannedImportEdge,
  planned: PlannedImportEdge[],
  report: ImportReport,
  seen: Set<string>,
): void {
  if (edge.from === edge.to) {
    report.errors.push(`edge ${edge.from} -> ${edge.to} from ${edge.source} points to itself`);
    return;
  }
  const key = `${edge.from}\0${edge.to}\0${edge.type}`;
  if (seen.has(key)) {
    report.warnings.push(
      `duplicate edge skipped: ${edge.from} -> ${edge.to} (${edge.type}) from ${edge.source}`,
    );
    return;
  }
  seen.add(key);
  planned.push(edge);
  report.edges.push(edge);
}

function validateNodeEdgesMapping(mapping: ImportNodeEdgesMapping): void {
  if (!mapping.path) throw new Error("nodeEdges.path is required");
  if (
    mapping.edgeDirection !== "deps-block-this-node" &&
    mapping.edgeDirection !== "this-node-blocks-deps"
  ) {
    throw new Error(
      "nodeEdges.edgeDirection must be deps-block-this-node or this-node-blocks-deps",
    );
  }
}

function defaultImportValue(
  report: ImportReport,
  nodeId: string,
  field: string,
  value: string | number,
  reason: string,
): void {
  report.defaults.push({ nodeId, field, value, reason });
}

function importVerbose(message: string): void {
  console.error(`[qd import] ${message}`);
}

function usedNodeMappingKeys(mapping: ImportMapping): Set<string> {
  const keys = new Set<string>();
  for (const value of [
    mapping.id ?? "id",
    mapping.title ?? "title",
    mapping.kind ?? "kind",
    mapping.milestone ?? "milestone",
    mapping.group ?? "group",
    mapping.projects ?? "projects",
    mapping.status ?? "status",
    mapping.priority ?? "priority",
    mapping.estimate ?? "estimate",
    mapping.risk ?? "risk",
    mapping.validation ?? "validation",
    mapping.verification ?? "verification",
    mapping.auditFocus ?? "auditFocus",
    mapping.context ?? "context",
    mapping.statusReason ?? "statusReason",
    mapping.blockedBy ?? "blocked_by",
    mapping.blockedReason ?? "blocked_reason",
    mapping.blockedOwner ?? "blocked_owner",
  ]) {
    keys.add(topLevelKey(value));
  }
  addTextMappingKeys(keys, mapping.spec ?? "spec");
  addTextMappingKeys(keys, mapping.acceptance ?? "acceptance");
  if (mapping.nodeEdges) keys.add(topLevelKey(mapping.nodeEdges.path));
  return keys;
}

function addTextMappingKeys(keys: Set<string>, mapping: ImportTextMapping): void {
  if (typeof mapping === "string") {
    keys.add(topLevelKey(mapping));
    return;
  }
  for (const pathText of mapping.concat) keys.add(topLevelKey(pathText));
}

function topLevelKey(pathText: string): string {
  return pathText.split(".")[0] ?? pathText;
}

function droppedTopLevelKeys(source: unknown, used: Set<string>): string[] {
  if (!source || typeof source !== "object" || Array.isArray(source)) return [];
  return Object.keys(source as Record<string, unknown>)
    .filter((key) => !used.has(key))
    .sort();
}

function findImportCycle(edges: Array<Pick<PlannedImportEdge, "from" | "to">>): string[] | null {
  const graph = new Map<string, string[]>();
  for (const edge of edges) {
    graph.set(edge.from, [...(graph.get(edge.from) ?? []), edge.to]);
    if (!graph.has(edge.to)) graph.set(edge.to, []);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  function visit(node: string): string[] | null {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      return [...stack.slice(start), node];
    }
    if (visited.has(node)) return null;
    visiting.add(node);
    stack.push(node);
    for (const child of graph.get(node) ?? []) {
      const cycle = visit(child);
      if (cycle) return cycle;
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  }

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle) return cycle;
  }
  return null;
}

async function importFindingsFromReport(
  root: string,
  reportPath: string,
  nodeIdArg?: string,
  options: { allowEmpty?: boolean } = {},
): Promise<{ nodeId: string; importedFindings: number; findings: unknown[] }> {
  const report = JSON.parse(await readFile(path.resolve(root, reportPath), "utf8")) as unknown;
  const nodeId = nodeIdArg ?? stringAt(report, "nodeId") ?? stringAt(report, "node_id");
  if (!nodeId)
    throw new Error("Report must include nodeId/node_id or command must provide node id");
  const findings = arrayAtPath(report, "findings");
  if (findings.length === 0 && !options.allowEmpty) {
    throw new Error("Report must include a non-empty findings array");
  }
  const imported = [];
  for (const [index, raw] of findings.entries()) {
    const severity = stringAt(raw, "severity");
    if (!severity) throw new Error(`findings[${index}].severity is required`);
    if (!isPriority(severity))
      throw new Error(`findings[${index}].severity must be P0, P1, P2, or P3`);
    const title = stringAt(raw, "title");
    if (!title) throw new Error(`findings[${index}].title is required`);
    const evidence = stringAt(raw, "evidence") ?? stringAt(raw, "body");
    if (!evidence) throw new Error(`findings[${index}].evidence is required`);
    imported.push(
      await addFinding(root, nodeId, {
        severity,
        title,
        evidence,
        path: stringAt(raw, "path"),
        line: numberAt(raw, "line") ?? null,
        expected: stringAt(raw, "expected"),
        suggestedFix: stringAt(raw, "suggested_fix") ?? stringAt(raw, "suggestedFix"),
      }),
    );
  }
  return { nodeId, importedFindings: imported.length, findings: imported };
}

async function viewCommand(
  root: string,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const assetsDir = await findViewerAssetsDir();
  if (options.check) {
    return output({ ok: true, viewer: "embedded", assetsDir }, json);
  }

  const host = stringOpt(options.host) ?? "127.0.0.1";
  const port = numberOpt(options.port) ?? 5173;
  const server = createServer((request, response) => {
    void handleViewerRequest(root, assetsDir, request, response);
  });

  await listen(server, port, host);
  const address = server.address() as AddressInfo;
  const url = `http://${hostForUrl(host)}:${address.port}/`;

  if (json) console.log(JSON.stringify({ ok: true, viewer: "embedded", url, root }, null, 2));
  else console.log(`Serving qd viewer at ${url}`);

  if (options.open) openUrl(url);

  await new Promise<void>((resolve, reject) => {
    server.on("error", reject);
    const shutdown = () => {
      server.close((error) => (error ? reject(error) : resolve()));
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

async function isSourceCheckout(): Promise<boolean> {
  const workspaceRoot = findWorkspaceRoot();
  return (
    (await pathExists(path.join(workspaceRoot, "pnpm-workspace.yaml"))) &&
    (await pathExists(path.join(workspaceRoot, "apps", "viewer")))
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function viewerRuntime(): Promise<string> {
  try {
    await findViewerAssetsDir();
    return "embedded";
  } catch {
    return "missing";
  }
}

async function findViewerAssetsDir(): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const assetsDir = path.join(here, "viewer");
  if (await pathExists(path.join(assetsDir, "index.html"))) return assetsDir;
  throw new Error(
    "qd view assets are missing. Reinstall qd or rebuild the package so the embedded viewer is included.",
  );
}

async function handleViewerRequest(
  root: string,
  assetsDir: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
      response.end("Method not allowed");
      return;
    }

    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/api/graph") {
      return sendJson(response, await graphSnapshot(root), request.method === "HEAD");
    }
    if (requestUrl.pathname === "/api/analytics") {
      return sendJson(response, await analyticsReport(root), request.method === "HEAD");
    }

    const filePath = await viewerFilePath(assetsDir, requestUrl.pathname);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("not a file");
    response.writeHead(200, { "content-type": contentType(filePath) });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
}

function sendJson(response: ServerResponse, payload: unknown, headOnly: boolean): void {
  response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  if (headOnly) response.end();
  else response.end(JSON.stringify(payload));
}

async function viewerFilePath(assetsDir: string, pathname: string): Promise<string> {
  const relative = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const resolved = path.resolve(assetsDir, `.${relative}`);
  const root = path.resolve(assetsDir);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Viewer path escapes asset root");
  }
  if (await pathExists(resolved)) return resolved;
  if (pathname.startsWith("/assets/") || path.extname(pathname)) return resolved;
  return path.join(assetsDir, "index.html");
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath);
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function listen(
  server: ReturnType<typeof createServer>,
  port: number,
  host: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function hostForUrl(host: string): string {
  return host.includes(":") ? `[${host}]` : host;
}

function openUrl(url: string): void {
  const opener =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(opener, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function parseArgs(argv: string[]): ParsedArgs {
  const command: string[] = [];
  const options: Record<string, string | string[] | boolean> = {};
  const repeatableOptions = new Set([
    "project",
    "verify",
    "verification",
    "audit-focus",
    "repo",
    "commit",
    "evidence",
  ]);
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
      const key = requiredArg(rawKey, "option name");
      const next = argv[i + 1];
      const hasInlineValue = inlineValue !== undefined;
      const value = hasInlineValue ? inlineValue : next && !next.startsWith("-") ? next : true;
      if (!hasInlineValue && value !== true) i += 1;

      const current = options[key];
      if (current !== undefined && !repeatableOptions.has(key)) {
        throw new Error(`Option --${key} cannot be repeated`);
      }
      if (repeatableOptions.has(key)) {
        if (Array.isArray(current)) current.push(String(value));
        else if (typeof current === "string") options[key] = [current, String(value)];
        else options[key] = [String(value)];
      } else {
        options[key] = value;
      }
    } else {
      command.push(arg);
    }
  }
  return { command, options };
}

function output(value: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (Array.isArray(value)) {
    console.table(value);
    return;
  }
  if (typeof value === "string") {
    console.log(value);
    return;
  }
  console.log(JSON.stringify(value, null, 2));
}

function required(value: string | string[] | boolean | undefined, name: string): string {
  const resolved = stringOpt(value);
  if (!resolved) throw new Error(`${name} is required`);
  return resolved;
}

function requiredArg(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function setConfigValue(config: QdConfig, key: string, value: string): QdConfig {
  if (key === "check_command" || key === "check-command") return { ...config, checkCommand: value };
  if (key === "ci_command" || key === "ci-command") return { ...config, ciCommand: value };
  if (key === "ci_provider" || key === "ci-provider") return setCiProviderConfig(config, value, {});
  if (key === "ci_repo" || key === "ci-repo") return { ...config, ciRepo: value };
  if (key === "ci_workflow" || key === "ci-workflow") return { ...config, ciWorkflow: value };
  if (key === "ci_auth" || key === "ci-auth") {
    if (value !== "gh-cli") throw new Error("ci_auth must be gh-cli");
    return { ...config, ciAuth: value };
  }
  if (key === "skills_dir" || key === "skills-dir") return { ...config, skillsDir: value };
  if (key === "merge_strategy" || key === "merge-strategy") {
    if (value !== "squash" && value !== "merge" && value !== "rebase") {
      throw new Error("merge_strategy must be squash, merge, or rebase");
    }
    return { ...config, mergeStrategy: value };
  }
  if (key === "require_clean_worktree" || key === "require-clean-worktree") {
    return { ...config, requireCleanWorktree: parseBoolean(value, key) };
  }
  if (key === "clean_worktree_except" || key === "clean-worktree-except") {
    return {
      ...config,
      cleanWorktreeExcept: value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }
  if (key === "require_gate_before_ci" || key === "require-gate-before-ci") {
    return { ...config, requireGateBeforeCi: parseBoolean(value, key) };
  }
  if (key === "require_ci_before_merge" || key === "require-ci-before-merge") {
    return { ...config, requireCiBeforeMerge: parseBoolean(value, key) };
  }
  if (key === "export_default_out" || key === "export-default-out") {
    return { ...config, exportDefaultOut: value };
  }
  if (key === "export_canonicalize_command" || key === "export-canonicalize-command") {
    return { ...config, exportCanonicalizeCommand: value };
  }
  if (key.startsWith("hooks_") || key.startsWith("hooks-")) {
    const hookKey = key.replace(/^hooks[-_]/, "");
    const hooks = { ...config.hooks };
    if (hookKey === "pre_claim" || hookKey === "pre-claim") hooks.preClaim = value;
    else if (hookKey === "post_claim" || hookKey === "post-claim") hooks.postClaim = value;
    else if (hookKey === "pre_check" || hookKey === "pre-check") hooks.preCheck = value;
    else if (hookKey === "post_check" || hookKey === "post-check") hooks.postCheck = value;
    else if (hookKey === "pre_gate" || hookKey === "pre-gate") hooks.preGate = value;
    else if (hookKey === "post_export" || hookKey === "post-export") hooks.postExport = value;
    else if (hookKey === "pre_merge" || hookKey === "pre-merge") hooks.preMerge = value;
    else if (hookKey === "post_merge" || hookKey === "post-merge") hooks.postMerge = value;
    else throw new Error(`Unknown config key: ${key}`);
    return { ...config, hooks };
  }
  if (key === "check_timeout_seconds" || key === "check-timeout-seconds")
    return { ...config, checkTimeoutSeconds: parsePositiveInteger(value, key) };
  if (key === "check_no_output_timeout_seconds" || key === "check-no-output-timeout-seconds")
    return { ...config, checkNoOutputTimeoutSeconds: parsePositiveInteger(value, key) };
  if (key === "ci_timeout_seconds" || key === "ci-timeout-seconds")
    return { ...config, ciTimeoutSeconds: parsePositiveInteger(value, key) };
  if (key === "ci_no_output_timeout_seconds" || key === "ci-no-output-timeout-seconds")
    return { ...config, ciNoOutputTimeoutSeconds: parsePositiveInteger(value, key) };
  throw new Error(`Unknown config key: ${key}`);
}

function setCiProviderConfig(
  config: QdConfig,
  value: string,
  options: Record<string, string | string[] | boolean>,
): QdConfig {
  if (value !== "none" && value !== "github") throw new Error("ci_provider must be none or github");
  if (value === "none") {
    return { ...config, ciProvider: "none", ciRepo: "", ciWorkflow: "", ciAuth: "gh-cli" };
  }
  const repo = stringOpt(options.repo) ?? config.ciRepo;
  const workflow = stringOpt(options.workflow) ?? config.ciWorkflow;
  const auth = stringOpt(options.auth) ?? config.ciAuth;
  if (!repo.trim()) throw new Error("--repo is required when setting ci-provider github");
  if (!workflow.trim()) throw new Error("--workflow is required when setting ci-provider github");
  if (auth !== "gh-cli") throw new Error("--auth must be gh-cli");
  return {
    ...config,
    ciProvider: "github",
    ciRepo: repo,
    ciWorkflow: workflow,
    ciAuth: "gh-cli",
  };
}

function getConfigValue(config: QdConfig, key: string): unknown {
  if (key === "check_command" || key === "check-command") return config.checkCommand;
  if (key === "ci_command" || key === "ci-command") return config.ciCommand;
  if (key === "ci_provider" || key === "ci-provider") return config.ciProvider;
  if (key === "ci_repo" || key === "ci-repo") return config.ciRepo;
  if (key === "ci_workflow" || key === "ci-workflow") return config.ciWorkflow;
  if (key === "ci_auth" || key === "ci-auth") return config.ciAuth;
  if (key === "skills_dir" || key === "skills-dir") return config.skillsDir;
  if (key === "merge_strategy" || key === "merge-strategy") return config.mergeStrategy;
  if (key === "require_clean_worktree" || key === "require-clean-worktree")
    return config.requireCleanWorktree;
  if (key === "clean_worktree_except" || key === "clean-worktree-except")
    return config.cleanWorktreeExcept;
  if (key === "require_gate_before_ci" || key === "require-gate-before-ci")
    return config.requireGateBeforeCi;
  if (key === "require_ci_before_merge" || key === "require-ci-before-merge")
    return config.requireCiBeforeMerge;
  if (key === "export_default_out" || key === "export-default-out") return config.exportDefaultOut;
  if (key === "export_canonicalize_command" || key === "export-canonicalize-command")
    return config.exportCanonicalizeCommand;
  if (key === "hooks" || key === "hook") return config.hooks;
  if (key === "hooks_pre_claim" || key === "hooks-pre-claim") return config.hooks.preClaim;
  if (key === "hooks_post_claim" || key === "hooks-post-claim") return config.hooks.postClaim;
  if (key === "hooks_pre_check" || key === "hooks-pre-check") return config.hooks.preCheck;
  if (key === "hooks_post_check" || key === "hooks-post-check") return config.hooks.postCheck;
  if (key === "hooks_pre_gate" || key === "hooks-pre-gate") return config.hooks.preGate;
  if (key === "hooks_post_export" || key === "hooks-post-export") return config.hooks.postExport;
  if (key === "hooks_pre_merge" || key === "hooks-pre-merge") return config.hooks.preMerge;
  if (key === "hooks_post_merge" || key === "hooks-post-merge") return config.hooks.postMerge;
  if (key === "check_timeout_seconds" || key === "check-timeout-seconds")
    return config.checkTimeoutSeconds;
  if (key === "check_no_output_timeout_seconds" || key === "check-no-output-timeout-seconds")
    return config.checkNoOutputTimeoutSeconds;
  if (key === "ci_timeout_seconds" || key === "ci-timeout-seconds") return config.ciTimeoutSeconds;
  if (key === "ci_no_output_timeout_seconds" || key === "ci-no-output-timeout-seconds")
    return config.ciNoOutputTimeoutSeconds;
  throw new Error(`Unknown config key: ${key}`);
}

function parsePositiveInteger(value: string, key: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${key} must be a positive integer`);
  return parsed;
}

function parseBoolean(value: string, key: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${key} must be true or false`);
}

function stringOpt(value: string | string[] | boolean | undefined): string | undefined {
  if (Array.isArray(value)) return value.at(-1);
  return typeof value === "string" ? value : undefined;
}

function stringListOpt(value: string | string[] | boolean | undefined): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return [value];
  return [];
}

function numberOpt(value: string | string[] | boolean | undefined): number | undefined {
  const text = stringOpt(value);
  if (!text) return undefined;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new Error(`Expected number, got ${text}`);
  return parsed;
}

function requiredNumber(value: string | string[] | boolean | undefined, name: string): number {
  const parsed = numberOpt(value);
  if (parsed === undefined || Number.isNaN(parsed)) throw new Error(`${name} is required`);
  return parsed;
}

function strictEnumOpt<T extends string>(
  value: string | string[] | boolean | undefined,
  isValue: (candidate: string) => candidate is T,
  label: string,
  fallback: T,
): T;
function strictEnumOpt<T extends string>(
  value: string | string[] | boolean | undefined,
  isValue: (candidate: string) => candidate is T,
  label: string,
): T | undefined;
function strictEnumOpt<T extends string>(
  value: string | string[] | boolean | undefined,
  isValue: (candidate: string) => candidate is T,
  label: string,
  fallback?: T,
): T | undefined {
  const text = stringOpt(value);
  if (!text) return fallback;
  if (!isValue(text))
    throw new Error(`${label} must be one of ${validValuesFor(isValue).join(", ")}`);
  return text;
}

function strictOptionalEnum<T extends string>(
  value: string | undefined,
  isValue: (candidate: string) => candidate is T,
  label: string,
  fallback: T,
): T {
  if (!value) return fallback;
  if (!isValue(value))
    throw new Error(`${label} must be one of ${validValuesFor(isValue).join(", ")}`);
  return value;
}

function optionalEnumField<T extends string>(
  value: string | undefined,
  isValue: (candidate: string) => candidate is T,
  label: string,
): T | undefined {
  if (!value) return undefined;
  if (!isValue(value)) {
    throw new Error(`${label} must be one of ${validValuesFor(isValue).join(", ")}`);
  }
  return value;
}

function strictEnum<T extends string>(
  value: string,
  isValue: (candidate: string) => candidate is T,
  label: string,
): T {
  if (!isValue(value))
    throw new Error(`${label} must be one of ${validValuesFor(isValue).join(", ")}`);
  return value;
}

function validValuesFor(isValue: (candidate: string) => boolean): readonly string[] {
  if (isValue === isNodeKind) return NODE_KINDS;
  if (isValue === isNodeStatus) return NODE_STATUSES;
  if (isValue === isPriority) return PRIORITIES;
  if (isValue === isRisk) return RISKS;
  if (isValue === isEdgeType) return EDGE_TYPES;
  if (isValue === isFindingStatus) return FINDING_STATUSES;
  if (isValue === isMergeStrategy) return MERGE_STRATEGIES;
  if (isValue === isBlockerType) return BLOCKER_TYPES;
  if (isValue === isRunKind) return RUN_KINDS;
  if (isValue === isAssignmentRole) return ASSIGNMENT_ROLES;
  if (isValue === isAssignmentStatus) return ASSIGNMENT_STATUSES;
  if (isValue === isWaveKind) return WAVE_KINDS;
  if (isValue === isNoteKind) return NOTE_KINDS;
  return [];
}

function importAdapter(value: string): ImportAdapter {
  if ((IMPORT_ADAPTERS as readonly string[]).includes(value)) return value as ImportAdapter;
  throw new Error(`--adapter must be one of ${IMPORT_ADAPTERS.join(", ")}`);
}

function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value);
}

function isNodeKind(value: string): value is NodeKind {
  return (NODE_KINDS as readonly string[]).includes(value);
}

function isNodeStatus(value: string): value is NodeStatus {
  return (NODE_STATUSES as readonly string[]).includes(value);
}

function isRisk(value: string): value is Risk {
  return (RISKS as readonly string[]).includes(value);
}

function isEdgeType(value: string): value is EdgeType {
  return (EDGE_TYPES as readonly string[]).includes(value);
}

function isFindingStatus(value: string): value is FindingStatus {
  return (FINDING_STATUSES as readonly string[]).includes(value);
}

function isMergeStrategy(value: string): value is QdConfig["mergeStrategy"] {
  return (MERGE_STRATEGIES as readonly string[]).includes(value);
}

function isBlockerType(value: string): value is BlockerType {
  return (BLOCKER_TYPES as readonly string[]).includes(value);
}

function isVerificationType(value: string): value is VerificationEntry["type"] {
  return (VERIFICATION_TYPES as readonly string[]).includes(value);
}

function isRunKind(value: string): value is QdRun["kind"] {
  return (RUN_KINDS as readonly string[]).includes(value);
}

function isAssignmentRole(value: string): value is Parameters<typeof addAssignment>[1]["role"] {
  return (ASSIGNMENT_ROLES as readonly string[]).includes(value);
}

function isAssignmentStatus(value: string): value is "open" | "complete" | "failed" | "cancelled" {
  return (ASSIGNMENT_STATUSES as readonly string[]).includes(value);
}

function isWaveKind(value: string): value is Parameters<typeof startWave>[1]["kind"] {
  return (WAVE_KINDS as readonly string[]).includes(value);
}

function isNoteKind(value: string): value is NoteKind {
  return (NOTE_KINDS as readonly string[]).includes(value);
}

function parseSeverityList(value: string | string[] | boolean | undefined): Priority[] | undefined {
  const raw = stringListOpt(value).flatMap((item) => item.split(","));
  if (raw.length === 0) return undefined;
  return raw.map((item) => {
    const severity = item.trim();
    if (!isPriority(severity)) throw new Error(`--severity must contain P0, P1, P2, or P3`);
    return severity;
  });
}

function parseStatusList(value: string | string[] | boolean | undefined): NodeStatus[] | undefined {
  const raw = stringListOpt(value).flatMap((item) => item.split(","));
  if (raw.length === 0) return undefined;
  return raw.map((item) => {
    const status = item.trim();
    if (!isNodeStatus(status)) {
      throw new Error(`--status must contain one of ${NODE_STATUSES.join(", ")}`);
    }
    return status;
  });
}

function parseNoteKindList(value: string | string[] | boolean | undefined): NoteKind[] | undefined {
  const raw = stringListOpt(value).flatMap((item) => item.split(","));
  if (raw.length === 0) return undefined;
  return raw.map((item) => {
    const kind = item.trim();
    if (!isNoteKind(kind)) throw new Error(`--kind must contain one of ${NOTE_KINDS.join(", ")}`);
    return kind;
  });
}

function filterSnapshot(
  snapshot: GraphSnapshot,
  filters: { statuses?: NodeStatus[]; milestone?: string },
): GraphSnapshot {
  const statuses = filters.statuses ? new Set(filters.statuses) : null;
  const nodeIds = new Set(
    snapshot.nodes
      .filter((node) => !statuses || statuses.has(node.status))
      .filter((node) => !filters.milestone || node.milestone === filters.milestone)
      .map((node) => node.id),
  );
  if (!statuses && !filters.milestone) return snapshot;
  const assignmentIds = new Set(
    snapshot.assignments
      .filter((assignment) => nodeIds.has(assignment.node_id))
      .map((assignment) => assignment.id),
  );
  return {
    ...snapshot,
    nodes: snapshot.nodes.filter((node) => nodeIds.has(node.id)),
    edges: snapshot.edges.filter(
      (edge) => nodeIds.has(edge.from_node) && nodeIds.has(edge.to_node),
    ),
    findings: snapshot.findings.filter((finding) => nodeIds.has(finding.node_id)),
    runs: snapshot.runs.filter((run) => nodeIds.has(run.node_id)),
    node_notes: snapshot.node_notes.filter((note) => nodeIds.has(note.node_id)),
    assignments: snapshot.assignments.filter((assignment) => nodeIds.has(assignment.node_id)),
    wave_memberships: snapshot.wave_memberships.filter(
      (membership) =>
        (membership.node_id && nodeIds.has(membership.node_id)) ||
        (membership.assignment_id && assignmentIds.has(membership.assignment_id)),
    ),
  };
}

function snapshotDiff(
  live: GraphSnapshot,
  exported: GraphSnapshot,
): {
  ok: boolean;
  liveOnlyNodes: string[];
  exportOnlyNodes: string[];
  changedNodes: string[];
  liveNodeCount: number;
  exportNodeCount: number;
} {
  const liveById = new Map(live.nodes.map((node) => [node.id, node]));
  const exportById = new Map(exported.nodes.map((node) => [node.id, node]));
  const liveOnlyNodes = [...liveById.keys()].filter((id) => !exportById.has(id)).sort();
  const exportOnlyNodes = [...exportById.keys()].filter((id) => !liveById.has(id)).sort();
  const changedNodes = [...liveById.keys()]
    .filter((id) => exportById.has(id))
    .filter((id) => JSON.stringify(liveById.get(id)) !== JSON.stringify(exportById.get(id)))
    .sort();
  return {
    ok: liveOnlyNodes.length === 0 && exportOnlyNodes.length === 0 && changedNodes.length === 0,
    liveOnlyNodes,
    exportOnlyNodes,
    changedNodes,
    liveNodeCount: live.nodes.length,
    exportNodeCount: exported.nodes.length,
  };
}

function nextStepForNode(
  node: GraphSnapshot["nodes"][number],
  gate: Awaited<ReturnType<typeof gateNode>>,
  latestCheck: Awaited<ReturnType<typeof latestRun>> | null,
  latestCi: Awaited<ReturnType<typeof latestRun>> | null,
): string | null {
  if (gate.blocking.length > 0) {
    const finding = gate.blocking[0];
    return finding ? `qd finding resolve ${finding.id}` : null;
  }
  if (gate.runningAudits.length > 0) {
    const runRow = gate.runningAudits[0];
    return runRow
      ? `qd audit pass ${node.id} --run-id ${runRow.id} --from-report <audit-report.json>`
      : null;
  }
  const passedRecoveryRun =
    latestCheck?.status === "passed"
      ? latestCheck
      : latestCi?.status === "passed"
        ? latestCi
        : null;
  if (node.status === "blocked" && passedRecoveryRun) {
    return `qd unblock ${node.id} --from-run ${passedRecoveryRun.id} --summary "<why it is unblocked>"`;
  }
  if (node.status !== "mergeable") return `qd ci run ${node.id}`;
  if (latestCi?.status !== "passed") return `qd ci run ${node.id}`;
  return null;
}

function auditReportSchema(): Record<string, unknown> {
  return {
    type: "object",
    required: ["nodeId", "findings"],
    properties: {
      nodeId: { type: "string" },
      node_id: { type: "string" },
      findings: {
        type: "array",
        items: {
          type: "object",
          required: ["severity", "title", "evidence"],
          properties: {
            severity: { enum: PRIORITIES },
            title: { type: "string" },
            evidence: { type: "string" },
            path: { type: "string" },
            line: { type: "number" },
            expected: { type: "string" },
            suggested_fix: { type: "string" },
            suggestedFix: { type: "string" },
          },
        },
      },
    },
  };
}

function findingImportSchema(): Record<string, unknown> {
  return auditReportSchema().properties
    ? {
        type: "object",
        required: ["severity", "title", "evidence"],
        properties: {
          severity: { enum: PRIORITIES },
          title: { type: "string" },
          evidence: { type: "string" },
          path: { type: "string" },
          line: { type: "number" },
          expected: { type: "string" },
          suggested_fix: { type: "string" },
          suggestedFix: { type: "string" },
        },
      }
    : {};
}

function assignmentSchema(): Record<string, unknown> {
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

function verificationSchema(): Record<string, unknown> {
  return {
    type: "object",
    required: ["type", "value"],
    properties: {
      type: { enum: VERIFICATION_TYPES },
      value: { type: "string" },
    },
  };
}

function externalCiSchema(): Record<string, unknown> {
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

function waveSchema(): Record<string, unknown> {
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

function validateAuditReport(value: unknown): { ok: true; findings: number } {
  const report = asRecord(value, "audit report");
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
  }
  return { ok: true, findings: findings.length };
}

function validateAssignmentReport(value: unknown): { ok: true } {
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

function validateVerificationReport(value: unknown): { ok: true } {
  const report = asRecord(value, "verification report");
  requiredNodeStringField(report, "nodeId", "verification report", "node_id");
  const status = requiredNodeStringField(report, "status", "verification report");
  if (status !== "passed" && status !== "failed") {
    throw new Error("verification report status must be passed or failed");
  }
  return { ok: true };
}

function filterNodes(
  nodes: GraphSnapshot["nodes"],
  options: Record<string, string | string[] | boolean>,
): GraphSnapshot["nodes"] {
  const statuses = parseStatusList(options.status);
  const priorities = parseSeverityList(options.priority);
  const kind = strictEnumOpt(options.kind, isNodeKind, "--kind");
  const milestone = stringOpt(options.milestone);
  const project = stringOpt(options.project);
  const group = stringOpt(options.group);
  const limit = numberOpt(options.limit);
  const filtered = nodes
    .filter((node) => !statuses || statuses.includes(node.status))
    .filter((node) => !priorities || priorities.includes(node.priority))
    .filter((node) => !kind || node.kind === kind)
    .filter((node) => !milestone || node.milestone === milestone)
    .filter((node) => !project || node.projects.includes(project))
    .filter((node) => !group || node.group_name === group)
    .sort(compareNodeRows);
  return limit ? filtered.slice(0, limit) : filtered;
}

function formatRows(
  rows: Array<Record<string, unknown> | GraphSnapshot["nodes"][number]>,
  options: Record<string, string | string[] | boolean>,
): unknown {
  const fields = stringOpt(options.fields)
    ?.split(",")
    .map((field) => field.trim())
    .filter(Boolean);
  const shaped = fields
    ? rows.map((row) =>
        Object.fromEntries(
          fields.map((field) => [field, (row as Record<string, unknown>)[field] ?? null]),
        ),
      )
    : rows;
  if (options.tsv) {
    const selected = fields ?? Object.keys(shaped[0] ?? {});
    return [
      selected.join("\t"),
      ...shaped.map((row) =>
        selected.map((field) => formatCell((row as Record<string, unknown>)[field])).join("\t"),
      ),
    ].join("\n");
  }
  if (options.compact) {
    return shaped.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      milestone: row.milestone,
    }));
  }
  return shaped;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function compareNodeRows(
  a: GraphSnapshot["nodes"][number],
  b: GraphSnapshot["nodes"][number],
): number {
  return (
    (PRIORITIES as readonly string[]).indexOf(a.priority) -
      (PRIORITIES as readonly string[]).indexOf(b.priority) ||
    a.estimate_points - b.estimate_points ||
    a.id.localeCompare(b.id)
  );
}

function parseVerification(value: string): VerificationEntry {
  const fields = Object.fromEntries(
    value.split(",").map((part) => {
      const [key, ...rest] = part.split("=");
      return [key?.trim(), rest.join("=").trim()];
    }),
  );
  const type = fields.type || "manual";
  const entryValue = fields.value || value;
  if (type !== "command" && type !== "manual" && type !== "url" && type !== "note") {
    throw new Error(`Unknown verification type: ${type}`);
  }
  return { type, value: entryValue };
}

function strictArrayAtPath(source: unknown, pathText: string, requiredPath: boolean): unknown[] {
  const value = valueAtPath(source, pathText);
  if (value === undefined) {
    if (requiredPath) throw new Error(`Expected ${pathText} to be an array`);
    return [];
  }
  if (!Array.isArray(value)) throw new Error(`Expected ${pathText} to be an array`);
  return value;
}

function arrayAtPath(source: unknown, pathText: string): unknown[] {
  const value = valueAtPath(source, pathText);
  return Array.isArray(value) ? value : [];
}

function stringAt(source: unknown, pathText: string): string | undefined {
  const value = valueAtPath(source, pathText);
  return typeof value === "string" ? value : undefined;
}

function numberAt(source: unknown, pathText: string): number | undefined {
  const value = valueAtPath(source, pathText);
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function strictStringArrayAt(source: unknown, pathText: string, label: string): string[] {
  const value = valueAtPath(source, pathText);
  if (value === undefined || value === null) return [];
  if (typeof value === "string") return value.trim() ? [value] : [];
  if (!Array.isArray(value)) throw new Error(`${label} at ${pathText} must be a string array`);
  const invalidIndex = value.findIndex((item) => typeof item !== "string");
  if (invalidIndex !== -1)
    throw new Error(`${label} at ${pathText}[${invalidIndex}] must be a string`);
  return value.filter((item) => item.trim());
}

function strictVerificationArrayAt(
  source: unknown,
  pathText: string,
  label: string,
): VerificationEntry[] {
  const value = valueAtPath(source, pathText);
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} at ${pathText} must be an array`);
  return value.map((item, index): VerificationEntry => {
    if (typeof item === "string") return parseVerification(item);
    if (item && typeof item === "object") {
      const type = stringAt(item, "type") ?? "manual";
      const entryValue = stringAt(item, "value");
      if (!entryValue) throw new Error(`${label}[${index}].value is required`);
      return parseVerification(`type=${type},value=${entryValue}`);
    }
    throw new Error(`${label}[${index}] must be a string or object`);
  });
}

function canonicalSnapshotFrom(source: unknown): GraphSnapshot | undefined {
  if (!isRecord(source) || source.schema_version === undefined) return undefined;
  if (source.schema_version !== 1) {
    throw new Error(
      `Unsupported qd export schema_version: ${formatUnknown(source.schema_version)}`,
    );
  }
  const registries = valueAtPath(source, "registries");
  if (!isRecord(registries)) throw new Error("qd export registries must be an object");
  return {
    schema_version: 1,
    exported_at: requiredStringField(source, "exported_at"),
    registries: {
      groups: requiredArrayField(registries, "groups"),
      projects: requiredArrayField(registries, "projects"),
      milestones: requiredArrayField(registries, "milestones"),
    },
    nodes: requiredArrayField(source, "nodes"),
    edges: requiredArrayField(source, "edges"),
    findings: requiredArrayField(source, "findings"),
    runs: requiredArrayField(source, "runs"),
    node_notes: requiredArrayField(source, "node_notes"),
    assignments: optionalArrayField(source, "assignments"),
    waves: optionalArrayField(source, "waves"),
    wave_memberships: optionalArrayField(source, "wave_memberships"),
  } as GraphSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requiredStringField(source: Record<string, unknown>, field: string): string {
  const value = source[field];
  if (typeof value !== "string" || !value.trim()) throw new Error(`qd export ${field} is required`);
  return value;
}

function requiredArrayField<T = unknown>(source: Record<string, unknown>, field: string): T[] {
  const value = source[field];
  if (!Array.isArray(value)) throw new Error(`qd export ${field} must be an array`);
  return value as T[];
}

function optionalArrayField<T = unknown>(source: Record<string, unknown>, field: string): T[] {
  const value = source[field];
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`qd export ${field} must be an array`);
  return value as T[];
}

function formatUnknown(value: unknown): string {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value) ?? "<unknown>";
}

function stripUndefinedValues<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<T>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function valueAtPath(source: unknown, pathText: string): unknown {
  return pathText.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, source);
}

function toMermaid(snapshot: Awaited<ReturnType<typeof graphSnapshot>>): string {
  const lines = ["flowchart TD"];
  for (const node of snapshot.nodes) {
    lines.push(`  ${safeId(node.id)}["${node.id}: ${node.title.replaceAll('"', "'")}"]`);
  }
  for (const edge of snapshot.edges.filter((item) => item.type === "requires")) {
    lines.push(`  ${safeId(edge.from_node)} --> ${safeId(edge.to_node)}`);
  }
  return lines.join("\n");
}

function toDot(snapshot: Awaited<ReturnType<typeof graphSnapshot>>): string {
  const lines = ["digraph qd {"];
  for (const node of snapshot.nodes)
    lines.push(`  "${node.id}" [label="${node.id}: ${node.title.replaceAll('"', "'")}"];`);
  for (const edge of snapshot.edges.filter((item) => item.type === "requires"))
    lines.push(`  "${edge.from_node}" -> "${edge.to_node}";`);
  lines.push("}");
  return lines.join("\n");
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, "_");
}

function findWorkspaceRoot(): string {
  return path.resolve(new URL("../../..", import.meta.url).pathname);
}

function cliVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  for (const packagePath of [
    path.join(here, "..", "package.json"),
    path.join(here, "package.json"),
  ]) {
    try {
      const parsed = JSON.parse(readFileSync(packagePath, "utf8")) as { version?: unknown };
      if (typeof parsed.version === "string" && parsed.version.trim()) return parsed.version;
    } catch {
      // Development builds without a package manifest should not report a stale release.
    }
  }
  return "0.0.0-dev";
}

function helpText(): string {
  return `qd - Quick DAG CLI

Global:
  qd --root <path> <command>
  QD_ROOT=/path/to/repo qd <command>

Core:
  qd init
  qd setup [--no-hooks] [--print-agent-url]
  qd doctor [--strict] [--json]
  qd status [--json]
  qd stats [--json] [--window 7] [--milestone <name>]
  qd snapshot [--json] [--milestone <name>]
  qd ready [--json]
  qd graph --format table|json|mermaid|dot
  qd velocity [--window 7]
  qd critical-path [--milestone <name>]
  qd eta [--window 7] [--milestone <name>]
  qd prompt plan|implement|audit|resolve [node] [--include-project-rules <path>] [--base main] [--json]
  qd config show
  qd config get ci-command
  qd config set check-command --value "<fast project check command>"
  qd config set ci-provider github --repo owner/name --workflow ci.yml --auth gh-cli
  qd export [--out roadmap/spec-dag.json] [--deterministic]
  qd export --status ready,claimed,review --milestone alpha [--json]
  qd import --from roadmap/spec-dag.json [--schema-mapping qd-import-map.json] [--dry-run] [--verbose] [--merge]
  qd sync --from roadmap/spec-dag.json
  qd import --from docs/ROADMAP.html --adapter roadmap-html [--dry-run]
  qd import --from roadmap.md --adapter markdown-checklist [--dry-run]
  qd workspace status|ready|graph [--json] [--config ~/.config/qd/workspaces.toml] [--repo <path>]

Graph:
  qd node add --title <text> --spec <text> --acceptance <text> [--id <id>] [--project <name>] [--verify type=command,value="<command>"] [--ci-command <command>]
  qd node add --from-json <node.json>
  qd node add --title <text> --spec-file <path> --acceptance-file <path>
  qd nodes add-bulk --from-json <plan.json>
  qd node list|show|edit|cancel|note
  qd node show <id> --full
  qd node edit <id> --from-json <patch.json>
  qd node edit <id> --spec-file <path> --acceptance-file <path>
  qd node edit <id> --blocked-by manual|external|policy --blocked-reason <text> [--blocked-owner <name>]
  qd node edit <id> --clear-blocker --status ready
  qd note add <node> --text <text>
  qd group register --name <name>
  qd project register --name <name>
  qd milestone register --name <name> --rank <n>
  qd edge add <from> <to> [--type requires]
  qd claim [node] --agent <name> [--branch <branch>]
  qd complete <node> --summary <text>
  qd advance <node> --summary <text> [--merge]
  qd diff <node> [--base main] [--self-only] [--name-only]

Audit:
  qd audit start <node>
  qd finding add <node> --severity P1 --title <text> --evidence <text>
  qd finding add [node] --from-report <audit-report.json>
  qd finding list [--open] [--severity P0,P1] [--node <id>]
  qd finding resolve <finding>
  qd promote-findings <node>
  qd gate <node>
  qd check run <node>
  qd ci run <node>
  qd ci poll <node> [--sha <commit>] [--provider github] [--repo owner/name] [--workflow ci.yml]
  qd ci record-pass <node> --summary <text> (--log-path <path>|--url <url>|--external-id <id>)
  qd verification sign-off <node> --type manual --note <text> [--evidence <path>]
  qd audit pass <node> --from-report <audit-report.json>
  qd merge <node> --use-existing-commit <sha>

Viewer:
  qd view [--host 127.0.0.1] [--port 5173] [--open] [--json]
  qd view --check [--json]`;
}

function commandHelp(group: string, action?: string): string {
  const key = [group, action].filter(Boolean).join(" ");
  const entries: Record<string, string> = {
    complete:
      "qd complete <node> --summary <text>\nRecords implementation completion and moves the node to review.",
    advance:
      "qd advance <node> --summary <text> [--merge] [--skip-check] [--skip-ci]\nRuns completion, gate, check, CI, and optionally qd merge until a gate fails.",
    check:
      "qd check run <node> [--cmd <command>] [--no-hooks]\nRuns the configured fast preflight and records a check run/log.",
    "check run":
      "qd check run <node> [--cmd <command>] [--no-hooks]\nMutates qd state with a passed or failed check run.",
    ci: "qd ci run|poll|record-pass|fail <node>\nRecords full trusted CI evidence. Passing CI makes a node mergeable.",
    "ci run":
      "qd ci run <node> [--cmd <command>] [--no-hooks]\nRuns the configured full CI command and records log evidence.",
    merge:
      "qd merge <node> [--strategy squash|merge|rebase] [--use-existing-commit <sha>] [--no-hooks]\nRecords qd merge state only; it does not run git merge or open a PR.",
    audit:
      "qd audit start|pass|fail|dispose|cancel|supersede|list <node>\nTracks audit run lifecycle and findings.",
    "audit pass":
      "qd audit pass <node> --from-report <audit-report.json> [--run-id <id>]\nCloses an audit run as passed, imports findings, blocks on P0/P1, promotes P2/P3.",
    assignment:
      "qd assignment add|complete|fail|cancel|list\nRecords opaque external worker/auditor ownership. qd does not launch agents.",
    wave: "qd wave start|add-node|add-assignment|complete|status\nRecords wave-level orchestration state.",
    worktree:
      "qd worktree create|status|list|cleanup <node>\nCreates and tracks git worktrees with branch collision checks.",
  };
  return entries[key] ?? entries[group] ?? helpText();
}

function topicHelp(topic: string): string {
  const topics: Record<string, string> = {
    lifecycle:
      "qd lifecycle: ready -> claim -> complete -> audit -> gate -> check -> ci -> merge.\nP0/P1 findings and running audits block gate. qd records state; external tools do the work.",
    audits:
      "qd audits: use qd audit start, qd audit pass/fail --from-report, and qd audit dispose/cancel/supersede with rationale for stale runs.",
    worktrees:
      "qd worktrees: use one branch/worktree per active node or assignment. qd refuses duplicate branch/path checkouts and dirty cleanup.",
    assignments:
      "qd assignments: record role, owner, branch, worktree, scope, commits, and evidence. Owner strings are opaque and agent-agnostic.",
    waves:
      "qd waves: group nodes and assignments into orchestration waves, then complete the wave with a summary.",
    gates:
      "qd gates: qd gate blocks on open P0/P1 findings and running audit runs. Merge additionally requires mergeable status and passed CI by default.",
    export:
      "qd export: commit deterministic qd JSON, not .qd/qd.db. Configure [export].canonicalize_command for repo formatting hooks.",
    "agent-agnostic-orchestration":
      "qd never launches Codex, Claude, or any agent runtime. It records DAG state, assignments, evidence, gates, audits, findings, and exports.",
  };
  return topics[topic] ?? helpText();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
