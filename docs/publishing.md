# Publishing qdcli

qd publishes two npm packages:

- `@cat-cave/qdcli-core`: the graph/database engine used by the CLI and viewer.
- `@cat-cave/qdcli`: the user-facing package that installs the `qd` binary.

Users install only the CLI package:

```sh
pnpm dlx @cat-cave/qdcli --help
npx @cat-cave/qdcli --help
npm install -g @cat-cave/qdcli
```

## Required Access

Manual publishing requires an npm account with publish permission for the `@cat-cave` scope. Use an interactive npm login with 2FA.

Automated publishing uses npm Trusted Publishing from `.github/workflows/publish.yml`. Do not use a long-lived npm publish token for qdcli releases.

The first publish for each scoped package must be public.

## Prepublish Validation

Run:

```sh
nix develop -c just release-check
```

`just release-check` runs the full CI gate, npm tarball smoke, and Stryker mutation ratchet.

`just npm-smoke` packs the actual core and CLI tarballs, installs them into a temporary npm prefix, and runs the installed `qd` binary through setup, doctor, JSON node creation, finding list, and export.

`just mutation` runs Stryker against `packages/core/src/**/*.ts` with Vitest and the TypeScript checker. The current release ratchet is `thresholds.break = 55`, and it should only rise after tests kill enough mutants to earn the higher threshold.

## Publish Order

For a local bootstrap or emergency manual publish, publish core first, then CLI:

```sh
nix develop -c corepack pnpm --filter ./packages/core publish --access public --otp=123456
nix develop -c corepack pnpm --filter ./packages/cli publish --access public --otp=123456
```

After publish, verify the public install path:

```sh
npx @cat-cave/qdcli --version
pnpm dlx @cat-cave/qdcli doctor --json
```

## Trusted Publishing

Each npm package must trust the GitHub Actions workflow named `publish.yml`:

- `@cat-cave/qdcli-core`
- `@cat-cave/qdcli`

Configure each package on npmjs.com under package Settings -> Trusted Publishing:

- Provider: GitHub Actions
- Organization or user: `cat-cave`
- Repository: `qdcli`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

The workflow validates the repo, packs the core and CLI tarballs with pnpm so workspace dependencies are rewritten, then publishes those tarballs with npm's OIDC trusted publisher flow.

To prepare a release:

```sh
nix develop -c just release-bump patch
nix develop -c just release-check
nix develop -c just release-tag
nix develop -c just release-push
```

`just release-bump` accepts `patch`, `minor`, `major`, or an exact `x.y.z` version. It updates the workspace package versions together, prepends `CHANGELOG.md`, and refreshes `pnpm-lock.yaml`. `just release-tag` commits the prepared release and creates `v<version>`. `just release-push` pushes `main` and the exact version tag, which triggers `.github/workflows/publish.yml` through npm Trusted Publishing.
