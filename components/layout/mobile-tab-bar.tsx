"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Home, LogIn, Map, Sparkles, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  // When set, the link's href is computed dynamically from the current pathname
  // (used by the unauth "Sign in" tab to carry a callbackUrl back here).
  dynamic?: "signin";
}

const AUTHED_TABS: Tab[] = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/map", label: "Map", icon: Map },
  { href: "/", label: "For you", icon: Sparkles, exact: true },
  { href: "/me", label: "Profile", icon: User },
];

// Anon users get an honest tab bar: a real Home (not a "For you" lie when there
// are no personalized recommendations), and a Sign in tab that carries the
// current pathname as ?callbackUrl so the post-login redirect lands you back
// where you tapped from instead of dumping you on /.
const UNAUTH_TABS: Tab[] = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/map", label: "Map", icon: Map },
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/login", label: "Sign in", icon: LogIn, dynamic: "signin" },
];

export function MobileTabBar({ isAuthed }: { isAuthed: boolean }) {
  const pathname = usePathname();
  const tabs = isAuthed ? AUTHED_TABS : UNAUTH_TABS;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        const Icon = t.icon;
        const href =
          t.dynamic === "signin" && pathname !== "/login"
            ? `/login?callbackUrl=${encodeURIComponent(pathname)}`
            : t.href;
        return (
          <Link
            key={t.href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2 text-xs transition-colors active:bg-accent/40",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
            {t.label}
            {active && (
              <motion.span
                layoutId="mobile-tab-indicator"
                className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
