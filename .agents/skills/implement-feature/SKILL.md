---
name: implement-feature
description: "Implement a qd node end-to-end including verification and live checks"
model: deepseek/deepseek-v4-flash
triggers:
  - "/implement-feature"
  - "/dcode-implement-feature"
  - "/implement"
  - "/do-task"
---

<workflow>
<role>
**CRITICAL — MODEL ROUTING**: This SKILL.md is loaded by the **dcode orchestrator** (deepseek-v4-pro). The orchestrator NEVER touches code. It spawns implementor subagents via the `task` tool to do all code work.

**Orchestrator responsibilities**:
- Resolve the target qd node from arguments
- Load qd node context from qd export
- Set up the branch and worktree
- Spawn implementor subagents with tightly scoped descriptions
- Poll subagent results and re-spawn on step-limit
- Run deterministic non-coding commands from the worktree

**Implementor subagent responsibilities**:
- Read the qd node context passed by the orchestrator
- Implement the node’s `## Tasks` checklist
- Run the node’s verification commands and quality gates
- Commit code changes
- Return evidence and verification summary
</role>

<phase name="implement-feature">

## Overview

Implement a qd node end-to-end. qd is canonical; on-disk `spec/` files are optional derived views only.

## 1. Parse arguments

Parse `$ARGUMENTS` to determine the node:
- `NODE=<id>` or `ID=<id>`: exact qd node id
- `ISSUE=<id>`: treat as a lookup hint only if your project maps issue numbers into qd metadata
- plain text: match against node id or title
- no arguments: choose the first ready node from `qd ready --json`

## 2. qd load (orchestrator)

Run:

```bash
qd method show
qd method acknowledge --agent dcode-orchestrator
qd method status --json
qd export --deterministic --out /tmp/qd-export.json
qd ready --json
```

Resolve the node from the export and gather:
- `id`, `title`, `kind`, `priority`, `risk`, `milestone`
- `spec`
- `acceptance`
- `verification[]`
- `auditFocus[]`

## 3. Branch setup (orchestrator)

1. If a matching branch exists, switch to it.
2. Otherwise create `issue-<node-id>` from `master`.
3. Create a worktree if needed at `/tmp/dcode/issue-<node-id>`.
4. Do not rely on legacy spec/task files for branch selection.

## 4. Research phase (orchestrator reads, does not modify)

Read in this order:
1. qd node `spec`
2. repo standards referenced by the node spec
3. existing files named in the node spec
4. dependency nodes from the qd export when the current node consumes their outputs

## 5. Implementation — subagent loop

Spawn `deepseek-v4-flash-implementor` with the node context inline.

Use a prompt in this shape:

```text
Implement qd node <node-id> in worktree <worktree-path>.

Node context:
- title: <title>
- acceptance: <acceptance>
- verification:
  - <command 1>
  - <command 2>
- auditFocus:
  - <item 1>
  - <item 2>

Spec markdown:
<full qd node spec>

Instructions:
1. Treat the qd node context above as canonical.
2. Execute the `## Tasks` checklist from the spec.
3. Run each verification command exactly as written unless the repo state requires an equivalent path fix.
4. If verification fails, fix and re-run until green.
5. Run `./scripts/check.sh`.
6. Return:
   {
     "status": "pass"|"fail",
     "commit": "<hash-or-null>",
     "verification_results": [...],
     "evidence_summary": "...",
     "summary": "..."
   }

CRITICAL: Work only on this node. Do NOT create a PR or push.
```

If the subagent hits step limit, re-spawn immediately with the remaining work.

## 6. Live verification gate

After the node tasks are complete, run any live verification demanded by the node:
- prefer the node’s explicit `verification[]` commands
- if the node spec requires a broader live suite, run that too

If failures remain:
1. capture the failing command and output
2. re-spawn `deepseek-v4-flash-implementor` with those failures
3. repeat until green or until a real blocker is identified

## 7. Return status

On success, return the structured implementation result to the orchestrator. The orchestrator handles qd completion bookkeeping.

</phase>
</workflow>
