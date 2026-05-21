import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { markAllRead } from "@/app/_actions/notifications";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { formatDistanceToNow } from "date-fns";

async function markAllReadAction() {
  "use server";
  await markAllRead();
}

export default async function NotificationsPage() {
  const me = await requireUser();
  const items = await db.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <form action={markAllReadAction}>
          <Button size="sm" variant="outline" type="submit">Mark all read</Button>
        </form>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Friend requests, event updates, vouches, and digest emails show up here."
          cta={{ label: "Browse the calendar", href: "/calendar" }}
        />
      ) : (
      <ul className="divide-y rounded-md border">
        {items.map((n) => (
          <li key={n.id} className={`p-3 text-sm ${n.readAt ? "opacity-60" : ""}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{n.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(n.createdAt, { addSuffix: true })}</span>
            </div>
            <p className="text-xs text-muted-foreground">{n.body}</p>
            {n.link && <Link href={n.link} className="text-xs text-primary hover:underline">Open</Link>}
          </li>
        ))}
      </ul>
      )}
    </section>
  );
}
