import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NotificationPrefs } from "@/components/settings/notification-prefs";
import { PushSubscribe } from "@/components/notifications/push-subscribe";

export default async function NotificationSettingsPage() {
  const me = await requireUser();
  const u = await db.user.findUnique({
    where: { id: me.id },
    select: { notificationPrefs: true },
  });
  const initial = (u?.notificationPrefs as Record<string, { inApp: boolean; email: boolean }>) ?? {};
  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      <NotificationPrefs initial={initial} />
      <PushSubscribe vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
    </section>
  );
}
