import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  addEdge,
  addAssignment,
  addFinding,
  addNodeNote,
  addNode,
  addNodesBulk,
  addWaveAssignment,
  addWaveNode,
  cancelNode,
  claimNode,
  ciFail,
  ciPass,
  completeAssignment,
  completeWave,
  deterministicGraphSnapshot,
  disposeFinding,
  finishRun,
  gateNode,
  getRun,
  graphSnapshot,
  latestRun,
  listEdges,
  listFindings,
  listNodeNotes,
  listRegistry,
  listRuns,
  listAssignments,
  listWaveMemberships,
  listWaves,
  markMerged,
  promoteFindings,
  recordCiResult,
  recordCheckResult,
  readyNodes,
  replaceGraphSnapshot,
  registerGroup,
  registerMilestone,
  registerProject,
  removeEdge,
  resolveProjectRoot,
  restoreGraphSnapshot,
  resolveFinding,
  setupProject,
  startRun,
  startWave,
  stats,
  unblockNode,
  updateNode,
  validateGraph,
} from "./index.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "qdcli-"));
  await setupProject(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("graph lifecycle", () => {
  it("returns only dependency-unblocked ready nodes", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await addNode(root, {
      id: "b",
      title: "Build B",
      spec: "Do B",
      acceptance: "B works",
    });
    await addEdge(root, "a", "b");

    expect((await readyNodes(root)).map((node) => node.id)).toEqual(["a"]);
  });

  it("rejects requires cycles", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await addNode(root, {
      id: "b",
      title: "Build B",
      spec: "Do B",
      acceptance: "B works",
    });
    await addEdge(root, "a", "b");

    await expect(addEdge(root, "b", "a")).rejects.toThrow(/cycle/);
  });

  it("rejects self edges and can remove existing edges", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await addNode(root, {
      id: "b",
      title: "Build B",
      spec: "Do B",
      acceptance: "B works",
    });

    await expect(addEdge(root, "a", "a")).rejects.toThrow(/same node/);
    await addEdge(root, "a", "b");
    expect(await listEdges(root)).toHaveLength(1);
    await removeEdge(root, "a", "b");
    expect(await listEdges(root)).toEqual([]);
  });

  it("generates stable unique ids from titles and validates required node quality", async () => {
    const first = await addNode(root, {
      title: "Runtime API!",
      spec: "Do runtime",
      acceptance: "Runtime works",
    });
    const second = await addNode(root, {
      title: "Runtime API!",
      spec: "Do more runtime",
      acceptance: "Runtime still works",
    });
    const long = await addNode(root, {
      title: "A".repeat(80),
      spec: "Do long work",
      acceptance: "Long work is done",
    });

    expect(first.id).toBe("runtime-api");
    expect(second.id).toBe("runtime-api-2");
    expect(long.id).toHaveLength(64);
    await expect(
      addNode(root, {
        title: " ",
        spec: "Do work",
        acceptance: "Work is done",
      }),
    ).rejects.toThrow(/Node title is required/);
    await expect(
      addNode(root, {
        title: "No estimate",
        estimatePoints: 0,
        spec: "Do work",
        acceptance: "Work is done",
      }),
    ).rejects.toThrow(/positive integer/);
  });

  it("blocks the gate for open P0/P1 findings", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    const finding = await addFinding(root, "a", {
      severity: "P1",
      title: "Missing acceptance",
      evidence: "The acceptance criterion is not implemented.",
    });

    expect((await gateNode(root, "a")).ok).toBe(false);
    await resolveFinding(root, finding.id);
    expect((await gateNode(root, "a")).ok).toBe(true);
  });

  it("rejects lifecycle records that reference missing nodes", async () => {
    await expect(startRun(root, "missing", "audit")).rejects.toThrow(/Node not found/);
    await expect(
      addFinding(root, "missing", {
        severity: "P1",
        title: "Bad node",
        evidence: "The node does not exist.",
      }),
    ).rejects.toThrow(/Node not found/);
    await expect(addNodeNote(root, "missing", "No node")).rejects.toThrow(/Node not found/);
  });

  it("blocks the gate while an audit run is still running", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });

    const run = await startRun(root, "a", "audit", { auditKind: "acceptance" });
    const blocked = await gateNode(root, "a");

    expect(blocked.ok).toBe(false);
    expect(blocked.runningAudits.map((item) => item.id)).toEqual([run.id]);

    await finishRun(root, run.id, { status: "passed", summary: "audit passed" });
    expect((await gateNode(root, "a")).ok).toBe(true);
  });

  it("promotes P2/P3 findings into future nodes", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await addFinding(root, "a", {
      severity: "P2",
      title: "Improve validation",
      evidence: "Validation can be made stronger.",
    });

    const promoted = await promoteFindings(root, "a");
    expect(promoted).toHaveLength(1);
    expect(promoted[0]?.node.kind).toBe("audit-fix");
    expect(promoted[0]?.findingId).toBeTruthy();
    expect(promoted[0]?.newNodeId).toBe(promoted[0]?.node.id);
    expect(promoted[0]?.node.status_reason).toContain("Promoted from finding");
  });

  it("lists findings and node runs for orchestrator dashboards", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await addFinding(root, "a", {
      severity: "P1",
      title: "Missing acceptance",
      evidence: "The acceptance criterion is not implemented.",
    });
    await addFinding(root, "a", {
      severity: "P3",
      title: "Polish docs",
      evidence: "The docs could be clearer.",
    });
    await startRun(root, "a", "audit", { summary: "audit started" });

    expect(
      (await listFindings(root, { status: "open", severities: ["P1"] })).map(
        (finding) => finding.title,
      ),
    ).toEqual(["Missing acceptance"]);
    expect(await listFindings(root, { nodeId: "a" })).toHaveLength(2);
    expect((await listRuns(root, "a")).map((run) => run.kind)).toEqual(["audit"]);
  });

  it("filters runs by node, kind, and status and preserves run metadata", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await addNode(root, {
      id: "b",
      title: "Build B",
      spec: "Do B",
      acceptance: "B works",
    });

    const audit = await startRun(root, "a", "audit", {
      agent: "external:auditor",
      auditKind: "security",
      command: "audit-tool",
      provider: "local",
      gitSha: "abc123",
      externalId: "run-1",
      url: "https://example.test/run-1",
      reportPath: "reports/audit.json",
      worktreePath: "/tmp/audit",
      summary: "audit started",
    });
    await startRun(root, "a", "check", { summary: "check started" });
    await startRun(root, "b", "audit", { summary: "other audit" });

    const finished = await finishRun(root, audit.id, {
      status: "superseded",
      summary: "newer audit exists",
      rationale: "rerun on updated branch",
      supersededBy: "next-run",
      exitCode: 124,
    });

    expect(await getRun(root, audit.id)).toMatchObject({
      kind: "audit",
      status: "superseded",
      command: "audit-tool",
      provider: "local",
      git_sha: "abc123",
      external_id: "run-1",
      url: "https://example.test/run-1",
      report_path: "reports/audit.json",
      audit_kind: "security",
      worktree_path: "/tmp/audit",
      agent: "external:auditor",
      rationale: "rerun on updated branch",
      superseded_by: "next-run",
      exit_code: 124,
    });
    expect(finished.summary).toBe("newer audit exists");
    expect(await listRuns(root, { nodeId: "a", kind: "audit", status: "superseded" })).toHaveLength(
      1,
    );
    expect(await listRuns(root, { nodeId: "a", status: "running" })).toHaveLength(1);
  });

  it("records P2/P3 finding disposition with a typed audit trail note", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    const finding = await addFinding(root, "a", {
      severity: "P2",
      title: "Follow-up",
      evidence: "Needs a later cleanup.",
    });

    const disposed = await disposeFinding(root, finding.id, {
      status: "dismissed",
      rationale: "Accepted risk for alpha.",
    });
    const notes = await listNodeNotes(root, "a", { kinds: ["audit-disposition"] });

    expect(disposed.status).toBe("dismissed");
    expect(notes).toHaveLength(1);
    expect(notes[0]?.text).toContain("Accepted risk for alpha");
  });

  it("requires a passed CI run before merge", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });

    await expect(markMerged(root, "a", "squash")).rejects.toThrow(/status ready/);
    await ciPass(root, "a");
    const merged = await markMerged(root, "a", "squash");

    expect(merged.status).toBe("done");
  });

  it("claims the highest priority ready node with the requested branch", async () => {
    await addNode(root, {
      id: "slow",
      title: "Slow task",
      priority: "P3",
      estimatePoints: 5,
      spec: "Do slow work",
      acceptance: "Slow work is done",
    });
    await addNode(root, {
      id: "urgent",
      title: "Urgent task",
      priority: "P1",
      estimatePoints: 3,
      spec: "Do urgent work",
      acceptance: "Urgent work is done",
    });

    const claimed = await claimNode(root, { agent: "orchestrator", branch: "spec/urgent" });

    expect(claimed.id).toBe("urgent");
    expect(claimed.status).toBe("claimed");
    expect(claimed.owner).toBe("orchestrator");
    expect(claimed.branch).toBe("spec/urgent");
    await expect(claimNode(root, { id: "urgent", agent: "other" })).rejects.toThrow(/not ready/);
  });

  it("records failed check and CI runs without marking the node mergeable", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });

    const afterCheck = await recordCheckResult(root, "a", {
      status: "failed",
      summary: "check failed",
      logPath: "logs/check.txt",
    });
    expect(afterCheck.status).toBe("blocked");
    expect(await latestRun(root, "a", "check")).toMatchObject({
      status: "failed",
      summary: "check failed",
      log_path: "logs/check.txt",
    });

    const afterCi = await recordCiResult(root, "a", {
      status: "failed",
      summary: "ci failed",
      logPath: "logs/ci.txt",
    });
    expect(afterCi.status).toBe("blocked");
    expect(await latestRun(root, "a", "ci")).toMatchObject({
      status: "failed",
      summary: "ci failed",
      log_path: "logs/ci.txt",
    });
    await expect(markMerged(root, "a", "squash")).rejects.toThrow(/status blocked/);
  });

  it("recovers a blocked node after a newer passed check when the gate is clean", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await recordCheckResult(root, "a", { status: "failed", summary: "format failed" });
    const recovered = await recordCheckResult(root, "a", {
      status: "passed",
      summary: "format repaired",
    });

    expect(recovered.status).toBe("review");
  });

  it("supports explicit unblock from a passed run", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await updateNode(root, "a", { status: "blocked" });
    await recordCheckResult(root, "a", { status: "passed", summary: "verified" });
    const run = await latestRun(root, "a", "check");
    await updateNode(root, "a", { status: "blocked" });

    const unblocked = await unblockNode(root, "a", {
      fromRunId: run?.id ?? "",
      summary: "verified by passed check",
    });

    expect(unblocked.status).toBe("review");
    expect((await listNodeNotes(root, "a", { kinds: ["retry"] }))[0]?.evidence).toContain(run?.id);
  });

  it("records CI failure through the shorthand helper", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });

    const failed = await ciFail(root, "a", "pipeline failed");

    expect(failed.status).toBe("blocked");
    expect(await latestRun(root, "a", "ci")).toMatchObject({
      status: "failed",
      summary: "pipeline failed",
    });
  });

  it("cancels nodes and reports aggregate stats", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      estimatePoints: 2,
      spec: "Do A",
      acceptance: "A works",
    });
    await addNode(root, {
      id: "b",
      title: "Build B",
      estimatePoints: 3,
      spec: "Do B",
      acceptance: "B works",
    });
    await ciPass(root, "a");
    await markMerged(root, "a", "squash");
    const cancelled = await cancelNode(root, "b");
    const report = await stats(root);

    expect(cancelled.status).toBe("cancelled");
    expect(report).toMatchObject({
      nodes: 2,
      ready: 0,
      donePoints: 2,
      totalPoints: 5,
      remainingPoints: 3,
      openP0P1Findings: 0,
    });
    expect(report.byStatus).toMatchObject({ done: 1, cancelled: 1 });
  });

  it("counts only open P0/P1 findings in aggregate stats", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    const p0 = await addFinding(root, "a", {
      severity: "P0",
      title: "Blocking",
      evidence: "Must fix.",
    });
    await addFinding(root, "a", {
      severity: "P2",
      title: "Follow-up",
      evidence: "Can be later.",
    });
    await resolveFinding(root, p0.id);
    await addFinding(root, "a", {
      severity: "P1",
      title: "Still blocking",
      evidence: "Must also fix.",
    });

    expect((await stats(root)).openP0P1Findings).toBe(1);
  });

  it("records check runs without making the node mergeable", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });

    const checked = await recordCheckResult(root, "a", {
      status: "passed",
      summary: "check passed",
    });

    expect(checked.status).toBe("ready");
    await expect(markMerged(root, "a", "squash")).rejects.toThrow(/status ready/);
  });

  it("persists per-node check and CI command overrides", async () => {
    const created = await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
      checkCommand: "just check-a",
      ciCommand: "just ci-a",
    });

    expect(created.check_command).toBe("just check-a");
    expect(created.ci_command).toBe("just ci-a");

    const updated = await updateNode(root, "a", {
      check_command: "just check-b",
      ci_command: "just ci-b",
    });

    expect(updated.check_command).toBe("just check-b");
    expect(updated.ci_command).toBe("just ci-b");
  });

  it("edits one field without blanking untouched required fields", async () => {
    await addNode(root, {
      id: "hardening",
      title: "Hardening",
      spec: "Do hardening",
      acceptance: "Hardening is done",
    });

    const edited = await updateNode(root, "hardening", { status: "blocked" });

    expect(edited.status).toBe("blocked");
    expect(edited.spec).toBe("Do hardening");
    expect(edited.acceptance).toBe("Hardening is done");
  });

  it("stores explicit manual blocker metadata", async () => {
    const node = await addNode(root, {
      id: "manual-gate",
      title: "Manual gate",
      status: "blocked",
      blockedBy: "manual",
      blockedReason: "Fixture approval is pending.",
      blockedOwner: "trevor",
      spec: "Wait for review",
      acceptance: "Review is signed off",
    });

    expect(node.blocked_by).toBe("manual");
    expect(node.blocked_reason).toBe("Fixture approval is pending.");
    expect(await readyNodes(root)).toEqual([]);
  });

  it("rejects malformed blocker metadata loudly", async () => {
    await expect(
      addNode(root, {
        id: "bad-status",
        title: "Bad status",
        status: "ready",
        blockedBy: "manual",
        blockedReason: "Needs approval.",
        spec: "Do work",
        acceptance: "Work is done",
      }),
    ).rejects.toThrow(/blocked_by can only be set/);
    await expect(
      addNode(root, {
        id: "missing-reason",
        title: "Missing reason",
        status: "blocked",
        blockedBy: "manual",
        spec: "Do work",
        acceptance: "Work is done",
      }),
    ).rejects.toThrow(/blocked_reason is required/);
    await expect(
      addNode(root, {
        id: "empty-owner",
        title: "Empty owner",
        status: "blocked",
        blockedBy: "manual",
        blockedReason: "Needs approval.",
        blockedOwner: " ",
        spec: "Do work",
        acceptance: "Work is done",
      }),
    ).rejects.toThrow(/blocked_owner must not be empty/);
  });

  it("adds bulk nodes transactionally and auto-registers referenced metadata", async () => {
    await expect(
      addNodesBulk(root, {
        nodes: [
          {
            id: "a",
            title: "Build A",
            milestone: "alpha",
            groupName: "runtime",
            projects: ["app"],
            spec: "Do A",
            acceptance: "A works",
          },
          {
            id: "a",
            title: "Duplicate A",
            spec: "Duplicate",
            acceptance: "Duplicate works",
          },
        ],
      }),
    ).rejects.toThrow(/duplicate node id/);
    expect((await graphSnapshot(root)).nodes).toHaveLength(0);

    const created = await addNodesBulk(root, {
      nodes: [
        {
          id: "a",
          title: "Build A",
          milestone: "alpha",
          groupName: "runtime",
          projects: ["app"],
          spec: "Do A",
          acceptance: "A works",
        },
      ],
    });

    expect(created.nodes).toHaveLength(1);
    expect((await listRegistry(root, "milestones")).map((entry) => entry.name)).toEqual(["alpha"]);
    expect((await listRegistry(root, "groups")).map((entry) => entry.name)).toEqual(["runtime"]);
    expect((await listRegistry(root, "projects")).map((entry) => entry.name)).toEqual(["app"]);
  });

  it("rolls back bulk nodes when an edge is invalid", async () => {
    await expect(
      addNodesBulk(root, {
        nodes: [
          {
            id: "a",
            title: "Build A",
            spec: "Do A",
            acceptance: "A works",
          },
          {
            id: "b",
            title: "Build B",
            spec: "Do B",
            acceptance: "B works",
          },
        ],
        edges: [
          { from: "a", to: "b" },
          { from: "missing", to: "b" },
        ],
      }),
    ).rejects.toThrow(/edge references missing from node/);

    const snapshot = await graphSnapshot(root);
    expect(snapshot.nodes).toEqual([]);
    expect(snapshot.edges).toEqual([]);
  });

  it("records the external commit represented by a qd merge", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await ciPass(root, "a");

    const merged = await markMerged(root, "a", "squash", {
      commitSha: "abcdef1234567890",
    });

    expect(merged.status).toBe("done");
    expect(await latestRun(root, "a", "merge")).toMatchObject({
      status: "recorded",
      summary: "Merge recorded with squash at commit abcdef1234567890",
    });
  });

  it("preserves done nodes on post-merge CI success and marks failures regressed", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await ciPass(root, "a");
    await markMerged(root, "a", "squash");

    const passed = await recordCiResult(root, "a", {
      status: "passed",
      summary: "main CI passed after merge",
    });
    expect(passed.status).toBe("done");

    const failed = await recordCiResult(root, "a", {
      status: "failed",
      summary: "main CI failed after merge",
    });
    expect(failed.status).toBe("regressed");
  });

  it("appends node notes to status reason and lists them oldest first", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      statusReason: "Initial note",
      spec: "Do A",
      acceptance: "A works",
    });

    await addNodeNote(root, "a", "Blocked by upstream API");
    await addNodeNote(root, "a", "Retry passed locally");

    const notes = await listNodeNotes(root, "a");
    const node = await graphSnapshot(root).then((snapshot) =>
      snapshot.nodes.find((candidate) => candidate.id === "a"),
    );
    expect(notes.map((note) => note.text)).toEqual([
      "Blocked by upstream API",
      "Retry passed locally",
    ]);
    expect(node?.status_reason).toContain("Initial note");
    expect(node?.status_reason).toContain("Blocked by upstream API");
    expect(node?.status_reason).toContain("Retry passed locally");
  });

  it("stores typed notes and filters them by kind", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });

    await addNodeNote(root, "a", "Waiting on fixture", {
      kind: "external-dependency",
      evidence: "https://example.test/ticket",
    });
    await addNodeNote(root, "a", "Plain note");

    const filtered = await listNodeNotes(root, "a", { kinds: ["external-dependency"] });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      kind: "external-dependency",
      evidence: "https://example.test/ticket",
    });
  });

  it("tracks opaque assignments and refuses duplicate open branch or worktree ownership", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    const assignment = await addAssignment(root, {
      nodeId: "a",
      role: "worker",
      owner: "external:worker-1",
      branch: "worker/a",
      worktreePath: "/tmp/worker-a",
      scope: "src/a.ts",
    });

    await expect(
      addAssignment(root, {
        nodeId: "a",
        role: "auditor",
        owner: "external:auditor-1",
        branch: "worker/a",
      }),
    ).rejects.toThrow(/branch already has an open assignment/);
    await expect(
      addAssignment(root, {
        nodeId: "a",
        role: "auditor",
        owner: "external:auditor-2",
        worktreePath: "/tmp/worker-a",
      }),
    ).rejects.toThrow(/worktree already has an open assignment/);
    await expect(
      addAssignment(root, {
        nodeId: "a",
        role: "worker",
        owner: " ",
      }),
    ).rejects.toThrow(/owner is required/);

    const completed = await completeAssignment(root, assignment.id, {
      status: "complete",
      summary: "done",
      commits: ["abc123"],
      evidence: ["log.txt"],
    });

    expect(completed.status).toBe("complete");
    expect(JSON.parse(completed.commits_json)).toEqual(["abc123"]);
    expect(JSON.parse(completed.evidence_json)).toEqual(["log.txt"]);
    expect(await listAssignments(root, { status: "complete" })).toHaveLength(1);
    expect(await listAssignments(root, { nodeId: "a", status: "open" })).toEqual([]);
  });

  it("tracks waves with node and assignment membership", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    const assignment = await addAssignment(root, {
      nodeId: "a",
      role: "worker",
      owner: "external:worker-1",
    });
    const wave = await startWave(root, {
      kind: "implementation",
      summary: "first wave",
    });

    await addWaveNode(root, wave.id, "a");
    await addWaveAssignment(root, wave.id, assignment.id);
    const completed = await completeWave(root, wave.id, {
      summary: "merged one node",
    });

    expect(completed.status).toBe("complete");
    expect(await listWaves(root)).toHaveLength(1);
    expect(await listWaveMemberships(root)).toHaveLength(2);
  });

  it("enforces registered group, project, and milestone values", async () => {
    await registerGroup(root, "runtime");
    await registerProject(root, "app");
    await registerMilestone(root, "baseline", 10);

    await expect(
      addNode(root, {
        id: "bad",
        title: "Bad metadata",
        groupName: "typo",
        projects: ["app"],
        milestone: "baseline",
        spec: "Do work",
        acceptance: "Work is done",
      }),
    ).rejects.toThrow(/unknown group/);

    const node = await addNode(root, {
      id: "good",
      title: "Good metadata",
      groupName: "runtime",
      projects: ["app"],
      milestone: "baseline",
      spec: "Do work",
      acceptance: "Work is done",
    });

    expect(node.group_name).toBe("runtime");
    expect(node.projects).toEqual(["app"]);
    expect(node.milestone).toBe("baseline");
  });

  it("lists registries in deterministic name and rank order", async () => {
    await registerGroup(root, "runtime");
    await registerGroup(root, "app");
    await registerProject(root, "suite");
    await registerProject(root, "core");
    await registerMilestone(root, "beta", 30);
    await registerMilestone(root, "alpha", 20);

    expect((await listRegistry(root, "groups")).map((entry) => entry.name)).toEqual([
      "app",
      "runtime",
    ]);
    expect((await listRegistry(root, "projects")).map((entry) => entry.name)).toEqual([
      "core",
      "suite",
    ]);
    expect((await listRegistry(root, "milestones")).map((entry) => entry.name)).toEqual([
      "alpha",
      "beta",
    ]);
  });

  it("reports all registered metadata mismatches in strict validation", async () => {
    await registerGroup(root, "runtime");
    await registerProject(root, "app");
    await registerMilestone(root, "baseline", 10);
    await expect(
      addNode(root, {
        id: "bad",
        title: "Bad metadata",
        groupName: "typo",
        projects: ["wrong"],
        milestone: "later",
        spec: "Do work",
        acceptance: "Work is done",
      }),
    ).rejects.toThrow(/unknown group: typo; unknown milestone: later; unknown project: wrong/);
  });

  it("restores a canonical graph snapshot into a fresh local cache", async () => {
    await registerGroup(root, "runtime");
    await registerProject(root, "app");
    await registerMilestone(root, "baseline", 10);
    await addNode(root, {
      id: "a",
      title: "Build A",
      groupName: "runtime",
      projects: ["app"],
      milestone: "baseline",
      spec: "Do A",
      acceptance: "A works",
    });
    await addNode(root, {
      id: "b",
      title: "Build B",
      spec: "Do B",
      acceptance: "B works",
    });
    await addEdge(root, "a", "b");
    await startRun(root, "a", "implement", { summary: "done" });
    await addFinding(root, "a", {
      severity: "P2",
      title: "Improve validation",
      evidence: "Validation can be stronger.",
    });
    await addNodeNote(root, "a", "Ready for audit");
    const assignment = await addAssignment(root, {
      nodeId: "a",
      role: "auditor",
      owner: "external:auditor",
      branch: "audit/a",
      worktreePath: "/tmp/audit-a",
    });
    const wave = await startWave(root, {
      kind: "audit",
      summary: "audit wave",
    });
    await addWaveNode(root, wave.id, "a");
    await addWaveAssignment(root, wave.id, assignment.id);

    const snapshot = await graphSnapshot(root);
    const restoredRoot = await mkdtemp(path.join(os.tmpdir(), "qdcli-restore-"));
    try {
      await setupProject(restoredRoot);
      await restoreGraphSnapshot(restoredRoot, snapshot);
      const restored = await graphSnapshot(restoredRoot);

      expect(restored.registries).toEqual(snapshot.registries);
      expect(restored.nodes).toEqual(snapshot.nodes);
      expect(restored.edges).toEqual(snapshot.edges);
      expect(restored.runs).toEqual(snapshot.runs);
      expect(restored.findings).toEqual(snapshot.findings);
      expect(restored.node_notes).toEqual(snapshot.node_notes);
      expect(restored.assignments).toEqual(snapshot.assignments);
      expect(restored.waves).toEqual(snapshot.waves);
      expect(restored.wave_memberships).toEqual(snapshot.wave_memberships);
    } finally {
      await rm(restoredRoot, { recursive: true, force: true });
    }
  });

  it("replaces a local cache from a canonical graph snapshot", async () => {
    await addNode(root, {
      id: "old",
      title: "Old node",
      spec: "Old work",
      acceptance: "Old work is done",
    });
    const sourceRoot = await mkdtemp(path.join(os.tmpdir(), "qdcli-replace-source-"));
    try {
      await setupProject(sourceRoot);
      await addNode(sourceRoot, {
        id: "new",
        title: "New node",
        spec: "New work",
        acceptance: "New work is done",
      });
      await replaceGraphSnapshot(root, await graphSnapshot(sourceRoot));

      expect((await graphSnapshot(root)).nodes.map((node) => node.id)).toEqual(["new"]);
    } finally {
      await rm(sourceRoot, { recursive: true, force: true });
    }
  });

  it("can produce a deterministic export snapshot", async () => {
    await addNodesBulk(root, {
      nodes: [
        {
          id: "a",
          title: "Build A",
          milestone: "alpha",
          groupName: "runtime",
          projects: ["app"],
          spec: "Do A",
          acceptance: "A works",
        },
      ],
    });

    const stable = deterministicGraphSnapshot(await graphSnapshot(root));

    expect(stable.exported_at).toBe("1970-01-01T00:00:00.000Z");
    expect(stable.registries.groups[0]?.created_at).toBe("1970-01-01T00:00:00.000Z");
    expect(stable.registries.projects[0]?.created_at).toBe("1970-01-01T00:00:00.000Z");
    expect(stable.registries.milestones[0]?.created_at).toBe("1970-01-01T00:00:00.000Z");
  });

  it("rejects invalid restore snapshots before mutating the local cache", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    const snapshot = await graphSnapshot(root);
    const restoredRoot = await mkdtemp(path.join(os.tmpdir(), "qdcli-restore-invalid-"));
    try {
      await setupProject(restoredRoot);
      await expect(
        restoreGraphSnapshot(restoredRoot, {
          ...snapshot,
          schema_version: 2,
        }),
      ).rejects.toThrow(/Unsupported qd export/);
      await expect(
        restoreGraphSnapshot(restoredRoot, {
          ...snapshot,
          edges: [
            {
              from_node: "missing",
              to_node: "a",
              type: "requires",
              created_at: "2026-06-20T00:00:00.000Z",
            },
          ],
        }),
      ).rejects.toThrow(/missing from node/);
      await expect(
        restoreGraphSnapshot(restoredRoot, {
          ...snapshot,
          assignments: [
            {
              id: "assignment-1",
              node_id: "missing",
              role: "worker",
              owner: "external:worker",
              branch: null,
              worktree_path: null,
              scope: null,
              status: "open",
              commits_json: "[]",
              evidence_json: "[]",
              summary: null,
              started_at: "2026-06-20T00:00:00.000Z",
              finished_at: null,
            },
          ],
        }),
      ).rejects.toThrow(/assignment references missing node/);
      await expect(
        restoreGraphSnapshot(restoredRoot, {
          ...snapshot,
          waves: [
            {
              id: "wave-1",
              kind: "implementation",
              status: "open",
              summary: "wave",
              started_at: "2026-06-20T00:00:00.000Z",
              finished_at: null,
            },
          ],
          wave_memberships: [
            {
              wave_id: "wave-1",
              node_id: "a",
              assignment_id: "missing",
              created_at: "2026-06-20T00:00:00.000Z",
            },
          ],
        }),
      ).rejects.toThrow(/wave membership references missing assignment/);
      expect((await graphSnapshot(restoredRoot)).nodes).toHaveLength(0);
    } finally {
      await rm(restoredRoot, { recursive: true, force: true });
    }
  });

  it("surfaces advisory blocker warnings and excludes blocked nodes from ready", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await updateNode(root, "a", { status: "blocked" });

    const validation = await validateGraph(root);

    expect(validation.ok).toBe(true);
    expect(validation.warnings).toEqual([
      "a: blocked node should include blocked_by and blocked_reason for external/manual blockers",
    ]);
    expect(await readyNodes(root)).toEqual([]);
  });

  it("can promote advisory warnings to strict validation errors", async () => {
    await addNode(root, {
      id: "a",
      title: "Build A",
      spec: "Do A",
      acceptance: "A works",
    });
    await updateNode(root, "a", { status: "blocked" });

    const validation = await validateGraph(root, { strict: true });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual([
      "a: blocked node should include blocked_by and blocked_reason for external/manual blockers",
    ]);
  });

  it("resolves the nearest ancestor qd root", async () => {
    const nested = path.join(root, "packages", "app", "src");
    await mkdir(nested, { recursive: true });

    await expect(resolveProjectRoot({ cwd: nested })).resolves.toBe(root);
    await expect(resolveProjectRoot({ cwd: nested, root })).resolves.toBe(root);
  });

  it("fails loudly when no qd root is present unless missing roots are allowed", async () => {
    const emptyRoot = await mkdtemp(path.join(os.tmpdir(), "qdcli-empty-"));
    try {
      await expect(resolveProjectRoot({ cwd: emptyRoot })).rejects.toThrow(/No qd project/);
      await expect(resolveProjectRoot({ cwd: emptyRoot, allowMissing: true })).resolves.toBe(
        emptyRoot,
      );
    } finally {
      await rm(emptyRoot, { recursive: true, force: true });
    }
  });
});
