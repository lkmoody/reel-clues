# Reel Clues: Movie Trivia Game — Project Scope

Nov 17, 2026 · @Larry

## Overview and goals

Reel Clues is a daily movie trivia game where players identify a film from clues revealed one at a time, with fewer clues meaning a better score. It is a personal project built to be fun to play and to serve as a portfolio piece showing senior-level full-stack TypeScript, real-time systems and cloud operations.

**Goals**

- Ship a polished, publicly playable game with a new puzzle every day
- Generate puzzles automatically from movie data, with a human review step
- Add a real-time head-to-head mode with a server-authoritative design
- Run it like a production service, with IaC, CI/CD, tests and observability
- Keep the codebase clean enough to walk an interviewer through any part

**Done means** the MVP is live on a public URL, a puzzle has published every day for 30 days without manual fixes, and the repo has a README with an architecture write-up.

## MVP scope (v1)

Version 1 is a single-player daily puzzle with accounts, streaks and a generation pipeline behind it.

**Gameplay**

- One puzzle per day, same for every player, rolling over at midnight UTC
- Six clues revealed in order, from vague to specific (release year, genre, tagline, a supporting cast member, director, lead actor)
- **Title slots.** From the start, the board shows the shape of the answer's title: one blank slot per letter or digit, grouped into words, with spaces and punctuation shown. Accents are folded (Amélie shows as AMELIE).
- **Guesses must be real films.** A guess is resolved to a film in the known title list, through typeahead or fuzzy matching. Input that doesn't match a known film is rejected and costs nothing.
- **Letter reveals.** On a wrong guess, each word of the guessed title is compared with the same word of the answer, letter by letter, by position. Letters that match in place are revealed and stay revealed for the rest of the game. There are no "right letter, wrong place" hints.
- **Guess or skip.** A wrong guess reveals the next clue plus any matching letters. A skip reveals only the next clue.
- The score is the clue number the puzzle is solved on, and a miss after clue 6 is a loss
- Fuzzy matching that resolves alternate titles, common abbreviations and small typos to the right film
- Typeahead suggestions drawn from the known title list

**Players**

- Anonymous play by default, with progress kept locally
- Optional sign-in (email magic link or OAuth) to sync streaks across devices
- Stats page with streak, solve distribution and history
- Spoiler-free share card, similar to Wordle's emoji grid, that never shows the title's shape or letters

**Puzzle pipeline**

- Nightly job pulls candidate films from TMDB and scores difficulty, including how many other known films share the answer's release year and word pattern
- Candidates must have data for all six clues, including a tagline, and the title is removed from any clue text
- Admin review queue to approve, edit or reject generated puzzles
- Puzzles scheduled at least 7 days ahead

**Integrity**

- The answer never reaches the client before the game ends, and the server validates every guess
- Clues are revealed by the server, one per request
- The server sends only the title's shape and the letters the player has earned. Hidden letters never leave the server.

**Platform**

- Responsive, mobile-first web app, installable as a PWA

## Phase 2 and stretch features

Phase 2 adds the real-time and social layer, and the stretch items are taken on only after phase 2 is stable.

| Feature | Phase | What it proves |
| --- | --- | --- |
| Head-to-head mode, two players racing on one puzzle over WebSockets | 2 | Server-authoritative state, reconnection, race conditions |
| Private leagues with weekly seasons and leaderboards | 2 | Data modeling, ranking queries, caching |
| Adaptive difficulty from solve-rate data | 2 | Data feedback loop into generation |
| Push notification when the daily puzzle goes live | 2 | Service workers, scheduled delivery |
| Image clue mode, a still that un-blurs step by step (server-side processing) | Stretch | Image pipeline, CDN, licensing care |
| Puzzle archive with play-any-past-day | Stretch | Pagination, access rules |
| Public read-only API with docs and API keys | Stretch | API design, rate limiting, key management |

## Out of scope

These are deliberate non-goals, so the project stays finishable.

- Native iOS or Android apps (the PWA covers mobile)
- Monetization, ads or payments
- User-submitted puzzles or any user-generated content needing moderation
- TV shows, games or other media beyond feature films
- Hosting copyrighted media beyond what TMDB's terms allow (no trailers, no clips)
- Localization beyond English for v1
- AI-generated clues or chat features

## Architecture and tech stack

A TypeScript monorepo with one API server as the single source of truth, so the client never holds an answer it hasn't earned.

&#91;embedded content: system architecture · 6 components\]

The generator writes puzzles to Postgres for review, and players only ever talk to the API.

