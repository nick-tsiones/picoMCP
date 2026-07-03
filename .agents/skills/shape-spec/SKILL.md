---
name: shape-spec
description: "Shape or refine a single qd node contract and optional derived spec view"
model: deepseek/deepseek-v4-pro
triggers:
  - "/shape-spec"
  - "/dcode-shape-spec"
  - "/shape spec"
---

<workflow>
<role>
You are the **dcode orchestrator** (deepseek-v4-pro). This is planning work. You NEVER write or edit source code, tests, or config files.
</role>

<phase name="shape-spec">

## Overview

Shape a single executable planning unit in qd. In the qd workflow, the node is canonical. Any `spec/` files are derived views only.

## 1. Gather context

Read:
- the linked issue or requested work item
- relevant standards
- existing qd export if the node already exists
- nearby implementation patterns in the repo

## 2. Interview the user

Ask only for information that is not recoverable from the repo or qd:
1. What existing node or milestone does this depend on?
2. What is the key non-negotiable decision?
3. What real behavior must be proven?
4. What verification should count as honest proof?
5. What should explicitly stay out of scope?

## 3. Write or refine the qd node

The node must contain:
- title
- kind / priority / risk
- spec markdown with `## Objective`, `## Non-goals`, `## Tasks`, dependencies, and rollback notes
- acceptance as observable outcomes
- verification commands
- auditFocus where behavior-proof integrity matters

If the repo still wants `spec/<id>/spec.md` and `tasks.md`, generate them as derived views from the qd node. Do not hand-maintain a second canonical contract.

## 4. Commit planning artifacts

Commit any exported or derived planning artifacts after the qd node is updated.

</phase>
</workflow>
