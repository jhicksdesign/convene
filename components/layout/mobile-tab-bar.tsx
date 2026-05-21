"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Map, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/map", label: "Map", icon: Map },
  { href: "/", label: "For you", icon: Sparkles, exact: true },
  { href: "/me", label: "Profile", icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center gap-1 py-2 text-xs transition-colors active:bg-accent/40",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Icon className={cn("h-5 w-5", active && "scale-110")} />
            {t.label}
            {active && (
              <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
