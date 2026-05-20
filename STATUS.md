# Convene — Build status

Honest accounting of what runs end-to-end vs. what's a stub, scoped to every PRD section.

## Cross-cutting infrastructure (added after the initial scaffold)

- **Concurrency** — `lib/tx.ts` exposes `withRowLock` (Postgres `SELECT … FOR UPDATE`) and `withAdvisoryLock` (Postgres advisory locks keyed by string). RSVP capacity / waitlist promotion (`lib/waitlist.ts`), conditional-RSVP evaluator (`lib/conditional-rsvps.ts`), soft-claim ≤2 cap, group admin demote / leave all wrap their reads + writes in a lock so concurrent callers serialize instead of racing.
- **Anti-spam** — `RateLimitBucket` table + `lib/rate-limit.ts` (`rateLimit`, `rateLimitForUser`, `refuseIfFresherThan`, `isFreshAccount`). Sliding-window per-key counter with opportunistic pruning. Applied to: magic-link send (per email — 1/min, 5/hr), event create (per user — 20/hr + 60-min new-account block), RSVP flip (per user-event — 10/hr), friend request (30/day), report submit (5/day), carpool create (10/hr), vouch (50/day), upload sign (30/hr per kind). Fresh accounts (<1h old) get 20% of the normal cap on every gate.
- **Real-time** — `ChangeTick` table + `lib/realtime.ts` `bump(channel)`. Server actions bump channels after mutations (`calendar`, `group:<id>`, `event:<id>`). `/api/realtime/ticks?c=...` returns latest tick per channel. `hooks/use-realtime-refresh.ts` + `<RealtimeSubscribe>` poll every 15s when the tab is visible and call `router.refresh()` on advance. Already wired into `/calendar`, `/g/[slug]`, `/e/[id]`.

### New UI surface delivered

- Generic `<Uploader kind="…">` (`components/common/uploader.tsx`) — used by `ProfileForm` for avatars, `ReportForm` for evidence (≤5 files), and `ImageToEvent` for flyer persistence.
- `/settings/friends` — accept/decline/remove + sent-requests list.
- `/settings/vouches` — count-per-group (identities never shown).
- `AdminNoteEditor` embedded on `/u/[id]` — one panel per group the viewer admins where the subject is a member.
- `CarpoolPanel` and `TravelEstimate` on `/e/[id]`.
- `/reports/appeals`, `/reports/appeals/new`, `/reports/appeals/[id]` — list, file, admin response.
- Group-removal notifications link directly to the appeal-creation page (`/reports/appeals/new?action=…`).
- `/g/[slug]/admin/safety-network` — propose / confirm / view active edges, with a confirmation dialog that spells out the implications before the toggle flips.
- Filter chips on `/calendar` and `/map` now support: per-group, "my groups only", RSVP status, accessibility flags.
- `/e/new` ships with the NL **scheduling assistant sidebar** — question + group selector → 2-3 dated suggestions with one-sentence reasoning; clicking one prefills the form's start/end.
- `RSVPButton` now exposes both conditional modes — "if N others go" and "if a specific user goes" via a debounced `UserCombobox` (backed by `/api/users/search`).
- Event detail page surfaces the aggregate conditional summary ("N people will go if at least M others commit").
- `/terms` page covers the shutdown commitment (§8.10), data ownership, and license.
- Top-bar **search** (`/api/search`) returns mixed users/groups/events with visibility + block filtering applied.
- Cancelled events older than 30 days are hidden from default calendar and iCal queries (§6.2).
- `ImageToEvent` now persists the uploaded flyer to R2 before the LLM extraction, and the public URL flows into `EventForm` as `flyerImageUrl`.
- `/u/[id]` shows a **recent attendance** section gated by `attendanceVisibility`.
- New cron `/api/cron/report-notify-subjects` (hourly): delivers the 48h subject notification for non-confidential reports (§8.7).
- **Per-instance recurrence editing** (§6.2) — `detachInstance` action splits an occurrence off into its own event (with `recurrenceParentId` set) and adds the date to the parent's exception list. `cancelInstance` does just the exception. Surfaced on event detail's admin tools as the next 12 occurrences, each with "Edit just this" and "Cancel just this".
- **Admin signals dashboard** (§11.4) — `/g/[slug]/admin/signals` with an opt-in modal that explains intent before turning on (`Group.signalsOptIn`). Three widgets: top-3 overlap partners (from `AttendanceOverlap`), 90-day GOING sparkline (`lib/signals.ts` + inline SVG), and lapsed-regulars count. Identities never exposed to admins of groups the user isn't in.
- **Cross-group claim history** (§6.3) — `/g/[slug]/admin` now shows the last 20 soft-claims from other groups, marked active / expired / converted (with a deep-link to the resulting event).
- **Venue notes editor** (§12.4) — `VenueNotesEditor` shown on event detail when the viewer admins any group that has previously hosted at this location.

