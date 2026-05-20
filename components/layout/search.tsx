"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";

interface Hit { kind: "user" | "group" | "event"; id: string; title: string; sub?: string; href: string }

export function TopBarSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      if (r.ok) {
        const j = await r.json();
        setResults(j.results as Hit[]);
        setOpen(true);
      }
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  return (
    <div className="relative hidden w-72 md:block">
      <SearchIcon className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people, groups, events…"
        className="pl-8"
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            router.push(results[0].href);
            setQuery("");
            setOpen(false);
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-md border bg-popover shadow-md">
          {results.map((h) => (
            <li key={`${h.kind}-${h.id}`}>
              <Link
                href={h.href}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-accent"
                onClick={() => { setQuery(""); setOpen(false); }}
              >
                <div>
                  <span className="font-medium">{h.title}</span>
                  {h.sub && <span className="ml-2 text-xs text-muted-foreground">{h.sub}</span>}
                </div>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{h.kind}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
