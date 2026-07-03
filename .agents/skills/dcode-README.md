# Dcode — Deep Agents Workflow Skills

Model routing and subagent management for a qd-driven development pipeline.

## Architecture

- The orchestrator is `deepseek/deepseek-v4-pro`
- Implementation, audit, and review workers are `deepseek/deepseek-v4-flash`
- qd is the source of truth for node readiness, dependencies, acceptance, verification, blockers, and completion evidence
- Derived `spec/` files are optional compatibility views, not the canonical contract

## Iron Rules

1. The orchestrator never writes source code, tests, or config.
2. One subagent, one job.
3. Only the orchestrator spawns subagents.
4. Re-spawn immediately on step-limit with remaining work.
5. qd is canonical. Do not prefer legacy `spec/` files over qd node data.
6. CI is a hard gate.

## Model Assignment

| Role         | Model                        | Provider   | Touches Code? |
| ------------ | ---------------------------- | ---------- | ------------- |
| Orchestrator | `deepseek/deepseek-v4-pro`   | OpenRouter | No            |
| Implementor  | `deepseek/deepseek-v4-flash` | OpenRouter | Yes           |
| Auditor      | `deepseek/deepseek-v4-flash` | OpenRouter | Read-only     |
| Reviewer     | `deepseek/deepseek-v4-flash` | OpenRouter | Read-only     |

## Workflow Skills

| Skill               | Purpose                                            |
| ------------------- | -------------------------------------------------- |
| `generate-dag`      | Build the qd DAG from repo planning inputs         |
| `select-issue`      | Select ready qd nodes                              |
| `develop-batch`     | Execute ready qd nodes end-to-end                  |
| `implement-feature` | Implement one qd node                              |
| `audit-task`        | Audit one qd node implementation                   |
| `handle-feedback`   | Resolve PR feedback and update qd planning context |
| `review-pr`         | Score a PR against the qd node contract            |
| `review-and-merge`  | Wait for green CI, review, and merge               |
| `create-pr`         | Open a PR from the current qd-backed branch        |
| `test-feature`      | Run node verification and quality gates            |
| `shape-spec`        | Refine one qd node contract                        |

## Subagent Spawn Guidance

When spawning an implementor, always pass:

- node id and title
- full qd node `spec`
- `acceptance`
- every `verification` command
- `auditFocus` when present
- hard scope boundaries

When spawning an auditor or reviewer, also pass the implementation evidence summary.

## Skill Invocation

Project skills are exposed as `/skill:<name>`. The execution path assumes qd is initialized and the method has been acknowledged.

Example:

- `/skill:generate-dag`
- `/skill:develop-batch 2`
- `/skill:implement-feature NODE=session-token-refresh`
