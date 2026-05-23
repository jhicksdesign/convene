"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EventForm, type EventFormInitial, type OwnableGroup } from "@/components/events/event-form";
import type { ExtractedEvent } from "@/lib/llm/extract-event";

export function PasteToEvent({ ownableGroups }: { ownableGroups: OwnableGroup[] }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [extracted, setExtracted] = useState<ExtractedEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const r = await fetch("/api/llm/extract-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error === "rate_limit" ? "Daily LLM limit reached." : "Extraction failed.");
        return;
      }
      const j = await r.json();
      setExtracted(j.result);
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
    };
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Review extracted fields and confirm.</p>
        <EventForm ownableGroups={ownableGroups} initial={initial} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Paste any event text</Label>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Paste Telegram/Discord/email/journal text here." />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button onClick={run} disabled={pending || text.length < 20}>
        {pending ? "Extracting…" : "Extract event"}
      </Button>
    </div>
  );
}
