"use client";

import { useState } from "react";
import { EventForm, type EventFormInitial } from "@/components/events/event-form";
import { AssistantSidebar } from "@/components/events/assistant-sidebar";

interface Group { id: string; name: string }

/**
 * Pairs the EventForm with the NL assistant sidebar. Clicking a suggestion
 * remounts the form with the picked date prefilled.
 */
export function EventFormWithAssistant({
  ownableGroups,
  initial,
}: {
  ownableGroups: Group[];
  initial?: EventFormInitial;
}) {
  const [seed, setSeed] = useState<EventFormInitial>(initial ?? {});

  function pickDate(iso: string) {
    const start = new Date(iso);
    if (Number.isNaN(start.getTime())) return;
    start.setHours(19, 0, 0, 0);
    const end = new Date(start);
    end.setHours(21, 0, 0, 0);
    const toLocal = (d: Date) => {
      const off = d.getTimezoneOffset();
      const adj = new Date(d.getTime() - off * 60_000);
      return adj.toISOString().slice(0, 16);
    };
    setSeed((prev) => ({ ...prev, startsAt: toLocal(start), endsAt: toLocal(end) }));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <EventForm key={`${seed.startsAt ?? "empty"}-${initial?.id ?? "new"}`} ownableGroups={ownableGroups} initial={seed} />
      </div>
      <AssistantSidebar groups={ownableGroups} onPickDate={pickDate} />
    </div>
  );
}
