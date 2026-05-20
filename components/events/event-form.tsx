"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConflictWarning, type ConflictReportSerialized } from "@/components/events/conflict-warning";
import { createEvent, updateEvent } from "@/app/_actions/events";

const A11Y = [
  "wheelchair_accessible",
  "sensory_friendly",
  "suit_friendly_restrooms",
  "alcohol_free",
  "smoke_free",
  "kid_friendly",
] as const;

interface Group { id: string; name: string }

export interface EventFormInitial {
  id?: string;
  title?: string;
  description?: string;
  owningGroupId?: string;
  startsAt?: string;
  endsAt?: string;
  capacity?: number | null;
  cost?: string | null;
  scope?: "PUBLIC" | "MEMBERS" | "VOUCHED" | "INVITE";
  status?: "TENTATIVE" | "CONFIRMED" | "CANCELLED";
  tags?: string[];
  accessibilityFlags?: string[];
  rrule?: string | null;
  allowPlusOnes?: boolean;
  flyerImageUrl?: string | null;
}

export function EventForm({ ownableGroups, initial }: { ownableGroups: Group[]; initial?: EventFormInitial }) {
  const [pending, start] = useTransition();
  const [conflicts, setConflicts] = useState<ConflictReportSerialized | null>(null);
  const [flags, setFlags] = useState<string[]>(initial?.accessibilityFlags ?? []);
  const [allowPlusOnes, setAllowPlusOnes] = useState<boolean>(initial?.allowPlusOnes ?? false);
  const [scope, setScope] = useState(initial?.scope ?? "MEMBERS");
  const [status, setStatus] = useState(initial?.status ?? "CONFIRMED");
  const [owningGroupId, setOwningGroupId] = useState(initial?.owningGroupId ?? ownableGroups[0]?.id ?? "");

  function toggleFlag(f: string) {
    setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  async function onSubmit(formData: FormData) {
    start(async () => {
      const payload = {
        title: formData.get("title") as string,
        description: (formData.get("description") as string) || undefined,
        owningGroupId,
        startsAt: formData.get("startsAt") as string,
        endsAt: formData.get("endsAt") as string,
        capacity: formData.get("capacity") ? Number(formData.get("capacity")) : null,
        cost: (formData.get("cost") as string) || null,
        scope,
        status,
        tags: ((formData.get("tags") as string) || "").split(",").map((t) => t.trim()).filter(Boolean),
        accessibilityFlags: flags,
        rrule: (formData.get("rrule") as string) || null,
        allowPlusOnes,
        coHostGroupIds: [],
      };
      const result = initial?.id
        ? { eventId: initial.id, conflicts: await updateEvent(initial.id, payload) }
        : await createEvent(payload);
      setConflicts({
        hits: result.conflicts.hits.map((h) => ({ ...h, startsAt: h.startsAt.toISOString(), endsAt: h.endsAt.toISOString() })),
        alternatives: result.conflicts.alternatives.map((d) => d.toISOString()),
      });
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required defaultValue={initial?.title} />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={4} defaultValue={initial?.description ?? ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Group</Label>
          <Select value={owningGroupId} onValueChange={setOwningGroupId}>
            <SelectTrigger><SelectValue placeholder="Pick a group" /></SelectTrigger>
            <SelectContent>
              {ownableGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Scope</Label>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC">Public</SelectItem>
              <SelectItem value="MEMBERS">Members</SelectItem>
              <SelectItem value="VOUCHED">Vouched members</SelectItem>
              <SelectItem value="INVITE">Invite-only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="startsAt">Starts</Label>
          <Input id="startsAt" name="startsAt" type="datetime-local" required defaultValue={initial?.startsAt} />
        </div>
        <div>
          <Label htmlFor="endsAt">Ends</Label>
          <Input id="endsAt" name="endsAt" type="datetime-local" required defaultValue={initial?.endsAt} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" name="capacity" type="number" min={1} defaultValue={initial?.capacity ?? undefined} />
        </div>
        <div>
          <Label htmlFor="cost">Cost</Label>
          <Input id="cost" name="cost" placeholder="$10 / free / varies" defaultValue={initial?.cost ?? ""} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TENTATIVE">Tentative</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="tags">Tags (comma-separated)</Label>
        <Input id="tags" name="tags" defaultValue={initial?.tags?.join(", ")} />
      </div>
      <div>
        <Label htmlFor="rrule">Recurrence (RRULE)</Label>
        <Input id="rrule" name="rrule" placeholder="FREQ=WEEKLY;BYDAY=SA" defaultValue={initial?.rrule ?? ""} />
      </div>
      <div>
        <Label>Accessibility flags</Label>
        <div className="mt-1 flex flex-wrap gap-3">
          {A11Y.map((f) => (
            <label key={f} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox checked={flags.includes(f)} onCheckedChange={() => toggleFlag(f)} />
              {f.replace(/_/g, " ")}
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={allowPlusOnes} onCheckedChange={setAllowPlusOnes} id="plus-ones" />
        <Label htmlFor="plus-ones">Allow +1 guests</Label>
      </div>
      {conflicts && <ConflictWarning report={conflicts} />}
      <div className="flex items-center justify-end gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : initial?.id ? "Save changes" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
