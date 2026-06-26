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
nix develop -c just ci
nix develop -c just pack
nix develop -c just npm-smoke
nix develop -c just mutation
```

`just npm-smoke` packs the actual core and CLI tarballs, installs them into a temporary npm prefix, and runs the installed `qd` binary through setup, doctor, JSON node creation, finding list, and export.

`just mutation` runs Stryker against `packages/core/src/**/*.ts` with Vitest and the TypeScript checker. The initial release ratchet is `thresholds.break = 45`, set from the first full-core baseline and intended to rise as surviving mutants are intentionally killed.

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

To release a new version:

```sh
nix develop -c corepack pnpm -r version patch
git commit -am "Release v0.1.1"
git tag v0.1.1
git push origin main --tags
```
