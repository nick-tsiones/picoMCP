# @cat-cave/qdcli

## 0.1.12

### Patch Changes

- Add agent-agnostic orchestration state for assignments and waves, audit run lifecycle helpers, richer gate/readiness output, milestone query commands, typed notes, schema validation commands, verification evidence recording, timeout-aware local run evidence, and tighter state-machine mutation coverage.
- Updated dependencies
  - @cat-cave/qdcli-core@0.1.12

## 0.1.11

### Patch Changes

- Harden DAG maintenance and migration workflows.

  - Fix partial `qd node edit` updates and add JSON/file-backed edit inputs.
  - Add first-class manual/external/policy blocker metadata and keep blocked nodes out of `qd ready`.
  - Make `qd nodes add-bulk` transactional and auto-register imported metadata for consistent validation.
  - Add deterministic exports and explicit canonical-export sync/replace workflows.
  - Improve roadmap HTML import scoping, status detection, and dependency extraction.
  - Add advisory `qd doctor` behavior with `qd doctor --strict` enforcement.

- Updated dependencies
  - @cat-cave/qdcli-core@0.1.11

## 0.1.10

### Patch Changes

- Replace the installed qd viewer list with an interactive DAG map with zoom, filtering, live refresh, focus highlighting, and richer node detail panels.
- Updated dependencies
  - @cat-cave/qdcli-core@0.1.10

## 0.1.9

### Patch Changes

- Make the CLI package build self-contained for publishing by building qdcli-core before embedding the viewer.
- Updated dependencies
  - @cat-cave/qdcli-core@0.1.9

## 0.1.8

### Patch Changes

- Ship the qd graph viewer as an embedded part of the installed CLI and serve it through `qd view` without requiring a qdcli source checkout.
- Updated dependencies
  - @cat-cave/qdcli-core@0.1.8

## 0.1.7

### Patch Changes

- Fix the Nix flake package dependency closure so the offline pnpm install includes the release tooling required by the package build.
- Updated dependencies
  - @cat-cave/qdcli-core@0.1.7

## 0.1.6

### Patch Changes

- Replace the custom release-bump and tarball publish plumbing with Changesets-managed versioning, changelog generation, and pnpm-backed publishing.
- Updated dependencies
  - @cat-cave/qdcli-core@0.1.6
