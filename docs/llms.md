# Quick DAG Orchestrator Bootstrap

Quick DAG (`qdcli`) is a CLI for orchestrator-led agentic software work. It does not run agents. It gives one central orchestrator agent a durable DAG ledger for specs, dependency edges, claims, audits, findings, CI state, merge state, velocity, critical path, and ETA.

The intended model:

- One orchestrator agent manages the DAG and keeps its own context clean.
- The orchestrator selects ready nodes and delegates implementation/audit to subagents.
- Subagents may work in git worktrees, remote machines, or any project-specific setup.
- qd does not manage or police the execution environment.
- qd enforces the work contract: dependencies are respected, specs are completed, audits happen, P0/P1 findings are resolved, P2/P3 findings enter the DAG, and CI passes before merge.
- Main should stay green. If CI does not pass, the node does not merge.

## Install

From the project that wants to use Quick DAG, install or clone `qdcli` from:

```text
https://github.com/cat-cave/qdcli
```

For local development from a clone:

```sh
nix develop
just install
just build
```

Use the built CLI as `qd`.

## Setup In The Target Repo

Run:

```sh
qd setup
qd agent install skills-sh
```

Configure the repository's real definition of "green":

```sh
qd config set check-command --value "<fast local check command>"
qd config set ci-command --value "<full green command>"
qd config set merge-strategy --value "squash"
```

For Nix projects, a good default is:

```sh
qd config set check-command --value "nix develop -c just ci"
qd config set ci-command --value "nix develop -c just ci"
```

The configured CI command should run the checks the project actually trusts before merge: formatting, lint, typecheck, tests, build, schema/architecture checks, and any repo-specific gates.

## Validate Setup

Run:

```sh
qd doctor --json
qd status --json
qd ready --json
```

If `qd doctor` reports config or graph errors, fix those before delegating work.

## Build The DAG

Create nodes as executable specs, not vague todos. Each node should be independently mergeable and include concrete acceptance criteria.

Useful commands:

```sh
qd node add --id <id> --title "<title>" --spec "<spec>" --acceptance "<acceptance>"
qd edge add <dependency-node> <blocked-node>
qd validate
qd graph --format mermaid
```

Rules:

- Split by mergeable behavioral increments, not files or layers.
- Use `requires` edges only for true technical prerequisites.
- Use milestones for product phases, not dependency truth.
- Add discovery nodes when unknowns must be resolved before implementation.

## Orchestrate Work

The orchestrator loop:

```sh
qd ready --json
qd claim <node> --agent <subagent-name>
qd prompt implement <node>
```

Delegate the implementation prompt and project context to a subagent. When the subagent completes work, record it:

```sh
qd complete <node> --summary "<what changed>"
```

Start audit:

```sh
qd audit start <node>
```

Record findings as structured state:

```sh
qd finding add <node> --severity P1 --title "<issue>" --evidence "<evidence>"
qd finding resolve <finding-id>
```

Severity policy:

- P0: security, data loss, build break, or critical incorrect behavior.
- P1: important regression or missing required acceptance.
- P2: non-blocking follow-up that should become a DAG node.
- P3: polish or future improvement.

P0/P1 findings block CI and merge. P2/P3 findings should be promoted into future nodes after the current node passes the gate:

```sh
qd gate <node>
qd promote-findings <node>
```

## Run Checks And Merge

Normal path:

```sh
qd gate <node>
qd ci run <node>
qd merge <node>
```

`qd ci run` runs the configured `ci_command`, streams output, writes a log under `.qd/logs/`, records pass/fail, and moves the node to `mergeable` or `blocked`.

Do not use `qd ci pass` unless recording a check that was already completed outside qd.

`qd merge` records the merge only after qd confirms:

- no open P0/P1 findings
- node is `mergeable`
- latest CI run passed, when `require_ci_before_merge = true`

## Inspect Progress

Use:

```sh
qd stats --json
qd velocity --window 7
qd critical-path
qd eta
qd milestone status --milestone "<name>"
qd view
```

These show ready work, completed points, remaining points, velocity, critical path, and ETA.

## First Trial Goal

For a first adoption trial, get one real but low-risk node from ready to done:

1. create or select a ready node
2. claim it for a subagent
3. complete implementation
4. audit it
5. resolve P0/P1 findings
6. promote P2/P3 findings
7. run `qd ci run`
8. merge only after qd marks it mergeable

If the graph is wrong, fix the graph. Do not bypass the ready queue.

