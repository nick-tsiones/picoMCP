---
name: review-and-merge
description: "Wait for CI, review against the qd node contract, and auto-merge when the PR clears the gate"
model: deepseek/deepseek-v4-pro
triggers:
  - "/review-and-merge"
  - "/dcode-review-and-merge"
  - "/merge"
---

<workflow>
<role>
**CRITICAL — MODEL ROUTING**: You are the **dcode orchestrator** (deepseek-v4-pro). You poll CI, enforce gates, load qd node context, and spawn a read-only reviewer.
</role>

<phase name="review-and-merge">

## 1. CI gate

No merge when CI is red.

```bash
gh pr checks <number>
```

Poll until all required checks complete. Stop immediately on failure.

## 2. Unresolved comments gate

```bash
gh api repos/<owner>/<repo>/pulls/<number>/comments
gh api repos/<owner>/<repo>/pulls/<number>/reviews
```

If unresolved review comments exist, stop and hand off to `handle-feedback`.

## 3. Load qd node context

Resolve the backing node id and load the qd export:

```bash
qd method show
qd method acknowledge --agent dcode-orchestrator
qd export --deterministic --out /tmp/qd-export.json
```

## 4. Run review

Invoke the `review-pr` workflow using the loaded qd node context.

## 5. Merge decision

- score `>= 85` and CI green: `gh pr merge <number> --squash --delete-branch`
- otherwise: post findings and stop

## 6. qd bookkeeping

After merge:
- record completion evidence in the qd completion flow
- refresh readiness with `qd ready --json`

</phase>
</workflow>
