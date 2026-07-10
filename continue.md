# Handover: Create Open-Source Issue Bundles

## Last action

Audited the repository's open-source readiness, agentic instructions, install/invocation model, packaging, CI, and MCP safety. Consolidated the findings into six bundled work items; no source code was changed.

## Next action

Create six issue bundles in the project tracker, using the titles and acceptance criteria below. Do not implement the fixes in this task. If the tracker is unavailable, write the six issue bodies to a reviewable project-local document instead of creating scattered individual issues.

## Issue bundles

### 1. Establish project identity and governance

Include: choose and reconcile the license; add `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue/PR templates, and a current picoMCP changelog; correct stale qdcli/DAG names, repository URLs, descriptions, and package READMEs.

Acceptance: a stranger can identify the project, license, maintainers/reporting path, contribution workflow, and current package purpose without encountering qdcli/proprietary contradictions.

### 2. Make the CLI installable and release-ready

Include: define global, local, and `pnpm dlx`/`npx` installation paths; decide whether the command is `picoMCP` or `picomcp`; align Node/pnpm requirements; verify `bin`, exports, packed files, runtime dependencies, and `workspace:*` rewriting; document PICO-8 and `xvfb-run`; add upgrade, rollback, and uninstall guidance.

Acceptance: a clean temporary project can install the packed CLI, invoke `--help`, run `serve`, and use the documented installation paths without cloning or building this repository.

### 3. Restore automated verification

Include: restore GitHub Actions; fix formatting failures in `packages/core/src/asset_svc.test.ts`, `packages/picoMCP/src/dispatch-cli.ts`, and `packages/picoMCP/src/mcp-tools.ts`; fix MCP subprocess smoke-test timeouts; separate format, lint, typecheck, build, and test commands; test supported Node/platform versions; validate release tarballs.

Acceptance: frozen install plus the canonical `pnpm run ci` passes in clean CI, and package smoke tests run against built artifacts rather than only source files.

### 4. Harden the agentic MCP surface

Include: apply project-boundary validation to conversion and sprite import/export paths; add runtime schema validation; enforce numeric, array, size, timeout, and process limits; define overwrite/backup/dry-run/atomic-write behavior; return proper JSON-RPC errors; document the filesystem and execution trust model.

Acceptance: every MCP path input/output has an explicit policy and test coverage; malformed or oversized requests fail safely; valid requests produce predictable MCP responses.

### 5. Add agent and contributor operating instructions

Include: add tracked root `AGENTS.md`; document repository structure, package boundaries, required checks, safe editing rules, MCP mutation behavior, architecture, troubleshooting, and user/developer workflows; rewrite the root README and package READMEs around the actual project.

Acceptance: a fresh coding agent can determine how to modify, test, package, and safely invoke the project from tracked documentation alone.

### 6. Formalize dependency and release management

Include: choose Changesets, semantic-release, or an equivalent versioning process; add trusted npm publishing with provenance and least-privilege permissions; add dependency update automation; add dependency/license/secret scanning; centralize tool-version management; define compatibility and support policy.

Acceptance: a maintainer can produce an auditable, versioned release from CI, and dependency/security maintenance has an explicit automated path.

## Recommended sequence

1. Project identity and governance
2. CLI installation and release readiness
3. Automated verification
4. MCP safety
5. Agent/contributor instructions
6. Dependency and release management

Bundles 1 through 4 are release blockers. Bundles 5 and 6 can follow once the release contract is stable.

## Evidence to include in issue bodies

- Root README claims `Proprietary`, while both publishable packages declare MIT.
- No tracked `LICENSE`, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md`, or CI workflows are present.
- Package metadata and core README still identify the qdcli project.
- Package README says Node `>=22`; manifests require Node `>=24.14.0`.
- `pnpm run ci`/`pnpm run typecheck` fail on formatting; `pnpm run lint` passes.
- `pnpm exec vitest run` currently reports 15 passing files and 2 failing MCP smoke tests.
- Cartridge load/save and runtime/export enforce project boundaries, but conversion and sprite import/export do not consistently do so.

## Open threads

- Confirm the canonical GitHub repository and intended npm package ownership before writing release automation.
- Confirm whether `@cat-cave/qdcli-core` is intentionally a public package or leftover qdcli metadata.
- Confirm the supported Node baseline before updating docs or CI.
- Confirm whether issue creation is allowed in the target tracker; do not assume GitHub issue creation without authorization.

## Do not

- Do not split these six bundles back into dozens of narrowly overlapping issues unless dependencies require it.
- Do not modify implementation files while creating the issue bundles.
- Do not remove or reset existing ignored `.qd` or `.qd-runtime` artifacts; they are local state and were not created by this handover.
- Do not publish packages or enable npm automation until identity, license, package metadata, and clean tarball installation are verified.