### "Pro" upgrade pass (deploy-ready for portfolio launch)

- **Sentry** — `sentry.{client,server,edge}.config.ts` + `instrumentation.ts` + source-map upload via `withSentryConfig`. `lib/error-report.ts` provides a `withErrorReport({ action, userId })` wrapper that suppresses expected user-facing errors (rate-limits, validation) and reports the rest.
- **Upstash Redis** — `lib/redis.ts` optional client. `lib/rate-limit.ts` now prefers Redis INCR+EXPIRE pipelines and falls back to the Postgres `RateLimitBucket` when env unset.
- **SSE realtime** — `lib/realtime.ts` fires `pg_notify('convene', JSON)` after every mutation. `/api/realtime/stream` holds a dedicated `pg` client per connection on Postgres `LISTEN "convene"` and pushes filtered events to the browser. `useRealtimeRefresh` opens an `EventSource` and keeps the 60s tick poll as recovery. Latency drops from ~7.5s avg to ~50ms.
- **Discord OAuth** — Auth.js Discord provider registered when `DISCORD_CLIENT_ID/SECRET` are set. Login page renders a Discord button above the magic-link form.
- **Web Push** — `PushSubscription` model, `lib/web-push.ts` sender, `public/sw.js` service worker, `/settings/notifications` exposes the subscribe button. `dispatch()` fires push best-effort alongside in-app + email.
- **Recharts on signals dashboard** — `GoingTrendChart` (AreaChart with gradient + tooltip) replaces the inline SVG sparkline.
- **Framer Motion** — conflict warning slide-in + notification badge spring animation. Surgical, not pervasive.
- **Semantic event search** — pgvector manual migration adds `Event.embedding vector(1536)` + IVFFlat index. `lib/embeddings.ts` writes via `text-embedding-3-small` on event create/update. `/api/search/similar?eventId=...` returns cosine-nearest events, rendered as a "Similar events" panel on event detail.
- **Playwright + GitHub Actions** — `playwright.config.ts` + four smoke tests at `tests/e2e/*`. `.github/workflows/ci.yml` runs typecheck → migrate → seed → build → e2e against a Postgres service container.
- **Cloudflare Images** — `lib/cf-images.ts` URL transformer with `variants.avatarSmall/avatarLarge/flyer/flyerThumb`. No-op when `CF_IMAGES_ZONE_URL` unset.
- **React Email** — `generic.tsx` rewrite of the transactional template using `@react-email/components`.
- **`/architecture` page** — live stats cards (users, groups, events, RSVPs, rate-limit buckets last hour, realtime channels, etc.) + a "stack at a glance" panel listing every dependency.
- **`docs/decisions.md`** — 10 ADRs covering server-actions-over-REST, concurrency strategy, the visibility-is-a-function rule, LLM budget guard, anti-spam, realtime architecture, and the AGPL choice.
- **README** — Mermaid architecture diagram + "what's interesting in this codebase" bullets.


Legend:
- **✓ Done** — code in place, wired through, would work against a real DB / API key
- **◐ Partial** — backend logic exists but missing UI surface, or UI exists but missing detail
- **✗ Stub / NYI** — placeholder only, or not started

