---
name: handle-feedback
description: "Resolve PR review feedback in a qd-driven workflow — triage, implement, reply, and update node planning context"
model: deepseek/deepseek-v4-flash
triggers:
  - "/handle-feedback"
  - "/dcode-handle-feedback"
  - "/feedback"
---

<workflow>
<role>
**CRITICAL — MODEL ROUTING**: This SKILL.md is loaded by the **dcode orchestrator** (deepseek-v4-pro). The orchestrator handles git/gh and qd state. Code fixes are delegated to implementor subagents.
</role>

<phase name="handle-feedback">

## Overview

Triage PR review feedback, fix red CI or merge conflicts, and update the qd node plan with any valid follow-up work.

## 1. Identify the PR

```bash
gh pr view --json number,title,headRefName,body
```

Abort if there is no open PR for the branch.

## 2. Pull unresolved review comments

```bash
gh api repos/<owner>/<repo>/pulls/<number>/comments
gh api repos/<owner>/<repo>/pulls/<number>/reviews
```

Collect unresolved feedback.

## 3. Resolve the qd node

From the branch or PR metadata, resolve the backing qd node id.

Run:

```bash
qd method show
qd method acknowledge --agent dcode-orchestrator
qd export --deterministic --out /tmp/qd-export.json
```

Load the node’s `spec`, `acceptance`, `verification`, and `auditFocus`.

## 4. Check CI status and merge conflicts

```bash
gh pr view <number> --json statusCheckRollup,mergeable,mergeStateStatus
```

## 5. Triage

Classify each item:
- valid
- invalid
- needs clarification

Proceed immediately. Do not wait for confirmation unless human clarification is truly required.

## 6. Fix red CI or merge conflicts

If CI is red or merge conflicts exist, spawn `deepseek-v4-flash-implementor` with:
- the qd node context
- the failing CI or conflict details
- a requirement to fix only the identified issue

The subagent must:
1. read the qd node context
2. inspect the CI logs or merge state
3. fix the root cause
4. run the relevant verification plus `./scripts/check.sh`
5. commit and push
6. return a structured summary

## 7. Update planning context for valid review items

For valid non-CI feedback not yet fixed, update the qd node plan rather than hand-maintaining `tasks.md`.

Preferred approach:
- append a `## Review Feedback` checklist block to the node `spec`
- or create a dedicated follow-up node if the feedback is materially separate work

The updated plan must preserve:
- acceptance intent
- verification commands
- dependency clarity

## 8. Reply on the PR

Reply to resolved comments with the concrete fix or planning update. If a follow-up node was created, cite the node id.

## 9. Handoff

Report:
- what was fixed now
- what was deferred into qd planning context
- whether CI is green
- the next action (`implement-feature`, `review-pr`, or retry after blockers)

</phase>
</workflow>
