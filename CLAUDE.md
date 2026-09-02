# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A GitHub Action (`touchlab/read-property`) that reads a single key out of a
Java/JVM `.properties` file and exposes it as the `propVal` output. It is a
JavaScript action (`runs: using: node24`), deliberately not a container action,
so it can run in any runner without Docker.

The entire implementation is `src/index.ts` (~30 lines): read `file` and
`property` inputs, `fs.readFileSync`, `parse()` from `dot-properties`, then
`core.setOutput('propVal', propVal)`. Error behavior is intentionally loose per
the README — a missing key yields `undefined`, and only thrown `Error`s reach
`core.setFailed`.

## Commands

```bash
npm ci                # install (node_modules is not checked in)
npm run all           # format:write + lint + test + package — run before committing
npm run bundle        # format:write + package (the minimum before committing src changes)
npm run package       # ncc build src/index.ts -> dist/index.js
npm run ci-test       # jest, without the badge-writing wrapper
npm run format:check  # what CI runs; format:write to fix
npm run lint          # eslint, flat config from eslint.config.mjs
```

Run a single test: `npx jest -t 'sets propVal from the properties file'`.

`npm test` deliberately swallows failures (`(jest && badge) || badge`) so the
coverage badge is always written. Use `npm run ci-test` when you want a nonzero
exit on failure.

Note when checking exit codes from a shell here: the default shell is zsh, so
`PIPESTATUS` is empty — use `pipestatus` or check `$?` without a pipe, or you
will misread a failing command as passing.

## dist/ is the deployed artifact

`dist/index.js` is the file GitHub actually executes, so it is **committed** and
must be regenerated (`npm run package` or `npm run bundle`) and committed in the
same change as any `src/` edit. The `check-dist` workflow rebuilds and fails the
PR on any diff under `dist/`. `dist/` is marked `linguist-generated` in
`.gitattributes` — don't hand-edit it.

After changing dependencies, smoke-test the real bundle, not just the tests — a
bundler can emit a broken `dist/index.js` while every build step still reports
success:

```bash
printf 'K=v\n' > /tmp/t.properties && : > /tmp/o
GITHUB_OUTPUT=/tmp/o INPUT_FILE=/tmp/t.properties INPUT_PROPERTY=K node dist/index.js
cat /tmp/o   # expect propVal ... v
```

## Toolchain constraints

These are load-bearing; changing them breaks things in non-obvious ways.

- **`@actions/core` is held at `^2.0.3` on purpose.** v3 is ESM-only
  (`"type": "module"`, `import`-only exports). ncc cannot bundle it in CJS mode:
  it exits 0 and emits a `webpackMissingModule` stub, so CI stays green while
  the published action dies with `Cannot find module '@actions/core'`. Moving to
  v3 means migrating the whole project to ESM and replacing ncc with rollup, as
  the upstream `actions/typescript-action` template did.
- **`dist/index.js` is ~1.1MB, up from ~109KB.** Expected, not a regression:
  `@actions/core` v2+ depends on `@actions/http-client` v3, which pulls in
  `undici`. The action never makes HTTP calls, but ncc bundles the eager CJS
  requires anyway and it cannot be tree-shaken away. v3 has the same dependency.
- **TypeScript is capped below 6.1** by `@typescript-eslint` (`<6.1.0`) and
  ts-jest (`<7`). Currently on 6.0.3.
- **TS 6 no longer auto-includes every `node_modules/@types` package**, hence
  the explicit `"types": ["node", "jest"]` in `tsconfig.json`. Dropping it
  brings back `TS2591: Cannot find name 'fs'`.
- `baseUrl` was removed from `tsconfig.json` — deprecated in TS 6, gone in TS 7,
  and unused here (no `paths` mapping).

## Testing gotchas

`src/index.ts` calls `run()` at module scope, so importing it in a test executes
the action once immediately.

- **Mock `core.setFailed` with a no-op implementation, not a call-through spy.**
  The real one sets `process.exitCode = 1`, which makes Jest exit nonzero — and
  CI red — even when all tests pass.
- **Errors thrown by node's own `fs` are not `instanceof Error` inside Jest's
  sandbox** (different realm), so the action's `error instanceof Error` guard
  silently skips `setFailed`. To exercise the failure path, throw an Error
  constructed inside the test.
- `fs` exports are non-configurable in modern Node, so `jest.spyOn(fs, ...)`
  fails with `Cannot redefine property`. The suite swaps the module via
  `jest.mock('fs', ...)` with a factory instead.

## Lint

ESLint 10 removed `.eslintrc` support entirely; config lives in
`eslint.config.mjs` (flat). super-linter v8 also expects that filename by
default. `.github/linters/` now holds only the markdown/yaml lint configs and
the tsconfig that adds `__tests__` to type-aware linting.

## Known leftover

`CODEOWNERS` still lists the upstream template's owners
(`@actions/actions-runtime`, `@ncalteen`) rather than anyone in this org, so it
grants no effective review ownership.
