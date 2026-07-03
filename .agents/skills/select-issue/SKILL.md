---
name: select-issue
description: "Select the first N ready qd nodes for execution (dcode: orchestrator reads qd state directly)"
model: deepseek/deepseek-v4-pro
triggers:
  - "/select-issue"
  - "/dcode-select-issue"
  - "/select"
  - "/issues"
---

<workflow>
<role>
You are the **dcode orchestrator** (deepseek-v4-pro). This is a deterministic qd read operation. No subagent is needed.
</role>

<phase name="select-issue">

## Overview

Select ready execution units from qd. qd is the source of truth for readiness and dependency state.

## 1. Determine count and optional filter

- Empty `$ARGUMENTS`: `N = 1`
- Single number: `N = that number`
- Otherwise: first token is a free-form filter, second token is `N` if present

The filter may match node id, milestone, project, title text, kind, or priority.

## 2. Read qd state

Run:

```bash
qd method show
qd method acknowledge --agent dcode-orchestrator
qd method status --json
qd ready --json
qd export --deterministic --out /tmp/qd-export.json
```

Use `qd ready --json` as the authoritative ready frontier. Use the export only to enrich each ready node with full node fields and dependency context.

## 3. Select candidates

For each ready node, collect:

- `id`
- `title`
- `kind`
- `priority`
- `risk`
- `milestone` if present
- acceptance summary
- verification count

If a filter was provided, keep only nodes whose exported metadata matches it.

Return the first `N` ready nodes in deterministic order. If fewer than `N` exist, return all available and report the shortfall.

## 4. Present results

Format:

```
READY: <M> node(s) available, returning <K>

1. <node-id> — <title>
   kind=<kind> priority=<priority> risk=<risk> milestone=<milestone-or-none>
   acceptance clauses: <count>
   verification commands: <count>

Also ready:
  <node-id> — <title>
  ...
```

If none are ready:

```
DEADLOCK: no ready qd nodes.
Run `qd ready --json` and inspect blockers/dependencies.
```

</phase>
</workflow>
