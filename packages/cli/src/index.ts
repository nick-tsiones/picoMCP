import { fileURLToPath } from "node:url";
import {
  analyticsReport,
  criticalPathReport,
  etaReport,
  graphSnapshot,
  initProject,
  listRegistry,
  policyReport,
  promoteFindings,
  readyNodes,
  registerGroup,
  registerMilestone,
  registerProject,
  resolveProjectRoot,
  setupProject,
  startRun,
  velocityReport,
} from "@cat-cave/qdcli-core";
import {
  numberOpt,
  output,
  parseArgs,
  parseBoolean,
  parsePositiveInteger,
  required,
  requiredArg,
  requiredNumber,
  stringOpt,
} from "./args.js";
import { getConfigValue, setCiProviderConfig, setConfigValue } from "./config-options.js";
import {
  isPolicyPhase,
  parseNoteKindList,
  parseSeverityList,
  parseStatusList,
  strictEnumOpt,
} from "./enums.js";
import {
  numberAt,
  parseVerification,
  strictArrayAtPath,
  strictStringArrayAt,
  strictVerificationArrayAt,
  stringAt,
} from "./object-utils.js";
import {
  contentType,
  handleViewerRequest,
  hostForUrl,
  viewCommand,
  viewerFilePath,
} from "./viewer.js";
import {
  filterSnapshot,
  formatCell,
  formatRows,
  nextStepForNode,
  snapshotDiff,
} from "./graph-format.js";
import { diffCommand } from "./diff.js";
import { worktreeCommand } from "./worktree.js";
import { cliVersion, commandHelp, helpText, topicHelp } from "./help.js";
import { ciCommand } from "./ci.js";
import { advanceCommand, checkCommand, verificationCommand } from "./lifecycle.js";
import { blockCommand, completeCommand, unblockCommand } from "./lifecycle-reports.js";
import {
  readOverviewCommand,
  readTabCommand,
  sizeCommand,
  parseCommand,
  writeCommand,
  lintCommand,
  convertCommand,
  flagsGetCommand,
  flagsSetCommand,
  flagsBulkCommand,
  spriteGetCommand,
  spriteSetCommand,
  spriteGetRangeCommand,
  spriteSetRangeCommand,
  spriteExportCommand,
  spriteImportCommand,
  mapGetCommand,
  mapSetCommand,
  mapGetRegionCommand,
  mapSetRegionCommand,
  sfxGetCommand,
  sfxSetCommand,
  sfxListCommand,
  minifyCommand,
  editRangeCommand,
  editReplaceCommand,
  editAppendCommand,
} from "./cartridge-commands.js";
import { assignmentCommand, waveCommand } from "./orchestration.js";
import { auditCommand, findingCommand, gate } from "./audit.js";
import {
  claimCommand,
  edgeCommand,
  mergeCommand,
  nodeCommand,
  nodesCommand,
  noteCommand,
} from "./graph-commands.js";
import { importCommand, syncCommand } from "./import-command.js";
import { refApiCommand, refPitfallsCommand } from "./ref-commands.js";
import {
  configCommand,
  doctorCommand,
  exportCommand,
  graphCommand,
  migrateCommand,
  readyCommand,
  snapshotCommand,
  statusCommand,
  validationCommand,
  workspaceCommand,
} from "./project-commands.js";
import {
  agentCommand,
  envCommand,
  installSkill,
  promptCommand,
  readinessCommand,
  runCommand,
  schemaCommand,
  stateCommand,
  templateCommand,
} from "./runtime-commands.js";
import { isCliEntrypoint } from "./entrypoint.js";
import { methodCommand, requireMethodAcknowledged } from "./method.js";
import { requiresMethodAcknowledgement } from "./command-gates.js";

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
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

  if (group === "method") return methodCommand(root, action, args.options, json);
  if (requiresMethodAcknowledgement(group, action, args.options)) {
    await requireMethodAcknowledged(root, [group, action].filter(Boolean).join(" "));
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
      return doctorCommand(root, args.options, json);
    case "migrate":
    case "upgrade":
      return migrateCommand(root, json);
    case "status":
      return statusCommand(root, json);
    case "ready":
      return readyCommand(root, args.options, json);
    case "graph":
      return graphCommand(root, args.options, json);
    case "validate":
      return validationCommand(root, json);
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
      return waveCommand(root, action, extra, args.command.slice(3), args.options, json);
    case "worktree":
      return worktreeCommand(root, action, extra, args.options, json);
    case "run":
      return runCommand(root, action, extra, args.options, json);
    case "state":
      return stateCommand(root, action, args.options, json);
    case "env":
      return envCommand(action, args.options, json);
    case "schema":
      return schemaCommand(action, extra, args.options, json);
    case "template":
      return templateCommand(action, json);
    case "block":
      return blockCommand(root, action, args.options, json);
    case "unblock":
      return unblockCommand(root, action, args.options, json);
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
      return completeCommand(root, action, args.options, json);
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
      return gate(root, requiredArg(action, "node id"), args.options, json);
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
    case "policy":
      return policyCommand(root, action, extra, args.options, json);
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
    case "ref":
      return refCommand(action, extra, args.options, json);
    case "cart":
    case "cartridge":
      return cartridgeCommand(root, action, extra, args.command.slice(3), args.options, json);
    case "toolbox":
      return toolboxCommand(root, action, extra, args.options, json);
    case "view":
      return viewCommand(root, args.options, json);
    default:
      throw new Error(`Unknown command: ${group}`);
  }
}

