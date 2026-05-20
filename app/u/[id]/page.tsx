import { notFound, forbidden } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import { canSeeWithVisibility, blockedUserIds } from "@/lib/visibility";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileActions } from "@/components/profile/profile-actions";
import { AdminNoteEditor } from "@/components/safety/admin-note-editor";
import { variants } from "@/lib/cf-images";

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getCurrentUser();
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true, displayName: true, avatarUrl: true, pronouns: true, bio: true,
      profileVisibility: true, attendanceVisibility: true, deletedAt: true,
      memberships: { include: { group: { select: { id: true, name: true, color: true, slug: true } } } },
    },
  });
  if (!user || user.deletedAt) notFound();

  const visibleProfile = await canSeeWithVisibility(me?.id ?? null, user.id, user.profileVisibility);
  if (!visibleProfile) forbidden();

  // Friend / block state
  let friendState: "none" | "pending_outgoing" | "pending_incoming" | "accepted" = "none";
  let isBlocked = false;
  if (me) {
    const [a, b] = me.id < user.id ? [me.id, user.id] : [user.id, me.id];
    const f = await db.friendship.findUnique({ where: { userAId_userBId: { userAId: a, userBId: b } } });
    if (f) {
      if (f.status === "ACCEPTED") friendState = "accepted";
      else if (f.status === "PENDING") friendState = f.initiatorId === me.id ? "pending_outgoing" : "pending_incoming";
    }
    const blocks = await blockedUserIds(me.id);
    isBlocked = blocks.has(user.id);
  }

  // Recent attendance (§7.3) — visible only if `attendanceVisibility` allows the viewer.
  const canSeeAttendance = await canSeeWithVisibility(me?.id ?? null, user.id, user.attendanceVisibility);
  const recentAttendance = canSeeAttendance
    ? await db.rSVP.findMany({
        where: { userId: user.id, status: "GOING", event: { startsAt: { lt: new Date() } } },
        include: {
          event: {
            select: {
              id: true, title: true, startsAt: true,
              owningGroup: { select: { name: true, color: true } },
            },
          },
        },
        orderBy: { event: { startsAt: "desc" } },
        take: 8,
      })
    : [];

  // Admin-note panels: one per group where the viewer admins AND the subject is a member.
  const subjectGroupIds = user.memberships.map((m) => m.groupId);
  const adminPanels = me
    ? await db.membership.findMany({
        where: { userId: me.id, role: "ADMIN", groupId: { in: subjectGroupIds } },
        include: { group: { select: { id: true, name: true, color: true } } },
      })
    : [];

  const notesByGroup = adminPanels.length
    ? await db.adminNote.findMany({
        where: { subjectUserId: user.id, groupId: { in: adminPanels.map((p) => p.groupId) } },
        include: { author: { select: { displayName: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-start gap-4">
        <Avatar className="h-16 w-16">
          {user.avatarUrl && <AvatarImage src={variants.avatarLarge(user.avatarUrl) ?? user.avatarUrl} alt={user.displayName} />}
          <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{user.displayName}</h1>
          {user.pronouns && <p className="text-sm text-muted-foreground">{user.pronouns}</p>}
          {user.bio && <p className="mt-2 text-sm">{user.bio}</p>}
        </div>
        {me && me.id !== user.id && (
          <ProfileActions otherUserId={user.id} friendState={friendState} isBlocked={isBlocked} />
        )}
      </header>
      <div className="flex flex-wrap gap-1.5">
        {user.memberships.map((m) => (
          <span key={m.id} className="rounded-full px-2 py-0.5 text-xs text-white" style={{ backgroundColor: m.group.color }}>
            {m.group.name}
          </span>
        ))}
      </div>
      {recentAttendance.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent attendance</h2>
          <ul className="mt-2 divide-y rounded-md border">
            {recentAttendance.map((r) => (
              <li key={r.id} className="flex items-center gap-2 p-2 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.event.owningGroup.color }} />
                <span className="truncate">{r.event.title}</span>
                <span className="ml-auto text-xs text-muted-foreground">{r.event.startsAt.toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {adminPanels.length > 0 && (
        <div className="space-y-4">
          {adminPanels.map((p) => (
            <AdminNoteEditor
              key={p.groupId}
              subjectUserId={user.id}
              group={p.group}
              notes={notesByGroup
                .filter((n) => n.groupId === p.groupId)
                .map((n) => ({
                  id: n.id,
                  body: n.body,
                  shareWithSafetyNetwork: n.shareWithSafetyNetwork,
                  createdAt: n.createdAt.toISOString(),
                  authorDisplayName: n.author.displayName,
                }))}
            />
          ))}
        </div>
      )}
    </section>
  );
}
