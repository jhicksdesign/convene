// Auth.js v5 — magic link via Resend.
// All auth checks in the app go through lib/auth-helpers.ts;
// this file is config only.
import NextAuth, { type NextAuthConfig } from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "@auth/core/adapters";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { renderMagicLinkEmail } from "@/lib/email/templates/magic-link";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";

// Lazy-init the Resend client (see Dockerfile build-time considerations).
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  if (!process.env.RESEND_API_KEY) return null;
  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

// Custom adapter wrapping PrismaAdapter so OAuth user creation maps Auth.js's
// standard fields (`name`, `image`) to our schema columns (`displayName`,
// `avatarUrl`). The default PrismaAdapter assumes a User model with name/image
// columns; our schema uses the convention names that match the rest of the app.
const base = PrismaAdapter(db);
// Explicitly reference each inherited method (no spread) so there's no doubt
// about which methods get overridden. Logs prefixed with [adapter] confirm
// our custom code is actually running in production.
const adapter: Adapter = {
  // Inherited from PrismaAdapter unchanged
  createSession: base.createSession!.bind(base),
  getSessionAndUser: base.getSessionAndUser!.bind(base),
  updateSession: base.updateSession!.bind(base),
  deleteSession: base.deleteSession!.bind(base),
  linkAccount: base.linkAccount!.bind(base),
  unlinkAccount: base.unlinkAccount?.bind(base),
  createVerificationToken: base.createVerificationToken?.bind(base),
  useVerificationToken: base.useVerificationToken?.bind(base),
  deleteUser: base.deleteUser?.bind(base),
  // Our overrides: map Auth.js standard {name, image} → our {displayName, avatarUrl}
  async createUser(user) {
    console.log("[adapter] createUser", { email: user.email, hasName: !!user.name });
    const created = await db.user.create({
      data: {
        email: user.email,
        emailVerified: user.emailVerified,
        displayName: user.name ?? user.email.split("@")[0] ?? "User",
        avatarUrl: user.image ?? null,
      },
    });
    return {
      id: created.id,
      email: created.email,
      emailVerified: created.emailVerified,
      name: created.displayName,
      image: created.avatarUrl,
    } satisfies AdapterUser;
  },
  async getUser(id) {
    const u = await db.user.findUnique({ where: { id } });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      emailVerified: u.emailVerified,
      name: u.displayName,
      image: u.avatarUrl,
    };
  },
  async getUserByEmail(email) {
    const u = await db.user.findUnique({ where: { email } });
    if (!u) return null;
    return {
      id: u.id,
      email: u.email,
      emailVerified: u.emailVerified,
      name: u.displayName,
      image: u.avatarUrl,
    };
  },
  async getUserByAccount({ provider, providerAccountId }) {
    const acc = await db.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });
    if (!acc) return null;
    return {
      id: acc.user.id,
      email: acc.user.email,
      emailVerified: acc.user.emailVerified,
      name: acc.user.displayName,
      image: acc.user.avatarUrl,
    };
  },
  async updateUser(user) {
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        emailVerified: user.emailVerified,
        ...(user.name !== undefined && { displayName: user.name ?? "User" }),
        ...(user.image !== undefined && { avatarUrl: user.image }),
      },
    });
    return {
      id: updated.id,
      email: updated.email,
      emailVerified: updated.emailVerified,
      name: updated.displayName,
      image: updated.avatarUrl,
    };
  },
};

export const authConfig: NextAuthConfig = {
  adapter,
  session: { strategy: "database", maxAge: 30 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  pages: { signIn: "/login", verifyRequest: "/verify", newUser: "/onboarding" },
  providers: [
    ...(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET
      ? [
          Discord({
            clientId: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            authorization: { params: { scope: "identify email" } },
            profile(p: { id: string; username: string; email: string | null; avatar: string | null }) {
              const avatarUrl = p.avatar
                ? `https://cdn.discordapp.com/avatars/${p.id}/${p.avatar}.png`
                : null;
              // Return only Auth.js standard fields; the custom adapter above
              // maps these to our schema columns on create.
              return {
                id: p.id,
                name: p.username,
                email: p.email,
                image: avatarUrl,
              };
            },
          }),
        ]
      : []),
    {
      id: "email",
      name: "Email",
      type: "email",
      maxAge: 15 * 60,
      from: process.env.EMAIL_FROM ?? "Eventide <noreply@example.com>",
      server: {},
      options: {},
      sendVerificationRequest: async ({ identifier, url }) => {
        try {
          await rateLimit(`magic-min:${identifier.toLowerCase()}`, 1, 60_000, "Wait a minute before requesting another link.");
          await rateLimit(`magic-hr:${identifier.toLowerCase()}`, 5, 60 * 60_000, "Too many sign-in requests — try again in an hour.");
        } catch (e) {
          if (e instanceof RateLimitError) {
            console.warn("[auth] magic-link rate-limited", identifier);
            return;
          }
          throw e;
        }
        const resend = getResend();
        if (!resend) {
          console.warn("[auth] RESEND_API_KEY not set — magic link not sent", identifier);
          return;
        }
        const { subject, html, text } = renderMagicLinkEmail({ url });
        await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "Eventide <noreply@example.com>",
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
