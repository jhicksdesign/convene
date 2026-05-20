"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface User { id: string; displayName: string; avatarUrl: string | null }

interface Props {
  value: User | null;
  onChange: (u: User | null) => void;
  placeholder?: string;
}

/** Debounced search input that surfaces user pickable by display-name. */
export function UserCombobox({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      if (r.ok) {
        const j = await r.json();
        setResults(j.results as User[]);
        setOpen(true);
      }
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm">
        <span className="flex-1 truncate">{value.displayName}</span>
        <button onClick={() => onChange(null)} className="text-xs text-muted-foreground hover:text-foreground">×</button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? "Search users…"}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-md border bg-popover shadow-md">
          {results.map((u) => (
            <li
              key={u.id}
              className="cursor-pointer px-3 py-1.5 text-sm hover:bg-accent"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(u);
                setQuery("");
                setOpen(false);
              }}
            >
              {u.displayName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
