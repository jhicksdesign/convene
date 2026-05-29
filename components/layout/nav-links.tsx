"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Map, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/map", label: "Map", icon: Map },
  { href: "/groups", label: "Groups", icon: Users },
];

export function TopNavLinks() {
  const pathname = usePathname();
  return (
    <nav className="hidden gap-1 text-sm md:flex">
      {LINKS.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
              active ? "font-medium text-primary" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {l.label}
            {active && (
              <motion.span
                layoutId="nav-underline"
                className="absolute inset-x-3 -bottom-[7px] h-0.5 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
