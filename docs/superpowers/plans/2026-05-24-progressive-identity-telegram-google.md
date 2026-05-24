# Progressive Identity: Telegram + Google Sign-In

**Goal:** Add Google OAuth and Telegram OIDC as sign-in providers alongside the existing Discord OAuth + magic-link email. Adopt a "progressive identity" model where users can sign in via any provider and only need to verify an email when they hit a feature that needs one.

**Architecture:**
- **No schema migration.** Telegram-only users get a recognizable placeholder email (`tg_<sub>@users.telegram.eventide.events`) so `User.email String @unique` stays as-is. `User.emailVerified` is the source of truth for "has a real, deliverable email." This avoids touching every email-assuming code path.
- **Telegram chat ID for bot DMs** comes from `Account.providerAccountId` (Telegram's `sub` claim IS the user/chat ID). No `User.telegramChatId` column needed.
- **Soft email gates**, not hard gates. Login is one tap. Email collection happens at the moment a feature needs it (event create, ICS, private-group join, data export).

**Tech Stack:** Auth.js v5 (Google built-in provider + custom Telegram OIDC), Prisma, Resend (unchanged), Telegram Bot API for outbound DMs.

---

## File map

- Create: `lib/identity.ts` — `hasRealEmail`, `isPlaceholderEmail`, `placeholderEmailFor(sub)`
- Create: `lib/telegram-bot.ts` — `sendBotMessage(chatId, text)` via Bot API
- Create: `app/settings/email/page.tsx` — "Add / verify / change email" UI
- Create: `app/_actions/email-verify.ts` — `requestEmailVerify(email)` + `confirmEmailVerify(token)`
- Create: `lib/email/templates/verify-email.ts`
- Create: `components/auth/provider-buttons.tsx` — branded Google/Telegram/Discord buttons
- Modify: `lib/auth.ts` — add Google + Telegram providers, capture id_token sub safely
- Modify: `lib/auth-helpers.ts` — add `requireVerifiedEmail()`
- Modify: `lib/notifications.ts` — Telegram DM fallback when no verified email
- Modify: `app/login/page.tsx` — 4-provider stack with email at the bottom
- Modify: `app/onboarding/page.tsx` — soft "Add email" panel for placeholder users
- Modify: `app/settings/delete/page.tsx` + `components/settings/delete-account.tsx` — handle placeholder gracefully
- Modify: `app/api/me/export/route.ts` (data export) — gate behind `requireVerifiedEmail`
- Modify: `app/_actions/events.ts` (create only) — gate behind `requireVerifiedEmail`
- Modify: `app/_actions/groups.ts` (join private) — gate behind `requireVerifiedEmail`
- Modify: `lib/ical.ts` (token mint side) — gate behind `requireVerifiedEmail`

## Env vars added
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `TELEGRAM_CLIENT_ID`, `TELEGRAM_CLIENT_SECRET`
- `TELEGRAM_BOT_TOKEN`

All optional — if absent, that provider's button doesn't render.

## Login UI direction

Editorial stack matching the existing card aesthetic: each OAuth provider as a full-width pill with its brand color and icon, ordered Google → Telegram → Discord (audience priority), then a Fraunces small-caps "or email a magic link" divider, then the email form. No "more options" hide — five visible affordances is fine when each one is a single-tap action with a familiar logo.

## Verification flow

Reuses Auth.js's existing `VerificationToken` table. `requestEmailVerify(email)` creates a token + Resend-sends a confirmation link to `/verify-email?token=...`. The route handler validates, updates `User.email` (in case it changed) and `User.emailVerified = now()`, then redirects to `/settings/email?ok=1`.

If the email being claimed already belongs to another User row (e.g. they previously signed up via magic-link with the same address), we abort with "this email is already linked to another account — sign in to that one and connect Telegram from settings." Account merge is out of scope for v1.

## Notification dispatch

`dispatch()` decision tree per user:
1. In-app: always written if `wantInApp`.
2. Web push: always best-effort (unchanged).
3. Outbound message:
   - If `user.emailVerified && wantEmail` → Resend email.
   - Else if user has a connected Telegram account → `sendBotMessage(account.providerAccountId, body)`.
   - Else: nothing (in-app + push are enough).

Bot DM is only attempted when email is unavailable, so verified-email users still get email by default and aren't double-pinged.
