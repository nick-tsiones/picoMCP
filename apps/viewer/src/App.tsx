import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type {
  AnalyticsReport,
  GraphSnapshot,
  NodeStatus,
  QdEdge,
  QdFinding,
  QdNode,
} from "@cat-cave/qdcli-core";
import "./styles.css";

const emptySnapshot: GraphSnapshot = {
  schema_version: 1,
  exported_at: new Date(0).toISOString(),
  registries: { groups: [], projects: [], milestones: [] },
  nodes: [],
  edges: [],
  findings: [],
  runs: [],
  node_notes: [],
  assignments: [],
  waves: [],
  wave_memberships: [],
};

const statuses: NodeStatus[] = [
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
];

const priorityRank = new Map([
  ["P0", 0],
  ["P1", 1],
  ["P2", 2],
  ["P3", 3],
]);

const nodeWidth = 230;
const nodeHeight = 92;
const columnGap = 120;
const rowGap = 34;
const graphPadding = 80;

interface Filters {
  query: string;
  statuses: Set<NodeStatus>;
  milestone: string;
  group: string;
  project: string;
  dimFiltered: boolean;
  focusSelection: boolean;
}

interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutNode {
  node: QdNode;
  x: number;
  y: number;
  layer: number;
}

interface LayoutGraph {
  nodes: LayoutNode[];
  edges: QdEdge[];
  bounds: Viewport;
}

interface DragState {
  pointerId: number;
  x: number;
  y: number;
  viewport: Viewport;
}

