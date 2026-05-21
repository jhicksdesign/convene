"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ConflictWarning, type ConflictReportSerialized } from "@/components/events/conflict-warning";
import { DateTimeDurationPicker } from "@/components/events/datetime-duration-picker";
import { RecurrencePicker } from "@/components/events/recurrence-picker";
import { createEvent, updateEvent } from "@/app/_actions/events";
import { cn } from "@/lib/utils";

const A11Y: { value: string; label: string }[] = [
  { value: "wheelchair_accessible", label: "Wheelchair accessible" },
  { value: "sensory_friendly", label: "Sensory friendly" },
  { value: "suit_friendly_restrooms", label: "Suit-friendly restrooms" },
  { value: "alcohol_free", label: "Alcohol free" },
  { value: "smoke_free", label: "Smoke free" },
  { value: "kid_friendly", label: "Kid friendly" },
];

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
  useWaitlist?: boolean;
  flyerImageUrl?: string | null;
}

type CostKind = "free" | "fixed" | "varies" | "pwyc";

function parseCost(s: string | null | undefined): { kind: CostKind; amount: string } {
  if (!s || s.toLowerCase() === "free") return { kind: "free", amount: "" };
  const l = s.toLowerCase();
  if (l.includes("vary") || l === "varies") return { kind: "varies", amount: "" };
  if (l.includes("pay what") || l === "pwyc") return { kind: "pwyc", amount: "" };
  const num = s.replace(/[^0-9.]/g, "");
  return { kind: "fixed", amount: num };
}

function serializeCost(kind: CostKind, amount: string): string | null {
  switch (kind) {
    case "free": return "Free";
    case "varies": return "Varies";
    case "pwyc": return "Pay what you can";
    case "fixed": return amount ? `$${amount}` : null;
  }
}

