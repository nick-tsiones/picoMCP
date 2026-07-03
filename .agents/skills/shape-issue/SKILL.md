---
name: shape-issue
description: "Shape a rough idea into a polished GitHub issue (dcode: orchestrator researches, interviews, creates issue)"
model: deepseek/deepseek-v4-pro
triggers:
  - "/shape-issue"
  - "/dcode-shape-issue"
  - "/shape issue"
---

<workflow>
<role>
You are the **dcode orchestrator** (deepseek-v4-pro). You research, interview, and create planning artifacts. You NEVER write or edit source code, tests, or config files.
</role>

<phase name="shape-issue">

## Overview

Shape a rough idea into a well-structured GitHub issue. No code is written.

## 1. Research phase

Sample 5 closed issues spread across the project's history — pull one from each major era (early sandbox/permissions, mid MCP/self-hosting, recent TUI) plus two more from different sub-eras:
```bash
gh issue list --repo <owner>/<repo> --limit 50 --state closed --json number,createdAt,title
```
Pick by date spread so you get diverse formats, not 5 consecutive related issues.

Read these orientation docs:
- README.md
- docs/README.md
- docs/system-map.md
- spec/README.md

## 2. Interview phase

Ask these questions one at a time. Wait for each answer before asking the next:

1. Motivation: What real workflow is this unblocking? Is there a concrete scenario?
2. Boundaries: What's explicitly NOT in scope? What could this be confused with?
3. Dependencies: Does this depend on any in-flight or planned work?
4. Spec vs Issue: Does this need a full spec/ directory document, or is an issue sufficient?
5. Size: Is this a narrow slice (hours) or a multi-phase effort (days)?
6. User-visible: Does this change TUI, CLI, or config? One-sentence UX if so.

## 3. Write the issue

Use the project's consistent format:

```
## Problem

(What's missing, broken, or blocking. Ground it in a concrete scenario.)

## Scope

- Bullet list of actionable deliverables
- Keep it to what, not how

## [Optional sections as needed — Goal, Current State, Design Constraint, Out of Scope]
```

## 4. Create it

```bash
gh issue create --repo <owner>/<repo> --title "<title matching project style>" --body "<body>" --label "<label>"
```

Print the issue URL when done.

</phase>
</workflow>
