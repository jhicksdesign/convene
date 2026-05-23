"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  /** Tags shown in the autocomplete dropdown (curated palette + recent uses). */
  suggestions?: string[];
  placeholder?: string;
  /** Slug-normalize entries (lowercase + hyphens). Default true. */
  normalize?: boolean;
  /** Hard cap. Default 50. */
  max?: number;
  id?: string;
  className?: string;
  /** If true, free-text entries outside the palette are not allowed. */
  paletteOnly?: boolean;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Type to add a tag…",
  normalize = true,
  max = 50,
  id,
  className,
  paletteOnly = false,
}: Props) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const valueSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = draft.toLowerCase().trim();
    return suggestions
      .filter((s) => !valueSet.has(s))
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [draft, suggestions, valueSet]);

  // Close popover on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function addTag(raw: string) {
    if (value.length >= max) return;
    const t = normalize ? slugify(raw) : raw.trim();
    if (!t) return;
    if (paletteOnly && !suggestions.includes(t)) return;
    if (valueSet.has(t)) return;
    onChange([...value, t]);
    setDraft("");
  }

  function removeTag(t: string) {
    onChange(value.filter((x) => x !== t));
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (draft) {
        addTag(draft);
      } else if (filtered.length === 1) {
        // Hitting Enter with an empty draft adds the only suggestion if it's unambiguous.
        addTag(filtered[0]);
      }
    } else if (e.key === "Backspace" && !draft && value.length > 0) {
      removeTag(value[value.length - 1]);
    } else if (e.key === "Escape") {
      setFocused(false);
    }
  }

  const showPop = focused && (filtered.length > 0 || (draft && !paletteOnly));

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm",
          "focus-within:ring-2 focus-within:ring-ring",
        )}
      >
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-foreground/20 bg-muted/40 px-2 py-0.5 text-xs"
          >
            {t}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(t);
              }}
              className="rounded-full p-0.5 hover:bg-foreground/10"
              aria-label={`Remove ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKey}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showPop && (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-56 overflow-y-auto rounded-md border border-input bg-popover text-popover-foreground shadow-md">
          {filtered.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus
                  addTag(s);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/30" />
                {s}
              </button>
            </li>
          ))}
          {draft && !paletteOnly && !suggestions.includes(normalize ? slugify(draft) : draft.trim()) && (
            <li>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(draft);
                }}
                className="flex w-full items-center gap-2 border-t border-input px-3 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span className="text-muted-foreground">Add new:</span>
                <span className="font-medium">{normalize ? slugify(draft) : draft.trim()}</span>
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