If you're picking this up, treat "✓ Done" as load-bearing — extend rather than rewrite. Treat "◐ Partial" entries as the highest-leverage next work: the data model and server actions already exist, so what's missing is usually a page or a component.

---

## §5 Data model

**✓ Done.** `prisma/schema.prisma` is the canonical model. It includes every PRD-listed model plus support tables not in the PRD but required by features called out elsewhere:
- `Notification` (§14), `AttendanceOverlap` (§9.4), `LLMRateLimit` (§10.4), `DirectionsCache` (§12.2)
- `CarpoolOffer` / `CarpoolRequest` (§12.3)
- `Convention` (§6.7)
- `JoinRequest`, `Invite`, `EventInvite` (§6.1, §8.1 INVITE scope)
- `SafetyNetworkEdge` (§8.5), `Appeal` (§8.8)
- Auth.js v5 tables (`Account`, `Session`, `VerificationToken`)

Migrations not run yet — `npx prisma migrate dev` needs a real `DATABASE_URL`.

---

## §6 Foundation

### §6.1 Groups
- ✓ Create / update / member management, multi-admin with ≥1-admin guard (`app/_actions/groups.ts`)
- ✓ Auto slug, color picker, visibility & joinMode controls (`components/groups/group-form.tsx`)
- ✓ Join flows for OPEN / REQUEST / INVITE_ONLY (`app/_actions/memberships.ts`)

### §6.2 Events
- ✓ CRUD + co-hosting, co-host admins can edit (`assertAdminOfOwningOrCoHost`)
- ✓ RRULE recurrence expansion (`lib/recurrence.ts`)
- ✓ Tentative auto-expiry cron (`app/api/cron/expire-tentative-events`)
- ◐ **Per-instance recurrence editing UI** — `recurrenceExceptions` field + `addRecurrenceException` action exist; no UI lets a user click a single instance and modify/cancel just that one
- ✗ **Cancelled-event 30-day hide rule** — cancelled events stay visible forever today; need a "hide cancelled events older than 30 days from default views" filter applied in `app/calendar/page.tsx` and feed queries

### §6.3 Soft-claims
- ✓ Create with ≤2 active limit, 7-day expiry, hourly purge cron (`app/_actions/soft-claims.ts`)
- ✓ Soft-claim conversion field on schema (`convertedToEventId`)
- ◐ **Cross-group claim-history view** — admin dashboard shows your group's active claims only; PRD §6.3 calls for a view across other groups' claim history. Add a section in `app/g/[slug]/admin/page.tsx` that queries `SoftClaim` across all groups for read-only display.

### §6.4 Conflict detection
- ✓ Hard / soft / adjacent severity, returns 3 best alternative dates, includes attendee-overlap % (`lib/conflict-detection.ts`)
- ✓ Surfaced in `ConflictWarning` after event create/update

### §6.5 Calendar views
- ✓ Month / Week / Agenda views (`components/calendar/*`)
- ✓ Per-group filter chips
- ✗ **"My groups only" toggle** — group chips exist but no all-vs-mine switch
- ✗ **RSVP-status filter** — going / interested filter chips
- ✗ **Accessibility filter** — flag chips

### §6.6 Export
- ✓ Public / group / user iCal feeds (`/api/ical/*`)
- ✓ Per-user token rotate/revoke (`/settings/calendar-feeds`)

### §6.7 Built-in convention calendar
- ✓ Model + seed of 10 conventions (`prisma/seed.ts`)
- ✓ Surfaced in conflict detection
- ✗ **Operator UI to edit list** — currently only via direct DB. PRD says "Admin-of-the-instance can edit." Add `app/admin/conventions/page.tsx` plus actions.

---

## §7 Identity

### §7.1 Authentication
- ✓ Email magic link via Resend, 15-min expiry, 30-day session (`lib/auth.ts`)

### §7.2 Onboarding
- ✓ `/onboarding` page with profile form + group browser
- ◐ **Avatar upload** — `/api/upload/sign` returns R2 signed URLs and `r2.ts` enforces mime/size, but no client component does the two-step (sign → PUT → save URL). `ProfileForm` accepts a URL string only. Need an `AvatarUploader` client component.

