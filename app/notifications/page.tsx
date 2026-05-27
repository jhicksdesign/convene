import Link from "next/link";
import { Bell, Check, X } from "lucide-react";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { markAllRead } from "@/app/_actions/notifications";
import { approveJoinRequest, declineJoinRequest } from "@/app/_actions/groups";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { formatDistanceToNow } from "date-fns";

async function markAllReadAction() {
  "use server";
  await markAllRead();
}

export default async function NotificationsPage() {
  const me = await requireUser();

  const adminRows = await db.membership.findMany({
    where: { userId: me.id, role: "ADMIN" },
    select: { groupId: true },
  });
  const adminGroupIds = adminRows.map((r) => r.groupId);

  const pendingRequests = adminGroupIds.length
    ? await db.joinRequest.findMany({
        where: { groupId: { in: adminGroupIds }, status: "PENDING" },
        include: { group: { select: { name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const requesterIds = pendingRequests.map((r) => r.userId);
  const requesters = requesterIds.length
    ? await db.user.findMany({
        where: { id: { in: requesterIds } },
        select: { id: true, displayName: true, avatarUrl: true },
      })
    : [];
  const requesterMap = new Map(requesters.map((u) => [u.id, u]));

  const items = await db.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <form action={markAllReadAction}>
          <Button size="sm" variant="outline" type="submit">Mark all read</Button>
        </form>
      </div>

      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Pending requests
          </h2>
          <ul className="divide-y rounded-md border">
            {pendingRequests.map((r) => {
              const user = requesterMap.get(r.userId);
              const approve = approveJoinRequest.bind(null, r.id);
              const decline = declineJoinRequest.bind(null, r.id);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  {user?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <span className="font-medium">{user?.displayName ?? "Someone"}</span>
                      <span className="text-muted-foreground"> wants to join </span>
                      <Link href={`/g/${r.group.slug}`} className="font-medium hover:underline">
                        {r.group.name}
                      </Link>
                    </div>
                    {r.message && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">"{r.message}"</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <form action={approve}>
                      <Button size="sm" type="submit" className="gap-1">
                        <Check className="h-3.5 w-3.5" /> Accept
                      </Button>
                    </form>
                    <form action={decline}>
                      <Button size="sm" variant="ghost" type="submit" className="gap-1 text-muted-foreground">
                        <X className="h-3.5 w-3.5" /> Decline
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {items.length === 0 && pendingRequests.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Friend requests, event updates, vouches, and digest emails show up here."
          cta={{ label: "Browse the calendar", href: "/calendar" }}
        />
      ) : items.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {items.map((n) => (
            <li key={n.id} className={`p-3 text-sm ${n.readAt ? "opacity-60" : ""}`}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{n.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(n.createdAt, { addSuffix: true })}</span>
              </div>
              <p className="text-xs text-muted-foreground">{n.body}</p>
              {n.link && n.category !== "JOIN_REQUEST" && (
                <Link href={n.link} className="text-xs text-primary hover:underline">Open</Link>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
