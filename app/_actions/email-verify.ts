"use server";

import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { renderVerifyEmail } from "@/lib/email/templates/verify-email";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";

// VerificationToken rows use the standard Auth.js shape; prefix the identifier
// so this flow doesn't collide with magic-link sign-in tokens.
const IDENTIFIER_PREFIX = "email-change:";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  if (!process.env.RESEND_API_KEY) return null;
  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const emailSchema = z.string().email().max(254).transform((s) => s.trim().toLowerCase());

export async function requestEmailVerify(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireUser();
  const parse = emailSchema.safeParse(input);
  if (!parse.success) return { ok: false, error: "That doesn't look like a valid email." };
  const email = parse.data;

  try {
    await rateLimit(`verify-email:${me.id}`, 3, 60 * 60_000, "Too many verification attempts. Try again in an hour.");
  } catch (e) {
    if (e instanceof RateLimitError) return { ok: false, error: e.message };
    throw e;
  }

  // If another account already owns this email, bail. Merging is out of scope.
  const existing = await db.user.findUnique({ where: { email } });
  if (existing && existing.id !== me.id) {
    return { ok: false, error: "That email is already linked to another account." };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  // Store the pending email alongside the token by encoding it in identifier.
  // Format: "email-change:<userId>:<newEmail>"
  const identifier = `${IDENTIFIER_PREFIX}${me.id}:${email}`;

  // Replace any prior pending verification for this user.
  await db.verificationToken.deleteMany({ where: { identifier: { startsWith: `${IDENTIFIER_PREFIX}${me.id}:` } } });
  await db.verificationToken.create({ data: { identifier, token: tokenHash, expires } });

  const baseUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  const url = `${baseUrl}/verify-email?token=${token}`;

  const resend = getResend();
  if (resend) {
    const { subject, html, text } = renderVerifyEmail({ url });
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "Eventide <noreply@example.com>",
      to: email,
      subject,
      html,
      text,
    });
  } else {
    console.warn("[email-verify] RESEND_API_KEY not set — verification email not sent");
  }

  return { ok: true };
}

/**
 * Confirm a verification token from the email link. Validates the token,
 * updates the user's email, and sets emailVerified.
 *
 * Called from app/verify-email/page.tsx — redirects on success/failure.
 */
export async function confirmEmailVerify(token: string): Promise<void> {
  if (!token || typeof token !== "string") redirect("/settings/email?error=invalid");

  const tokenHash = hashToken(token);
  const row = await db.verificationToken.findFirst({
    where: { token: tokenHash, identifier: { startsWith: IDENTIFIER_PREFIX } },
  });
  if (!row) redirect("/settings/email?error=invalid");
  if (row.expires < new Date()) {
    await db.verificationToken.delete({ where: { token: tokenHash } });
    redirect("/settings/email?error=expired");
  }

  // Identifier format: "email-change:<userId>:<newEmail>"
  const rest = row.identifier.slice(IDENTIFIER_PREFIX.length);
  const colon = rest.indexOf(":");
  if (colon < 0) redirect("/settings/email?error=invalid");
  const userId = rest.slice(0, colon);
  const newEmail = rest.slice(colon + 1);

  // Re-check that nobody else has claimed this email in the meantime.
  const conflict = await db.user.findUnique({ where: { email: newEmail } });
  if (conflict && conflict.id !== userId) {
    await db.verificationToken.delete({ where: { token: tokenHash } });
    redirect("/settings/email?error=taken");
  }

  await db.user.update({
    where: { id: userId },
    data: { email: newEmail, emailVerified: new Date() },
  });
  await db.verificationToken.delete({ where: { token: tokenHash } });

  revalidatePath("/settings/email");
  redirect("/settings/email?ok=1");
}
