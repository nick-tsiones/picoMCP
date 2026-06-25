# CLI Reference

## Core

- `qd init`
- `qd setup`
- `qd doctor [--json]`
- `qd status [--json]`
- `qd stats [--json] [--window 7] [--milestone <name>]`
- `qd ready [--json]`
- `qd graph --format table|json|mermaid|dot`
- `qd import --from <json> [--schema-mapping <json>]`
- `qd velocity [--window 7]`
- `qd critical-path [--milestone <name>]`
- `qd eta [--window 7] [--milestone <name>]`
- `qd milestone status [--milestone <name>]`
- `qd config show [--json]`
- `qd config get <key>`
- `qd config set check-command --value <command>`
- `qd config set ci-command --value <command>`

## DAG

- `qd group register --name <name>`
- `qd project register --name <name>`
- `qd milestone register --name <name> --rank <number>`
- `qd node add --title <text> --spec <text> --acceptance <text>`
- `qd node add ... --group <name> --project <name> --project <name>`
- `qd node add ... --milestone <name> --verify type=command,value="just ci" --audit-focus <text>`
- `qd node list`
- `qd node show <id>`
- `qd node edit <id> [--title] [--spec] [--acceptance]`
- `qd node note <id> --text <text>`
- `qd node note <id> --mode list`
- `qd edge add <from> <to> [--type requires]`
- `qd claim [node] --agent <name>`
- `qd complete <node> --summary <text>`

## Audit

- `qd audit start <node>`
- `qd finding add <node> --severity P1 --title <text> --evidence <text>`
- `qd finding add [node] --from-report <audit-report.json>`
- `qd finding resolve <finding>`
- `qd promote-findings <node>`
- `qd gate <node>`
- `qd check run <node>`
- `qd ci run <node>`

## Lifecycle

- `qd ci start <node> --cmd <command>`
- `qd ci pass <node>`
- `qd ci fail <node>`
- `qd merge <node> --strategy squash`

`qd merge` is a qd state transition, not a git operation and not a GitHub PR operation. It records a merge run and marks the node `done` only after qd confirms the node is mergeable, P0/P1 findings are closed, and the latest CI passed when `require_ci_before_merge = true`. Do the actual git merge, squash, rebase, or PR merge in your normal repo workflow before or around this command.
