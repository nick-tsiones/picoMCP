import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  addEdge,
  addFinding,
  addNode,
  addNodeNote,
  analyticsReport,
  cancelNode,
  ciFail,
  ciPass,
  claimNode,
  completeNode,
  criticalPathReport,
  etaReport,
  getProjectPaths,
  gateNode,
  getNode,
  graphSnapshot,
  initProject,
  listNodeNotes,
  listEdges,
  listNodes,
  listRegistry,
  markMerged,
  promoteFindings,
  readConfig,
  recordCiResult,
  readyNodes,
  registerGroup,
  registerMilestone,
  registerProject,
  recordCheckResult,
  removeEdge,
  resolveFinding,
  setupProject,
  startRun,
  stats,
  updateNode,
  validateGraph,
  velocityReport,
  writeConfig,
  type QdConfig,
  type EdgeType,
  type NodeKind,
  type NodeStatus,
  type Priority,
  type Risk,
  type VerificationEntry,
} from "@qdcli/core";
import { promptText, skillText } from "./prompts.js";

interface ParsedArgs {
  command: string[];
  options: Record<string, string | string[] | boolean>;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const [group, action, extra] = args.command;
  const json = Boolean(args.options.json);
  const root = process.cwd();

  if (!group || group === "help" || group === "--help" || group === "-h") {
    console.log(helpText());
    return;
  }

  if (group === "--version" || group === "-v") {
    console.log("0.1.0");
    return;
  }

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
      return doctor(root, json);
    case "status":
      return output(await stats(root), json);
    case "ready":
      return output(await readyNodes(root), json);
    case "graph":
      return graph(root, args.options, json);
    case "validate":
      return validation(root, json);
    case "config":
      return configCommand(root, action, extra, args.options, json);
    case "import":
      return importCommand(root, args.options, json);
    case "group":
      return registryCommand(root, "groups", action, args.options, json);
    case "project":
      return registryCommand(root, "projects", action, args.options, json);
    case "node":
      return nodeCommand(root, action, extra, args.options, json);
    case "edge":
      return edgeCommand(root, action, args.command.slice(2), args.options, json);
    case "claim":
      return output(
        await claimNode(root, {
          id: action,
          agent: required(args.options.agent, "--agent"),
          branch: stringOpt(args.options.branch),
        }),
        json,
      );
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
      return output(
        await startRun(root, requiredArg(action === "start" ? extra : action, "node id"), "audit"),
        json,
      );
    case "finding":
      return findingCommand(root, action, extra, args.options, json);
    case "promote-findings":
      return output(await promoteFindings(root, requiredArg(action, "node id")), json);
    case "gate":
      return gate(root, requiredArg(action, "node id"), json);
    case "ci":
      return ciCommand(root, action, extra, args.options, json);
    case "check":
      return checkCommand(root, action, extra, args.options, json);
    case "merge":
      return output(
        await markMerged(
          root,
          requiredArg(action, "node id"),
          stringOpt(args.options.strategy) ?? "squash",
        ),
        json,
      );
    case "plan":
      return planCommand(root, action, args.options, json);
    case "milestone":
      return milestoneCommand(root, action, args.options, json);
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
    case "prompt":
      return promptCommand(root, action, extra);
    case "agent":
      return agentCommand(root, action, extra, args.options, json);
    case "view":
      return viewCommand(args.options);
    default:
      throw new Error(`Unknown command: ${group}`);
  }
}

async function doctor(root: string, json: boolean): Promise<void> {
  await initProject(root);
  const validationResult = await validateGraph(root);
  const config = await readConfig(root);
  const configErrors: string[] = [];
  if (!config.checkCommand.trim()) configErrors.push("check_command is empty");
  if (!config.ciCommand.trim()) configErrors.push("ci_command is empty");
  if (!["squash", "merge", "rebase"].includes(config.mergeStrategy)) {
    configErrors.push("merge_strategy must be squash, merge, or rebase");
  }
  const result = {
    ok: validationResult.ok && configErrors.length === 0,
    checks: {
      initialized: true,
      schema: true,
      graph: validationResult.ok,
      config: configErrors.length === 0,
    },
    config,
    errors: [...validationResult.errors, ...configErrors],
    warnings: validationResult.warnings,
  };
  output(result, json);
  if (!result.ok) process.exitCode = 1;
}

async function configCommand(
  root: string,
  action: string | undefined,
  key: string | undefined,
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
    const value = requiredArg(options.value ? stringOpt(options.value) : undefined, "--value");
    const next = setConfigValue(config, requiredArg(key, "config key"), value);
    await writeConfig(root, next);
    return output(next, json);
  }
  throw new Error(`Unknown config action: ${action}`);
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