function App() {
  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsReport | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(true);
  const [filters, setFilters] = useState<Filters>(() => ({
    query: "",
    statuses: new Set(statuses),
    milestone: "all",
    group: "all",
    project: "all",
    dimFiltered: true,
    focusSelection: true,
  }));
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    let disposed = false;

    async function load() {
      try {
        const [graphResponse, analyticsResponse] = await Promise.all([
          fetch("/api/graph"),
          fetch("/api/analytics"),
        ]);
        if (!graphResponse.ok) throw new Error(`Graph request failed: ${graphResponse.status}`);
        const graph = (await graphResponse.json()) as GraphSnapshot;
        const report = analyticsResponse.ok
          ? ((await analyticsResponse.json()) as AnalyticsReport)
          : null;
        if (disposed) return;
        setSnapshot(graph);
        setAnalytics(report);
        setLastUpdated(new Date());
        setError(null);
        setSelected((current) =>
          current && graph.nodes.some((node) => node.id === current)
            ? current
            : (graph.nodes[0]?.id ?? null),
        );
      } catch (caught) {
        if (disposed) return;
        setSnapshot((current) => current ?? emptySnapshot);
        setAnalytics(null);
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    }

    void load();
    const timer = window.setInterval(() => {
      if (live) void load();
    }, 5000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [live]);

  const filteredIds = useMemo(() => {
    if (!snapshot) return new Set<string>();
    return new Set(
      snapshot.nodes.filter((node) => matchesFilters(node, filters)).map((node) => node.id),
    );
  }, [filters, snapshot]);

  const renderedNodeIds = useMemo(() => {
    if (!snapshot) return new Set<string>();
    if (filters.dimFiltered) return new Set(snapshot.nodes.map((node) => node.id));
    return filteredIds;
  }, [filteredIds, filters.dimFiltered, snapshot]);

  const layout = useMemo(() => {
    if (!snapshot) return null;
    return buildLayout(snapshot, renderedNodeIds);
  }, [renderedNodeIds, snapshot]);

  useEffect(() => {
    if (layout) setViewport(fitBounds(layout.bounds));
  }, [layout?.bounds.height, layout?.bounds.width, layout?.bounds.x, layout?.bounds.y]);

  const ready = useMemo(() => (snapshot ? readyNodes(snapshot) : []), [snapshot]);
  const selectedNode = snapshot?.nodes.find((node) => node.id === selected) ?? null;
  const openAssignments = useMemo(
    () => snapshot?.assignments.filter((assignment) => assignment.status === "open") ?? [],
    [snapshot],
  );
  const openWaves = useMemo(
    () => snapshot?.waves.filter((wave) => wave.status === "open") ?? [],
    [snapshot],
  );
  const criticalIds = useMemo(
    () => new Set(analytics?.criticalPath.criticalPath.map((node) => node.id) ?? []),
    [analytics],
  );
  const neighborIds = useMemo(
    () => (snapshot && selected ? neighborhood(snapshot, selected) : new Set<string>()),
    [selected, snapshot],
  );

  if (!snapshot || !layout || !viewport) {
    return <main className="loading">Loading qd graph...</main>;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brandBlock">
          <h1>Quick DAG</h1>
          <p>
            {snapshot.nodes.length} nodes, {snapshot.edges.length} edges, {ready.length} ready
          </p>
        </div>
        <MetricStrip
          snapshot={snapshot}
          analytics={analytics}
          ready={ready.length}
          openAssignments={openAssignments.length}
          openWaves={openWaves.length}
        />
      </header>

      <section className="workspace">
        <aside className="sidebar controlsPanel">
          <Toolbar
            snapshot={snapshot}
            filters={filters}
            onFilters={setFilters}
            onFit={() => setViewport(fitBounds(layout.bounds))}
            live={live}
            onLive={setLive}
            onRefresh={() => {
              setLive(false);
              window.setTimeout(() => setLive(true), 0);
            }}
            lastUpdated={lastUpdated}
            error={error}
          />
          <HealthPanel snapshot={snapshot} analytics={analytics} />
          <TriagePanel snapshot={snapshot} selected={selected} onSelect={setSelected} />
          <ReadyQueue ready={ready} selected={selected} onSelect={setSelected} />
          <WavePanel snapshot={snapshot} selected={selected} onSelect={setSelected} />
        </aside>

        <section className="graphPanel">
          <div className="graphHeader">
            <div>
              <h2>DAG Map</h2>
              <p>
                {filters.dimFiltered
                  ? `${filteredIds.size} matching nodes highlighted`
                  : `${layout.nodes.length} nodes visible`}
              </p>
            </div>
            <GraphLegend />
          </div>

          <svg
            ref={svgRef}
            className="dagCanvas"
            viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
            role="img"
            aria-label="Interactive qd DAG graph"
            onWheel={(event) => {
              event.preventDefault();
              setViewport((current) => zoomViewport(current ?? viewport, event, svgRef.current));
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              dragRef.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                viewport,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              const rect = svgRef.current?.getBoundingClientRect();
              if (!drag || !rect) return;
              const dx = ((event.clientX - drag.x) / rect.width) * drag.viewport.width;
              const dy = ((event.clientY - drag.y) / rect.height) * drag.viewport.height;
              setViewport({
                ...drag.viewport,
                x: drag.viewport.x - dx,
                y: drag.viewport.y - dy,
              });
            }}
            onPointerUp={(event) => {
              if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
            }}
          >
            <defs>
              <marker id="arrow" markerHeight="7" markerWidth="7" orient="auto" refX="7" refY="3.5">
                <path d="M 0 0 L 7 3.5 L 0 7 z" className="arrowHead" />
              </marker>
            </defs>
            <GraphEdges
              layout={layout}
              selected={selected}
              filteredIds={filteredIds}
              neighborIds={neighborIds}
              filters={filters}
            />
            <GraphNodes
              layout={layout}
              selected={selected}
              filteredIds={filteredIds}
              neighborIds={neighborIds}
              criticalIds={criticalIds}
              filters={filters}
              snapshot={snapshot}
              onSelect={setSelected}
            />
          </svg>
        </section>

        <aside className="sidebar detailPanel">
          {selectedNode ? (
            <NodeDetail
              node={selectedNode}
              snapshot={snapshot}
              analytics={analytics}
              onSelect={setSelected}
            />
          ) : (
            <p className="emptyState">Select a node to inspect its spec, blockers, and history.</p>
          )}
        </aside>
      </section>
    </main>
  );
}

function Toolbar({
  snapshot,
  filters,
  onFilters,
  onFit,
  live,
  onLive,
  onRefresh,
  lastUpdated,
  error,
}: {
  snapshot: GraphSnapshot;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  onFit: () => void;
  live: boolean;
  onLive: (live: boolean) => void;
  onRefresh: () => void;
  lastUpdated: Date | null;
  error: string | null;
}) {
  const milestones = ["all", ...snapshot.registries.milestones.map((item) => item.name)];
  const groups = ["all", ...snapshot.registries.groups.map((item) => item.name)];
  const projects = ["all", ...snapshot.registries.projects.map((item) => item.name)];

  return (
    <section className="toolBlock">
      <div className="panelTitle">
        <h2>View</h2>
        <span className={live ? "liveDot active" : "liveDot"} />
      </div>
      <label className="fieldLabel">
        Search
        <input
          value={filters.query}
          onChange={(event) => onFilters({ ...filters, query: event.target.value })}
          placeholder="id, title, spec"
        />
      </label>
      <div className="buttonRow">
        <button type="button" onClick={onFit}>
          Fit
        </button>
        <button type="button" onClick={onRefresh}>
          Refresh
        </button>
        <button type="button" className={live ? "activeButton" : ""} onClick={() => onLive(!live)}>
          Live
        </button>
      </div>
      <div className="statusGrid">
        {statuses.map((status) => {
          const enabled = filters.statuses.has(status);
          return (
            <button
              key={status}
              type="button"
              className={enabled ? `statusToggle ${status}` : "statusToggle disabled"}
              onClick={() => {
                const next = new Set(filters.statuses);
                if (next.has(status)) next.delete(status);
                else next.add(status);
                onFilters({ ...filters, statuses: next });
              }}
            >
              {status}
            </button>
          );
        })}
      </div>
      <label className="fieldLabel">
        Milestone
        <select
          value={filters.milestone}
          onChange={(event) => onFilters({ ...filters, milestone: event.target.value })}
        >
          {milestones.map((milestone) => (
            <option key={milestone} value={milestone}>
              {milestone}
            </option>
          ))}
        </select>
      </label>
      <label className="fieldLabel">
        Group
        <select
          value={filters.group}
          onChange={(event) => onFilters({ ...filters, group: event.target.value })}
        >
          {groups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
      </label>
      <label className="fieldLabel">
        Project
        <select
          value={filters.project}
          onChange={(event) => onFilters({ ...filters, project: event.target.value })}
        >
          {projects.map((project) => (
            <option key={project} value={project}>
              {project}
            </option>
          ))}
        </select>
      </label>
      <label className="checkLine">
        <input
          type="checkbox"
          checked={filters.dimFiltered}
          onChange={(event) => onFilters({ ...filters, dimFiltered: event.target.checked })}
        />
        Dim filtered nodes
      </label>
      <label className="checkLine">
        <input
          type="checkbox"
          checked={filters.focusSelection}
          onChange={(event) => onFilters({ ...filters, focusSelection: event.target.checked })}
        />
        Focus selected neighborhood
      </label>
      <p className="syncLine">
        {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Waiting for graph"}
      </p>
      {error ? <p className="errorLine">{error}</p> : null}
    </section>
  );
}

function MetricStrip({
  snapshot,
  analytics,
  ready,
  openAssignments,
  openWaves,
}: {
  snapshot: GraphSnapshot;
  analytics: AnalyticsReport | null;
  ready: number;
  openAssignments: number;
  openWaves: number;
}) {
  const donePoints = snapshot.nodes
    .filter((node) => node.status === "done")
    .reduce((sum, node) => sum + node.estimate_points, 0);
  const totalPoints = snapshot.nodes.reduce((sum, node) => sum + node.estimate_points, 0);
  const openBlocking = snapshot.findings.filter(
    (finding) =>
      finding.status === "open" && (finding.severity === "P0" || finding.severity === "P1"),
  ).length;
  return (
    <div className="metricStrip">
      <Metric label="Ready" value={String(ready)} />
      <Metric label="Points" value={`${donePoints}/${totalPoints}`} />
      <Metric
        label="Velocity"
        value={analytics ? analytics.velocity.pointsPerDay.toFixed(2) : "n/a"}
      />
      <Metric
        label="Critical"
        value={analytics ? String(analytics.criticalPath.criticalPathPoints) : "n/a"}
      />
      <Metric label="P0/P1" value={String(openBlocking)} />
      <Metric label="Owners" value={String(openAssignments)} />
      <Metric label="Waves" value={String(openWaves)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReadyQueue({
  ready,
  selected,
  onSelect,
}: {
  ready: QdNode[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="toolBlock queueBlock">
      <div className="panelTitle">
        <h2>Ready Queue</h2>
        <span>{ready.length}</span>
      </div>
      {ready.length === 0 ? (
        <p className="emptyState">No dependency-unblocked nodes are ready.</p>
      ) : (
        ready.slice(0, 16).map((node) => (
          <button
            key={node.id}
            type="button"
            className={selected === node.id ? "queueItem selectedQueueItem" : "queueItem"}
            onClick={() => onSelect(node.id)}
          >
            <span className={`priority ${node.priority}`}>{node.priority}</span>
            <strong>{node.id}</strong>
            <small>{node.title}</small>
          </button>
        ))
      )}
    </section>
  );
}

function HealthPanel({
  snapshot,
  analytics,
}: {
  snapshot: GraphSnapshot;
  analytics: AnalyticsReport | null;
}) {
  const blocked = snapshot.nodes.filter((node) => node.status === "blocked");
  const review = snapshot.nodes.filter((node) => node.status === "review");
  const mergeable = snapshot.nodes.filter((node) => node.status === "mergeable");
  const progress = milestoneProgress(snapshot);
  return (
    <section className="toolBlock healthBlock">
      <div className="panelTitle">
        <h2>Health</h2>
        <span>{analytics?.eta.etaDate ?? "no ETA"}</span>
      </div>
      <div className="healthGrid">
        <Metric label="Blocked" value={String(blocked.length)} />
        <Metric label="Review" value={String(review.length)} />
        <Metric label="Mergeable" value={String(mergeable.length)} />
      </div>
      <div className="progressList">
        {progress.slice(0, 5).map((item) => (
          <div key={item.name} className="progressItem">
            <span>{item.name}</span>
            <strong>
              {item.done}/{item.total}
            </strong>
            <i style={{ inlineSize: `${item.percent}%` }} />
          </div>
        ))}
      </div>
    </section>
  );
}

function TriagePanel({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: GraphSnapshot;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const byNode = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const blockers = snapshot.findings
    .filter(
      (finding) =>
        finding.status === "open" && (finding.severity === "P0" || finding.severity === "P1"),
    )
    .slice(0, 6);
  const regressed = snapshot.nodes.filter((node) => node.status === "regressed").slice(0, 4);
  const blocked = snapshot.nodes.filter((node) => node.status === "blocked").slice(0, 4);
  return (
    <section className="toolBlock triageBlock">
      <div className="panelTitle">
        <h2>Triage</h2>
        <span>{blockers.length + regressed.length + blocked.length}</span>
      </div>
      {blockers.length === 0 && regressed.length === 0 && blocked.length === 0 ? (
        <p className="emptyState">No active blockers.</p>
      ) : null}
      {blockers.map((finding) => {
        const node = byNode.get(finding.node_id);
        return (
          <button
            key={finding.id}
            type="button"
            className={
              selected === finding.node_id ? "triageItem selectedTriageItem" : "triageItem"
            }
            onClick={() => onSelect(finding.node_id)}
          >
            <span className={`priority ${finding.severity}`}>{finding.severity}</span>
            <strong>{finding.title}</strong>
            <small>{node ? `${node.id} - ${node.title}` : finding.node_id}</small>
          </button>
        );
      })}
      {[...regressed, ...blocked].map((node) => (
        <button
          key={`${node.status}-${node.id}`}
          type="button"
          className={selected === node.id ? "triageItem selectedTriageItem" : "triageItem"}
          onClick={() => onSelect(node.id)}
        >
          <span className={`statusPill ${node.status}`}>{node.status}</span>
          <strong>{node.id}</strong>
          <small>{node.blocked_reason ?? node.title}</small>
        </button>
      ))}
    </section>
  );
}

function WavePanel({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: GraphSnapshot;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const membershipsByWave = new Map<string, string[]>();
  for (const membership of snapshot.wave_memberships) {
    if (!membership.node_id) continue;
    membershipsByWave.set(membership.wave_id, [
      ...(membershipsByWave.get(membership.wave_id) ?? []),
      membership.node_id,
    ]);
  }
  const openWaves = snapshot.waves.filter((wave) => wave.status === "open");
  return (
    <section className="toolBlock queueBlock">
      <div className="panelTitle">
        <h2>Open Waves</h2>
        <span>{openWaves.length}</span>
      </div>
      {openWaves.length === 0 ? (
        <p className="emptyState">No open waves.</p>
      ) : (
        openWaves.slice(0, 8).map((wave) => {
          const nodes = membershipsByWave.get(wave.id) ?? [];
          return (
            <div key={wave.id} className="waveItem">
              <strong>{wave.kind}</strong>
              <small>{wave.summary}</small>
              <div className="waveNodes">
                {nodes.slice(0, 6).map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={selected === id ? "miniNode activeMiniNode" : "miniNode"}
                    onClick={() => onSelect(id)}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}

function GraphLegend() {
  return (
    <div className="legend">
      <span>
        <i className="legendLine requires" /> requires
      </span>
      <span>
        <i className="legendLine related" /> other edge
      </span>
      <span>
        <i className="legendNode critical" /> critical path
      </span>
    </div>
  );
}

function GraphEdges({
  layout,
  selected,
  filteredIds,
  neighborIds,
  filters,
}: {
  layout: LayoutGraph;
  selected: string | null;
  filteredIds: Set<string>;
  neighborIds: Set<string>;
  filters: Filters;
}) {
  const byId = new Map(layout.nodes.map((item) => [item.node.id, item]));
  return (
    <g className="edges">
      {layout.edges.map((edge) => {
        const from = byId.get(edge.from_node);
        const to = byId.get(edge.to_node);
        if (!from || !to) return null;
        const highlighted = Boolean(
          selected && (edge.from_node === selected || edge.to_node === selected),
        );
        const dimmed =
          (filters.dimFiltered &&
            (!filteredIds.has(edge.from_node) || !filteredIds.has(edge.to_node))) ||
          (filters.focusSelection &&
            selected &&
            (!neighborIds.has(edge.from_node) || !neighborIds.has(edge.to_node)));
        return (
          <path
            key={`${edge.from_node}-${edge.to_node}-${edge.type}`}
            className={`edge ${edge.type} ${highlighted ? "highlighted" : ""} ${
              dimmed ? "dimmed" : ""
            }`}
            d={edgePath(from, to)}
            markerEnd={edge.type === "requires" ? "url(#arrow)" : undefined}
          />
        );
      })}
    </g>
  );
}

function GraphNodes({
  layout,
  selected,
  filteredIds,
  neighborIds,
  criticalIds,
  filters,
  snapshot,
  onSelect,
}: {
  layout: LayoutGraph;
  selected: string | null;
  filteredIds: Set<string>;
  neighborIds: Set<string>;
  criticalIds: Set<string>;
  filters: Filters;
  snapshot: GraphSnapshot;
  onSelect: (id: string) => void;
}) {
  const findingCounts = findingCountByNode(snapshot.findings);
  const assignmentCounts = assignmentCountByNode(snapshot);
  return (
    <g className="nodes">
      {layout.nodes.map((item) => {
        const node = item.node;
        const titleLines = wrapText(node.title, 28, 2);
        const filtered = filteredIds.has(node.id);
        const selectedNode = selected === node.id;
        const focused = !selected || neighborIds.has(node.id);
        const dimmed =
          (filters.dimFiltered && !filtered) || (filters.focusSelection && selected && !focused);
        const blocking = findingCounts.get(node.id) ?? 0;
        const assignments = assignmentCounts.get(node.id) ?? 0;
        return (
          <g
            key={node.id}
            className={`graphNode ${node.status} ${selectedNode ? "selected" : ""} ${
              criticalIds.has(node.id) ? "critical" : ""
            } ${dimmed ? "dimmed" : ""}`}
            transform={`translate(${item.x} ${item.y})`}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(node.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelect(node.id);
            }}
          >
            <rect width={nodeWidth} height={nodeHeight} rx="8" />
            <rect className={`nodeRail ${node.priority}`} width="6" height={nodeHeight} rx="3" />
            <text className="nodeId" x="14" y="24">
              {node.id}
            </text>
            <text className="nodeStatus" x={nodeWidth - 14} y="24">
              {node.status}
            </text>
            {titleLines.map((line, index) => (
              <text key={line} className="nodeTitle" x="14" y={48 + index * 17}>
                {line}
              </text>
            ))}
            <text className="nodeMeta" x="14" y="80">
              {node.priority} - {node.estimate_points} pts
            </text>
            {blocking > 0 ? (
              <text className="findingBadge" x={nodeWidth - 14} y="80">
                {blocking} P0/P1
              </text>
            ) : assignments > 0 ? (
              <text className="findingBadge neutral" x={nodeWidth - 14} y="80">
                {assignments} active
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

function NodeDetail({
  node,
  snapshot,
  analytics,
  onSelect,
}: {
  node: QdNode;
  snapshot: GraphSnapshot;
  analytics: AnalyticsReport | null;
  onSelect: (id: string) => void;
}) {
  const findings = snapshot.findings.filter((finding) => finding.node_id === node.id);
  const runs = snapshot.runs.filter((run) => run.node_id === node.id);
  const notes = snapshot.node_notes.filter((note) => note.node_id === node.id);
  const assignments = snapshot.assignments.filter((assignment) => assignment.node_id === node.id);
  const dependencies = snapshot.edges.filter(
    (edge) => edge.to_node === node.id && edge.type === "requires",
  );
  const dependents = snapshot.edges.filter(
    (edge) => edge.from_node === node.id && edge.type === "requires",
  );
  const criticalIndex =
    analytics?.criticalPath.criticalPath.findIndex((item) => item.id === node.id) ?? -1;
  const latestRuns = latestRunsByKind(runs);
  const nodeWaves = snapshot.wave_memberships
    .filter((membership) => membership.node_id === node.id)
    .map((membership) => snapshot.waves.find((wave) => wave.id === membership.wave_id))
    .filter((wave): wave is NonNullable<typeof wave> => Boolean(wave));
  const byNode = new Map(snapshot.nodes.map((candidate) => [candidate.id, candidate]));

  return (
    <section className="detailContent">
      <div className="detailHead">
        <span className={`priority ${node.priority}`}>{node.priority}</span>
        <h2>{node.title}</h2>
        <p>{node.id}</p>
      </div>
      <dl className="detailGrid">
        <dt>Status</dt>
        <dd>{node.status}</dd>
        <dt>Kind</dt>
        <dd>{node.kind}</dd>
        <dt>Estimate</dt>
        <dd>{node.estimate_points} pts</dd>
        <dt>Risk</dt>
        <dd>{node.risk}</dd>
        <dt>Milestone</dt>
        <dd>{node.milestone ?? "none"}</dd>
        <dt>Group</dt>
        <dd>{node.group_name ?? "none"}</dd>
        <dt>Owner</dt>
        <dd>{node.owner ?? "none"}</dd>
        <dt>Branch</dt>
        <dd>{node.branch ?? "none"}</dd>
      </dl>
      {criticalIndex >= 0 ? (
        <p className="criticalNote">Critical path position {criticalIndex + 1}</p>
      ) : null}
      {node.blocked_by ? (
        <p className="blockerNote">
          Blocked by {node.blocked_by}: {node.blocked_reason}
          {node.blocked_owner ? ` (${node.blocked_owner})` : ""}
        </p>
      ) : null}
      <DetailList
        title="Latest Runs"
        items={[...latestRuns.entries()].map(([kind, run]) => `${kind}: ${run.status}`)}
      />
      <DetailList
        title="Assignments"
        items={assignments.map(
          (assignment) =>
            `${assignment.role} ${assignment.status}: ${assignment.owner}${
              assignment.worktree_path ? ` @ ${assignment.worktree_path}` : ""
            }`,
        )}
      />
      <DetailList
        title="Waves"
        items={nodeWaves.map((wave) => `${wave.kind} ${wave.status}: ${wave.summary}`)}
      />
      <DetailSection title="Spec" text={node.spec} />
      <DetailSection title="Acceptance" text={node.acceptance} />
      <DependencyList
        title="Dependencies"
        ids={dependencies.map((edge) => edge.from_node)}
        byNode={byNode}
        onSelect={onSelect}
      />
      <DependencyList
        title="Unblocks"
        ids={dependents.map((edge) => edge.to_node)}
        byNode={byNode}
        onSelect={onSelect}
      />
      <Findings findings={findings} />
      <DetailList title="Audit Focus" items={node.audit_focus} />
      <DetailList
        title="Verification"
        items={node.verification.map((item) => `${item.type}: ${item.value}`)}
      />
      <DetailList title="Runs" items={runs.map((run) => `${run.kind}: ${run.status}`)} />
      <DetailList title="Notes" items={notes.map((note) => note.text)} />
    </section>
  );
}

function DependencyList({
  title,
  ids,
  byNode,
  onSelect,
}: {
  title: string;
  ids: string[];
  byNode: Map<string, QdNode>;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="detailSection">
      <h3>{title}</h3>
      {ids.length === 0 ? (
        <p>None</p>
      ) : (
        <div className="dependencyList">
          {ids.map((id) => {
            const node = byNode.get(id);
            return (
              <button
                key={id}
                type="button"
                className="dependencyItem"
                onClick={() => onSelect(id)}
              >
                <span className={`statusDot ${node?.status ?? "draft"}`} />
                <strong>{id}</strong>
                <small>{node?.title ?? "Missing node"}</small>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function DetailSection({ title, text }: { title: string; text: string | null }) {
  return (
    <section className="detailSection">
      <h3>{title}</h3>
      <p>{text?.trim() || "None"}</p>
    </section>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="detailSection">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p>None</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Findings({ findings }: { findings: QdFinding[] }) {
  return (
    <section className="detailSection">
      <h3>Findings</h3>
      {findings.length === 0 ? (
        <p>None</p>
      ) : (
        <ul>
          {findings.map((finding) => (
            <li key={finding.id}>
              <span className={`priority ${finding.severity}`}>{finding.severity}</span>{" "}
              {finding.status}: {finding.title}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function buildLayout(snapshot: GraphSnapshot, renderedNodeIds: Set<string>): LayoutGraph {
  const nodes = snapshot.nodes.filter((node) => renderedNodeIds.has(node.id));
  const ids = new Set(nodes.map((node) => node.id));
  const requires = snapshot.edges.filter(
    (edge) => edge.type === "requires" && ids.has(edge.from_node) && ids.has(edge.to_node),
  );
  const layer = new Map(nodes.map((node) => [node.id, 0]));
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;
    for (const edge of requires) {
      const from = layer.get(edge.from_node) ?? 0;
      const to = layer.get(edge.to_node) ?? 0;
      if (to <= from) {
        layer.set(edge.to_node, from + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const byLayer = new Map<number, QdNode[]>();
  for (const node of nodes) {
    const nodeLayer = layer.get(node.id) ?? 0;
    byLayer.set(nodeLayer, [...(byLayer.get(nodeLayer) ?? []), node]);
  }

  const positioned: LayoutNode[] = [];
  const maxRows = Math.max(...[...byLayer.values()].map((items) => items.length), 1);
  const height = maxRows * (nodeHeight + rowGap) - rowGap;
  for (const [nodeLayer, layerNodes] of [...byLayer.entries()].sort((a, b) => a[0] - b[0])) {
    const sorted = [...layerNodes].sort(compareNodes);
    const columnHeight = sorted.length * (nodeHeight + rowGap) - rowGap;
    const offsetY = (height - columnHeight) / 2;
    sorted.forEach((node, index) => {
      positioned.push({
        node,
        layer: nodeLayer,
        x: graphPadding + nodeLayer * (nodeWidth + columnGap),
        y: graphPadding + offsetY + index * (nodeHeight + rowGap),
      });
    });
  }

  const visibleEdges = snapshot.edges.filter(
    (edge) => ids.has(edge.from_node) && ids.has(edge.to_node),
  );
  const maxLayer = Math.max(...positioned.map((node) => node.layer), 0);
  return {
    nodes: positioned,
    edges: visibleEdges,
    bounds: {
      x: 0,
      y: 0,
      width: graphPadding * 2 + (maxLayer + 1) * nodeWidth + maxLayer * columnGap,
      height: graphPadding * 2 + height,
    },
  };
}

function compareNodes(a: QdNode, b: QdNode): number {
  return (
    (priorityRank.get(a.priority) ?? 9) - (priorityRank.get(b.priority) ?? 9) ||
    statuses.indexOf(a.status) - statuses.indexOf(b.status) ||
    a.id.localeCompare(b.id)
  );
}

function readyNodes(snapshot: GraphSnapshot): QdNode[] {
  return snapshot.nodes.filter((node) => {
    if (!["ready", "regressed"].includes(node.status)) return false;
    return !snapshot.edges.some((edge) => {
      if (edge.type !== "requires" || edge.to_node !== node.id) return false;
      return snapshot.nodes.find((candidate) => candidate.id === edge.from_node)?.status !== "done";
    });
  });
}

function matchesFilters(node: QdNode, filters: Filters): boolean {
  const query = filters.query.trim().toLowerCase();
  if (!filters.statuses.has(node.status)) return false;
  if (filters.milestone !== "all" && node.milestone !== filters.milestone) return false;
  if (filters.group !== "all" && node.group_name !== filters.group) return false;
  if (filters.project !== "all" && !node.projects.includes(filters.project)) return false;
  if (!query) return true;
  return [node.id, node.title, node.spec, node.acceptance, node.owner ?? "", node.branch ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function fitBounds(bounds: Viewport): Viewport {
  return {
    x: bounds.x - graphPadding,
    y: bounds.y - graphPadding,
    width: Math.max(bounds.width + graphPadding * 2, 600),
    height: Math.max(bounds.height + graphPadding * 2, 420),
  };
}

function zoomViewport(
  current: Viewport,
  event: React.WheelEvent,
  svg: SVGSVGElement | null,
): Viewport {
  const rect = svg?.getBoundingClientRect();
  if (!rect) return current;
  const mx = (event.clientX - rect.left) / rect.width;
  const my = (event.clientY - rect.top) / rect.height;
  const factor = event.deltaY > 0 ? 1.12 : 0.88;
  const width = clamp(current.width * factor, 260, 20000);
  const height = clamp(current.height * factor, 180, 20000);
  const graphX = current.x + mx * current.width;
  const graphY = current.y + my * current.height;
  return {
    x: graphX - mx * width,
    y: graphY - my * height,
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function edgePath(from: LayoutNode, to: LayoutNode): string {
  const startX = from.x + nodeWidth;
  const startY = from.y + nodeHeight / 2;
  const endX = to.x;
  const endY = to.y + nodeHeight / 2;
  const distance = Math.max(Math.abs(endX - startX) * 0.45, 80);
  return `M ${startX} ${startY} C ${startX + distance} ${startY}, ${
    endX - distance
  } ${endY}, ${endX} ${endY}`;
}

function neighborhood(snapshot: GraphSnapshot, id: string): Set<string> {
  const ids = new Set([id]);
  for (const edge of snapshot.edges) {
    if (edge.from_node === id) ids.add(edge.to_node);
    if (edge.to_node === id) ids.add(edge.from_node);
  }
  return ids;
}

function findingCountByNode(findings: QdFinding[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    if (finding.status !== "open" || (finding.severity !== "P0" && finding.severity !== "P1")) {
      continue;
    }
    counts.set(finding.node_id, (counts.get(finding.node_id) ?? 0) + 1);
  }
  return counts;
}

function assignmentCountByNode(snapshot: GraphSnapshot): Map<string, number> {
  const counts = new Map<string, number>();
  for (const assignment of snapshot.assignments) {
    if (assignment.status !== "open") continue;
    counts.set(assignment.node_id, (counts.get(assignment.node_id) ?? 0) + 1);
  }
  return counts;
}

function latestRunsByKind(runs: GraphSnapshot["runs"]): Map<string, GraphSnapshot["runs"][number]> {
  const byKind = new Map<string, GraphSnapshot["runs"][number]>();
  for (const run of runs) byKind.set(run.kind, run);
  return byKind;
}

function milestoneProgress(snapshot: GraphSnapshot): Array<{
  name: string;
  done: number;
  total: number;
  percent: number;
}> {
  const names = [...new Set(snapshot.nodes.map((node) => node.milestone ?? "unassigned"))].sort();
  return names.map((name) => {
    const nodes = snapshot.nodes.filter((node) => (node.milestone ?? "unassigned") === name);
    const done = nodes.filter((node) => node.status === "done").length;
    return {
      name,
      done,
      total: nodes.length,
      percent: nodes.length === 0 ? 0 : Math.round((done / nodes.length) * 100),
    };
  });
}

function wrapText(text: string, maxLength: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxLength) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === 0) return [text.slice(0, maxLength)];
  const last = lines.at(-1);
  if (last && words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = `${last.slice(0, Math.max(maxLength - 3, 1))}...`;
  }
  return lines;
}

createRoot(document.getElementById("root")!).render(<App />);
