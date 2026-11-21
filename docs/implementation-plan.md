# Reel Clues: MVP Implementation Plan

Nov 17, 2026 · @Larry

This plan breaks the MVP from the [project scope](Reel%20Clues%20Movie%20Trivia%20Game%20—%20Project%20Scope.md) into epics and stories, in the order to build them. It covers v1 only. Phase 2 and stretch features are left out on purpose.

## How to use this plan

- **Work top to bottom.** Epics are numbered in build order, and stories within an epic are numbered in order too. A story only depends on stories above it.
- **One story = one feature branch = one PR into `develop`.** Name branches after the story, for example `feature/2.2-guess-resolution`.
- **Phases end in a gate.** Don't start the next phase until the gate passes. This is the scope's main defense against scope creep.
- **Decision stories** (marked 🧭) end in an ADR in `docs/adr/` before any code is written.
- **Sizes** are rough: **S** is an evening, **M** is a few sessions, **L** is a week or more of evenings.
- **TS focus** notes the TypeScript ideas each story is a good chance to learn.

### Definition of done (every story)

- Merged to `develop` through a PR with CI green (once CI exists, from story 1.6)
- New logic has tests, and there's no `any` outside test fixtures
- README or docs updated if setup or behavior changed

## Starting point

- The repo is a fresh Vite React + TypeScript app at the root, with `docs/` holding the scope and ADRs.
- GitHub flow: feature branches → `develop` (default) → `main` (production), with rulesets on both protected branches.
- Decided so far:
  - React + Vite frontend
  - Drizzle ORM
  - pnpm workspaces
  - Postgres on Neon ([ADR 0001](adr/0001-use-postgres-on-neon.md))
  - Lambda backend for the MVP ([ADR 0002](adr/0002-run-mvp-on-aws-lambda.md))
  - Redis deferred until after the MVP
- Not yet available: a TMDB API key. The game is built on seed data first.

## The plan at a glance

| Order | Phase | Epic | Gate at the end of the phase |
| --- | --- | --- | --- |
| 1 | A. Foundation | E1 Repo and tooling | Monorepo builds; CI runs lint, typecheck, test and build on every PR |
| 2 | B. Playable locally | E2 Core game domain | |
| 3 | | E3 Database | |
| 4 | | E4 Game API | |
| 5 | | E5 Web gameplay | You can solve a seed puzzle end to end on your machine, and the answer-leak test passes |
| 6 | C. Live on AWS | E6 AWS infrastructure and deployment | Merging to `develop` deploys to staging, and merging to `main` deploys to production, automatically |
| 7 | D. Real puzzles | E7 Puzzle generator (TMDB) | |
| 8 | | E8 Accounts and sync | |
| 9 | | E9 Admin review and scheduling | At least 7 days of approved, TMDB-generated puzzles are scheduled on staging |
| 10 | E. Launch | E10 Launch readiness | The scope's quality bar is met and production is public. The 30-day clock starts. |

**Why this order:**
- **Domain logic first:** guess resolution, letter reveals and scoring are pure TypeScript with no framework in the way. That's the best place to learn the language.
- **Playable locally next:** a working game early keeps motivation up and proves the server-authoritative design before any cloud work.
- **Deploy before the hard features:** getting the playable game onto AWS before the TMDB pipeline means infrastructure isn't one big risky step at the end. Every later story then ships through the real pipeline.
- **Accounts before admin:** the admin review queue needs a signed-in admin, so accounts come first.

---

## Phase A: Foundation

### E1: Repo and tooling

Turn the single Vite app into the monorepo the scope describes, with strict TypeScript and CI in place before feature work starts.

