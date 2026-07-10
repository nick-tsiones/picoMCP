import {
  analyticsReport,
  criticalPathReport,
  graphSnapshot,
  listRegistry,
  policyReport,
  readyNodes,
  registerGroup,
  registerMilestone,
  registerProject,
} from "@cat-cave/qdcli-core";
import { numberOpt, output, required, requiredArg, requiredNumber, stringOpt } from "./args.js";
import { isPolicyPhase, strictEnumOpt } from "./enums.js";
import { capabilityCommand } from "./capability-commands.js";
import {
  convertCommand,
  exportCartCommand,
  flagsBulkCommand,
  flagsGetCommand,
  flagsSetCommand,
  lintCommand,
  parseCommand,
  readOverviewCommand,
  readTabCommand,
  runCartCommand,
  sizeCommand,
  writeCommand,
} from "./cartridge-commands.js";
import {
  mapGetCommand,
  mapGetRegionCommand,
  mapSetCommand,
  mapSetRegionCommand,
  sfxGetCommand,
  sfxListCommand,
  sfxSetCommand,
  spriteExportCommand,
  spriteGetCommand,
  spriteGetRangeCommand,
  spriteImportCommand,
  spriteSetCommand,
  spriteSetRangeCommand,
} from "./cartridge-asset-commands.js";
import {
  editAppendCommand,
  editRangeCommand,
  editReplaceCommand,
  minifyCommand,
} from "./cartridge-edit-commands.js";
import { refApiCommand, refPitfallsCommand } from "./ref-commands.js";
import { formatRows } from "./graph-format.js";

export async function planCommand(
  root: string,
  action: string | undefined,
  options: Record<string, string | string[] | boolean>,
  json: boolean,
  graphCommand: (
    root: string,
    options: Record<string, string | string[] | boolean>,
    json: boolean,
  ) => Promise<void>,
): Promise<void> {
  if (action === "export") {
    return graphCommand(root, { ...options, format: stringOpt(options.format) ?? "json" }, json);
  }
  if (action === "import") {
    throw new Error(
      "qd plan import is reserved for the next trial iteration; use qd node add and qd edge add for now",
    );
  }
  throw new Error(`Unknown plan action: ${action}`);
}

export async function policyCommand(
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

export async function milestoneCommand(
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

export async function registryCommand(
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

export async function refCommand(
  action: string | undefined,
  extra: string | undefined,
  json: boolean,
): Promise<void> {
  if (action === "api" || (action === undefined && extra === "api")) {
    return refApiCommand(json);
  }
  if (action === "pitfalls" || (action === undefined && extra === "pitfalls")) {
    return refPitfallsCommand(json);
  }
  if (action === "api" || action === "pitfalls") {
    if (action === "api") return refApiCommand(json);
    return refPitfallsCommand(json);
  }
  throw new Error(`Unknown ref action: ${action}`);
}

export async function cartridgeCommand(
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
  if (action === "run") {
    return runCartCommand(root, filePath, options, json);
  }
  if (action === "export") {
    return exportCartCommand(root, filePath, options, json);
  }
  if (action === "lint") {
    return lintCommand(root, filePath, json);
  }
  if (action === "convert") {
    return convertCommand(root, filePath, options, json);
  }
  if (action === "flags") {
    const flagsAction = filePath;
    const flagsTarget = extraArgs[0];
    if (flagsAction === "get") return flagsGetCommand(root, flagsTarget, json);
    if (flagsAction === "set") return flagsSetCommand(root, flagsTarget, options, json);
    if (flagsAction === "bulk") return flagsBulkCommand(root, flagsTarget, options, json);
    throw new Error(`Unknown flags action: ${flagsAction}`);
  }
  if (action === "sprite") {
    const spriteAction = filePath;
    const spriteTarget = (options.file ?? extraArgs[0]) as string | undefined;
    if (spriteAction === "get") {
      const idx = options.index ?? extraArgs[1];
      return spriteGetCommand(root, spriteTarget, idx as string | undefined, json);
    }
    if (spriteAction === "set") {
      const idx = options.index ?? extraArgs[1];
      return spriteSetCommand(root, spriteTarget, idx as string | undefined, options, json);
    }
    if (spriteAction === "get-range")
      return spriteGetRangeCommand(root, spriteTarget, options, json);
    if (spriteAction === "set-range")
      return spriteSetRangeCommand(root, spriteTarget, options, json);
    if (spriteAction === "export") return spriteExportCommand(root, spriteTarget, options, json);
    if (spriteAction === "import") return spriteImportCommand(root, spriteTarget, options, json);
    throw new Error(`Unknown sprite action: ${spriteAction}`);
  }
  if (action === "map") {
    const mapAction = filePath;
    const mapTarget = (options.file ?? extraArgs[0]) as string | undefined;
    if (mapAction === "get") {
      return mapGetCommand(
        root,
        mapTarget,
        options.x as string | undefined,
        options.y as string | undefined,
        json,
      );
    }
    if (mapAction === "set") {
      return mapSetCommand(
        root,
        mapTarget,
        options.x as string | undefined,
        options.y as string | undefined,
        options,
        json,
      );
    }
    if (mapAction === "get-region") return mapGetRegionCommand(root, mapTarget, options, json);
    if (mapAction === "set-region") return mapSetRegionCommand(root, mapTarget, options, json);
    throw new Error(`Unknown map action: ${mapAction}`);
  }
  if (action === "sfx") {
    const sfxAction = filePath;
    const sfxTarget = (options.file ?? extraArgs[0]) as string | undefined;
    if (sfxAction === "get")
      return sfxGetCommand(root, sfxTarget, options.index as string | undefined, json);
    if (sfxAction === "set")
      return sfxSetCommand(root, sfxTarget, options.index as string | undefined, options, json);
    if (sfxAction === "list") return sfxListCommand(root, sfxTarget, json);
    throw new Error(`Unknown sfx action: ${sfxAction}`);
  }
  if (action === "minify") return minifyCommand(root, filePath, options, json);
  if (action === "edit") {
    const editAction = filePath;
    const editTarget = (options.file ?? extraArgs[0]) as string | undefined;
    if (editAction === "range") return editRangeCommand(root, editTarget, options, json);
    if (editAction === "replace") return editReplaceCommand(root, editTarget, options, json);
    if (editAction === "append") return editAppendCommand(root, editTarget, options, json);
    throw new Error(`Unknown edit action: ${editAction}`);
  }
  throw new Error(`Unknown cartridge action: ${action}`);
}

export async function toolboxCommand(action: string | undefined, json: boolean): Promise<void> {
  if (action === "capabilities" || !action) {
    return capabilityCommand(json);
  }
  toolboxError(`"${action}" is not a toolbox command`, json);
}

function toolboxError(message: string, json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ error: message, message }, null, 2));
  } else {
    console.error(message);
  }
}
