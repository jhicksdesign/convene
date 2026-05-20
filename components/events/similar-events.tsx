"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Hit {
  id: string;
  title: string;
  groupName: string;
  color: string;
  startsAt: string;
}

export function SimilarEvents({ eventId }: { eventId: string }) {
  const [hits, setHits] = useState<Hit[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/search/similar?eventId=${encodeURIComponent(eventId)}`)
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j) => { if (!cancelled) setHits(j.results); })
      .catch(() => { if (!cancelled) setHits([]); });
    return () => { cancelled = true; };
  }, [eventId]);

  if (!hits || hits.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Similar events</h3>
      <ul className="divide-y rounded-md border">
        {hits.map((h) => (
          <li key={h.id}>
            <Link href={`/e/${h.id}`} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: h.color }} />
              <span className="truncate">{h.title}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {h.groupName} · {new Date(h.startsAt).toLocaleDateString()}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
