# Reel Clues

A daily movie trivia game. Players identify a film from clues revealed one at a time, and fewer clues means a better score.

## Prerequisites

- Node 26 (see `.nvmrc`)
- pnpm 12 (`npm install -g pnpm`)

## Setup

```powershell
pnpm install
pnpm dev
```

## Packages

| Package              | What it holds                                        |
| -------------------- | ---------------------------------------------------- |
| `packages/web`       | React app (Vite)                                     |
| `packages/shared`    | Types and game logic shared by the client and server |
| `packages/api`       | Fastify API (placeholder)                            |
| `packages/generator` | Nightly puzzle generator (placeholder)               |

## Scripts

Run from the repo root:

| Command      | What it does        |
| ------------ | ------------------- |
| `pnpm dev`   | Start the web app   |
| `pnpm build` | Build every package |
| `pnpm lint`  | Lint the whole repo |

## Docs

Project scope, the implementation plan and architecture decisions (ADRs) are in [`docs/`](docs/).
