---
name: develop-batch
description: "Orchestrate N ready qd nodes end-to-end — select, implement on worktrees, audit, review, auto-merge"
model: deepseek/deepseek-v4-pro
triggers:
  - "/develop-batch"
  - "/dcode-develop-batch"
  - "/batch"
  - "/develop"
---

<workflow>
<role>
**CRITICAL — MODEL ROUTING**: You are the **dcode orchestrator** (deepseek-v4-pro). You are the PM. You NEVER touch code. You manage worktrees, read qd state, spawn flash subagents for implementation and audit, and drive ready nodes from selection through merge.

**You (orchestrator, pro)**:

- Read qd readiness, dependencies, and exported node metadata
- Create and manage worktrees
- Spawn implementor and auditor subagents
- Poll subagents and re-spawn on step-limit
- Run `gh` commands, git operations, CI polling, and qd state updates
- Auto-merge when score is high enough and CI is green
- Report status every 5 minutes

**Implementor subagent (flash)**:

- All code work: read, write, edit source, tests, config
- Execute node tasks from qd node spec
- Run verification commands, quality gate, and live checks
- Commit and push only when explicitly told
- Return completion evidence summary

**Auditor subagent (flash)**:

- Read-only code analysis
- Evaluate against node acceptance, verification, and auditFocus
- Return violations and concrete fix items

**IRON RULE**: qd is the source of truth. Legacy `spec/<id>/spec.md` and `tasks.md` files are optional derived views only. Never treat them as canonical if qd disagrees.
</role>

<phase name="develop-batch">

## Autonomous execution — CRITICAL

You are running unattended. You MUST NOT stop to ask questions.

When you encounter ambiguity:

1. Read qd state first.
2. Consult repo standards and nearby code patterns.
3. If truly blocked, record the blocker in qd and move to the next ready node.
4. Never invent acceptance, verification, or evidence.

## Phase 0: qd preflight

Determine `N` from `$ARGUMENTS`. Default: `1`.

Before any execution:

```bash
qd method show
qd method acknowledge --agent dcode-orchestrator
qd method status --json
qd ready --json
qd export --deterministic --out /tmp/qd-export.json
```

If the method acknowledgement fails, reread the method and retry. Do not proceed without acknowledgement.

## Phase 1: Selection

Run the `select-issue` workflow to choose the first `N` ready qd nodes.

For each selected node, load its full context from `/tmp/qd-export.json`:

- node id, title, kind, priority, risk, milestone
- `spec`
- `acceptance`
- `verification[]`
- `auditFocus[]`
- prerequisite edges and dependent edges

## Phase 2: Implementation (parallel, on worktrees)

For each selected node, in parallel:

1. Create worktree: `git worktree add -b issue-<node-id> /tmp/dcode/issue-<node-id> master`
2. Re-export qd inside the repo if needed so the worktree has the latest node metadata
3. Spawn subagent `deepseek-v4-flash-implementor`

Pass the subagent the node context directly. The prompt must include:

- worktree path
- node id and title
- the full `spec` markdown from qd
- the `acceptance` text
- every `verification` command
- `auditFocus`
- any prerequisite context needed from dependency nodes

Use a prompt in this shape:

```text
Implement qd node <node-id> in worktree /tmp/dcode/issue-<node-id>.

Context:
- title: <title>
- kind/priority/risk: <...>
- acceptance: <acceptance text>
- verification:
  - <command 1>
  - <command 2>
- auditFocus:
  - <item 1>
  - <item 2>

Spec markdown:
<full qd node spec>

Execution contract:
1. Read the qd node context above as the source of truth.
2. Execute the `## Tasks` checklist embedded in the node spec.
3. Run each verification command and fix until green.
4. Run `./scripts/check.sh`.
5. Run any required live verification for this node.
6. Commit coherent progress using `Task <node-id>: <summary>` or similarly specific messages.
7. Return:
   {
     "status": "pass"|"fail",
     "tasks_completed": [...],
     "verification_results": [...],
     "evidence_summary": "...",
     "summary": "..."
   }

CRITICAL: Work only on this node. Do NOT touch other worktrees or unrelated nodes. Do NOT create a PR or push unless explicitly instructed later.
```

Never wait synchronously on a subagent. Poll and re-spawn immediately on step-limit with the remaining work.

## Phase 3: Audit + fix loop (parallel, per worktree)

For each completed implementation:

1. Spawn subagent `deepseek-v4-flash-auditor`
2. Pass the same qd node context plus the implementor’s evidence summary

Use a prompt in this shape:

```text
Audit qd node <node-id> in worktree /tmp/dcode/issue-<node-id>.

READ ONLY on source code.

Source of truth:
- acceptance: <acceptance text>
- verification: <commands>
- auditFocus: <items>
- spec markdown:
<full qd node spec>

Evaluate:
- task fidelity to the qd node spec
- acceptance coverage
- verification honesty
- standards compliance
- quality and regression risk

Return:
{
  "status": "pass"|"fail",
  "violations": [...],
  "fix_items": [...],
  "summary": "..."
}
```

3. If audit fails, re-spawn `deepseek-v4-flash-implementor` with the fix items, then re-audit.
4. If execution is blocked by provider, credential, data, or environment reality, record that with qd instead of faking success.

## Phase 4: PR creation + review (parallel, per worktree)

For each passing node:

1. Push: `git push origin issue-<node-id>`
2. Create PR with title/body derived from the qd node title and evidence summary
3. Poll CI until complete

**CI GATE — ABSOLUTE HARD STOP.**

- If any required check fails, spawn `deepseek-v4-flash-implementor` to fix the root cause, push, and re-poll.

4. Check unresolved review comments before review
5. Run the `review-pr` workflow
6. If the node clears review and all CI is green, merge

## Phase 5: qd completion bookkeeping

For each merged node:

1. Generate the completion evidence payload from the implementor and reviewer output
2. Use the repo’s qd completion flow to mark the node complete with real evidence
3. Re-run `qd ready --json` so newly unblocked nodes can enter the frontier

For blocked nodes, record a typed blocker in qd and move on.

## Phase 6: Continuous monitoring

Report status every 5 minutes:

```text
In flight:
  <node-id> [implementing, round 2]
  <node-id> [auditing, verification green, live check pending]
  <node-id> [PR #<n>, CI 3/4 green]

Completed:
  <node-id> [merged]

Blocked:
  <node-id> [provider/data/environment blocker recorded in qd]
```

Never stop until all requested nodes are merged or blocked.

</phase>
</workflow>
