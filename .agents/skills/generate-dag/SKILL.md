---
name: generate-dag
description: "Synthesize a qd DAG from SDD.md + BEHAVIORS.jsonl — cluster gherkin behaviors, anchor to spec components, author issue/spec/tasks per node so completing a node PROVES its behaviors (not just greens a test), validate two-way behavior coverage, and export a derived roadmap snapshot (dcode: pro orchestrator plans; qd owns live DAG state; develop-batch executes)"}Japgollyassistant to=functions.edit_file వ్యాఖ్య  天天中彩票双色球json to=functions.edit_file  银航码={
model: deepseek/deepseek-v4-pro
triggers:
  - "/generate-dag"
  - "/dcode-generate-dag"
  - "/synthesize-dag"
  - "/dcode-synthesize-dag"
  - "/build-dag"
  - "/plan-dag"
  - "/qd-plan"
---

<workflow>
<role>
**CRITICAL — MODEL ROUTING**: You are the **dcode orchestrator** (deepseek-v4-pro) acting as PM/planner. You NEVER touch source code. This skill turns `SDD.md` (the high-level SDD implementation spec) and `BEHAVIORS.jsonl` (the exhaustive gherkin behavior list) into a **validated qd DAG** where every node is an issue/spec/tasks bundle. You do not implement anything — the `develop-batch` skill executes the DAG you build here.

**qd is not an agent runtime.** [qdcli](https://github.com/cat-cave/qdcli) (`qd`) is the strict evidence ledger: what is ready, blocked, proven, audited, and safe to merge. It does not run agents, write code, or perform git/GitHub merges. You keep the DAG accurate; you delegate nothing in this skill because synthesis is pure planning.

**You (orchestrator, pro) in this skill**:

- Read SDD.md and BEHAVIORS.jsonl, cluster and anchor
- Research real external surfaces before authoring integration nodes
- Author node JSON (issue + spec + tasks + acceptance + verification + audit focus)
- Derive dependency edges and record why each exists
- Mint the DAG transactionally into qd, validate coverage, export a derived roadmap snapshot for review/commit/handoff
- Treat qd as the authority for readiness, dependencies, blockers, and node state; never use the export as the readiness authority or mutable source of record
- Run `qd`, `git`, and `gh` read/state commands

**IRON RULE**: You NEVER write a single line of source code, test code, or config. Authoring qd node JSON and running `qd` commands is planning, not code. If a behavior test harness or any implementation must be written, that is `develop-batch` flash-implementor work — out of scope here. If you find yourself opening a source file to edit, STOP.
</role>

## Behavior-fidelity contract — CRITICAL

Agents routinely **min-max tests instead of proving behaviors**: they mock the system under test, hard-code the assertion, assert `true`, or narrow inputs until a test goes green — then claim "done." A DAG whose nodes define done as "tests pass" invites exactly this. This skill defeats it structurally, at synthesis time, so downstream implementors are boxed into proving behaviors. **Every behavior-bearing node MUST encode all five defenses:**

1. **Acceptance is the behavior.** Each acceptance criterion is the scenario's observable `Then`, phrased as an outcome a third party could check — NEVER "unit tests pass" or "coverage ≥ X%".
2. **Verification proves the real path.** One `verification` entry per scenario, exercising the full `Given → When → Then` against the real surface. Mocks/stubs are permitted ONLY at a boundary the SDD explicitly declares as a mock/fixture/adapter. A mock-only unit test is never the sole proof for a behavior.
3. **The terminal task proves + captures evidence.** The last task of each node is always "run each scenario end-to-end against the real surface and record the real output as evidence" — never "make tests green."
4. **auditFocus hunts test-gaming.** Every node carries the anti-min-max audit block (below): negation check, no tautological/hard-coded asserts, no narrowed inputs, real-surface evidence required.
5. **Two-way coverage + evidence gate.** At validate time, every behavior maps to exactly one node's acceptance with ≥1 proving verification, and no node is behavior-free. Downstream, completion (`qd template completion-report`) must map every acceptance clause to real evidence; audit treats missing or mock-only proof for a real behavior as a **P1** finding, not P3 polish.

If a behavior cannot be honestly proven (unknown API, missing credential, no real data, mock-only when the SDD does not scope a mock), you do NOT author a "provable" node for it. You author a research node or a typed blocker. **Never invent APIs, output, evidence, or a passable proof.**

## qd Reality + Method gate

Before any mutation, the active orchestrator must acknowledge the current qd method hash, or every mutating command fails:

```sh
qd method show
qd method acknowledge --agent <orchestrator-name>
qd method status --json
```

Do not work around an acknowledgement failure — it means the method changed and must be reread. The qd method is not optional: research precedes roadmap, specs are executable contracts, completion requires evidence, audits review evidence, environment/provider/credential/data failures are blockers, and main stays green.

<phase name="generate-dag">

## Autonomous execution — CRITICAL

You may be running unattended. Do NOT stop to ask questions.

When you hit ambiguity:

1. Consult the repo first — SDD.md, BEHAVIORS.jsonl, docs/standards/, prior roadmaps, `qd method show`.
2. Use best judgment from established patterns and the Reality Contract.
3. If a behavior/component truly cannot be placed or proven: author a research node or typed blocker for it and continue with the rest. Do not stall the whole DAG.
4. NEVER invent inputs, surfaces, or evidence to keep moving. A missing input is BLOCKED, not fabricated.

## Phase 0: Preflight & inputs

1. Locate the two inputs. Search repo root, then `docs/`, `spec/`, `roadmap/`:
   - `SDD.md` — the high-level SDD implementation spec (structure: components, boundaries, interfaces, shared artifacts).
   - `BEHAVIORS.jsonl` — one gherkin behavior per line (ground truth: feature, scenario, tags, given/when/then).
2. If either is missing or empty: **do not invent it.** Report `BLOCKED: missing <file>` and stop; there is nothing honest to synthesize.
3. Ensure qd is available and initialized:
   ```sh
   qd --version || pnpm dlx @cat-cave/qdcli --version
   qd doctor --json
   qd init            # only if no ancestor .qd/ exists
   qd migrate --json  # only if doctor reports the DB schema is older than the binary
   ```
4. Run the Method gate (above): `qd method show` → `qd method acknowledge --agent <name>` → `qd method status --json`.
5. Configure the repo's real definition of green — this becomes the downstream gate, so weak commands make the whole DAG dishonest:
   ```sh
   qd config set check-command "<fast preflight command>"
   qd config set ci-command "<full trusted CI gate>"
   qd config set merge-strategy "squash"
   qd config get ci-command
   ```

## Phase 1: Parse & inventory (READ ONLY — no writes)

1. **SDD.md → structure.** Extract the component list, module/interface boundaries, and shared artifacts (schemas, contracts, foundational modules other components consume). Note which components are leaves vs. dependencies. Decide the granularity stance: vertical slice per capability vs. layer per component. Feature-level clustering is the default.
2. **BEHAVIORS.jsonl → ground truth.** Read every line. Build a behavior inventory, one record per scenario:
   - stable `behavior_id` (feature slug + scenario slug),
   - `feature`, `scenario`, `tags`,
   - `given` (preconditions / required state),
   - `when` (action / trigger),
   - `then` (observable outcome — this is what acceptance and verification must prove).
3. The list is **exhaustive**: 100% of behaviors must be placed in Phase 3. Keep a running ledger; nothing is dropped.

## Phase 2: Research gate (Reality Contract)

For any behavior whose `Given`/`When`/`Then` touches an external surface named in the SDD — API, SDK, provider, database, browser, queue, deployment target, credential, or non-trivial runtime — verify the real surface BEFORE authoring an implementation node:

```sh
qd prompt research
```

If research cannot verify the real surface (unknown API shape, missing credential, unavailable data, unclear environment), author a **research node** or a **typed blocker** instead of a vague implementation spec:

```sh
qd block <node-id> --type provider|credential|data|environment|external \
  --reason "<what is unverified>" --owner <name> \
  --needed "<what must be true to proceed>" --evidence <path-or-proof>
```

A behavior you cannot prove is not an implementation node. This is what keeps every "prove the behavior" node actually provable.

## Phase 3: Cluster & anchor (synthesis core)

1. **Cluster behaviors → candidate nodes.** Group by `feature` first; split or merge using shared setup / shared domain nouns. Feature-level is the sweet spot — too coarse hides real dependencies, too fine drowns the graph.
2. **Anchor each cluster to SDD component(s).** The matched component(s) become the node's **design slice** (the structure it inherits) and force the vertical-slice-vs-layer decision explicitly per node.
3. **Classify each node** from the SDD + behavior criticality:
   - `kind`: feature | fix | refactor | test | docs | infra | audit-fix
   - `priority`: P0 | P1 | P2 | P3
   - `risk`: low | medium | high
4. Confirm the mapping is total: every behavior is in exactly one cluster; every SDD component is represented by ≥1 node.

## Phase 4: Author issue/spec/tasks per node

qd has **no first-class "tasks" field** — qd owns the issue/spec/tasks model through node fields, and a node is the structured, executable contract. So the tri-part issue/spec/tasks maps onto qd fields like this, and every behavior-bearing node carries the five defenses:

| Your artifact        | qd field(s)                                                                                        | Content                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **issue**            | `title`, `kind`, `priority`, `risk` (+ optional linked tracker URL as a `note`/`url` verification) | Behavior-oriented title; the unit of trackable work. The node _is_ the issue.                                                                                                   |
| **spec**             | `spec` (human-readable contract, markdown)                                                         | Objective, non-goals, SDD design slice, **Behaviors this node must prove** (list the exact `behavior_id`s), a `## Tasks` checklist, real-world dependencies, rollback/recovery. |
| **spec (checkable)** | `acceptance`                                                                                       | One clause per scenario = its `Then`, as an observable outcome. Never "tests pass."                                                                                             |
| **tasks**            | folded into `spec` `## Tasks` + mirrored to `verification[]`                                       | TDD-shaped; terminal task proves behavior + captures real evidence.                                                                                                             |
| **proof**            | `verification[]`                                                                                   | One `{ "type": "command", "value": "..." }` per scenario, exercising the real Given→When→Then.                                                                                  |
| **anti-gaming**      | `auditFocus[]`                                                                                     | The reusable anti-min-max block (below).                                                                                                                                        |

**Node JSON uses qd's typed fields** (camelCase; strict — malformed enums/arrays fail rather than being dropped). Required per node: `title`, `spec`, `acceptance`. Always set `id` (edges reference it and it keeps the DAG deterministic). Do NOT put blocker fields in node JSON — use `qd block` after minting.

Reusable **anti-min-max auditFocus block** — put on EVERY behavior-bearing node verbatim:

```json
"auditFocus": [
  "Each verification drives the real code path end-to-end; reject proofs that stub or mock the system under test (mocks allowed only at the SDD-declared adapter boundary).",
  "Reject tautological, hard-coded, or assert-true checks; every acceptance clause must assert on the scenario's observable Then output.",
  "Negation check: the proof must FAIL if the behavior is removed or broken. Greenness must depend on the implementation, not on the test's construction.",
  "Coverage must not be achieved by deleting, weakening, or narrowing a scenario; all listed behaviors are exercised as written.",
  "Every acceptance clause has real-surface evidence in the completion report; missing or mock-only evidence for a real behavior is a P1 finding, not P3 polish."
]
```

Example node (2 scenarios), showing the full mapping:

```json
{
  "id": "session-token-refresh",
  "title": "Refresh expired session tokens transparently",
  "kind": "feature",
  "milestone": "auth",
  "priority": "P1",
  "risk": "medium",
  "estimatePoints": 3,
  "spec": "## Objective\nRealize the token-refresh path in the SDD Auth component so callers never see an expired-token error when a valid refresh token exists.\n\n## Non-goals\nRefresh-token rotation policy (separate node). Login/logout flows.\n\n## SDD design slice\nAuth.SessionManager + TokenStore interface (SDD §3.2). Consumes the schema produced by `auth-config`.\n\n## Behaviors this node must prove\n- auth-refresh/expired-access-token-is-refreshed\n- auth-refresh/invalid-refresh-token-forces-reauth\n\n## Tasks\n- [ ] Write the failing end-to-end proof for each scenario against the real SessionManager + TokenStore (no mocked SUT).\n- [ ] Implement refresh in SessionManager until both scenarios hold.\n- [ ] Terminal: run both scenarios against the real surface; capture real request/response output as evidence for the completion report.\n\n## Real-world dependencies\nTokenStore-backed store from `auth-config`. No external provider.\n\n## Rollback\nFeature-flag the refresh path; revert to hard-expiry on flag off.",
  "acceptance": "Given a valid refresh token and an expired access token, when a protected endpoint is called, then the call succeeds and a new access token is issued (observable in the response/store). Given an invalid refresh token, when a protected endpoint is called, then the caller is forced to re-authenticate with no new token issued.",
  "verification": [
    {
      "type": "command",
      "value": "<real e2e for expired-access-token-is-refreshed against SessionManager+TokenStore>"
    },
    { "type": "command", "value": "<real e2e for invalid-refresh-token-forces-reauth>" }
  ],
  "auditFocus": [
    "Each verification drives the real code path end-to-end; reject proofs that stub or mock the system under test (mocks allowed only at the SDD-declared adapter boundary).",
    "Reject tautological, hard-coded, or assert-true checks; every acceptance clause must assert on the scenario's observable Then output.",
    "Negation check: the proof must FAIL if the behavior is removed or broken. Greenness must depend on the implementation, not on the test's construction.",
    "Coverage must not be achieved by deleting, weakening, or narrowing a scenario; all listed behaviors are exercised as written.",
    "Every acceptance clause has real-surface evidence in the completion report; missing or mock-only evidence for a real behavior is a P1 finding, not P3 polish."
  ]
}
```

**Derive edges.** Dependencies come mostly from `Given` clauses: a node whose precondition needs state another node _produces_ (its `When`/`Then` output) depends on it. Reinforce with SDD structural deps (shared schema, foundational module, consumed interface).

- Edge shape for the bulk plan: `{ "from": "<prerequisite-id>", "to": "<dependent-id>", "type": "requires" }`.
- **Direction:** the arrow points prerequisite → dependent. `from` must be `done` before `to` is ready. "B depends on A" is `{ "from": "A", "to": "B" }`. Only `requires` affects readiness; qd rejects cycles at write time.
- **Record why** each edge exists in the dependent node's spec, e.g. "Depends on `auth-config` because its emitted TokenStore schema satisfies this node's Given." Inferred edges are the fragile part — make them auditable.

## Phase 5: Mint the DAG transactionally

qd is the live authority once nodes are minted. `roadmap/dag-plan.json` is the bulk-write input and `roadmap/spec-dag.json` is a deterministic derived export for review, commit, and drift detection. Neither export artifact supersedes qd for readiness, blocking, dependency resolution, or mutable node state.

Assemble one plan object and mint it in a single all-or-nothing transaction (qd validates every node + edge, auto-registers referenced groups/projects/milestones, and refuses partial writes):

```json
{
  "nodes": [
    /* every node from Phase 4 */
  ],
  "edges": [
    /* every derived edge */
  ]
}
```

```sh
qd nodes add-bulk --from-json roadmap/dag-plan.json
```

If any node or edge is invalid (bad enum, unresolved edge endpoint, duplicate id, cycle), the whole mint fails and no partial DAG is left behind — fix the plan and rerun. Register meaningful capability phases as milestones with exit criteria before or during mint (`qd milestone register --name <name> --rank <n>`).

## Phase 6: Validate + behavior coverage ledger

1. Structural integrity:
   ```sh
   qd validate --json
   qd doctor --json
   ```
2. **Two-way behavior coverage** (the critical audit — this is where min-maxing is designed out):
   - Every `behavior_id` from BEHAVIORS.jsonl appears in exactly one node's `acceptance` AND has ≥1 `verification` entry. No orphan behaviors.
   - Every node has ≥1 behavior (no behavior-free implementation node) and every SDD component is represented.
   - Every behavior-bearing node carries the anti-min-max `auditFocus` block.
   - Flag orphans, duplicates, and behavior-free nodes; fix the plan and re-mint (clean on an empty table) or patch with `qd node edit` / follow-up nodes.
3. **Cycles**: a detected cycle means a node is too big (split it) or an edge is spurious (remove it). Do not force an edge to break a cycle.
4. Sanity-check the initial frontier:
   ```sh
   qd ready --json
   ```
   The ready set should be non-empty and match the DAG roots (nodes with no incomplete `requires` prerequisite).

## Phase 7: Export + hand off

1. Export a deterministic derived snapshot from qd for commit/review/handoff (`.qd/qd.db` remains the live local qd state):
   ```sh
   qd export --deterministic --out roadmap/spec-dag.json
   qd sync --from roadmap/spec-dag.json --dry-run --json   # confirm clean, no drift
   ```
2. Commit `roadmap/spec-dag.json` and `roadmap/dag-plan.json` as export artifacts that mirror qd state at planning time.
3. Report the synthesized DAG:
   ```sh
   qd stats
   qd critical-path
   qd graph --format mermaid
   ```

**Optional derived-file bridge.** If the repo still needs on-disk `spec/<id>/spec.md` and `tasks.md` for compatibility, generate them FROM qd nodes as derived views. qd remains the sole authority; do not hand-maintain parallel issue/spec/tasks artifacts.

The DAG is now ready for `develop-batch` (or any orchestrator) to select ready nodes and delegate. Because acceptance is the behavior, verification proves the real path, and auditFocus hunts test-gaming, **completing a node provably achieves its behaviors** — there is nothing left to min-max.

## Continuous behavior-fidelity self-check

Before finishing, re-verify for every node: acceptance states the `Then` (not "tests pass"); each scenario has a real-path verification; the terminal task captures real evidence; the anti-min-max auditFocus block is present; and the two-way coverage ledger is 100%. Any gap is fixed before export, not deferred.

## Recovery procedures

| Situation                                                 | Action                                                                                                                                |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| SDD.md or BEHAVIORS.jsonl missing/empty                   | Report `BLOCKED: missing <file>`. Do not invent inputs.                                                                               |
| Malformed line in BEHAVIORS.jsonl                         | Skip and log the bad line; if it names a required behavior, mark it a research/blocker item. Never guess its intent.                  |
| Behavior can't be anchored to any SDD component           | Author a research node to locate the surface, or a typed blocker; do not force it into an unrelated node.                             |
| External surface unverifiable                             | `qd prompt research`; if still unknown, `qd block --type provider/credential/data/environment`. No fake-provable implementation node. |
| Behavior provable only with a mock the SDD does not scope | `qd block --type data` (or provider). Do not author acceptance/verification that mocks the system under test.                         |
| Orphan behavior after mint                                | Fix the plan (add to a node's acceptance + verification) and re-mint, or patch via `qd node edit`.                                    |
| Cycle detected on mint                                    | Split the oversized node or remove the spurious edge; re-derive `Given`-based deps; re-mint.                                          |
| Duplicate node id                                         | Rename to a unique, descriptive slug; re-mint (bulk is transactional).                                                                |
| Method acknowledgement fails                              | Reread `qd method show` and re-acknowledge; do not work around it.                                                                    |
| `qd doctor` reports stale DB schema                       | `qd migrate --json`, then re-run doctor.                                                                                              |

## Repository info

- Repo: current repository
- Inputs: `SDD.md` (high-level SDD spec), `BEHAVIORS.jsonl` (exhaustive gherkin behaviors)
- DAG builder: qdcli — `pnpm dlx @cat-cave/qdcli` or installed `qd`
- Live DAG authority: qd local state in `.qd/qd.db`
- Committed export artifacts: `roadmap/spec-dag.json` (deterministic qd export) and `roadmap/dag-plan.json` (bulk mint input)
- Readiness/selection/status must come from qd commands, not by inspecting committed JSON directly

</phase>
</workflow>
