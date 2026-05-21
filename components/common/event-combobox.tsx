"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export interface EventOption {
  id: string;
  title: string;
  groupName: string;
  color: string;
  startsAt: string;
}

interface Props {
  value: EventOption | null;
  onChange: (e: EventOption | null) => void;
  placeholder?: string;
}

export function EventCombobox({ value, onChange, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<EventOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.length < 2 && !open) return;
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/events/search?q=${encodeURIComponent(query)}`);
      if (r.ok) {
        const j = await r.json();
        setResults(j.results as EventOption[]);
        setActiveIndex(0);
      }
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, open]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: value.color }} />
        <span className="flex-1 truncate">
          {value.title} <span className="text-muted-foreground">· {value.groupName}</span>
        </span>
        <button onClick={() => onChange(null)} className="text-xs text-muted-foreground hover:text-foreground" aria-label="Clear selection">
          ×
        </button>
      </div>
    );
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      onChange(results[activeIndex]);
      setQuery("");
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? "Search events…"}
        role="combobox"
        aria-expanded={open}
        aria-controls="event-listbox"
      />
      {open && results.length > 0 && (
        <ul
          id="event-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border bg-popover shadow-md"
        >
          {results.map((e, i) => (
            <li
              key={e.id}
              role="option"
              aria-selected={i === activeIndex}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === activeIndex ? "bg-accent" : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(ev) => {
                ev.preventDefault();
                onChange(e);
                setQuery("");
                setOpen(false);
              }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
              <span className="flex-1 truncate">
                {e.title}
                <span className="ml-2 text-xs text-muted-foreground">{e.groupName} · {new Date(e.startsAt).toLocaleDateString()}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