async function planCommand(
  root: string,
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "export")
    return graphCommand(root, { ...options, format: stringOpt(options.format) ?? "json" }, json);
  if (action === "import") {
    throw new Error(
      "qd plan import is reserved for the next trial iteration; use qd node add and qd edge add for now",
    );
  }
  throw new Error(`Unknown plan action: ${action}`);
}

async function policyCommand(
  root: string,
  action: string | undefined,
  nodeId: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action !== "evaluate" && action !== "check") {
    throw new Error(`Unknown policy action: ${action}`);
  }
  const phase = strictEnumOpt(options.phase, isPolicyPhase, "--phase", "ci");
  const result = await policyReport(root, requiredArg(nodeId, "node id"), phase);
  output(result, json);
  if (!result.ok) process.exitCode = 1;
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

async function refCommand(
  action: string | undefined,
  extra: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "api" || (action === undefined && extra === "api")) {
    return refApiCommand(json);
  }
  if (action === "pitfalls" || (action === undefined && extra === "pitfalls")) {
    return refPitfallsCommand(json);
  }
  // Allow "ref api" and "ref pitfalls" where action=api/pitfalls, extra=undefined
  if (action === "api" || action === "pitfalls") {
    if (action === "api") return refApiCommand(json);
    return refPitfallsCommand(json);
  }
  throw new Error(`Unknown ref action: ${action}`);
}

async function cartridgeCommand(
  root: string,
  action: string | undefined,
  filePath: string | undefined,
  extraArgs: string[],
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "read" || action === "overview" || !action) {
    return readOverviewCommand(root, filePath, json);
  }
  if (action === "tab") {
    return readTabCommand(root, filePath, options.tab as string | undefined, json);
  }
  if (action === "size") {
    return sizeCommand(root, filePath, json);
  }
  if (action === "parse") {
    return parseCommand(root, filePath, json);
  }
  if (action === "write") {
    return writeCommand(root, filePath, options, json);
  }
  if (action === "lint") {
    return lintCommand(root, filePath, json);
  }
  if (action === "convert") {
    return convertCommand(root, filePath, options, json);
  }
  if (action === "flags") {
    const flagsAction = filePath; // "get", "set", or "bulk"
    const flagsTarget = extraArgs[0]; // the cartridge file path
    if (flagsAction === "get") {
      return flagsGetCommand(root, flagsTarget, json);
    }
    if (flagsAction === "set") {
      return flagsSetCommand(root, flagsTarget, options, json);
    }
    if (flagsAction === "bulk") {
      return flagsBulkCommand(root, flagsTarget, options, json);
    }
    throw new Error(`Unknown flags action: ${flagsAction}`);
  }
  // sprite sub-commands: cart sprite get|set <index> --file <path>  OR cart sprite get-range|set-range --file <path> --start <n> --end <n>
  if (action === "sprite") {
    const spriteAction = filePath; // "get", "set", "get-range", "set-range"
    const spriteTarget = (options.file ?? extraArgs[0]) as string | undefined;
    if (spriteAction === "get") {
      const idx = options.index ?? extraArgs[1];
      return spriteGetCommand(root, spriteTarget, idx as string | undefined, json);
    }
    if (spriteAction === "set") {
      const idx = options.index ?? extraArgs[1];
      return spriteSetCommand(root, spriteTarget, idx as string | undefined, options, json);
    }
    if (spriteAction === "get-range") {
      return spriteGetRangeCommand(root, spriteTarget, options, json);
    }
    if (spriteAction === "set-range") {
      return spriteSetRangeCommand(root, spriteTarget, options, json);
    }
    if (spriteAction === "export") {
      return spriteExportCommand(root, spriteTarget, options, json);
    }
    if (spriteAction === "import") {
      return spriteImportCommand(root, spriteTarget, options, json);
    }
    throw new Error(`Unknown sprite action: ${spriteAction}`);
  }
  // map sub-commands: cart map get|set --file <path> --x <n> --y <n>  OR cart map get-region|set-region --file <path> --x <n> --y <n> --w <n> --h <n>
  if (action === "map") {
    const mapAction = filePath; // "get", "set", "get-region", "set-region"
    const mapTarget = (options.file ?? extraArgs[0]) as string | undefined;
    if (mapAction === "get") {
      return mapGetCommand(root, mapTarget, options.x as string | undefined, options.y as string | undefined, json);
    }
    if (mapAction === "set") {
      return mapSetCommand(root, mapTarget, options.x as string | undefined, options.y as string | undefined, options, json);
    }
    if (mapAction === "get-region") {
      return mapGetRegionCommand(root, mapTarget, options, json);
    }
    if (mapAction === "set-region") {
      return mapSetRegionCommand(root, mapTarget, options, json);
    }
    throw new Error(`Unknown map action: ${mapAction}`);
  }
  // sfx sub-commands: cart sfx get|set --file <path> --index <n>  OR cart sfx list --file <path>
  if (action === "sfx") {
    const sfxAction = filePath; // "get", "set", "list"
    const sfxTarget = (options.file ?? extraArgs[0]) as string | undefined;
    if (sfxAction === "get") {
      return sfxGetCommand(root, sfxTarget, options.index as string | undefined, json);
    }
    if (sfxAction === "set") {
      return sfxSetCommand(root, sfxTarget, options.index as string | undefined, options, json);
    }
    if (sfxAction === "list") {
      return sfxListCommand(root, sfxTarget, json);
    }
    throw new Error(`Unknown sfx action: ${sfxAction}`);
  }
  if (action === "minify") {
    return minifyCommand(root, filePath, options, json);
  }
  if (action === "edit") {
    const editAction = filePath; // "range", "replace", or "append"
    const editTarget = (options.file ?? extraArgs[0]) as string | undefined;
    if (editAction === "range") {
      return editRangeCommand(root, editTarget, options, json);
    }
    if (editAction === "replace") {
      return editReplaceCommand(root, editTarget, options, json);
    }
    if (editAction === "append") {
      return editAppendCommand(root, editTarget, options, json);
    }
    throw new Error(`Unknown edit action: ${editAction}`);
  }
  throw new Error(`Unknown cartridge action: ${action}`);
}

