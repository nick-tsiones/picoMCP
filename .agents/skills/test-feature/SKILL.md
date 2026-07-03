---
name: test-feature
description: "Run the verification and quality gates for the current qd-backed feature branch"
model: deepseek/deepseek-v4-flash
triggers:
  - "/test-feature"
  - "/dcode-test-feature"
  - "/test"
---

<workflow>
<role>
**CRITICAL — MODEL ROUTING**: This SKILL.md is loaded by the **dcode orchestrator** (deepseek-v4-pro). The orchestrator identifies branch and qd node context. A flash subagent executes tests.
</role>

<phase name="test-feature">

## 1. Branch and qd context

Abort on `master`.

Load qd context:

```bash
git rev-parse --abbrev-ref HEAD
qd method show
qd method acknowledge --agent dcode-orchestrator
qd export --deterministic --out /tmp/qd-export.json
```

Resolve the current node and collect its `verification[]` commands.

## 2. Spawn test-runner subagent

Pass:

- node id and title
- acceptance summary
- all verification commands
- whether broader repo gates such as `./scripts/check.sh` are required

The subagent must:

1. run `./scripts/check.sh`
2. run every node verification command
3. run any broader live suite the node spec explicitly requires
4. return structured pass/fail output

## 3. Handle failures

If anything fails:

1. capture the exact command/output
2. spawn `deepseek-v4-flash-implementor` to fix
3. re-run until green or until a real blocker is identified

## 4. Success

Return the pass summary. The orchestrator decides whether to commit, push, or open a PR.

</phase>
</workflow>
