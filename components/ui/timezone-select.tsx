"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "cmdk";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (tz: string) => void;
  id?: string;
  className?: string;
}

/** All IANA zones the runtime knows about, prefixed by the canonical UTC/GMT */
function allZones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }
  return ["UTC", "America/Denver", "America/New_York", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"];
}

function offsetFor(tz: string): string {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" });
    const parts = dtf.formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function TimezoneSelect({ value, onChange, id, className }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const zones = useMemo(() => allZones(), []);
  const offset = offsetFor(value);

  // Close on outside click or escape.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors hover:bg-accent/40"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate">{value || "Pick a timezone"}</span>
          {offset && <span className="text-xs text-muted-foreground">{offset}</span>}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-md border border-input bg-popover text-popover-foreground shadow-md"
        >
          <Command
            shouldFilter
            className="flex h-72 flex-col"
            filter={(itemValue, search) => {
              // case-insensitive contains. cmdk's default scoring penalizes long strings,
              // which makes "America/" zones rank weirdly when typing fragments.
              const v = itemValue.toLowerCase();
              const s = search.toLowerCase();
              if (!s) return 1;
              if (v.includes(s)) return 1;
              return 0;
            }}
          >
            <CommandInput
              placeholder="Search timezones…"
              className="h-9 w-full border-b border-input bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <CommandList className="flex-1 overflow-y-auto p-1">
              <CommandEmpty className="px-3 py-6 text-center text-sm text-muted-foreground">
                No timezones match
              </CommandEmpty>
              <CommandGroup>
                {zones.map((z) => (
                  <CommandItem
                    key={z}
                    value={z}
                    onSelect={(picked) => {
                      onChange(picked);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-sm px-2 py-1.5 text-sm",
                      "aria-selected:bg-accent aria-selected:text-accent-foreground",
                    )}
                  >
                    <span className="truncate">{z}</span>
                    <span className="ml-3 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{offsetFor(z)}</span>
                      {z === value && <Check className="h-4 w-4 text-foreground" />}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

/** Hint for the form: what timezone does the browser think we're in. */
export function detectBrowserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}
