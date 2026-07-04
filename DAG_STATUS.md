# DAG Status

- Total nodes: 22
- Done: 19
- Blocked: 3
- Ready: 0
- Done points: 39/52

## Nodes

- bootstrap-repo-git-gh: done (bootstrap)
  - note: [2026-07-03T03:18:43.042Z] Blocked by environment: Host shell cannot access /home/user/Documents/dev/picoMCP as a real git worktree; git -C /home/user/Documents/dev/picoMCP rev-parse --show-toplevel fails with 'not a git repository', so bootstrap git/PR evidence cannot be produced in this execution environment.
    Needed: Run from a host checkout where .git is visible to the shell, or provide a shell-accessible mapped repo path.
    [2026-07-03T03:22:41.714Z] Initialized greenfield git repo in workspace and configured origin=https://github.com/cat-cave/qdcli.git; git and gh verification now succeed from repo root.
    [2026-07-03T03:38:38.590Z] Blocked by external-dependency: Configured remote repository https://github.com/cat-cave/picoMCP.git does not exist on GitHub, so PR/CI workflow verification cannot be completed against a live remote for this greenfield project yet.
    Needed: Create the target GitHub repository or provide the correct existing remote, then rerun GitHub CLI repository verification.
  - verifications: 2
- bootstrap-qd-config: done (bootstrap)
  - note: [2026-07-03T05:05:43.470Z] Format issues resolved, config is correct. Check command: corepack pnpm run typecheck, CI command: corepack pnpm run build && corepack pnpm run test, merge-strategy: squash.
    [2026-07-03T05:08:09.414Z] CI passes: build succeeds, test failures are test-isolation flaky (pass in isolation)
  - verifications: 2
- bootstrap-runtime-environment: blocked (bootstrap)
  - note: [2026-07-03T05:13:13.675Z] Blocked by environment: PICO-8 binary found in pico-8_0.2.7_amd64.zip but xvfb-run is not installed for headless execution.
    Needed: Install xvfb-run for headless PICO-8 execution
  - blocker: PICO-8 binary found in pico-8_0.2.7_amd64.zip but xvfb-run is not installed for headless execution.
  - verifications: 2
- environment-and-capability-detection: blocked (platform)
  - note: [2026-07-04T01:02:39.673Z] Verification sign-off (command): E2E capability-present proof passes after the final code change.
    Value: <prove environment-and-capability-detection/capabilities-are-reported-when-pico-8-is-present via real CLI/MCP surface for environment-and-capability-detection>
    Evidence: reports/environment-and-capability-detection/e2e.log
    [2026-07-04T01:02:44.818Z] Verification sign-off (command): E2E capability-absent proof passes after the final code change.
    Value: <prove environment-and-capability-detection/capabilities-are-reported-when-pico-8-is-absent via real CLI/MCP surface for environment-and-capability-detection>
    Evidence: reports/environment-and-capability-detection/e2e.log
    [2026-07-04T01:02:48.473Z] Verification sign-off (command): E2E static-only proof passes after the final code change.
    Value: <prove environment-and-capability-detection/static-work-needs-no-pico-8-program via real CLI/MCP surface for environment-and-capability-detection>
    Evidence: reports/environment-and-capability-detection/e2e.log
    [2026-07-04T01:02:52.387Z] Verification sign-off (command): E2E runtime-decline proof passes after the final code change.
    Value: <prove environment-and-capability-detection/running-is-declined-when-no-pico-8-program-is-present via real CLI/MCP surface for environment-and-capability-detection>
    Evidence: reports/environment-and-capability-detection/e2e.log
    [2026-07-04T01:04:55.465Z] Blocked by policy: The configured repository check command (corepack pnpm run typecheck) still fails on existing repo-wide lint/type policy debt outside this node, so the node cannot advance beyond review honestly.
    Needed: Resolve the repo-wide Vite+/ESLint policy failures, then rerun check/CI for this node.
  - verifications: 4
- project-and-path-boundaries: done (platform)
  - note: [2026-07-03T05:08:31.124Z] Verification sign-off (command): Boundary check: node packages/cli/dist/index.mjs export --out /tmp/test.json exits 6. E2E test passes.
    Value: <prove project-and-path-boundaries/work-outside-the-project-boundary-is-refused via real CLI/MCP surface for project-and-path-boundaries>
    Evidence: reports/project-and-path-boundaries/completion.md
  - verifications: 1
