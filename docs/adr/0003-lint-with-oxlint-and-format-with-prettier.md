# 3. Lint with oxlint and format with Prettier

- **Status:** Accepted
- **Date:** 2026-11-20
- **Deciders:** @Larry

## Context

The repo needs a linter to catch likely bugs and a formatter to keep style consistent across all packages. The scope's quality bar requires lint on every PR and no `any` outside test fixtures.

The forces on this decision:

- **TypeScript 7.** The repo uses TypeScript 7.0, the native Go compiler. typescript-eslint, the standard way to lint TypeScript with ESLint, supports only TypeScript up to 6.0 (its peer dependency is `>=4.8.4 <6.1.0`).
- **Type-aware rules matter for this codebase.** The API and web app are built on promises: database calls, HTTP handlers and TanStack Query. Rules like `no-floating-promises` need type information to work.
- **Speed.** Linting should be fast enough to run on save and in CI without becoming a bottleneck.
- **Existing setup.** The Vite template already ships with oxlint and a `.oxlintrc.json`.

## Decision

- **Lint with oxlint, with type-aware rules turned on** through `oxlint-tsgolint`, which is built on the TypeScript 7 compiler (`typescript-go`).
  - Configuration lives in the root `.oxlintrc.json` and lints the whole repo from the root.
  - The `correctness` category is errors and the `suspicious` category is warnings.
  - Explicit errors: `no-explicit-any`, `no-floating-promises`, `no-misused-promises` and `await-thenable`.
  - `react/react-in-jsx-scope` is off, because the automatic JSX runtime (`"jsx": "react-jsx"`) doesn't need `React` in scope.
- **Format with Prettier,** using `singleQuote: true`, `printWidth: 100` and otherwise Prettier's defaults.
  - `pnpm format` writes and `pnpm format:check` verifies.
  - VS Code formats on save through a committed `.vscode/settings.json`.
- **Use LF line endings everywhere,** enforced by `.gitattributes` (`* text=auto eol=lf`) and VS Code's `files.eol`. CI and AWS Lambda run on Linux, and mixed endings had already appeared in the repo.

## Alternatives considered

### ESLint with typescript-eslint

The most widely used option, with the largest rule ecosystem.

- Rejected because it doesn't support TypeScript 7. We'd have to downgrade the whole repo to TypeScript 6.0 and give up the native compiler's speed.
- Noticeably slower than oxlint, especially with type-aware rules.
- Worth revisiting if a rule we need is only available for ESLint, once typescript-eslint supports TypeScript 7.

### oxlint without type-aware rules

Simpler, with no extra package, but it would miss the promise-handling bugs that matter most in an async API.

### oxfmt instead of Prettier

Oxc's own formatter, from the same project as oxlint. It's very fast and Prettier-compatible, but still pre-1.0 (0.79 at the time of writing). Prettier is stable and has a mature VS Code extension. Switching later would be low-risk, because oxfmt aims to match Prettier's output.

## Consequences

### Positive

- Type-aware linting runs on the same compiler as `tsc`, so the linter and the type checker always agree on types.
- Fast enough to lint the whole repo in well under a second, so it can run on save and in CI.
- Formatting is never discussed or reviewed again, and diffs only show real changes.
- No conflict between tools: oxlint has no style rules turned on, so it never argues with Prettier.

### Negative

- oxlint's rule set is smaller than ESLint's plugin ecosystem, so some niche rules aren't available.
- `oxlint-tsgolint` is newer and moves fast. Its version should be updated together with TypeScript.
- Prettier is a second tool to install and configure alongside oxlint.

### Follow-ups

- Story 1.6: CI runs `pnpm lint` and `pnpm format:check` on every PR. Decide there whether warnings should also fail CI (`oxlint --deny-warnings`).
