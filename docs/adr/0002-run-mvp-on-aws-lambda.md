# 2. Run the MVP backend on AWS Lambda

- **Status:** Accepted
- **Date:** 2026-11-17
- **Deciders:** @Larry

## Context

The app is hosted on AWS. The scope left the hosting model open: containers or serverless. Two pieces of backend code need somewhere to run in the MVP:

- **The API:** a Fastify server that serves the daily puzzle, reveals clues and validates guesses.
- **The generator:** a nightly job that pulls candidate films from TMDB, scores difficulty and writes puzzles for review.

The forces on this decision:

- **Cost.** Traffic will be low and spiky, peaking when the daily puzzle goes live and idle most of the day. The scope asks for serverless or scale-to-zero where possible, and the database already scales to zero ([ADR 0001](0001-use-postgres-on-neon.md)).
- **Network access.** Both the API and the generator must reach Neon over the public internet, and the generator must also reach TMDB. Neither needs a VPC.
- **Real-time play.** Phase 2 head-to-head mode needs long-lived WebSocket connections, but that is not part of the MVP.
- **Operations.** As a solo project, it should have as little infrastructure to patch and monitor as possible.

## Decision

Run the MVP backend on **AWS Lambda**.

- **API:** Fastify runs in a Lambda function behind an **API Gateway HTTP API**, using the official `@fastify/aws-lambda` adapter. The Fastify app is built in its own module, with two thin entry points: a Lambda handler for AWS and a normal `listen()` server for local development and integration tests.
- **Generator:** a separate Lambda function, triggered nightly by **Amazon EventBridge Scheduler**.
- **No VPC.** Functions run outside a VPC, so they reach Neon and TMDB with default internet access and need no NAT Gateway.
- **Bundling.** Each function is bundled into one small file (for example with esbuild) to keep cold starts short.
- **Phase 2.** The hosting for head-to-head WebSockets is decided separately when phase 2 starts.

## Alternatives considered

### Containers on Amazon ECS Fargate

The API would run as an always-on Docker container, acting like a normal Node server.

- Rejected for the MVP on cost. A small setup runs and bills around the clock (roughly $10–30/month with a load balancer) even when no one is playing.
- More to operate: images, task definitions, a load balancer and health checks.
- It handles WebSockets naturally, so it remains the leading option for head-to-head in phase 2.

### AWS App Runner

A simpler container service, but it also bills for provisioned instances while idle and adds a second hosting model without solving the WebSocket question any better than Fargate.

### A single EC2 instance

The cheapest always-on option, but it means patching an OS, managing the Node process and scaling by hand, which goes against running this like a production service with little operational overhead.

## Consequences

### Positive

- **Scales to zero.** There is no cost when idle, and low traffic should stay within or near Lambda's free tier.
- **No servers to manage.** AWS handles patching, scaling and availability.
- **Fits ADR 0001.** With no VPC and no NAT Gateway, the whole MVP backend can scale to zero.
- **Portable.** The Fastify app doesn't depend on Lambda, so moving it to a container later only means swapping its entry point.

### Negative

- **Cold starts.** The first request to an idle function takes extra time. This is mitigated by small bundles and by creating the database client outside the handler, so warm invocations reuse it.
- **No shared memory between invocations.** Each Lambda instance is separate, so in-process caches and counters only cover one instance. Per-IP and per-account rate limiting needs a shared store (Postgres, AWS WAF rate rules, or Redis later).
- **Time limits.** API Gateway HTTP APIs time out after 30 seconds, and Lambda after 15 minutes. That is fine for the API, but the generator must finish its nightly batch within 15 minutes or be split into smaller runs.
- **Debugging.** Problems that only appear on Lambda are harder to reproduce locally, so structured logs and tracing matter more.

### Follow-ups

- Choose the rate-limiting approach (AWS WAF rate-based rules versus a Postgres-backed limiter).
- Decide head-to-head hosting at the start of phase 2: API Gateway WebSocket APIs with Lambda, or a container on Fargate.
- Decide where the frontend is hosted (recommended: S3 + CloudFront).
