---
name: create-pr
description: "Push the current branch and create a PR whose summary is derived from the qd node contract and evidence"
model: deepseek/deepseek-v4-pro
triggers:
  - "/create-pr"
  - "/dcode-create-pr"
  - "/pr"
---

<workflow>
<role>
You are the **dcode orchestrator** (deepseek-v4-pro). This is a git/gh and qd read operation. No code is modified here.
</role>

<phase name="create-pr">

## Overview

Push the current feature branch and create a pull request grounded in the backing qd node.

## 1. Identify branch and node

```bash
git rev-parse --abbrev-ref HEAD
git remote get-url origin
qd method show
qd method acknowledge --agent dcode-orchestrator
qd export --deterministic --out /tmp/qd-export.json
```

Resolve the qd node id from the branch or current execution context.

## 2. Push

```bash
git push origin <branch>
```

## 3. Check for existing PR

```bash
gh pr view --json number,title,url
```

If one already exists, print the URL and stop.

## 4. Gather PR body content

Use:

- qd node title and acceptance summary
- implementation evidence summary
- `git diff origin/master...HEAD --stat`
- `git log origin/master...HEAD --oneline --no-decorate`

## 5. Create PR

```bash
gh pr create --title "<title>" --body "<body>"
```

The body must include:

- qd node id and title
- summary of implemented acceptance behavior
- verification and test summary
- notable risks or blockers removed

## 6. Print PR URL

</phase>
</workflow>
