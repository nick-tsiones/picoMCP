# Trial Guide

Use this guide to trial qdcli on a new project.

1. Make sure `qd` is installed and available on PATH.
2. Run `qd setup`.
3. Configure preflight and green gates with the target repo's real commands.
4. Ask the orchestrator agent to read `skills/qd-dag/SKILL.md`.
5. Build the initial DAG conversationally.
6. Run `qd validate`.
7. Work one ready node end to end.
8. Use `qd check run <node>` for fast preflight and `qd ci run <node>` for the merge gate.
9. Run `qd stats`, `qd critical-path`, and `qd eta` to inspect planning signal.
10. Start `qd view` to inspect topology, readiness, velocity, critical path, and ETA.

The first trial is successful when the orchestrator moves one node from ready to done through delegation, claim, complete, audit, gate, CI pass, and merge while keeping main green.