### §7.3 Profile page
- ✓ Header (avatar, name, pronouns, bio), memberships, friend / block / report (`app/u/[id]/page.tsx`)
- ✗ **Recent attendance** — PRD §7.3 lists this; not surfaced. Would need a section that pulls `RSVP` where `status=GOING` and filters by `attendanceVisibility` through `canSeeWithVisibility`.

### §7.4 Privacy defaults
- ✓ Schema defaults match PRD verbatim

---

## §8 Trust & safety

### §8.1 Visibility scopes
- ✓ `canSeeEvent` handles PUBLIC / MEMBERS / VOUCHED / INVITE
- ✓ Vouch requirement enforced against the live `Vouch` count

### §8.2 Vouching
- ✓ Give / revoke from `VouchButton`, private to voucher+vouchee+admins (`app/_actions/vouches.ts`)
- ◐ **`/settings/vouches`** — link exists in settings nav, page doesn't. Add a page that shows vouches received per group (count only, no identities).

### §8.3 Blocking
- ✓ Bidirectional invisibility (`blockedUserIds` + `canSeeWithVisibility`)
- ✓ Both-GOING flag surfaces in `app/e/[id]/admin/page.tsx`
- ✓ Block list in `/settings/blocks`

### §8.4 Admin notes
- ✓ Server actions (`createAdminNote`, `updateAdminNote`, `deleteAdminNote`)
- ✗ **UI** — no editor component, not embedded in `app/u/[id]/page.tsx` for admin viewers. Need an `AdminNoteEditor` component shown when the viewer admins a group the subject is in.

### §8.5 Safety network
- ✓ Schema + propose/confirm actions (`proposeSafetyNetwork`, `confirmSafetyNetwork`)
- ✗ **UI** — no `/g/[slug]/admin/safety-network` page; no confirmation modal "explains the implications" as required by PRD §8.5.

### §8.6 Friends
- ✓ Request / accept / decline / remove (`app/_actions/friends.ts`)
- ◐ **`/settings/friends`** — settings nav links it; page not built. Easy build — list friendships where status=ACCEPTED + incoming PENDING with Accept/Decline buttons.
- ⚠ **Tension with §7.4** — PRD §8.6 says "Friends can see each other's RSVPs by default" but §7.4 says default `rsvpVisibility = GROUP`. Schema follows §7.4. If the §8.6 reading is canonical, change the default to `FRIENDS` (or add a special-case in `canSeeWithVisibility`).

### §8.7 Incident reporting
- ✓ Submit, routes to admins, audit log, status transitions (`app/_actions/reports.ts`)
- ✓ Reporter notified on status change
- ◐ **Subject-notification 48h cron** — `subjectNotifiedAt` is set at submit time, but no cron actually delivers the notification at that time. Add a cron that finds reports with `subjectNotifiedAt < now AND not yet delivered` and dispatches.
- ✗ **Evidence file upload** — `IncidentReport.evidenceUrls` is in schema; `ReportForm` doesn't include any file pickers. Same uploader pattern as avatar.

### §8.8 Appeals
- ✓ Server actions (`fileAppeal`, `respondToAppeal`)
- ✗ **UI** — `app/reports/appeals/[id]/page.tsx` not built; in-app notifications about admin actions don't include the "request review" button per PRD §8.8.
- ✗ **Route to different admin if exists** — current `respondToAppeal` checks "not your own appeal" only; doesn't enforce "different admin from original action."

### §8.9 Account deletion + data export
- ✓ Soft delete, anonymize displayName, clear sessions (`app/_actions/account.ts`)
- ✓ Hard-delete cron after 30 days
- ✓ JSON export via `/api/me/export`

### §8.10 Data ownership & shutdown plan
- ✗ **In-app terms page** — PRD says this commitment is documented in the in-app terms. No `/terms` route exists.

---

## §9 RSVP

### §9.1 States
- ✓ All 6 states (`RSVPStatus` enum)

