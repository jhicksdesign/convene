// Single fan-out point for all notifications (PRD §14).
// Server actions never call email/db directly; they call dispatch().
import { db } from "@/lib/db";
import { Resend } from "resend";
import type { NotificationCategory } from "@prisma/client";
import { pushTo } from "@/lib/web-push";
import { hasRealEmail } from "@/lib/identity";
import { sendBotMessage } from "@/lib/telegram-bot";

// Lazy-init: see lib/auth.ts for the same pattern + rationale.
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  if (!process.env.RESEND_API_KEY) return null;
  _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

interface DispatchArgs {
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  link?: string;
  email?: { subject: string; html: string; text: string };
}

interface UserPrefs {
  digestOptIn: boolean;
  channels: Partial<Record<NotificationCategory, { inApp?: boolean; email?: boolean }>>;
}

async function loadPrefs(userId: string): Promise<UserPrefs> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { digestOptIn: true, notificationPrefs: true, email: true },
  });
  return {
    digestOptIn: u?.digestOptIn ?? true,
    channels: (u?.notificationPrefs as UserPrefs["channels"]) ?? {},
  };
}

function defaultsFor(category: NotificationCategory): { inApp: boolean; email: boolean } {
  // Everything in-app on; email on for high-signal categories per §14.
  const emailOn: NotificationCategory[] = [
    "FRIEND_REQUEST",
    "VOUCH_RECEIVED",
    "EVENT_CANCELLED",
    "WAITLIST_PROMOTED",
    "ADMIN_ACTION",
    "REPORT_STATUS",
    "WEEKLY_DIGEST",
  ];
  return { inApp: true, email: emailOn.includes(category) };
}

export async function dispatch(args: DispatchArgs): Promise<void> {
  const prefs = await loadPrefs(args.userId);
  const def = defaultsFor(args.category);
  const channels = prefs.channels[args.category] ?? {};
  const wantInApp = channels.inApp ?? def.inApp;
  const wantEmail = channels.email ?? def.email;

  let emailedAt: Date | null = null;
  let emailDelivered = false;
  if (wantEmail && args.email) {
    const user = await db.user.findUnique({
      where: { id: args.userId },
      select: { email: true, emailVerified: true },
    });
    const resend = getResend();
    if (resend && user && hasRealEmail(user)) {
      try {
        await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "Eventide <noreply@example.com>",
          to: user.email,
          subject: args.email.subject,
          html: args.email.html,
          text: args.email.text,
        });
        emailedAt = new Date();
        emailDelivered = true;
      } catch (err) {
        console.error("[notifications.dispatch] email failed", err);
      }
    }
  }

  // Telegram bot DM as the outbound fallback when email isn't available.
  // Falls back when the user has no verified email OR when the email send
  // didn't make it out (Resend unset, transient failure, etc.).
  if (wantEmail && !emailDelivered) {
    const tg = await db.account.findFirst({
      where: { userId: args.userId, provider: "telegram" },
      select: { providerAccountId: true },
    });
    if (tg) {
      const link = args.link
        ? `${process.env.AUTH_URL ?? ""}${args.link.startsWith("/") ? args.link : `/${args.link}`}`
        : undefined;
      await sendBotMessage(tg.providerAccountId, `${args.title}\n${args.body}`, link);
    }
  }

  if (wantInApp) {
    await db.notification.create({
      data: {
        userId: args.userId,
        category: args.category,
        title: args.title,
        body: args.body,
        link: args.link ?? null,
        emailedAt,
      },
    });
  }

  // Web Push — best-effort, never blocks. Subscriptions are user-opt-in via
  // the subscribe button on /settings/notifications; if the user hasn't
  // subscribed this is a quick DB lookup that finds nothing.
  await pushTo(args.userId, {
    title: args.title,
    body: args.body,
    url: args.link,
  });
}

export async function dispatchMany(userIds: string[], args: Omit<DispatchArgs, "userId">): Promise<void> {
  await Promise.all(userIds.map((userId) => dispatch({ ...args, userId })));
}
