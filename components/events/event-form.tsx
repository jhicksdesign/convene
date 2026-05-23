"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { TagInput } from "@/components/ui/tag-input";
import { ConflictWarning, type ConflictReportSerialized } from "@/components/events/conflict-warning";
import { DateTimeDurationPicker } from "@/components/events/datetime-duration-picker";
import { RecurrencePicker } from "@/components/events/recurrence-picker";
import { LocationPicker, type LocationValue } from "@/components/events/location-picker";
import { createEvent, updateEvent } from "@/app/_actions/events";
import type { GroupEventDefaults } from "@/lib/schemas";
import { cn } from "@/lib/utils";

/** Each ownable group hands in its curated vocabulary so the form can render
 *  group-specific suggestions instead of leaning on a hardcoded universal set. */
export interface OwnableGroup {
  id: string;
  name: string;
  tagPalette: string[];
  accessibilityPalette: string[];
  eventDefaults: GroupEventDefaults | null;
}

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
  location?: LocationValue;
  mapCenter?: { lat: number; lng: number };
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

/** Slug-shaped flag → pretty label. Falls back to titlecased slug for community-custom flags. */
function flagLabel(flag: string): string {
  const dictionary: Record<string, string> = {
    wheelchair_accessible: "Wheelchair accessible",
    sensory_friendly: "Sensory friendly",
    alcohol_free: "Alcohol free",
    smoke_free: "Smoke free",
    kid_friendly: "Kid friendly",
  };
  if (dictionary[flag]) return dictionary[flag];
  return flag
    .split("_")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function EventForm({ ownableGroups, initial }: { ownableGroups: OwnableGroup[]; initial?: EventFormInitial }) {
  const [pending, start] = useTransition();
  const [conflicts, setConflicts] = useState<ConflictReportSerialized | null>(null);

  // Pick a group first — many defaults flow from this choice.
  const [owningGroupId, setOwningGroupId] = useState(initial?.owningGroupId ?? ownableGroups[0]?.id ?? "");
  const owningGroup = useMemo(
    () => ownableGroups.find((g) => g.id === owningGroupId) ?? ownableGroups[0],
    [owningGroupId, ownableGroups],
  );
  const groupDefaults: GroupEventDefaults = owningGroup?.eventDefaults ?? {};

  // ───── Form state — initial value falls back to group default, then a sensible static default.
  const [scope, setScope] = useState(initial?.scope ?? groupDefaults.scope ?? "MEMBERS");
  const [isTentative, setIsTentative] = useState(initial?.status === "TENTATIVE");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [flags, setFlags] = useState<string[]>(initial?.accessibilityFlags ?? groupDefaults.accessibilityFlags ?? []);
  const [allowPlusOnes, setAllowPlusOnes] = useState<boolean>(initial?.allowPlusOnes ?? groupDefaults.allowPlusOnes ?? false);
  const [useWaitlist, setUseWaitlist] = useState<boolean>(initial?.useWaitlist ?? groupDefaults.useWaitlist ?? true);

  const [startsAt, setStartsAt] = useState(initial?.startsAt ?? "");
  const [endsAt, setEndsAt] = useState(initial?.endsAt ?? "");
  const [rrule, setRrule] = useState<string | null>(initial?.rrule ?? null);

  const initialCost = parseCost(initial?.cost ?? groupDefaults.cost ?? null);
  const [costKind, setCostKind] = useState<CostKind>(initialCost.kind);
  const [costAmount, setCostAmount] = useState<string>(initialCost.amount);

  const initialCapacity = initial?.capacity ?? groupDefaults.capacity ?? null;
  const [hasCapacity, setHasCapacity] = useState(initialCapacity != null);
  const [capacity, setCapacity] = useState<string>(initialCapacity ? String(initialCapacity) : "");

  const [location, setLocation] = useState<LocationValue>(initial?.location ?? { kind: "none" });

  // Whether the "More options" drawer is open. On edit (initial?.id), default to open
  // so admins can see what they set last time. On create, default closed.
  const [showMore, setShowMore] = useState<boolean>(Boolean(initial?.id));

  // When the user switches groups on a fresh form, re-apply that group's defaults
  // for any field they haven't explicitly touched yet. We track "touched" via a
  // simple flag per field to avoid clobbering user edits.
  const [touched, setTouched] = useState<Set<string>>(new Set());
  function mark(key: string, fn: () => void) {
    setTouched((prev) => new Set(prev).add(key));
    fn();
  }

  useEffect(() => {
    if (!owningGroup || initial?.id) return; // never reapply on edit
    const d = owningGroup.eventDefaults ?? {};
    if (!touched.has("scope") && d.scope) setScope(d.scope);
    if (!touched.has("flags") && d.accessibilityFlags) setFlags(d.accessibilityFlags);
    if (!touched.has("plusOnes") && typeof d.allowPlusOnes === "boolean") setAllowPlusOnes(d.allowPlusOnes);
    if (!touched.has("waitlist") && typeof d.useWaitlist === "boolean") setUseWaitlist(d.useWaitlist);
    if (!touched.has("cost") && d.cost) {
      const c = parseCost(d.cost);
      setCostKind(c.kind);
      setCostAmount(c.amount);
    }
    if (!touched.has("capacity") && d.capacity) {
      setHasCapacity(true);
      setCapacity(String(d.capacity));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owningGroupId]);

  function toggleFlag(f: string) {
    setTouched((prev) => new Set(prev).add("flags"));
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
          tags,
          accessibilityFlags: flags,
          rrule,
          allowPlusOnes,
          useWaitlist: hasCapacity ? useWaitlist : false,
          coHostGroupIds: [],
          location,
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

  const accessibilityPalette = owningGroup?.accessibilityPalette ?? [];
  const tagSuggestions = owningGroup?.tagPalette ?? [];

  return (
    <form action={onSubmit} className="space-y-7">
      {/* ───────── Essentials ───────── */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Event title</Label>
          <Input id="title" name="title" required defaultValue={initial?.title} placeholder="What's this called?" />
        </div>

        {ownableGroups.length > 1 && (
          <div>
            <Label>Hosting group</Label>
            <Select value={owningGroupId} onValueChange={setOwningGroupId}>
              <SelectTrigger><SelectValue placeholder="Pick a group" /></SelectTrigger>
              <SelectContent>
                {ownableGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">When</h3>
          <DateTimeDurationPicker
            startsAt={startsAt}
            endsAt={endsAt}
            onChange={({ startsAt: s, endsAt: e }) => {
              setStartsAt(s);
              setEndsAt(e);
            }}
          />
        </div>

        <div className="space-y-3">
          <h3 className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">Where</h3>
          <LocationPicker
            value={location}
            onChange={setLocation}
            fallbackCenter={initial?.mapCenter}
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={4} defaultValue={initial?.description ?? ""} placeholder="What it is, who it's for, what to bring…" />
        </div>
      </div>

      {/* ───────── More options collapsible ───────── */}
      <div className="space-y-3 border-t pt-5">
        <button
          type="button"
          onClick={() => setShowMore((s) => !s)}
          className="group flex w-full items-center justify-between text-left"
          aria-expanded={showMore}
        >
          <span className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground group-hover:text-foreground">
            More options
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform group-hover:text-foreground", showMore && "rotate-180")} />
        </button>
        {!showMore && (
          <p className="text-xs text-muted-foreground">
            Visibility, capacity, cost, tags, accessibility flags, recurrence — open when you need them.
          </p>
        )}

        {showMore && (
          <div className="space-y-6 pt-2">
            {/* Visibility + tentative */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Who can see this</Label>
                <Select value={scope} onValueChange={(v) => mark("scope", () => setScope(v as typeof scope))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Anyone with the link</SelectItem>
                    <SelectItem value="MEMBERS">Group members</SelectItem>
                    <SelectItem value="VOUCHED">Vouched members only</SelectItem>
                    <SelectItem value="INVITE">Invite-only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-md border bg-muted/20 p-3 text-sm">
                <Switch checked={isTentative} onCheckedChange={setIsTentative} />
                <span>
                  <span className="font-medium">Tentative</span>
                  <span className="block text-xs text-muted-foreground">Auto-cancels after 14 days if not confirmed.</span>
                </span>
              </label>
            </div>

            {/* Recurrence */}
            <div>
              <Label>Repeats</Label>
              <RecurrencePicker startDate={startsAt} rrule={rrule} onChange={setRrule} />
            </div>

            {/* Capacity + waitlist */}
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm">
                <Switch
                  checked={hasCapacity}
                  onCheckedChange={(v) => mark("capacity", () => setHasCapacity(v))}
                />
                Set a headcount limit
              </label>
              {hasCapacity && (
                <div className="grid gap-3 rounded-md border border-input bg-muted/20 p-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="capacity">Headcount</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min={1}
                      value={capacity}
                      onChange={(e) => mark("capacity", () => setCapacity(e.target.value))}
                    />
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <Switch
                      checked={useWaitlist}
                      onCheckedChange={(v) => mark("waitlist", () => setUseWaitlist(v))}
                    />
                    <span>
                      Use a waitlist when full
                      <span className="block text-xs text-muted-foreground">Off = limit is just a guideline.</span>
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Cost */}
            <div>
              <Label>Cost</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {(["free", "fixed", "varies", "pwyc"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => mark("cost", () => setCostKind(k))}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                      costKind === k
                        ? "border-foreground bg-foreground text-background"
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
                    onChange={(e) => mark("cost", () => setCostAmount(e.target.value))}
                    className="w-32"
                  />
                </div>
              )}
            </div>

            {/* Plus-ones */}
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <Switch
                checked={allowPlusOnes}
                onCheckedChange={(v) => mark("plusOnes", () => setAllowPlusOnes(v))}
              />
              <span>
                Allow bringing a friend (+1 guests)
                <span className="block text-xs text-muted-foreground">RSVPs can specify N additional guests; counts against capacity.</span>
              </span>
            </label>

            {/* Tags */}
            <div>
              <Label htmlFor="tags">Tags</Label>
              <p className="mb-1.5 text-xs text-muted-foreground">
                Powers recommendations and filtering. Suggestions come from this group's palette.
              </p>
              <TagInput
                id="tags"
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                placeholder={tagSuggestions.length > 0 ? "Start typing — suggestions appear" : "social, outdoor, beginner-friendly…"}
              />
            </div>

            {/* Accessibility */}
            {accessibilityPalette.length > 0 && (
              <div>
                <Label>Accessibility</Label>
                <p className="mb-1.5 text-xs text-muted-foreground">
                  Mark anything this event explicitly supports.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {accessibilityPalette.map((f) => (
                    <label key={f} className="flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                      <Checkbox checked={flags.includes(f)} onCheckedChange={() => toggleFlag(f)} />
                      <span className="truncate">{flagLabel(f)}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
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