async function validation(root: string, json: boolean): Promise<void> {
  const result = await validateGraph(root);
  output(result, json);
  if (!result.ok) process.exitCode = 1;
}

async function nodeCommand(
  root: string,
  action: string | undefined,
  id: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "add") {
    return output(
      await addNode(root, {
        id: stringOpt(options.id),
        title: required(options.title, "--title"),
        kind: enumOpt<NodeKind>(options.kind) ?? "feature",
        milestone: stringOpt(options.milestone),
        groupName: stringOpt(options.group),
        projects: stringListOpt(options.project),
        status: enumOpt<NodeStatus>(options.status) ?? "ready",
        priority: enumOpt<Priority>(options.priority) ?? "P2",
        estimatePoints: numberOpt(options.estimate) ?? 1,
        risk: enumOpt<Risk>(options.risk) ?? "medium",
        spec: required(options.spec, "--spec"),
        acceptance: required(options.acceptance, "--acceptance"),
        validation: stringOpt(options.validation),
        verification: stringListOpt(options.verify).map(parseVerification),
        auditFocus: stringListOpt(options["audit-focus"]),
        context: stringOpt(options.context),
        statusReason: stringOpt(options["status-reason"]),
        checkCommand: stringOpt(options["check-command"]),
      }),
      json,
    );
  }
  if (action === "note") return nodeNoteCommand(root, id, options, json);
  if (action === "show") return output(await getNode(root, requiredArg(id, "node id")), json);
  if (action === "list" || !action) return output(await listNodes(root), json);
  if (action === "cancel") return output(await cancelNode(root, requiredArg(id, "node id")), json);
  if (action === "edit") {
    return output(
      await updateNode(root, requiredArg(id, "node id"), {
        title: stringOpt(options.title),
        kind: enumOpt<NodeKind>(options.kind),
        milestone: stringOpt(options.milestone),
        group_name: stringOpt(options.group),
        projects: options.project ? stringListOpt(options.project) : undefined,
        status: enumOpt<NodeStatus>(options.status),
        priority: enumOpt<Priority>(options.priority),
        estimatePoints: numberOpt(options.estimate),
        risk: enumOpt<Risk>(options.risk),
        spec: stringOpt(options.spec),
        acceptance: stringOpt(options.acceptance),
        validation: stringOpt(options.validation),
        verification: options.verify
          ? stringListOpt(options.verify).map(parseVerification)
          : undefined,
        audit_focus: options["audit-focus"] ? stringListOpt(options["audit-focus"]) : undefined,
        context: stringOpt(options.context),
        status_reason: stringOpt(options["status-reason"]),
        check_command: stringOpt(options["check-command"]),
      }),
      json,
    );
  }
  throw new Error(`Unknown node action: ${action}`);
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
        enumOpt<EdgeType>(options.type) ?? "requires",
      ),
      json,
    );
  }
  if (action === "remove") {
    await removeEdge(
      root,
      requiredArg(values[0], "from node"),
      requiredArg(values[1], "to node"),
      enumOpt<EdgeType>(options.type) ?? "requires",
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
        severity: enumOpt<Priority>(options.severity) ?? "P2",
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
  throw new Error(`Unknown finding action: ${action}`);
}

async function gate(root: string, nodeId: string, json: boolean): Promise<void> {
  const result = await gateNode(root, nodeId);
  output(result, json);
  if (!result.ok) process.exitCode = 1;
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
  if (action === "start") {
    return output(
      await startRun(root, requiredArg(nodeId, "node id"), "ci", {
        summary: stringOpt(options.cmd),
      }),
      json,
    );
  }
  if (action === "pass")
    return output(
      await ciPass(root, requiredArg(nodeId, "node id"), stringOpt(options.summary)),
      json,
    );
  if (action === "fail")
    return output(
      await ciFail(root, requiredArg(nodeId, "node id"), stringOpt(options.summary)),
      json,
    );
  throw new Error(`Unknown ci action: ${action}`);
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
    return output(
      await analyticsReport(root, {
        milestone: stringOpt(options.milestone) ?? null,
        windowDays: numberOpt(options.window) ?? 7,
      }),
      json,
    );
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
  if (mode === "list") return output(await listNodeNotes(root, id), json);
  return output(await addNodeNote(root, id, required(options.text, "--text")), json);
}

async function importCommand(
  root: string,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const filePath = path.resolve(root, required(options.from, "--from"));
  const mappingPath = stringOpt(options["schema-mapping"]);
  const source = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  const mapping = mappingPath
    ? (JSON.parse(await readFile(path.resolve(root, mappingPath), "utf8")) as ImportMapping)
    : defaultImportMapping;
  const nodes = arrayAtPath(source, mapping.nodesPath ?? "nodes");
  const edges = arrayAtPath(source, mapping.edgesPath ?? "edges");
  const importedNodes = [];
  const importedEdges = [];

  for (const raw of nodes) {
    const node = await addNode(root, {
      id: stringAt(raw, mapping.id ?? "id"),
      title:
        stringAt(raw, mapping.title ?? "title") ??
        stringAt(raw, mapping.id ?? "id") ??
        "Imported node",
      kind: enumString<NodeKind>(stringAt(raw, mapping.kind ?? "kind")) ?? "feature",
      milestone: stringAt(raw, mapping.milestone ?? "milestone"),
      groupName: stringAt(raw, mapping.group ?? "group"),
      projects: stringArrayAt(raw, mapping.projects ?? "projects"),
      status: enumString<NodeStatus>(stringAt(raw, mapping.status ?? "status")) ?? "ready",
      priority: enumString<Priority>(stringAt(raw, mapping.priority ?? "priority")) ?? "P2",
      estimatePoints: numberAt(raw, mapping.estimate ?? "estimate") ?? 1,
      risk: enumString<Risk>(stringAt(raw, mapping.risk ?? "risk")) ?? "medium",
      spec:
        stringAt(raw, mapping.spec ?? "spec") ??
        stringAt(raw, mapping.title ?? "title") ??
        "Imported spec",
      acceptance:
        stringAt(raw, mapping.acceptance ?? "acceptance") ??
        "Imported acceptance criteria must be verified.",
      validation: stringAt(raw, mapping.validation ?? "validation"),
      verification: verificationArrayAt(raw, mapping.verification ?? "verification"),
      auditFocus: stringArrayAt(raw, mapping.auditFocus ?? "auditFocus"),
      context: stringAt(raw, mapping.context ?? "context"),
      statusReason: stringAt(raw, mapping.statusReason ?? "statusReason"),
    });
    importedNodes.push(node);
  }

  for (const raw of edges) {
    const from = stringAt(raw, mapping.edgeFrom ?? "from");
    const to = stringAt(raw, mapping.edgeTo ?? "to");
    if (!from || !to) continue;
    importedEdges.push(
      await addEdge(
        root,
        from,
        to,
        enumString<EdgeType>(stringAt(raw, mapping.edgeType ?? "type")) ?? "requires",
      ),
    );
  }

  return output(
    {
      importedNodes: importedNodes.length,
      importedEdges: importedEdges.length,
    },
    json,
  );
}

async function promptCommand(
  root: string,
  action: string | undefined,
  id: string | undefined,
): Promise<void> {
  if (action === "implement" && id) {
    console.log(promptText("implement", await getNode(root, id)));
    return;
  }
  console.log(promptText(action ?? "plan"));
}

async function runConfiguredCheck(
  root: string,
  nodeId: string,
  kind: "check" | "ci",
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  const config = await readConfig(root);
  if (config.requireGateBeforeCi) {
    const gate = await gateNode(root, nodeId);
    if (!gate.ok) {
      output({ ok: false, blocking: gate.blocking }, json);
      process.exitCode = 1;
      return;
    }
  }

  if (config.requireCleanWorktree) await assertCleanWorktree(root, config.cleanWorktreeExcept);

  const node = await getNode(root, nodeId);
  const command =
    stringOpt(options.cmd) ??
    node.check_command ??
    (kind === "ci" ? config.ciCommand : config.checkCommand);
  const paths = getProjectPaths(root);
  await mkdir(paths.logsDir, { recursive: true });
  const startedAt = new Date().toISOString();
  const logPath = path.join(
    paths.logsDir,
    `${kind}-${nodeId}-${startedAt.replace(/[:.]/g, "-")}.log`,
  );
  const exitCode = await runShellCommand(command, root, logPath);
  const finishedAt = new Date().toISOString();
  const status = exitCode === 0 ? "passed" : "failed";
  const recorder = kind === "ci" ? recordCiResult : recordCheckResult;
  const updatedNode = await recorder(root, nodeId, {
    status,
    summary: `${kind} command ${status}: ${command}`,
    logPath,
    startedAt,
    finishedAt,
  });
  const result = {
    ok: exitCode === 0,
    exitCode,
    command,
    logPath,
    node: updatedNode,
  };
  output(result, json);
  if (exitCode !== 0) process.exitCode = exitCode;
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

function runShellCommand(command: string, cwd: string, logPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk);
      void appendFile(logPath, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk);
      void appendFile(logPath, chunk);
    });
    child.on("error", reject);
    child.on("exit", (code: number | null) => resolve(code ?? 1));
  });
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
    if (requested !== "skills-sh" && requested !== "codex" && requested !== "claude") {
      throw new Error("agent install target must be skills-sh, codex, or claude");
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
  if (action === "doctor") return doctor(root, json);
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
  spec?: string;
  acceptance?: string;
  validation?: string;
  verification?: string;
  auditFocus?: string;
  context?: string;
  statusReason?: string;
  edgeFrom?: string;
  edgeTo?: string;
  edgeType?: string;
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
  edgeFrom: "from_node",
  edgeTo: "to_node",
  edgeType: "type",
};

