"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateVenueNotes } from "@/app/_actions/locations";

interface Props {
  locationId: string;
  initialNotes: string | null;
}

export function VenueNotesEditor({ locationId, initialNotes }: Props) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!editing) {
    return (
      <div className="space-y-1">
        {initialNotes ? (
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">{initialNotes}</p>
        ) : (
          <p className="text-xs text-muted-foreground">No venue notes yet.</p>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-primary hover:underline"
        >
          {initialNotes ? "Edit venue notes" : "Add venue notes"}
        </button>
      </div>
    );
  }

  function save() {
    setError(null);
    start(async () => {
      try {
        await updateVenueNotes(locationId, notes);
        setEditing(false);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Parking instructions, sensory tips, dress code, accessibility specifics…"
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setNotes(initialNotes ?? ""); }} disabled={pending}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
