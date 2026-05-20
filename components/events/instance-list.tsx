"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { detachInstance, cancelInstance } from "@/app/_actions/events";

interface Instance { startsAt: string; endsAt: string }

interface Props {
  parentEventId: string;
  instances: Instance[];
}

/**
 * Per-instance editor for recurring series (PRD §6.2).
 * - "Edit just this" detaches the instance into its own event and navigates to /e/[new]/edit.
 * - "Cancel just this" adds the date to the parent's exception list.
 */
export function InstanceList({ parentEventId, instances }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function detach(startsAt: string) {
    setError(null);
    start(async () => {
      try {
        const r = await detachInstance(parentEventId, new Date(startsAt));
        router.push(`/e/${r.eventId}/edit`);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to detach instance");
      }
    });
  }

  function cancel(startsAt: string) {
    setError(null);
    start(async () => {
      try {
        await cancelInstance(parentEventId, new Date(startsAt));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to cancel instance");
      }
    });
  }

  if (instances.length === 0) {
    return <p className="text-xs text-muted-foreground">No upcoming instances.</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Edits or cancellations here apply only to that single occurrence. The rest of the series is untouched.
      </p>
      <ul className="divide-y rounded-md border">
        {instances.map((i) => (
          <li key={i.startsAt} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>{format(new Date(i.startsAt), "EEE MMM d, yyyy · p")}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={pending} onClick={() => detach(i.startsAt)}>
                Edit just this
              </Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => cancel(i.startsAt)}>
                Cancel just this
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
