// Auth.js v5 — magic link via Resend.
// All auth checks in the app go through lib/auth-helpers.ts;
// this file is config only.
import NextAuth, { type NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { renderMagicLinkEmail } from "@/lib/email/templates/magic-link";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(db),
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login", verifyRequest: "/verify", newUser: "/onboarding" },
  providers: [
    // Discord OAuth — optional; only registered when env vars are present so
    // local dev doesn't need them. Furry-community-focused communities have
    // strong existing Discord identity, so this is a natural primary OAuth.
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? [
          Discord({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            // Pull only the identity fields we need. Email is required for
            // our user model; the user can revoke at Discord any time.
            authorization: { params: { scope: "identify email" } },
            profile(p: { id: string; username: string; email: string | null; avatar: string | null }) {
              const avatarUrl = p.avatar
                ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png`
                : null;
              return {
                id: p.id,
                name: p.username,
                email: p.email,
                image: avatarUrl,
                displayName: p.username,
                avatarUrl,
              };
            },
          }),
        ]
      : []),
    {
      id: "email",
      name: "Email",
      type: "email",
      maxAge: 15 * 60, // §7.1 — 15-minute expiry
      from: process.env.EMAIL_FROM ?? "Convene <noreply@example.com>",
      server: {},
      options: {},
      sendVerificationRequest: async ({ identifier, url }) => {
        // Anti-spam: 1 magic link per minute, 5 per hour, per email.
        try {
          await rateLimit(`magic-min:${identifier.toLowerCase()}`, 1, 60_000, "Wait a minute before requesting another link.");
          await rateLimit(`magic-hr:${identifier.toLowerCase()}`, 5, 60 * 60_000, "Too many sign-in requests — try again in an hour.");
        } catch (e) {
          if (e instanceof RateLimitError) {
            // Swallow silently so we don't leak email-existence to attackers.
            console.warn("[auth] magic-link rate-limited", identifier);
            return;
          }
          throw e;
        }
        const { subject, html, text } = renderMagicLinkEmail({ url });
        await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "Convene <noreply@example.com>",
          to: identifier,
          subject,
          html,
          text,
        });
      },
    },
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
