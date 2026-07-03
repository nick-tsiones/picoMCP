---
name: audit-task
description: "Audit a completed qd node implementation for acceptance fidelity, verification honesty, standards, and quality"
model: deepseek/deepseek-v4-flash
triggers:
  - "/audit-task"
  - "/dcode-audit-task"
  - "/audit"
---

<workflow>
<role>
**CRITICAL — MODEL ROUTING**: This SKILL.md is loaded by the **dcode orchestrator** (deepseek-v4-pro). The orchestrator spawns an auditor subagent to evaluate a completed node. The auditor is read-only on source code.

**Orchestrator responsibilities**:
- Resolve the qd node from arguments
- Load full qd node context
- Spawn the auditor with node context and implementation evidence
- Report the verdict

**Auditor responsibilities**:
- Read node acceptance, verification, and auditFocus
- Read relevant source, tests, and git history
- Run read-only checks
- Return structured violations and concrete fix items
</role>

<phase name="audit-task">

## 1. Resolve the node (orchestrator)

Parse `$ARGUMENTS`:
- `NODE=<id>` or `ID=<id>`: exact qd node id
- plain text: match node id or title
- no arguments: use the current branch name or first ready/active node as context

Run:

```bash
qd method show
qd method acknowledge --agent dcode-orchestrator
qd export --deterministic --out /tmp/qd-export.json
```

Load the node’s:
- `spec`
- `acceptance`
- `verification[]`
- `auditFocus[]`

## 2. Spawn auditor subagent

Use `subagent_type: deepseek-v4-flash-auditor`.

Construct a prompt like:

```text
Audit qd node <node-id> in the current worktree.

READ ONLY — do NOT modify source code, tests, or config.

Source of truth:
- acceptance: <acceptance text>
- verification:
  - <command 1>
  - <command 2>
- auditFocus:
  - <item 1>
  - <item 2>

Spec markdown:
<full qd node spec>

Implementation evidence:
- <implementor evidence summary>

Steps:
1. Read the qd node context above.
2. Read standards referenced by the spec.
3. Inspect the implementation and git history.
4. Run read-only checks such as ruff, mypy, grep, and git diff/log as needed.
5. Evaluate:
   - fidelity to the node spec tasks
   - coverage of every acceptance clause
   - honesty of verification evidence
   - standards adherence
   - quality, security, and regression risk

Return:
{
  "status": "pass"|"fail",
  "violations": [...],
  "fix_items": [...],
  "summary": "..."
}
```

## 3. Report verdict

- Pass: `Audit passed.`
- Fail: list violations and fix items

If the audit reveals a real provider, credential, data, or environment blocker, tell the orchestrator to record it in qd rather than pretending the node is implementable.

</phase>
</workflow>
