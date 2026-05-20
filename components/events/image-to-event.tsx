"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EventForm, type EventFormInitial } from "@/components/events/event-form";
import type { ExtractedEvent } from "@/lib/llm/extract-event";

interface Group { id: string; name: string }

export function ImageToEvent({ ownableGroups }: { ownableGroups: Group[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [pending, start] = useTransition();
  const [extracted, setExtracted] = useState<ExtractedEvent | null>(null);
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!file) return;
    setError(null);
    start(async () => {
      try {
        // 1) Persist the file to R2 so it can be attached as the event's flyer.
        const sign = await fetch("/api/upload/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "flyer", mime: file.type, sizeBytes: file.size }),
        });
        if (!sign.ok) {
          const j = await sign.json().catch(() => ({}));
          throw new Error(j.error ?? "Couldn't sign upload");
        }
        const { url, publicUrl } = (await sign.json()) as { url: string; publicUrl: string };
        const put = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        if (!put.ok) throw new Error(`Upload failed (${put.status})`);
        setFlyerUrl(publicUrl);

        // 2) Extract event details from the same file in parallel-ish (single LLM call).
        const fd = new FormData();
        fd.append("file", file);
        const r = await fetch("/api/llm/extract-image", { method: "POST", body: fd });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error === "rate_limit" ? "Daily LLM limit reached." : "Extraction failed.");
        }
        const j = await r.json();
        setExtracted(j.result);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed");
      }
    });
  }

  if (extracted) {
    const initial: EventFormInitial = {
      title: extracted.title ?? "",
      description: extracted.description ?? "",
      startsAt: extracted.startsAtISO ?? undefined,
      endsAt: extracted.endsAtISO ?? undefined,
      cost: extracted.cost,
      capacity: extracted.capacity,
      tags: extracted.tags,
      accessibilityFlags: extracted.accessibilityFlags,
      flyerImageUrl: flyerUrl,
    };
    return <EventForm ownableGroups={ownableGroups} initial={initial} />;
  }

  return (
    <div className="space-y-3">
      <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={run} disabled={pending || !file}>{pending ? "Working…" : "Extract from flyer"}</Button>
    </div>
  );
}
