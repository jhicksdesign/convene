import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage() {
  const me = await requireUser();
  const u = await db.user.findUnique({
    where: { id: me.id },
    select: {
      displayName: true, pronouns: true, bio: true, avatarUrl: true,
      timezone: true, homeLat: true, homeLng: true,
    },
  });
  if (!u) return null;

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link href="/settings" className="font-medium underline">Profile</Link>
        <Link href="/settings/privacy" className="text-muted-foreground hover:underline">Privacy</Link>
        <Link href="/settings/notifications" className="text-muted-foreground hover:underline">Notifications</Link>
        <Link href="/settings/friends" className="text-muted-foreground hover:underline">Friends</Link>
        <Link href="/settings/vouches" className="text-muted-foreground hover:underline">Vouches</Link>
        <Link href="/settings/blocks" className="text-muted-foreground hover:underline">Blocks</Link>
        <Link href="/settings/calendar-feeds" className="text-muted-foreground hover:underline">Calendar feeds</Link>
        <Link href="/settings/export" className="text-muted-foreground hover:underline">Export data</Link>
        <Link href="/settings/delete" className="text-destructive hover:underline">Delete account</Link>
      </nav>
      <ProfileForm initial={u} />
    </section>
  );
}