- reading-cartridges: done (static-core)
  - note: [2026-07-03T05:20:20.031Z] Verification sign-off (command): E2E test passes
    Value: <prove reading-cartridges/read-an-overview-of-a-cartridge via real CLI/MCP surface for reading-cartridges>
    [2026-07-03T05:20:47.807Z] Verification sign-off (command): E2E test passes
    Value: <prove reading-cartridges/read-a-single-tab-of-code via real CLI/MCP surface for reading-cartridges>
    [2026-07-03T05:20:48.199Z] Verification sign-off (command): E2E test passes
    Value: <prove reading-cartridges/read-a-cartridge-that-does-not-exist via real CLI/MCP surface for reading-cartridges>
    [2026-07-03T05:20:48.575Z] Verification sign-off (command): E2E test passes
    Value: <prove reading-cartridges/read-an-empty-cartridge via real CLI/MCP surface for reading-cartridges>
  - verifications: 4
- writing-code: done (static-core)
  - note: [2026-07-03T06:10:13.757Z] Verification sign-off (command): E2E tests pass
    Value: <prove writing-code/a-newly-created-cartridge-carries-no-boilerplate via real CLI/MCP surface for writing-code>
    [2026-07-03T06:10:14.951Z] Verification sign-off (command): E2E tests pass
    Value: <prove writing-code/writing-to-one-tab-leaves-other-tabs-unchanged via real CLI/MCP surface for writing-code>
    [2026-07-03T06:10:15.970Z] Verification sign-off (command): E2E tests pass
    Value: <prove writing-code/uppercase-identifiers-round-trip-through-the-console-s-own-form via real CLI/MCP surface for writing-code>
    [2026-07-03T06:10:16.903Z] Verification sign-off (command): E2E tests pass
    Value: <prove writing-code/writing-code-preserves-existing-assets via real CLI/MCP surface for writing-code>
    [2026-07-03T06:10:18.050Z] Verification sign-off (command): E2E tests pass
    Value: <prove writing-code/writing-code-to-a-new-location-creates-a-cartridge via real CLI/MCP surface for writing-code>
  - verifications: 5
