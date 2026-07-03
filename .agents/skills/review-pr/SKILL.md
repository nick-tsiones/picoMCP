---
name: review-pr
description: "Score a PR against the qd node contract, code quality, and CI health"
model: deepseek/deepseek-v4-flash
triggers:
  - "/review-pr"
  - "/dcode-review-pr"
  - "/review"
---

<workflow>
<role>
**CRITICAL — MODEL ROUTING**: This SKILL.md is loaded by the **dcode orchestrator** (deepseek-v4-pro). The orchestrator handles CI gates and spawns a reviewer subagent that is strictly read-only on code.
</role>

<phase name="review-pr">

## 0. Pre-review gates

The review must not run until:
1. required CI checks are green
2. there are no unresolved review comments

## 0.1 CI gate

```bash
gh pr checks <number>
```

- Pending: poll
- Failure: stop and return score `0`
- Success on all required checks: continue

## 0.2 Unresolved comments gate

```bash
gh api repos/<owner>/<repo>/pulls/<number>/comments
gh api repos/<owner>/<repo>/pulls/<number>/reviews
```

If unresolved comments exist, stop and return score `0`.

## 1. Load qd node context

Resolve the backing node id from the branch or PR metadata.

Run:

```bash
qd method show
qd method acknowledge --agent dcode-orchestrator
qd export --deterministic --out /tmp/qd-export.json
```

Load:
- `spec`
- `acceptance`
- `verification[]`
- `auditFocus[]`

## 2. Spawn reviewer subagent

Construct a prompt like:

```text
Review PR <number> against qd node <node-id>.

READ ONLY — do NOT modify code.

Node context:
- acceptance: <acceptance>
- verification:
  - <command 1>
  - <command 2>
- auditFocus:
  - <item 1>
  - <item 2>

Spec markdown:
<full qd node spec>

Steps:
1. Read the rubric: docs/standards/review-rubric.md
2. Gather PR context with `gh pr view`, `gh pr diff`, and `gh pr checks`
3. Evaluate:
   - node-contract completeness
   - pattern conformance
   - code quality
   - CI and test health
   - honesty of evidence relative to acceptance and verification
4. Return:
   {
     "score": <number>,
     "threshold": 85,
     "auto_merge": <boolean>,
     "findings": [...],
     "summary": "..."
   }
```

## 3. Act on verdict

- `score >= 85` and all CI green: merge
- `60-84`: post findings, do not merge
- `<60`: block

## 4. Post review summary

If not auto-merged, post:
- total score and threshold
- findings
- whether the issue is acceptance coverage, verification honesty, code quality, or CI health

</phase>
</workflow>