### §9.2 Conditional RSVPs
- ✓ "If N others go" and "If specific user goes" both supported in the data layer + `evaluateConditionals` (`lib/conditional-rsvps.ts`)
- ✓ UI accepts conditional-min-attendees (`components/events/rsvp-button.tsx`)
- ✗ **"Conditional on a specific friend" UI** — server-side ready, but the picker on `RSVPButton` only exposes the count variant. Add a user combobox.
- ✗ **Aggregate display** — "8 people will commit if 5 others do" is not rendered on `app/e/[id]/page.tsx`. The data is queryable from `RSVP where status=CONDITIONAL`.

### §9.3 Plus-ones
- ✓ Per-event toggle, counts against capacity (`statusForNewGoing`)

### §9.4 Attendance overlap data
- ✓ Nightly cron computes pairwise overlap (`lib/attendance-overlap.ts`)
- ✓ Surfaced in conflict warnings

### §9.5 Waitlists
- ✓ Auto-promote on GOING → NOT_GOING and on capacity-change (`lib/waitlist.ts`)
- ✓ Position visible to user; admin sees full list in `app/e/[id]/admin/page.tsx`

---

## §10 Ingestion

### §10.1 Paste-to-event
- ✓ `PasteToEvent` component + `/api/llm/extract-text` + Claude Sonnet prompt
- ✓ Pre-fills `EventForm` for review

### §10.2 Image OCR
- ✓ `ImageToEvent` component + `/api/llm/extract-image` + Claude Sonnet vision
- ◐ **Persist uploaded flyer as `flyerImageUrl`** — image is sent to LLM but not stored. Need to also push to R2 and pass the URL into the pre-filled `EventForm`.

### §10.3 Announcement generation
- ✓ 5-platform bundle via Sonnet, tabs with copy buttons (`AnnouncementGenerator`)

### §10.4 LLM cost / guardrails
- ✓ 10k char cap on text extraction
- ✓ Per-user 50/day rate limit via `LLMRateLimit` table
- ✗ **Monthly $50 project budget** — documented in `.env.example` as `LLM_MONTHLY_BUDGET_USD` but not enforced. Would need a monthly aggregate counter + admin alert.

---

## §11 Intelligence

### §11.1 NL admin assistant
- ✓ `/api/llm/assistant` endpoint with system prompt + group/conventions context
- ✗ **Sidebar UI on event creation page** — endpoint works; nothing on `app/e/new/page.tsx` exposes it. Add a right-rail component that POSTs to `/api/llm/assistant` and shows date-pill suggestions.

### §11.2 Member recommendations
- ✓ Heuristic scorer (`lib/recommendations.ts`) — group +3, friend GOING +2, friend INTERESTED +1, tag match +1, ≤30mi +1
- ✓ "For you" feed on `/`

### §11.3 Weekly digest
- ✓ Cron fires Thursday 16:00 UTC, dispatches per-user digest with in-app + email
- ◐ **9am user-local time** — currently a single UTC fire. To match PRD, either run hourly and filter by user timezone, or partition users into hourly buckets.

### §11.4 Admin signals dashboard
- ✗ **Not built.** Backend has the data (`AttendanceOverlap`, `RSVP` history) but no `/g/[slug]/admin/signals` page, no chart component, no opt-in modal.

---

## §12 Logistics

### §12.1 Map view
- ✓ Mapbox GL JS, color-coded pins, popup links (`/map`)
- ✓ Filters by visibility through `filterVisibleEvents`
- ✗ **Filter chips on map page** — same as calendar; not yet wired to the map page

### §12.2 Travel estimates
- ✓ `/api/mapbox/directions` with 7-day cache
- ✗ **UI on event detail page** — endpoint exists; `app/e/[id]/page.tsx` doesn't fetch or display. Add a small client component that fetches on mount when the user has `homeLat/Lng` set.

### §12.3 Carpooling
- ✓ Offer / request / match server actions (`app/_actions/carpool.ts`)
- ✗ **UI on event detail page** — no buttons, no list. Need an "Offer a ride" / "Request a ride" panel rendered to logged-in users with permission to see the event.

### §12.4 Venue notes
- ✓ Location model is first-class; `updateVenueNotes` action with admin-of-hosting-group check
- ✗ **UI** — event detail page shows address but not `venueNotes`; no editor for admins.

