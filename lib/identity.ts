// Progressive identity helpers.
//
// Telegram-only users get a recognizable placeholder email so the rest of the
// app (where User.email is a required string) keeps working. `emailVerified` is
// the source of truth for "this user has a real, deliverable email" — never
// inspect the email string for verification purposes.

const PLACEHOLDER_DOMAIN = "users.telegram.eventide.events";

export function placeholderEmailFor(sub: string | number): string {
  return `tg_${sub}@${PLACEHOLDER_DOMAIN}`;
}

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return email.endsWith(`@${PLACEHOLDER_DOMAIN}`);
}

export function hasRealEmail(user: { email: string | null; emailVerified: Date | null }): boolean {
  return !!user.emailVerified && !isPlaceholderEmail(user.email);
}
