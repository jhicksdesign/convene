# Architecture decisions

Short, dated entries that explain *why* the code looks the way it does.
Add a new section when you make a choice that future-you would have to re-derive.

---

## ADR-001 — Server actions over REST for mutations

**2026-05.** Every mutation in the app is a Next.js server action in `app/_actions/*`. Mutations are not exposed as `/api/*` endpoints.

- **Why:** Server actions have direct access to the auth session (`auth()` from Auth.js), get TypeScript end-to-end with no client-side schema duplication, and avoid the boilerplate of `(method, body, validation, response shape, error handling)` for every operation.
- **Consequence:** Any caller that needs a mutation has to be a React server component or a `'use client'` component that imports the action. There is no public REST API. If we ever need one (mobile, integrations), we'll wrap the same actions in `/api/*` route handlers — the action layer is the contract.

## ADR-002 — Postgres for everything except hot counters

**2026-05.** Single Postgres database for users, events, RSVPs, notifications, vouches, rate-limit buckets, change ticks, vector embeddings — and audit logs. No microservice extraction.

- **Why:** v1 is ≤300 users. Operationally, one DB to back up and one schema to evolve is dramatically cheaper than separating data stores. Postgres is also more capable than people give it credit for: pgvector, advisory locks, row-level locks, LISTEN/NOTIFY, JSON columns all in one engine.
- **Hot-counter exception:** Once Redis (Upstash) is wired, rate-limit counters move to it for O(1) INCR/EXPIRE. Postgres remains the fallback so the app still functions without Redis.

## ADR-003 — Concurrency: row-level locks, not optimistic retry

**2026-05.** Writes that depend on contended state (RSVP capacity, soft-claim ≤2 cap, group ≥1-admin invariant) wrap their read+write in `SELECT … FOR UPDATE` via `lib/tx.ts`.

- **Why:** Optimistic concurrency (compare-and-set with version columns) works but means every caller has retry-and-back-off plumbing. Row-level locks on a known row are simpler to reason about and the contention is low enough that the throughput cost is invisible.
- **Soft-claim cap exception:** No row to lock (the cap is on a *count*), so we use a Postgres advisory lock keyed by group id (`pg_advisory_xact_lock`).

## ADR-004 — One canonical helper per concern

**2026-05.** `lib/visibility.ts`, `lib/auth-helpers.ts`, `lib/rate-limit.ts`, `lib/notifications.ts`, `lib/conflict-detection.ts`, `lib/recurrence.ts` — each is the *only* place that handles its concern. Server actions and pages call them; we never reimplement.

- **Why:** The codebase will be touched by LLM-driven agents. Without a strict "one source of truth" rule, three different agents will produce three slightly different visibility checks and the safest one will lose. Keeping the surface small lets each agent extend rather than spawn.
- **How to enforce:** PR review and the README's "DRY rules" section.

## ADR-005 — Real-time via Postgres LISTEN/NOTIFY + SSE

**2026-05.** Calendar / event / group pages subscribe to a single Postgres channel `"convene"` via SSE. Server actions `pg_notify('convene', JSON.stringify({channel, ts}))` after every write. Browsers prefer `EventSource`; a 60-second poll against `ChangeTick` is the recovery path.

- **Why not WebSockets / a hosted realtime service?** SSE is one-way (server → client) which is exactly what we need (notify, then the client re-fetches). WebSockets would require a separate server process to terminate the connection; hosted services (Pusher / Ably) add a $25–50/mo recurring bill for what one `pg_notify` call solves.
- **Why not just polling?** Polling is reliable but feels laggy and burns the most cache-unfriendly traffic of any pattern. With LISTEN/NOTIFY, two browsers see an RSVP change within ~50 ms instead of ~7.5 s on average.
- **Caveat:** Each SSE connection holds its own pg client (LISTEN requires a dedicated connection). At ~200 concurrent viewers we'd use ~200 connections. Railway Postgres caps at ~250; with more traffic we'd add PgBouncer or move LISTEN onto a dedicated subscriber process.

## ADR-006 — Visibility is a function, not a column

**2026-05.** Every "can user U see entity E" check lives in `lib/visibility.ts`. We do not denormalize `is_visible_to` flags anywhere. Reads run the function; large lists call `filterVisibleEvents`.

- **Why:** Visibility rules combine blocks, group memberships, friendship, vouches and event scope. Any denormalization would be wrong somewhere — friendships get accepted, vouches get revoked, groups get joined. Cost: a few extra ms per page. Win: zero stale-permission bugs.

## ADR-007 — LLM budget guard in code, not in cloud

**2026-05.** `lib/anthropic.ts` enforces a per-user daily cap via the `LLMRateLimit` table. The PRD's "monthly $50 budget" is a soft target the operator monitors at the Anthropic dashboard.

- **Why per-user not per-server?** A single admin abusing paste-to-event 1000 times shouldn't deny service to everyone else. Per-user limits are the right shape.
- **Why no in-code monthly cap?** Tracking cost requires either pre-pricing every model+token combination ourselves (fragile) or polling the Anthropic billing API (rate-limited and slow). The simpler thing is a strict per-user cap that mathematically can't exceed N$/month at the configured rate.

## ADR-008 — Anti-spam: rate limits + account-age gates

**2026-05.** Every action that could be abused at scale goes through `rateLimitForUser`. Accounts younger than 1 hour get 20% of the normal cap. Event creation has an absolute 60-minute new-account block.

- **Why account-age scaling?** The realistic abuse pattern is "sign up → spam → abandon." Tightening limits in the first hour costs legitimate users almost nothing (most don't create 4 events in their first hour) and blocks the abuse pattern cold.

## ADR-009 — Magic link primary, OAuth optional

**2026-05.** Auth.js v5 with Resend magic links is the primary path. Discord OAuth is added when env vars are present.

- **Why magic link first?** Lower friction (no provider account required), works for groups whose members aren't on Discord, keeps Convene viable as a self-hostable scene-neutral app.

## ADR-010 — Open source under AGPL-3.0

**2026-05.** Codebase is public from day 1 under AGPL-3.0. The license travels with the deployment.

- **Why AGPL not MIT?** AGPL forces any SaaS fork to publish its source. We want self-hosting to spread but don't want a closed competitor undercutting the operator.
- **Trade-off:** Some companies are AGPL-allergic for their own products. That's fine — Convene is not a product for them.