**1.1 Move to Node 26 LTS** · S
- Install Node 26 (the Active LTS since October 2026) with nvm-windows, and add `.nvmrc` containing `26`.
- Install pnpm for Node 26 (Corepack isn't bundled with Node 25+), and set `"engines"` and `"packageManager"` in the root `package.json`.
- Update `@types/node` to match.
- Acceptance: `node --version` shows 26.x, and `pnpm install`, `pnpm dev` and `pnpm build` still work.

**1.2 Restructure into a pnpm monorepo** · M
- Add `pnpm-workspace.yaml` and move the Vite app into `packages/web`.
- Create empty `packages/shared`, `packages/api` and `packages/generator`, each with its own `package.json`, scoped as `@reel-clues/*`.
- Have `web` depend on `shared` using `"workspace:*"`, and prove it with one exported constant.
- Acceptance: from the root, `pnpm -r build` builds everything, and `pnpm --filter web dev` runs the app.
- TS focus: how `tsconfig` `references` and `extends` work, and how a package's `exports` field decides what other packages can import.

**1.3 Shared strict TypeScript config** · S
- Add a root `tsconfig.base.json` that every package extends. Turn on `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax`.
- Add a root `pnpm typecheck` script that runs across all packages.
- Acceptance: `pnpm typecheck` passes, and a deliberate type error in any package fails it.
- TS focus: what each strict flag catches, compared with the same bug in plain JS.

**1.4 🧭 Linting and formatting** · S
- Decide between keeping oxlint (fast, already in the template) and switching to ESLint with typescript-eslint (slower, but deeper rules that use type information). Write it up as an ADR.
- Add Prettier and format the repo.
- Acceptance: `pnpm lint` and `pnpm format:check` pass, and the VS Code extensions format on save.

**1.5 Vitest across the workspace** · S
- Install Vitest at the root with one test project per package.
- Write a first trivial test in `shared`.
- Acceptance: `pnpm test` runs every package's tests, and the VS Code Vitest extension shows them.

**1.6 CI on every pull request** · M
- Add a GitHub Actions workflow on `pull_request` that runs install (with pnpm cache), lint, typecheck, test and build.
- Add those checks as **required status checks** in both rulesets.
- Acceptance: a PR with a failing test can't be merged.

**1.7 Local Postgres in Docker** · S
- Add `docker-compose.yml` with Postgres 17 only, plus a `.env.example`, and make sure `.gitignore` covers `.env`.
- Acceptance: `docker compose up -d` gives you a database you can connect to from VS Code or `psql`.

**1.8 README skeleton** · S
- Cover what the project is, the prerequisites, and setup in under 5 commands.
- Link to `docs/`.
- Acceptance: a fresh clone gets running by following only the README.

**1.9 Request a TMDB API key** (chore, run in parallel) · S
- Apply at themoviedb.org for a non-commercial developer key, and store it in `.env`, never in the repo.
- Done early so it's ready by E7.

**⛳ Gate A:** the monorepo builds, CI runs on every PR, and the branch rulesets require it.

---

## Phase B: Playable locally

### E2: Core game domain (`packages/shared`)

Pure TypeScript with no I/O. This is the heart of the game, and the scope requires coverage on guess resolution, letter reveals and scoring.

**How a game works** (from the scope's Gameplay section):
- The board shows the title's **shape** from the start: a blank slot per letter or digit, grouped into words, with spaces and punctuation shown and accents folded.
- A guess must **resolve to a known film**. Input that doesn't is rejected and costs nothing.
- A **wrong guess** reveals the next clue plus any letters that match **in place, word by word**. Revealed letters stay revealed.
- A **skip** reveals only the next clue.
- The score is the clue number the puzzle was solved on. A miss after clue 6 loses.

**2.1 Clue and puzzle types** · S
- Define the six clue kinds in reveal order as a `const` array, and derive a `ClueKind` union type from it.
- Add `Clue`, the title-shape types (a word is a list of slots, and a slot is hidden, revealed or fixed punctuation), and the API contract types (request and response shapes) the client and server will share.
- Acceptance: the types compile and are exported from `@reel-clues/shared`.
- TS focus: `as const`, deriving a union from an array (`(typeof X)[number]`), `interface` vs `type`, and a discriminated union for slots (`{ kind: 'hidden' } | { kind: 'revealed'; char: string } | { kind: 'fixed'; char: string }`).

**2.2 Title normalization and guess resolution** · L
- `normalizeTitle`:
  - lowercase and strip accents and punctuation
  - drop a leading "The", "A" or "An"
  - map `&` to "and"
  - treat "Part II", "II" and "2" as the same
- `resolveGuess(input, knownTitles)` returns the film the player meant, or "not a known film". It accepts:
  - an exact title or a curated alias
  - an auto-generated acronym ("LOTR")
  - small typos, with the allowance scaled to title length
- Two rules stop false matches:
  - An exact match always wins over a typo match, so "Alien" resolves to *Alien*, never *Aliens*.
  - Sequel numbers must agree, so "Rocky 3" never resolves to *Rocky II*.
- A guess is correct when the resolved film **is** the answer film. Comparing film ids means no separate "is this the answer?" matching is needed.
- Acceptance: a thorough table-driven test suite (use `it.each`) of inputs and the film each should resolve to, or none, all passing.
- TS focus: discriminated unions for the result (`{ found: true; film } | { found: false }`), and narrowing on them.

**2.3 Title shape and letter reveals** · M
- `titleShape(title)` turns a title into its board:
  - Words are split on spaces.
  - Each letter or digit is a hidden slot.
  - Punctuation (`:`, `'`, `-`, `·` and so on) is a fixed slot, shown from the start.
  - Accents are folded and letters are uppercased, so *Amélie* becomes `AMELIE`.
- `lettersRevealed(guessTitle, answerTitle)` compares word 1 with word 1, word 2 with word 2 and so on, by position within each word, using the same folding. It returns the slot positions that match. Words beyond the shorter title don't match anything.
- `mergeReveals(previous, next)` combines reveals, so letters stay revealed for the rest of the game.
- Acceptance: table-driven tests, including:
  - *The Silence of the Lambs* vs *The Prince of Tides*
  - titles with punctuation (*Ocean's Eleven*, *2001: A Space Odyssey*, *WALL·E*)
  - accents (*Amélie*)
  - different word counts
  - a guess that shares no letters
- TS focus: readonly nested arrays (`ReadonlyArray<ReadonlyArray<Slot>>`), `Set` for revealed positions, and Unicode normalization (`String.prototype.normalize`).

**2.4 Game state machine and scoring** · M
- Write `newGame(shape)` and `applyMove(state, move)` as pure functions:
  - A correct guess wins.
  - A wrong guess reveals the next clue and merges in its letter reveals.
  - A skip reveals only the next clue.
  - A miss on clue 6 loses.
  - Unknown-film inputs never become moves.
- `scoreOf(state)` returns the clue number the puzzle was solved on, or `null` for a loss.
- A move after the game ends throws a typed error.
- Acceptance: every transition is covered by tests.
- TS focus: `readonly` arrays, union types for moves, and making impossible states impossible to represent.

**2.5 Share card text** · S
- Build a Wordle-style result, for example `Reel Clues #12 3/6` followed by 🟥⬜🟩⬛⬛⬛, where 🟥 is a wrong guess, ⬜ a skip, 🟩 the solve and ⬛ an unused clue.
- Acceptance: tests for a win on clue 1, a mid-game win and a loss. The output never contains the title, its shape or any letter.

**2.6 Daily date helpers** · S
- `todayKey()` returns `YYYY-MM-DD` in **UTC**, and `puzzleNumber(dateKey, launchDate)` gives the puzzle's number.
- Acceptance: tests around midnight UTC, including a time zone that's on a different calendar day.

### E3: Database (Drizzle + Postgres)

**3.1 Drizzle setup and migrations** · M
- Install `drizzle-orm` and `drizzle-kit` in `api`, and add a typed config that reads `DATABASE_URL`.
- Add a first migration that enables the `pg_trgm` extension.
- Add the scripts `db:generate`, `db:migrate` and `db:studio`.
- Acceptance: migrations run cleanly against Docker Postgres from scratch.

**3.2 🧭 MVP schema** · M
- Tables:
  - `films`: TMDB id, title, original title, year, aliases
  - `known_titles`: the typeahead and guess list, with title and year, so remakes can be told apart
  - `puzzles`: date (unique), film, status (`draft` / `approved` / `rejected`), difficulty
  - `clues`: puzzle, number 1–6, kind, text
  - `players`: an anonymous id, later linked to a user
  - `plays`: player × puzzle, clues revealed, moves (each guess's resolved film or a skip), revealed letter positions, status, score
- Add a trigram index on known titles.
- Write a short ADR for the data model.
- Acceptance: migrations are generated and applied, and `db:studio` shows the tables.
- TS focus: Drizzle's inferred types (`typeof puzzles.$inferSelect`), so the database schema is the single source of truth for row types.

**3.3 Seed data** · M
- Hand-write about 14 puzzles across consecutive dates starting today, plus a few hundred known titles, and add a `db:seed` script.
- Write your own clue text; there's no TMDB data yet.
- Every puzzle's answer must be in the known titles, plus enough films from the same years for real guesses to be possible.
- Acceptance: a fresh database plus `db:migrate` and `db:seed` gives a playable "today".

### E4: Game API (`packages/api`, Fastify)

The server is the single source of truth. The answer never leaves it until the game ends.

**4.1 Fastify app skeleton** · M
- Write a `buildApp()` factory, a local `server.ts` entry point that calls `listen()`, and add `/health`.
- Parse environment variables with zod, so the app refuses to start if one is missing or malformed.
- Use pino JSON logs, which Fastify has built in.
- Acceptance: `pnpm --filter api dev` serves `/health`, and a missing `DATABASE_URL` fails fast with a clear error.
- TS focus: `z.infer` to derive types from runtime schemas, and why environment variables need runtime validation even with TypeScript.

**4.2 Anonymous player session** · S
- Use `@fastify/cookie` to set a **signed**, httpOnly cookie holding a player id the first time a player visits, and create a `players` row.
- Acceptance: the same browser keeps the same player id, and a tampered cookie is rejected.
- TS focus: Fastify declaration merging, which lets you add `request.playerId` to Fastify's types.

**4.3 `GET /api/puzzle/today`** · M
- Return:
  - the puzzle number and the date
  - the **title shape**, with only the letters this player has earned filled in
  - the clues revealed so far
  - the status and the moves
- Return the answer only if the game is over.
- Acceptance: integration tests for a new player, a game in progress and a finished game.

**4.4 `POST /api/puzzle/today/guess` and `/skip`** · M
- For a guess, run `resolveGuess` (from `shared`) on the server.
  - If the input isn't a known film, respond with a clear "not a known film" error. No move is recorded and no clue is revealed.
  - Otherwise, compute the letter reveals, apply the move with `applyMove`, and save it.
- Return the next clue and the updated title shape, or the result plus the answer when the game ends.
- Validate request bodies with schemas.
- Acceptance: integration tests for:
  - a wrong guess that reveals letters
  - a wrong guess that reveals none
  - an unknown film (rejected, free)
  - a skip
  - a win
  - a loss
  - a move after the game is over (rejected)

**4.5 `GET /api/titles?q=`** · S
- Typeahead over `known_titles` using `pg_trgm` similarity, returning at most 10 results.
- Acceptance: typos still return sensible suggestions, and responses are fast against the seed data.

**4.6 Integration test harness and answer-leak test** · M
- Run API tests against a real Postgres in Docker, both locally and in CI, using a service container or Testcontainers.
- Add the **answer-leak test**: play a game to just before the end and check that:
  - no response body contains the title or an alias
  - no response contains a letter the player hasn't earned
- Acceptance: CI runs the integration tests on every PR.

### E5: Web gameplay (`packages/web`)

**5.1 App shell and routing** · S
- Set up a mobile-first layout, routes for Play, Stats and About, and basic design tokens (colors and type).
- Acceptance: it works at 360 px wide with no horizontal scroll.

**5.2 Typed API client with TanStack Query** · M
- Write a small `fetch` wrapper typed against the `shared` contract types.
- Add query hooks for today's puzzle and mutations for guess and skip.
- Acceptance: changing a response type in `shared` causes a compile error in `web`.
- TS focus: generics (`apiGet<T>()`), and sharing types across the client and server boundary.

**5.3 Daily puzzle screen** · M
- Show revealed clues in order, a guess input, a Skip button, and the remaining clue slots.
- Show the server's response, including the "not a known film" error, and handle loading and error states.
- Acceptance: you can play a full seed puzzle in the browser.

**5.4 Title slots board** · M
- Draw the title shape as letter tiles grouped into words, with fixed punctuation shown and long titles wrapping cleanly on a 360 px screen.
- Newly revealed letters get a short highlight animation, which is turned off when the user prefers reduced motion.
- Make it accessible: screen readers announce something like "word 2 of 5, 7 letters, 2 revealed".
- Acceptance: it renders the 2.3 test titles correctly, and works with the keyboard and a screen reader.

**5.5 Typeahead input** · M
- A debounced call to `/api/titles` with keyboard navigation and accessible combobox markup.
- Show each suggestion's year, so remakes can be told apart.
- Acceptance: it's usable with the keyboard only and on a phone.
- TS focus: typing React events and refs (`React.KeyboardEvent<HTMLInputElement>`, `useRef<HTMLInputElement>(null)`).

**5.6 Result screen and share** · S
- On a win or loss, reveal the film and show the share text.
- Use the Web Share API where it's available, with copy-to-clipboard as the fallback.
- Acceptance: the shared text matches story 2.5, and there's no spoiler.

**5.7 Local stats and history** · M
- Store finished games in `localStorage`, and compute the streak, the solve distribution and the history.
- Make storage safe: wrap reads and writes in try/catch and validate the data shape.
- Acceptance: unit tests for the streak calculation, including gaps and the UTC rollover.

**5.8 Stats page** · S
- Show the streak, the max streak, the solve distribution as bars, and the history list.
- Acceptance: it shows correct numbers after several days of seeded play.

**5.9 About and credits** · S
- How to play, including how letter reveals work, plus **TMDB attribution** using an approved logo and the required notice, as the scope requires.
- Acceptance: the attribution matches TMDB's terms.

**5.10 Playwright end-to-end: daily solve and share** · M
- Run Playwright against the local stack, covering a wrong guess that reveals letters, a solve and the share card.
- Acceptance: it runs in CI.

**⛳ Gate B:** a seed puzzle can be solved end to end locally, and the answer-leak test and the E2E test pass in CI.

---

## Phase C: Live on AWS

### E6: AWS infrastructure and deployment

Everything in Terraform, with separate staging and production environments, as the scope requires.

**6.1 AWS account baseline** · M
- Create an admin IAM user or IAM Identity Center sign-in for yourself, and lock down the root user with MFA.
- Add **budget alerts**, a Terraform state backend (an S3 bucket with native locking), and a Terraform layout with `staging` and `production` environments.
- Acceptance: `terraform plan` runs for both environments, and the budget alert email is confirmed.

**6.2 GitHub to AWS with OIDC** · S
- Create an IAM role that GitHub Actions can assume through OIDC, so no AWS keys are stored in GitHub.
- Add GitHub Environments `staging` and `production`, with `production` limited to `main`.
- Acceptance: a workflow on `develop` can run `aws sts get-caller-identity`.

**6.3 🧭 Frontend hosting** · M
- ADR, recommended option: S3 plus CloudFront.
- Terraform: the bucket, the distribution, an ACM certificate, and Route 53 records for your domain (for example `staging.<domain>` and `<domain>`).
- Acceptance: a placeholder page is served over HTTPS on both domains.

**6.4 Neon environments and secrets** · S
- Create the Neon project with `production` and `staging` branches, and store each pooled connection string in SSM Parameter Store or Secrets Manager.
- Acceptance: the secrets exist for each environment, and none are in the repo.

**6.5 API on Lambda** · M
- Add a Lambda entry point using `@fastify/aws-lambda`, and an esbuild bundle.
- Terraform: the Lambda, an API Gateway HTTP API, and a custom domain such as `api.<domain>`. Choose between the custom domain and same-origin routing through CloudFront in this story.
- Acceptance: `/health` responds on staging.

**6.6 Deploy pipelines** · L
- Merging to `develop` deploys to staging; merging to `main` deploys to production.
- Each run builds, applies Terraform, runs database migrations, uploads the frontend, invalidates the CloudFront cache and runs a smoke test.
- Acceptance: a trivial change flows to staging automatically, and to production after a `develop` → `main` PR.

**6.7 Preview deploys per PR** · M
- Each PR gets a Neon branch plus a preview frontend and API, all torn down when the PR closes.
- This story can slip to Phase E if it's blocking progress.
- Acceptance: a PR comment links to its preview.

**⛳ Gate C:** the seed-data game is playable on staging and production URLs, deployed only through the pipeline.

---

## Phase D: Real puzzles

### E7: Puzzle generator (`packages/generator`, TMDB)

Every TMDB call happens here, in the nightly batch job, and never on a player request.

**7.1 TMDB adapter** · M
- Write one module that wraps every TMDB call the project uses: discover/popular, details, credits, alternative titles and release dates.
- Validate each response with zod, and handle rate limits with retry and backoff.
- Record test fixtures so tests never call the network.
- Acceptance: the adapter is the only code that knows TMDB's URLs and shapes, as the scope's risk table requires.
- TS focus: designing an interface (`MovieSource`) and swapping a fake in for tests.

**7.2 Candidate selection** · M
- Pick feature films only, with enough data for all six clues (a tagline, a director and at least two billed cast members), skipping films already used or recently rejected.
- The answer must be in the known titles, so players can actually guess it.
- Acceptance: unit tests on the filtering rules using fixtures.

**7.3 Clue builder** · M
- Turn film data into the six clues in order.
- **Redact the title** wherever it appears in the tagline or other clue text.
- Pick a supporting cast member who isn't the lead, and pull aliases from alternative titles.
- Acceptance: tests show that no clue text contains the title or an alias.

**7.4 Difficulty scoring** · M
- Calculate a score from:
  - popularity, vote count and film age
  - **pattern uniqueness:** how many other known titles share the answer's release year and word-length pattern. Fewer look-alikes means an easier puzzle; for example, a 1975 film with one four-letter word is nearly a giveaway.
- Keep the formula documented and tested, since the scope requires coverage on difficulty logic.
- Acceptance: well-known films score easier than obscure ones on fixture data, and a short, unique pattern scores easier than a common one.

**7.5 Known-titles refresh** · S
- Update the known titles (title and year) from TMDB, storing only what the game needs, per the scope's storage rule. This list is both the typeahead and the set of valid guesses.
- Acceptance: the list grows with no duplicates.

**7.6 Generator job** · M
- Write a CLI that runs locally (`pnpm --filter generator start`) and creates N draft puzzles. Running it twice must be safe.
- Add a Lambda handler for the same job, triggered nightly by EventBridge Scheduler (in Terraform), finishing well within Lambda's 15-minute limit.
- Acceptance: the nightly run on staging creates drafts, with logs to show it.

### E8: Accounts and sync

**8.1 🧭 Sign-in method** · S
- ADR: email magic link (through Amazon SES) vs OAuth (Google or GitHub), or both. Cover sessions as signed cookies, and how anonymous history gets linked to an account.

**8.2 Users and sessions** · M
- Add a `users` table and a session cookie, and attach `request.user` in Fastify.
- Acceptance: signed-in state survives a reload, and signing out clears it.

**8.3 Sign-in flow** · L
- Implement the chosen method end to end. Locally, the magic link is logged to the console, not emailed.
- Acceptance: you can sign in on staging.

**8.4 Link anonymous play to an account** · M
- On first sign-in, attach the anonymous player's plays to the user, and merge the local stats.
- Acceptance: a streak started anonymously carries over to a second device after signing in there.

**8.5 Server-backed stats** · S
- Add a `GET /api/me/stats` endpoint for signed-in players. The stats page uses it when signed in, and local stats otherwise.
- Acceptance: stats match across two browsers signed in to the same account.

### E9: Admin review and scheduling

**9.1 Admin role** · S
- Add an `is_admin` flag set only through a migration or script, guard the admin API routes, and add a hidden `/admin` area in the web app.
- Acceptance: non-admins get a 403 on every admin route, with tests to prove it.

**9.2 Review queue** · M
- List draft puzzles with their clues, difficulty, film details, title shape and pattern-uniqueness count.
- Acceptance: drafts made by the generator appear.

**9.3 Edit, approve, reject** · M
- Edit clue text and aliases, then approve or reject. Rejected films are excluded from future candidates.
- Acceptance: every action is saved, with audit fields recording who did it and when.

**9.4 Scheduling** · M
- Assign approved puzzles to dates, with a calendar view of upcoming days.
- Warn when fewer than **7 days** are scheduled ahead.
- Acceptance: you can't schedule two puzzles on one date, and the buffer warning shows correctly.

**9.5 Daily rollover** · S
- At midnight UTC, "today" becomes the next scheduled puzzle.
- If no puzzle is scheduled, players see a clear "no puzzle today" state instead of an error.
- Acceptance: tests around the rollover time.

**⛳ Gate D:** at least 7 days of real, TMDB-generated, admin-approved puzzles are scheduled on staging.

---

## Phase E: Launch

### E10: Launch readiness

**10.1 🧭 Rate limiting** · M
- ADR: AWS WAF rate-based rules vs a Postgres-backed limiter, covering limits per IP and per account. Then implement it.
- Acceptance: a burst of guesses gets HTTP 429 responses, with tests or a load script to show it.

**10.2 Observability** · L
- Add a request id passed through the logs, and tracing.
- Add metrics for solve rate, active players and API latency, using CloudWatch embedded metrics.
- Add **alarms** for when the daily puzzle fails to publish, when fewer than 7 days are scheduled, and for API errors.
- Acceptance: alarms reach your email, tested by triggering one on staging.

**10.3 PWA** · M
- Add a manifest, icons, and a service worker through `vite-plugin-pwa`, so the app shell works offline.
- Acceptance: the app installs on Android and iOS, and shows a friendly offline state.

**10.4 Performance budget** · M
- Target a Lighthouse score of 90+ on mobile, and under 150 KB of JS on the puzzle page.
- Add a bundle-size check and Lighthouse CI to the PR workflow.
- Acceptance: CI fails if the JS budget is exceeded.

**10.5 Security pass** · S
- Turn on Dependabot, secret scanning and CodeQL.
- Review cookie flags, CORS and security headers.
- Re-read TMDB's terms, as the scope's risk table requires.
- Acceptance: no high-severity alerts are open.

**10.6 Documentation** · M
- Finish the README, write `docs/architecture.md` with a diagram and the request flow, and check every major decision has an ADR.
- Acceptance: someone else could walk an interviewer through the system using the docs.

**10.7 Launch** · S
- Deploy to production on your domain, schedule 30+ days ahead, and run a production smoke test.
- **Start the 30-day clock.** The scope's "done" is 30 straight days of puzzles published with no manual fixes.
- Acceptance: the public URL is live and the first real daily puzzle is playable.

**⛳ Gate E (MVP done):** live on a public URL, 30 consecutive days published with no manual fixes, and the README with the architecture write-up complete.

---

## Decisions still to make

These are planned as 🧭 stories, so each gets an ADR when you reach it:

| Story | Decision |
| --- | --- |
| 1.4 | oxlint vs ESLint with typescript-eslint |
| 3.2 | MVP data model |
| 6.3 | Frontend hosting (recommended: S3 + CloudFront) |
| 8.1 | Magic link vs OAuth |
| 10.1 | Rate-limiting approach |

Other open questions from the scope to settle along the way:
- What TMDB's terms allow for storing data between nightly runs (settle before 7.5)
- The final name (the domain is already registered)
- Whether the repo is public
