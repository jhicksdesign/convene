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
  const [activeIndex, setActiveIndex] = useState(0);
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
        setActiveIndex(0);
        setOpen(true);
      }
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      router.push(results[activeIndex].href);
      setQuery("");
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

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
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls="topbar-listbox"
        aria-autocomplete="list"
      />
      {open && results.length > 0 && (
        <ul
          id="topbar-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-auto rounded-md border bg-popover shadow-md"
        >
          {results.map((h, i) => (
            <li key={`${h.kind}-${h.id}`} role="option" aria-selected={i === activeIndex}>
              <Link
                href={h.href}
                className={`flex items-center justify-between px-3 py-2 text-sm ${i === activeIndex ? "bg-accent" : "hover:bg-accent"}`}
                onMouseEnter={() => setActiveIndex(i)}
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
