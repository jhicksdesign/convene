import Link from "next/link";
import { Bell, Calendar, Map, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { signOut } from "@/lib/auth";
import { TopBarSearch } from "@/components/layout/search";
import { NotificationBadge } from "@/components/layout/notification-badge";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/" });
}

export async function TopBar() {
  const user = await getCurrentUser();
  const unread = user
    ? await db.notification.count({ where: { userId: user.id, readAt: null } })
    : 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">Convene</Link>
          {user && (
            <nav className="hidden gap-4 text-sm md:flex">
              <Link href="/calendar" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Calendar className="h-4 w-4" /> Calendar
              </Link>
              <Link href="/map" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Map className="h-4 w-4" /> Map
              </Link>
              <Link href="/groups" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                <Users className="h-4 w-4" /> Groups
              </Link>
            </nav>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user && <TopBarSearch />}
          {user ? (
            <>
              <Link href="/notifications" aria-label="Notifications">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-4 w-4" />
                  <NotificationBadge count={unread} />
                </Button>
              </Link>
              <Link href="/me" aria-label="My profile">
                <Button variant="ghost" size="icon"><User className="h-4 w-4" /></Button>
              </Link>
              <form action={signOutAction}>
                <Button variant="ghost" size="sm" type="submit">Sign out</Button>
              </form>
            </>
          ) : (
            <Link href="/login"><Button size="sm">Sign in</Button></Link>
          )}
        </div>
      </div>
    </header>
  );
}
