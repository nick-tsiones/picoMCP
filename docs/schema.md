# Schema

qd stores local state in `.qd/qd.db`.

## Nodes

Nodes are executable specs. They include title, kind, typed milestone, group, projects, status, priority, estimate, risk, branch, spec, acceptance, validation text, typed verification entries, audit focus guidance, context, status reason, per-node check override, and timestamps.

If groups, projects, or milestones have been registered, qd validates node values against those registries. This lets a project define strict scheduling lanes, product areas, and milestone ranks without hard-coding one universal taxonomy.

## Edges

Edges connect nodes. Only `requires` edges participate in readiness.

## Runs

Runs record implementation, audit, resolve, CI, and merge lifecycle events.

`qd check run <node>` runs the configured `check_command` or the node's `check_command` override, writes a log under `.qd/logs/`, and records a check run. A passed check does not make the node mergeable.

`qd ci run <node>` runs the configured `ci_command`, writes a log under `.qd/logs/`, records a pass/fail run, and updates the node to `mergeable` or `blocked`.

`qd merge <node>` records qd state only. It does not run `git merge`, open a pull request, squash commits, or push anything. Repositories should perform the actual git/GitHub merge through their normal workflow and use `qd merge` to record that the node satisfied qd's gate.

## Findings

Findings belong to a node and can be P0, P1, P2, or P3.

- P0/P1 block the gate.
- P2/P3 can be promoted into future nodes after the gate passes.

Structured audit reports can be imported with `qd finding add --from-report <file>`. The report must contain `nodeId` or `node_id` unless the node id is passed positionally, plus a `findings` array with severity, title, evidence, and optional path, line, expected, and suggested fix fields.