async function importFindingsFromReport(
  root: string,
  reportPath: string,
  nodeIdArg?: string,
): Promise<unknown> {
  const report = JSON.parse(await readFile(path.resolve(root, reportPath), "utf8")) as unknown;
  const nodeId = nodeIdArg ?? stringAt(report, "nodeId") ?? stringAt(report, "node_id");
  if (!nodeId)
    throw new Error("Report must include nodeId/node_id or command must provide node id");
  const findings = arrayAtPath(report, "findings");
  if (findings.length === 0) throw new Error("Report must include a non-empty findings array");
  const imported = [];
  for (const [index, raw] of findings.entries()) {
    const severity = stringAt(raw, "severity") ?? "P2";
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

function viewCommand(options: Record<string, string | string[] | boolean>): Promise<void> {
  const port = stringOpt(options.port) ?? "5173";
  const child = spawn(
    "corepack",
    ["pnpm", "exec", "vp", "run", "@qdcli/viewer#dev", "--", "--host", "127.0.0.1", "--port", port],
    {
      cwd: findWorkspaceRoot(),
      env: { ...process.env, QD_ROOT: process.cwd() },
      stdio: "inherit",
    },
  );
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code: number | null) =>
      code === 0 ? resolve() : reject(new Error(`viewer exited with code ${code}`)),
    );
  });
}