### §12.5 Accessibility flags
- ✓ Fixed enum, settable on `EventForm`, displayed as badges on event detail
- ✗ **Filter on calendar/map** — not wired

---

## §13 UI structure

Pages built:
- `/`, `/login`, `/verify`, `/onboarding`
- `/calendar`, `/map`
- `/groups`, `/groups/new`, `/g/[slug]`, `/g/[slug]/admin`
- `/e/new`, `/e/new/from-text`, `/e/new/from-image`, `/e/[id]`, `/e/[id]/edit`, `/e/[id]/admin`
- `/u/[id]`, `/me`
- `/settings`, `/settings/privacy`, `/settings/notifications`, `/settings/blocks`, `/settings/calendar-feeds`, `/settings/export`, `/settings/delete`
- `/reports`, `/reports/new`, `/reports/[id]`
- `/notifications`

Pages stubbed in nav but not built:
- `/settings/friends`
- `/settings/vouches`
- `/g/[slug]/admin/{safety-network,signals}` — `/g/[slug]/admin` is one big page today; PRD suggests sub-pages
- `/reports/appeals/[id]`
- `/admin/conventions` (instance admin only)
- `/terms` (§8.10)

Top-bar **search** is referenced in PRD §13 but not implemented.

---

## §14 Notifications

All 9 triggers fire through `lib/notifications.ts` `dispatch()`:
- ✓ Friend request, friend accepted, vouch received, event updated, event cancelled, waitlist promoted, conditional triggered, admin action, report status, weekly digest, join request, report filed
- ✓ Per-category in-app / email toggles in `/settings/notifications`
- ◐ **"Admin action against your account" body includes appeal link** — text mentions it but no actual link to a build-an-appeal flow (depends on §8.8 UI)

---

## §15 Operational

- ✓ Cron schedule in `vercel.json`
- ✓ Open source — AGPL-3.0 + README self-host instructions
- ✗ **Sentry wiring** — PRD mentions; not configured
- ✗ **Monthly DB-export-to-R2** — not implemented as cron

---

## §17 Definition-of-done checklist

| Item | State |
|---|---|
| 5 admins can create groups + events | ✓ build allows it |
| Members sign up, join, RSVP, see calendar | ✓ |
| Conflict detection across groups | ✓ |
| Soft-claims work + expire | ✓ |
| Blocking end-to-end | ✓ |
| Visibility scopes gate access | ✓ |
| Incident reports filed + processed | ◐ — submit/transition done; evidence upload + appeals UI missing |
| Paste-to-event ≥80% accuracy | untested — need real ANTHROPIC_API_KEY against real flyers |
| Map renders all events | ✓ |
| iCal export | ✓ |
| Account deletion + anonymization | ✓ |
| Deployed at real domain | ✗ — code only |

---

## Top 10 highest-leverage next tasks

Ranked by **value × cheapness** (data layer already in place):

1. **`/settings/friends` page** — friendships data + actions exist; pure UI.
2. **`/settings/vouches` page** — same, pure UI.
3. **Admin-notes UI** on `/u/[id]` — embed an editor visible only to admins of groups the subject is in.
4. **Carpool panel** on `/e/[id]` — render the offers/requests, wire "match" button.
5. **Travel-estimate widget** on `/e/[id]` — call `/api/mapbox/directions` from a client component.
6. **Avatar / flyer / evidence upload** — single `<Uploader kind="…">` client component used in 3 places; sign URL endpoint already exists.
7. **NL assistant sidebar** on `/e/new` — endpoint exists; needs a textarea + suggestion-pill UI.
8. **`/reports/appeals/[id]`** page + "request review" button on admin-action notifications.
9. **Admin signals dashboard** — opt-in modal + 3 widgets (overlap, trend, "stopped attending" count).
10. **Calendar filter chips for RSVP status + accessibility** — small change to `FilterChips` + query in `app/calendar/page.tsx`.

After those ten, the remaining gaps are mostly the "polish" phase from PRD §16 — accessibility audit, mobile responsive review, perf pass.
