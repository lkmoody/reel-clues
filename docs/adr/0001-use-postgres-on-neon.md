# 1. Use Postgres hosted on Neon

- **Status:** Accepted
- **Date:** 2026-11-17
- **Deciders:** @Larry

## Context

Reel Clues needs a primary database for puzzles, clues, players, streaks and guess history, and in phase 2 for leagues and leaderboards. The app will be hosted on AWS, where the domain is already registered.

The forces on this decision:

- **Cost.** This is a non-commercial personal project. Traffic will be small and spiky (most play happens soon after the daily puzzle goes live), and the database will sit idle most of the day. The scope lists "cloud costs grow quietly" as a risk and asks for scale-to-zero where possible.
- **Query needs.** Fuzzy title matching uses `pg_trgm`. Stats (streaks, solve distribution, history) and phase 2 leaderboards are relational queries with aggregates and rankings.
- **Network access.** The nightly generator must reach both the database and the TMDB API on the public internet.
- **Preview environments.** CI/CD calls for a preview deploy per PR, and each preview needs its own data.
- **Learning focus.** The project is for learning TypeScript. A familiar database keeps the effort on TypeScript rather than a new data model.
- **Tooling.** Drizzle has been chosen as the typed query layer.

## Decision

Use **PostgreSQL** as the database, hosted on **Neon** (serverless Postgres) in the same AWS region as the application.

- Application code connects with a standard Postgres connection string through Drizzle, so nothing in the code is Neon-specific.
- Serverless functions connect through Neon's **pooled connection endpoint**.
- The connection string is stored in a managed secret store (AWS Secrets Manager or SSM Parameter Store), never in code or the repo.
- Local development and integration tests use Postgres in Docker (`docker-compose.yml`).

## Alternatives considered

### Amazon RDS for PostgreSQL (db.t4g.micro)

Fully inside AWS, simple and well understood.

- Rejected for now on cost. It runs and bills around the clock (roughly $15/month) even when no one is playing.
- RDS lives in a private VPC, so any Lambda that reaches it must run in that VPC. A Lambda in a VPC has no internet access by default, so the generator would need a NAT Gateway (roughly $30+/month) to call TMDB. That is more than the database itself.
- Remains the fallback if keeping everything in one AWS account becomes more important than cost. Migrating is mostly a connection-string change plus a `pg_dump`/`pg_restore`.

### Amazon Aurora Serverless v2

Can scale to zero, but resuming from a pause takes several seconds. In a daily game, the first player after an idle period would hit that delay. It is also costly while active, and it has the same VPC and NAT Gateway issue as RDS.

### Amazon DynamoDB

Pay-per-request with a permanent free tier, so it would be the cheapest option.

- Rejected because the access patterns must be designed up front. Stats, history and leaderboard queries become much harder, and there is no `pg_trgm` equivalent.
- It would mean learning DynamoDB data modeling alongside TypeScript, against the learning-focus goal.
- It does not work with Drizzle.

## Consequences

### Positive

- **Low cost.** Neon's free tier should cover the MVP, and the database scales to zero when idle.
- **No VPC or NAT Gateway needed.** Neon is reached over the public internet with TLS, so functions can reach both Neon and TMDB with default internet access.
- **Branching** gives each PR preview its own copy of the database, created and deleted by CI.
- **Full Postgres,** including `pg_trgm`, standard SQL and the existing Drizzle choice.

### Negative

- **A second vendor.** Neon has its own account, billing and status page, separate from AWS, and its availability is outside AWS's control.
- **The connection string is the main security control,** since the database is reachable from the internet. It must be kept in a managed secret store and rotated if exposed.
- **Cold starts.** After the database scales to zero, the first query takes a short resume delay (usually under a second).
- **Terraform.** Neon resources need Neon's Terraform provider (or are managed by hand), alongside the AWS provider.

### Follow-ups

- Confirm free-tier limits (storage, compute hours, branch count) against expected usage before launch.
- Decide whether CI creates Neon branches through the Neon API, a GitHub Action, or Terraform.