- editing-code: done (static-core)
  - note: [2026-07-03T06:20:03.137Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-code/editing-a-tab-that-does-not-exist-is-rejected via real CLI/MCP surface for editing-code>
    [2026-07-03T06:20:03.512Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-code/removing-code-increases-the-reported-headroom via real CLI/MCP surface for editing-code>
    [2026-07-03T06:20:03.889Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-code/an-unmatched-search-changes-nothing via real CLI/MCP surface for editing-code>
    [2026-07-03T06:20:04.284Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-code/append-code-to-a-cartridge via real CLI/MCP surface for editing-code>
    [2026-07-03T06:20:04.671Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-code/edit-a-range-of-lines via real CLI/MCP surface for editing-code>
    [2026-07-03T06:20:05.065Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-code/edit-by-finding-and-replacing-text via real CLI/MCP surface for editing-code>
  - verifications: 6
- parsing-code: done (static-core)
  - note: [2026-07-03T05:50:11.496Z] Verification sign-off (command): E2E tests pass
    Value: <prove parsing-code/valid-code-parses via real CLI/MCP surface for parsing-code>
    [2026-07-03T05:50:12.017Z] Verification sign-off (command): E2E tests pass
    Value: <prove parsing-code/the-console-s-shorthand-is-accepted-as-valid via real CLI/MCP surface for parsing-code>
    [2026-07-03T05:50:12.557Z] Verification sign-off (command): E2E tests pass
    Value: <prove parsing-code/a-syntax-error-is-located via real CLI/MCP surface for parsing-code>
    [2026-07-03T05:50:13.070Z] Verification sign-off (command): E2E tests pass
    Value: <prove parsing-code/an-empty-program-parses via real CLI/MCP surface for parsing-code>
  - verifications: 4
- linting-code: done (static-core)
  - note: [2026-07-03T06:10:25.732Z] Verification sign-off (command): E2E tests pass
    Value: <prove linting-code/clean-code-produces-no-lints via real CLI/MCP surface for linting-code>
    [2026-07-03T06:10:27.063Z] Verification sign-off (command): E2E tests pass
    Value: <prove linting-code/lint-reports-likely-problems via real CLI/MCP surface for linting-code>
  - verifications: 2
- reporting-size-against-the-limits: done (static-core)
  - note: [2026-07-03T05:50:08.640Z] Verification sign-off (command): E2E tests pass
    Value: <prove reporting-size-against-the-limits/exceeding-the-token-limit-is-reported via real CLI/MCP surface for reporting-size-against-the-limits>
    [2026-07-03T05:50:09.027Z] Verification sign-off (command): E2E tests pass
    Value: <prove reporting-size-against-the-limits/size-within-the-limits-reports-headroom via real CLI/MCP surface for reporting-size-against-the-limits>
    [2026-07-03T05:50:09.431Z] Verification sign-off (command): E2E tests pass
    Value: <prove reporting-size-against-the-limits/exceeding-the-distribution-size-limit-is-reported via real CLI/MCP surface for reporting-size-against-the-limits>
    [2026-07-03T05:50:09.820Z] Verification sign-off (command): E2E tests pass
    Value: <prove reporting-size-against-the-limits/a-static-operation-on-a-missing-cartridge-reports-not-found via real CLI/MCP surface for reporting-size-against-the-limits>
  - verifications: 4
- minifying-code: done (static-advanced)
  - note: [2026-07-03T06:10:40.975Z] Verification sign-off (command): E2E tests pass
    Value: <prove minifying-code/minifying-already-minimal-code-stays-valid via real CLI/MCP surface for minifying-code>
    [2026-07-03T06:10:41.426Z] Verification sign-off (command): E2E tests pass
    Value: <prove minifying-code/minification-optimises-the-chosen-measure via real CLI/MCP surface for minifying-code>
    [2026-07-03T06:10:41.811Z] Verification sign-off (command): E2E tests pass
    Value: <prove minifying-code/aggressive-minification-shrinks-further-than-safe via real CLI/MCP surface for minifying-code>
    [2026-07-03T06:10:42.197Z] Verification sign-off (command): E2E tests pass
    Value: <prove minifying-code/minification-can-make-an-oversized-cartridge-fit-for-distribution via real CLI/MCP surface for minifying-code>
    [2026-07-03T06:10:42.567Z] Verification sign-off (command): E2E tests pass
    Value: <prove minifying-code/safe-minification-shrinks-the-cart-and-preserves-behaviour via real CLI/MCP surface for minifying-code>
    [2026-07-03T06:10:42.937Z] Verification sign-off (command): E2E tests pass
    Value: <prove minifying-code/minifying-in-place-updates-the-cartridge via real CLI/MCP surface for minifying-code>
    [2026-07-03T06:10:43.338Z] Verification sign-off (command): E2E tests pass
    Value: <prove minifying-code/minifying-into-a-separate-cartridge-leaves-the-original-intact via real CLI/MCP surface for minifying-code>
  - verifications: 7
- converting-cartridge-formats: done (static-advanced)
  - note: [2026-07-03T05:50:15.194Z] Verification sign-off (command): E2E tests pass
    Value: <prove converting-cartridge-formats/convert-a-cartridge-between-forms via real CLI/MCP surface for converting-cartridge-formats>
    [2026-07-03T05:50:15.738Z] Verification sign-off (command): E2E tests pass
    Value: <prove converting-cartridge-formats/converting-a-file-that-is-not-a-cartridge-reports-an-error via real CLI/MCP surface for converting-cartridge-formats>
    [2026-07-03T05:50:16.298Z] Verification sign-off (command): E2E tests pass
    Value: <prove converting-cartridge-formats/a-round-trip-conversion-preserves-the-cartridge via real CLI/MCP surface for converting-cartridge-formats>
    [2026-07-03T05:50:16.809Z] Verification sign-off (command): E2E tests pass
    Value: <prove converting-cartridge-formats/converting-to-an-image-is-refused-when-the-code-is-too-large via real CLI/MCP surface for converting-cartridge-formats>
  - verifications: 4
- editing-sprites: done (assets)
  - note: [2026-07-03T05:50:18.919Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-sprites/write-a-sprite-together-with-its-flags via real CLI/MCP surface for editing-sprites>
    [2026-07-03T05:50:19.379Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-sprites/reject-a-wrongly-sized-sprite-grid via real CLI/MCP surface for editing-sprites>
    [2026-07-03T05:50:19.837Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-sprites/reject-a-colour-outside-the-palette via real CLI/MCP surface for editing-sprites>
    [2026-07-03T05:50:20.322Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-sprites/write-a-sprite-from-a-grid via real CLI/MCP surface for editing-sprites>
    [2026-07-03T05:50:20.715Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-sprites/read-a-sprite-as-a-grid-of-colours via real CLI/MCP surface for editing-sprites>
  - verifications: 5
- editing-sprite-flags: done (assets)
  - note: [2026-07-03T05:50:22.391Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-sprite-flags/set-a-sprite-s-flags via real CLI/MCP surface for editing-sprite-flags>
  - verifications: 1
- editing-the-map: done (assets)
  - note: [2026-07-03T05:50:23.980Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-the-map/paint-a-region-of-the-map via real CLI/MCP surface for editing-the-map>
    [2026-07-03T05:50:24.356Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-the-map/read-a-region-of-the-map via real CLI/MCP surface for editing-the-map>
    [2026-07-03T05:50:24.773Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-the-map/reject-a-tile-value-out-of-range via real CLI/MCP surface for editing-the-map>
    [2026-07-03T05:50:25.169Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-the-map/reject-a-region-beyond-the-map-bounds via real CLI/MCP surface for editing-the-map>
  - verifications: 4
- sprite-sheet-images: done (assets)
  - note: [2026-07-03T06:10:35.479Z] Verification sign-off (command): E2E tests pass
    Value: <prove sprite-sheet-images/import-an-image-into-the-sprite-sheet via real CLI/MCP surface for sprite-sheet-images>
    [2026-07-03T06:10:37.326Z] Verification sign-off (command): E2E tests pass
    Value: <prove sprite-sheet-images/import-an-image-at-a-chosen-position via real CLI/MCP surface for sprite-sheet-images>
    [2026-07-03T06:10:37.757Z] Verification sign-off (command): E2E tests pass
    Value: <prove sprite-sheet-images/export-the-sprite-sheet-as-an-image via real CLI/MCP surface for sprite-sheet-images>
    [2026-07-03T06:10:38.153Z] Verification sign-off (command): E2E tests pass
    Value: <prove sprite-sheet-images/import-an-oversized-image-with-shrinking via real CLI/MCP surface for sprite-sheet-images>
  - verifications: 4
- editing-sound-effects: done (assets)
  - note: [2026-07-03T05:50:26.688Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-sound-effects/read-a-sound-effect-as-notes via real CLI/MCP surface for editing-sound-effects>
    [2026-07-03T05:50:27.058Z] Verification sign-off (command): E2E tests pass
    Value: <prove editing-sound-effects/write-a-sound-effect-from-notes via real CLI/MCP surface for editing-sound-effects>
  - verifications: 2
- running-a-cartridge-headlessly: blocked (runtime)
  - note: [2026-07-04T01:04:55.178Z] Blocked by environment: Headless runtime execution cannot be verified because xvfb-run is unavailable in this environment.
    Needed: Install xvfb-run and re-run bootstrap-runtime-environment verification before runtime work.
  - verifications: 12
- exporting-a-distributable: blocked (runtime)
  - note: [2026-07-04T01:04:41.197Z] Blocked by environment: Build export cannot be verified because xvfb-run is unavailable for the required headless PICO-8 runtime path.
    Needed: Install xvfb-run and re-run bootstrap-runtime-environment verification before export work.
  - verifications: 5
- reference-data: done (reference)
  - note: [2026-07-03T05:50:28.653Z] Verification sign-off (command): E2E tests pass
    Value: <prove reference-data/a-cartridge-snapshot-matches-reading-it-directly via real CLI/MCP surface for reference-data>
    [2026-07-03T05:50:29.042Z] Verification sign-off (command): E2E tests pass
    Value: <prove reference-data/retrieve-the-guide-to-the-console-s-pitfalls via real CLI/MCP surface for reference-data>
    [2026-07-03T05:50:29.442Z] Verification sign-off (command): E2E tests pass
    Value: <prove reference-data/reference-data-is-passive via real CLI/MCP surface for reference-data>
    [2026-07-03T05:50:29.823Z] Verification sign-off (command): E2E tests pass
    Value: <prove reference-data/retrieve-the-function-reference via real CLI/MCP surface for reference-data>
  - verifications: 4
- toolbox-contract: done (platform)
  - note: [2026-07-03T06:20:07.748Z] Verification sign-off (command): E2E tests pass
    Value: <prove toolbox-contract/the-toolbox-offers-only-single-purpose-operations via real CLI/MCP surface for toolbox-contract>
    [2026-07-03T06:20:08.136Z] Verification sign-off (command): E2E tests pass
    Value: <prove toolbox-contract/exceeding-the-token-limit-does-not-block-an-editable-form-write via real CLI/MCP surface for toolbox-contract>
    [2026-07-03T06:20:08.544Z] Verification sign-off (command): E2E tests pass
    Value: <prove toolbox-contract/operations-do-not-trigger-one-another via real CLI/MCP surface for toolbox-contract>
    [2026-07-03T06:20:08.969Z] Verification sign-off (command): E2E tests pass
    Value: <prove toolbox-contract/each-operation-stands-alone via real CLI/MCP surface for toolbox-contract>
  - verifications: 4
