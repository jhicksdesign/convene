"use client";

import { useTransition, useState } from "react";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserCombobox } from "@/components/common/user-combobox";
import { setRSVP, withdrawRSVP } from "@/app/_actions/rsvps";

type Status = "GOING" | "INTERESTED" | "MAYBE" | "NOT_GOING" | "CONDITIONAL" | "WAITLIST";
type CondMode = "count" | "user";

interface Props {
  eventId: string;
  initialStatus?: Status | null;
  initialPlusOnes?: number;
  allowPlusOnes?: boolean;
  initialPosition?: number | null;
}

export function RSVPButton({ eventId, initialStatus, initialPlusOnes = 0, allowPlusOnes, initialPosition }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus ?? "INTERESTED");
  const [plusOnes, setPlusOnes] = useState(initialPlusOnes);
  const [condMode, setCondMode] = useState<CondMode>("count");
  const [conditionalMin, setConditionalMin] = useState<number | "">("");
  const [conditionalUser, setConditionalUser] = useState<{ id: string; displayName: string; avatarUrl: string | null } | null>(null);
  const [pending, start] = useTransition();
  const [position, setPosition] = useState<number | null>(initialPosition ?? null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      try {
        const result = await setRSVP({
          eventId,
          status,
          plusOneCount: plusOnes,
          conditionalMinAttendees:
            status === "CONDITIONAL" && condMode === "count" && conditionalMin !== "" ? Number(conditionalMin) : null,
          conditionalOnUserId:
            status === "CONDITIONAL" && condMode === "user" ? conditionalUser?.id ?? null : null,
        });
        setPosition(result.waitlistPosition);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Couldn't save RSVP");
      }
    });
  }

  function withdraw() {
    start(async () => {
      await withdrawRSVP(eventId);
      setStatus("INTERESTED");
      setPosition(null);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GOING">Going</SelectItem>
              <SelectItem value="INTERESTED">Interested</SelectItem>
              <SelectItem value="MAYBE">Maybe</SelectItem>
              <SelectItem value="CONDITIONAL">Conditional</SelectItem>
              <SelectItem value="NOT_GOING">Not going</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {allowPlusOnes && status === "GOING" && (
          <div>
            <Input type="number" min={0} max={10} value={plusOnes} onChange={(e) => setPlusOnes(Number(e.target.value))} className="w-20" />
          </div>
        )}
        <Button onClick={submit} disabled={pending}>{pending ? "Saving…" : "Save RSVP"}</Button>
        {initialStatus && <Button onClick={withdraw} variant="ghost" disabled={pending}>Withdraw</Button>}
        {position != null && <span className="text-xs text-muted-foreground">Waitlist position #{position}</span>}
      </div>
      {status === "CONDITIONAL" && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <div className="flex gap-2">
            <Button size="sm" variant={condMode === "count" ? "default" : "outline"} onClick={() => setCondMode("count")}>If N others go</Button>
            <Button size="sm" variant={condMode === "user" ? "default" : "outline"} onClick={() => setCondMode("user")}>If a specific user goes</Button>
          </div>
          {condMode === "count" ? (
            <Input
              type="number"
              placeholder="Minimum total attendees"
              value={conditionalMin}
              onChange={(e) => setConditionalMin(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-48"
            />
          ) : (
            <UserCombobox value={conditionalUser} onChange={setConditionalUser} placeholder="Search by display name…" />
          )}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
