import { graphSnapshot } from "./graph.js";
import type {
  AnalyticsReport,
  CriticalPathNode,
  CriticalPathReport,
  EtaReport,
  GraphSnapshot,
  QdEdge,
  QdNode,
  VelocityReport,
} from "./types.js";

const doneStatuses = new Set(["done", "cancelled"]);

export async function velocityReport(root: string, windowDays = 7): Promise<VelocityReport> {
  return calculateVelocity(await graphSnapshot(root), windowDays);
}

export async function criticalPathReport(
  root: string,
  milestone: string | null = null,
): Promise<CriticalPathReport> {
  return calculateCriticalPath(await graphSnapshot(root), milestone);
}

export async function etaReport(
  root: string,
  milestone: string | null = null,
  windowDays = 7,
): Promise<EtaReport> {
  const snapshot = await graphSnapshot(root);
  return calculateEta(snapshot, milestone, windowDays);
}

export async function analyticsReport(
  root: string,
  input: { milestone?: string | null; windowDays?: number } = {},
): Promise<AnalyticsReport> {
  const snapshot = await graphSnapshot(root);
  const windowDays = input.windowDays ?? 7;
  const milestone = input.milestone ?? null;
  const stats = calculateStats(snapshot);
  const velocity = calculateVelocity(snapshot, windowDays);
  const criticalPath = calculateCriticalPath(snapshot, milestone);
  const eta = calculateEta(snapshot, milestone, windowDays);
  return { stats, velocity, criticalPath, eta };
}

export function calculateStats(snapshot: GraphSnapshot): Record<string, unknown> {
  const byStatus = Object.fromEntries(
    [...new Set(snapshot.nodes.map((node) => node.status))].map((status) => [
      status,
      snapshot.nodes.filter((node) => node.status === status).length,
    ]),
  );
  const donePoints = snapshot.nodes
    .filter((node) => node.status === "done")
    .reduce((sum, node) => sum + node.estimate_points, 0);
  const totalPoints = snapshot.nodes.reduce((sum, node) => sum + node.estimate_points, 0);
  const ready = calculateReady(snapshot).length;
  return {
    nodes: snapshot.nodes.length,
    ready,
    byStatus,
    donePoints,
    totalPoints,
    remainingPoints: totalPoints - donePoints,
    openP0P1Findings: snapshot.findings.filter(
      (finding) =>
        finding.status === "open" && (finding.severity === "P0" || finding.severity === "P1"),
    ).length,
  };
}

export function calculateVelocity(
  snapshot: GraphSnapshot,
  windowDays = 7,
  now = new Date(),
): VelocityReport {
  const sinceMs = now.getTime() - windowDays * 24 * 60 * 60 * 1000;
  const completed = snapshot.nodes.filter((node) => {
    if (node.status !== "done" || !node.done_at) return false;
    return new Date(node.done_at).getTime() >= sinceMs;
  });
  const completedPoints = completed.reduce((sum, node) => sum + node.estimate_points, 0);
  const cycleHours = completed
    .filter((node) => node.claimed_at && node.done_at)
    .map(
      (node) =>
        (new Date(node.done_at ?? "").getTime() - new Date(node.claimed_at ?? "").getTime()) /
        3_600_000,
    )
    .filter((hours) => Number.isFinite(hours) && hours >= 0);

  return {
    windowDays,
    completedNodes: completed.length,
    completedPoints,
    pointsPerDay: completedPoints / windowDays,
    averageCycleHours: cycleHours.length
      ? cycleHours.reduce((sum, hours) => sum + hours, 0) / cycleHours.length
      : null,
  };
}

export function calculateCriticalPath(
  snapshot: GraphSnapshot,
  milestone: string | null = null,
): CriticalPathReport {
  const scoped = snapshot.nodes.filter((node) => !milestone || node.milestone === milestone);
  const scopedIds = new Set(scoped.map((node) => node.id));
  const remaining = scoped.filter((node) => !doneStatuses.has(node.status));
  const remainingIds = new Set(remaining.map((node) => node.id));
  const edges = snapshot.edges.filter(
    (edge) =>
      edge.type === "requires" &&
      scopedIds.has(edge.from_node) &&
      scopedIds.has(edge.to_node) &&
      remainingIds.has(edge.from_node) &&
      remainingIds.has(edge.to_node),
  );
  const byId = new Map(remaining.map((node) => [node.id, node]));
  const children = new Map<string, string[]>();
  for (const edge of edges)
    children.set(edge.from_node, [...(children.get(edge.from_node) ?? []), edge.to_node]);

  const memo = new Map<string, { points: number; path: string[] }>();
  function longestFrom(id: string): { points: number; path: string[] } {
    const cached = memo.get(id);
    if (cached) return cached;
    const node = byId.get(id);
    if (!node) return { points: 0, path: [] };
    const childPaths = (children.get(id) ?? []).map(longestFrom);
    const bestChild = childPaths.sort((a, b) => b.points - a.points)[0] ?? { points: 0, path: [] };
    const result = {
      points: node.estimate_points + bestChild.points,
      path: [id, ...bestChild.path],
    };
    memo.set(id, result);
    return result;
  }

  const best = remaining
    .map((node) => longestFrom(node.id))
    .sort((a, b) => b.points - a.points)[0] ?? { points: 0, path: [] };

  return {
    milestone,
    totalRemainingPoints: remaining.reduce((sum, node) => sum + node.estimate_points, 0),
    criticalPathPoints: best.points,
    criticalPath: best.path.map((id): CriticalPathNode => {
      const node = byId.get(id);
      if (!node) throw new Error(`Missing critical path node: ${id}`);
      return {
        id: node.id,
        title: node.title,
        status: node.status,
        estimatePoints: node.estimate_points,
        remainingPoints: node.status === "done" ? 0 : node.estimate_points,
      };
    }),
  };
}

export function calculateEta(
  snapshot: GraphSnapshot,
  milestone: string | null = null,
  windowDays = 7,
  now = new Date(),
): EtaReport {
  const velocity = calculateVelocity(snapshot, windowDays, now);
  const criticalPath = calculateCriticalPath(snapshot, milestone);
  const etaDays =
    velocity.pointsPerDay > 0
      ? Math.max(criticalPath.criticalPathPoints / velocity.pointsPerDay, 0)
      : null;
  const etaDate =
    etaDays === null ? null : new Date(now.getTime() + etaDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    milestone,
    remainingPoints: criticalPath.totalRemainingPoints,
    velocityPointsPerDay: velocity.pointsPerDay,
    etaDays,
    etaDate,
    criticalPathPoints: criticalPath.criticalPathPoints,
  };
}

function calculateReady(snapshot: GraphSnapshot): QdNode[] {
  return snapshot.nodes.filter((node) => {
    if (!["ready", "regressed"].includes(node.status)) return false;
    return !snapshot.edges.some((edge) => blocksNode(snapshot, edge, node));
  });
}

function blocksNode(snapshot: GraphSnapshot, edge: QdEdge, node: QdNode): boolean {
  if (edge.type !== "requires" || edge.to_node !== node.id) return false;
  return snapshot.nodes.find((candidate) => candidate.id === edge.from_node)?.status !== "done";
}
