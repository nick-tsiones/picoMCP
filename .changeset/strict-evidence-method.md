---
"@cat-cave/qdcli": minor
"@cat-cave/qdcli-core": minor
---

Ship qd's strict evidence-first orchestration method as the default roadmap model.

- Add canonical orchestration guidance for research-before-roadmap, executable specs, evidence-backed completion, independent audits, typed blockers, periodic repo audits, and DAG reality reviews.
- Require structured completion reports for `qd complete` and for `qd advance` when it moves a node into review; summary-only completion now fails loudly.
- Add strict public schemas for specs, milestones, research reports, completion reports, audit reports, findings, blockers, unblock reports, and reality checks.
- Add first-class `qd block` and evidence-backed `qd unblock`, with expanded blocker types for environment, credential, provider, data, policy, manual, external, and external-dependency conditions.
- Harden audit reports so clean audits must include acceptance review, verification evidence review, and real-world validation status; failed or blocked real-world validation requires a P0/P1 finding.
- Update prompts, help topics, installed skills, and setup/LLM docs so agents repeatedly see the qd reality contract and the one intended workflow.