| Layer | Choice |
| --- | --- |
| Repo | pnpm workspaces monorepo with packages for web, api, generator and shared types |
| Frontend | React + TypeScript with Vite, TanStack Query, PWA plugin |
| Backend | Node + TypeScript with Fastify, running on AWS Lambda behind API Gateway for the MVP ([ADR 0002](adr/0002-run-mvp-on-aws-lambda.md)), plus a WebSocket server for head-to-head with hosting decided in phase 2 |
| Database | Postgres hosted on Neon in the app's AWS region, with Drizzle as the typed query layer, and pg\_trgm for fuzzy title matching ([ADR 0001](adr/0001-use-postgres-on-neon.md)) |
| Cache and real-time state | Redis, deferred until after the MVP (not used in v1) |
| Jobs | Generator as a Lambda function, triggered nightly by EventBridge Scheduler ([ADR 0002](adr/0002-run-mvp-on-aws-lambda.md)) |
| Auth | Magic link email or OAuth, with signed session cookies |
| Infrastructure | Terraform and GitHub Actions on AWS, with the hosting model still open |

Major decisions are recorded as ADRs in [docs/adr](adr/).

## Data sources and licensing

TMDB is the single data source, and the game stays non-commercial so it qualifies for TMDB's free developer API.

- **Cost and use.** TMDB's API is free for non-commercial use as long as TMDB is credited as the source of data and images. A project counts as commercial if its main purpose is earning revenue for the owner ([TMDB FAQ](https://developer.themoviedb.org/docs/faq)).
- **Attribution.** Show an approved TMDB logo and the required notice in an About or Credits screen.
- **Storage.** Store only what each puzzle needs (TMDB IDs, titles, year, clue text), refreshed from the API on generation. Load images from TMDB's CDN rather than rehosting them.
- **Rate limits.** Every TMDB call happens in the nightly batch job, never on a player request, so player traffic never touches TMDB.
- **No IMDb data.** IMDb's dataset terms are personal and non-commercial only, with limits on republishing, so it stays out of the game.

Source: [TMDB API Terms of Use](https://www.themoviedb.org/api-terms-of-use).

## Engineering quality bar

Every merge to main has to pass these, because how the project is built matters as much as what it does.

| Area | Standard |
| --- | --- |
| Types | TypeScript strict mode everywhere, shared types between client and server, no `any` outside test fixtures |
| Unit tests | Vitest for the core packages, with coverage on guess resolution, letter reveals, scoring and difficulty logic |
| Integration tests | API tests against a real Postgres in Docker |
| End-to-end tests | Playwright covering the daily solve, share card and head-to-head happy path |
| CI/CD | GitHub Actions running lint, typecheck, tests and build on every PR, with a preview deploy per PR and auto deploy to production on merge |
| Infrastructure | All cloud resources in Terraform, with separate staging and production environments |
| Observability | Structured JSON logs, request tracing, and metrics for solve rate, active players and API latency, plus alerts when the daily puzzle fails to publish |
| Security | Server-side guess validation, rate limiting per IP and per account, secrets in a managed store, and dependency scanning |
| Performance | Lighthouse score of 90 or higher on mobile, with the daily puzzle page under 150 KB of JS |
| Documentation | README with setup in under 5 commands, an architecture doc, and ADRs for major decisions |

## Milestones

Five milestones, each closed by a gate that has to pass before the next one starts. No dates are set yet.

&#91;embedded content: milestones · 5 phases, 4 gates\]

M2 is the real finish line. Everything after it is optional polish that builds on a live, working product.

## Risks and open questions

The biggest risk is scope creep, which the phase gates and the out-of-scope list are there to hold back.

| Risk | Mitigation |
| --- | --- |
| Scope creep stalls the MVP | Ship M2 publicly before starting any phase 2 work |
| Generated puzzles are too easy or too obscure | Human review queue, plus solve-rate data feeding difficulty scoring |
| TMDB terms or API changes | Keep TMDB access behind one adapter module, and re-read the terms before each phase |
| Answer leakage through the client or network | Server-only answers, with a test that checks API responses never contain the title, or any letter not yet earned, before the game ends |
| Short or common title patterns make some puzzles trivial | Difficulty scoring counts films sharing the same year and word pattern, and the review queue shows that count |
| Cloud costs grow quietly | Budget alerts in Terraform, serverless or scale-to-zero where possible |

**Open questions**

- [x] Cloud provider and hosting model: AWS, with the MVP backend on Lambda ([ADR 0002](adr/0002-run-mvp-on-aws-lambda.md)) and Postgres on Neon ([ADR 0001](adr/0001-use-postgres-on-neon.md))
- [x] Frontend framework: plain React with Vite
- [ ] What do TMDB's terms allow for storing data between nightly runs?
- [ ] Final name and domain (a domain is already registered on AWS)
- [ ] Should the repo be public from day one?