async function toolboxCommand(
  root: string,
  action: string | undefined,
  extra: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
): Promise<void> {
  if (action === "capabilities" || !action) {
    return toolboxCapabilities(json);
  }
  // Unknown toolbox action → consistent error shape
  const msg = `"${action}" is not a toolbox command`;
  toolboxError(msg, json);
}

function toolboxCapabilities(json: boolean): void {
  const capabilities = {
    capabilities: {
      static: ["code editing", "sprite editing", "map editing", "sfx editing", "flag editing", "linting", "minification", "format conversion", "size reporting"],
      runtime: ["running cartridges", "exporting builds"],
    },
    commands: [
      { command: "cart overview", description: "Read an overview of a cartridge" },
      { command: "cart tab", description: "Read a single tab of code" },
      { command: "cart size", description: "Report cartridge size against PICO-8 limits" },
      { command: "cart parse", description: "Parse and validate cartridge code syntax" },
      { command: "cart write", description: "Write code to a cartridge tab" },
      { command: "cart lint", description: "Lint cartridge code for common issues" },
      { command: "cart convert", description: "Convert between .p8 and .p8.png formats" },
      { command: "cart minify", description: "Minify cartridge code" },
      { command: "cart edit range", description: "Replace a specific range of lines in a cartridge" },
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
      { command: "toolbox capabilities", description: "Report available toolbox capabilities and commands" },
    ],
  };
  output(capabilities, json);
}

function toolboxError(message: string, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ error: message, message }, null, 2));
  } else {
    console.error(message);
  }
}

export const __testing = {
  contentType,
  filterSnapshot,
  formatCell,
  formatRows,
  getConfigValue,
  handleViewerRequest,
  hostForUrl,
  nextStepForNode,
  numberAt,
  parseNoteKindList,
  parseSeverityList,
  parseStatusList,
  parseVerification,
  parseArgs,
  parseBoolean,
  parsePositiveInteger,
  setCiProviderConfig,
  setConfigValue,
  snapshotDiff,
  strictArrayAtPath,
  strictStringArrayAt,
  strictVerificationArrayAt,
  stringAt,
  isCliEntrypoint,
  viewerFilePath,
};

if (isCliEntrypoint(process.argv[1], fileURLToPath(import.meta.url))) {
  runCli().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