export function EventForm({ ownableGroups, initial }: { ownableGroups: Group[]; initial?: EventFormInitial }) {
  const [pending, start] = useTransition();
  const [conflicts, setConflicts] = useState<ConflictReportSerialized | null>(null);
  const [flags, setFlags] = useState<string[]>(initial?.accessibilityFlags ?? []);
  const [allowPlusOnes, setAllowPlusOnes] = useState<boolean>(initial?.allowPlusOnes ?? false);
  const [useWaitlist, setUseWaitlist] = useState<boolean>(initial?.useWaitlist ?? true);
  const [scope, setScope] = useState(initial?.scope ?? "MEMBERS");
  const [isTentative, setIsTentative] = useState(initial?.status === "TENTATIVE");
  const [owningGroupId, setOwningGroupId] = useState(initial?.owningGroupId ?? ownableGroups[0]?.id ?? "");

  const [startsAt, setStartsAt] = useState(initial?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ?? "");
  const [rrule, setRrule] = useState<string | null>(initial?.rrule ?? null);

  const initialCost = parseCost(initial?.cost);
  const [costKind, setCostKind] = useState<CostKind>(initialCost.kind);
  const [costAmount, setCostAmount] = useState<string>(initialCost.amount);

  const [hasCapacity, setHasCapacity] = useState(initial?.capacity != null);
  const [capacity, setCapacity] = useState<string>(initial?.capacity ? String(initial.capacity) : "");

  function toggleFlag(f: string) {
    setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  async function onSubmit(formData: FormData) {
    start(async () => {
      try {
        const payload = {
          title: formData.get("title") as string,
          description: (formData.get("description") as string) || undefined,
          owningGroupId,
          startsAt,
          endsAt,
          capacity: hasCapacity && capacity ? Number(capacity) : null,
          cost: serializeCost(costKind, costAmount),
          scope,
          status: isTentative ? "TENTATIVE" : "CONFIRMED",
          tags: ((formData.get("tags") as string) || "").split(",").map((t) => t.trim()).filter(Boolean),
          accessibilityFlags: flags,
          rrule,
          allowPlusOnes,
          useWaitlist: hasCapacity ? useWaitlist : false,
          coHostGroupIds: [],
        };
        const result = initial?.id
          ? { eventId: initial.id, conflicts: await updateEvent(initial.id, payload) }
          : await createEvent(payload);
        setConflicts({
          hits: result.conflicts.hits.map((h) => ({ ...h, startsAt: h.startsAt.toISOString(), endsAt: h.endsAt.toISOString() })),
          alternatives: result.conflicts.alternatives.map((d) => d.toISOString()),
        });
        toast.success(initial?.id ? "Event updated" : "Event created");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't save event");
      }
    });
  }

  function pickAlternative(iso: string) {
    if (!startsAt) return;
    const oldStart = new Date(startsAt);
    const oldEnd = new Date(endsAt);
    const newStart = new Date(iso);
    newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
    const durMs = oldEnd.getTime() - oldStart.getTime();
    const newEnd = new Date(newStart.getTime() + durMs);
    const toLocal = (d: Date) => {
      const off = d.getTimezoneOffset();
      const adj = new Date(d.getTime() - off * 60_000);
      return adj.toISOString().slice(0, 16);
    };
    setStartsAt(toLocal(newStart));
    setEndsAt(toLocal(newEnd));
    setConflicts(null);
    toast.success("Date updated — review and save again");
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Event title</Label>
          <Input id="title" name="title" required defaultValue={initial?.title} placeholder="Movie night, suit walk, game night…" />
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
            <Label>Who can see this</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Anyone with the link</SelectItem>
                <SelectItem value="MEMBERS">Group members</SelectItem>
                <SelectItem value="VOUCHED">Vouched members only</SelectItem>
                <SelectItem value="INVITE">Invite-only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
          <Switch checked={isTentative} onCheckedChange={setIsTentative} />
          <div>
            <span className="font-medium">Mark as tentative</span>
            <span className="ml-2 text-muted-foreground">Still planning — auto-cancels after 14 days if not confirmed.</span>
          </div>
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">When</h3>
        <DateTimeDurationPicker
          startsAt={startsAt}
          endsAt={endsAt}
          onChange={({ startsAt: s, endsAt: e }) => {
            setStartsAt(s);
            setEndsAt(e);
          }}
        />
        <RecurrencePicker startDate={startsAt} rrule={rrule} onChange={setRrule} />
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Capacity & cost</h3>

        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <Switch checked={hasCapacity} onCheckedChange={setHasCapacity} />
          Set a headcount limit
        </label>
        {hasCapacity && (
          <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="capacity">Headcount</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Switch checked={useWaitlist} onCheckedChange={setUseWaitlist} />
              <span>
                Use a waitlist when full
                <span className="block text-xs text-muted-foreground">Off = limit is just a guideline.</span>
              </span>
            </label>
          </div>
        )}

        <div>
          <Label>Cost</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["free", "fixed", "varies", "pwyc"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setCostKind(k)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                  costKind === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:bg-accent",
                )}
              >
                {k === "free" && "Free"}
                {k === "fixed" && "Fixed price"}
                {k === "varies" && "Varies"}
                {k === "pwyc" && "Pay what you can"}
              </button>
            ))}
          </div>
          {costKind === "fixed" && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                placeholder="10.00"
                value={costAmount}
                onChange={(e) => setCostAmount(e.target.value)}
                className="w-32"
              />
            </div>
          )}
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <Switch checked={allowPlusOnes} onCheckedChange={setAllowPlusOnes} />
          <span>
            Allow bringing a friend (+1 guests)
            <span className="block text-xs text-muted-foreground">RSVPs can specify N additional guests; counts against capacity.</span>
          </span>
        </label>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Details</h3>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={4} defaultValue={initial?.description ?? ""} placeholder="What it is, who it's for, what to bring…" />
        </div>
        <div>
          <Label htmlFor="tags">Tags <span className="font-normal text-muted-foreground">(comma-separated, helps recommendations)</span></Label>
          <Input id="tags" name="tags" defaultValue={initial?.tags?.join(", ")} placeholder="movie, indoor, suit-friendly" />
        </div>
        <div>
          <Label>Accessibility</Label>
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {A11Y.map((f) => (
              <label key={f.value} className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
                <Checkbox checked={flags.includes(f.value)} onCheckedChange={() => toggleFlag(f.value)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {conflicts && <ConflictWarning report={conflicts} onPickAlternative={pickAlternative} />}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="submit" disabled={pending} size="lg">
          {pending ? "Saving…" : initial?.id ? "Save changes" : isTentative ? "Save as tentative" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