function parseArgs(argv: string[]): ParsedArgs {
  const command: string[] = [];
  const options: Record<string, string | string[] | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) continue;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        const current = options[key];
        if (Array.isArray(current)) current.push(next);
        else if (typeof current === "string") options[key] = [current, next];
        else options[key] = next;
        i += 1;
      } else {
        options[key] = true;
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
  throw new Error(`Unknown config key: ${key}`);
}

function getConfigValue(config: QdConfig, key: string): unknown {
  if (key === "check_command" || key === "check-command") return config.checkCommand;
  if (key === "ci_command" || key === "ci-command") return config.ciCommand;
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
  throw new Error(`Unknown config key: ${key}`);
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

function enumOpt<T extends string>(value: string | string[] | boolean | undefined): T | undefined {
  return stringOpt(value) as T | undefined;
}

function enumString<T extends string>(value: string | undefined): T | undefined {
  return value as T | undefined;
}

function isPriority(value: string): value is Priority {
  return value === "P0" || value === "P1" || value === "P2" || value === "P3";
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

function stringArrayAt(source: unknown, pathText: string): string[] {
  const value = valueAtPath(source, pathText);
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function verificationArrayAt(source: unknown, pathText: string): VerificationEntry[] {
  const value = valueAtPath(source, pathText);
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): VerificationEntry[] => {
    if (typeof item === "string") return [parseVerification(item)];
    if (item && typeof item === "object") {
      const type = stringAt(item, "type") ?? "manual";
      const entryValue = stringAt(item, "value");
      if (!entryValue) return [];
      return [parseVerification(`type=${type},value=${entryValue}`)];
    }
    return [];
  });
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

function helpText(): string {
  return `qd - Quick DAG CLI

Core:
  qd init
  qd setup [--no-hooks] [--print-agent-url]
  qd doctor [--json]
  qd status [--json]
  qd stats [--json] [--window 7] [--milestone <name>]
  qd ready [--json]
  qd graph --format table|json|mermaid|dot
  qd velocity [--window 7]
  qd critical-path [--milestone <name>]
  qd eta [--window 7] [--milestone <name>]
  qd config show
  qd config get ci-command
  qd config set check-command --value "<fast project check command>"
  qd import --from roadmap/spec-dag.json --schema-mapping qd-import-map.json

Graph:
  qd node add --title <text> --spec <text> --acceptance <text> [--id <id>] [--project <name>] [--verify type=command,value="<command>"]
  qd node list|show|edit|cancel|note
  qd group register --name <name>
  qd project register --name <name>
  qd milestone register --name <name> --rank <n>
  qd edge add <from> <to> [--type requires]
  qd claim [node] --agent <name>
  qd complete <node> --summary <text>

Audit:
  qd audit start <node>
  qd finding add <node> --severity P1 --title <text> --evidence <text>
  qd finding add [node] --from-report <audit-report.json>
  qd finding resolve <finding>
  qd gate <node>
  qd check run <node>
  qd ci run <node>

Viewer:
  qd view [--port 5173]`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
