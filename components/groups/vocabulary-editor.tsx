"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { updateGroupVocabulary } from "@/app/_actions/groups";
import type { GroupEventDefaults } from "@/lib/schemas";

type Scope = "PUBLIC" | "MEMBERS" | "VOUCHED" | "INVITE";

interface Initial {
  id: string;
  name: string;
  tagPalette: string[];
  accessibilityPalette: string[];
  eventDefaults: GroupEventDefaults | null;
}

type CostKind = "free" | "fixed" | "varies" | "pwyc" | "unset";

function parseCostKind(s: string | null | undefined): { kind: CostKind; amount: string } {
  if (!s) return { kind: "unset", amount: "" };
  const l = s.toLowerCase();
  if (l === "free") return { kind: "free", amount: "" };
  if (l.includes("vary") || l === "varies") return { kind: "varies", amount: "" };
  if (l.includes("pay what") || l === "pwyc") return { kind: "pwyc", amount: "" };
  return { kind: "fixed", amount: s.replace(/[^0-9.]/g, "") };
}

function serializeCost(kind: CostKind, amount: string): string | null {
  switch (kind) {
    case "unset": return null;
    case "free": return "Free";
    case "varies": return "Varies";
    case "pwyc": return "Pay what you can";
    case "fixed": return amount ? `$${amount}` : null;
  }
}

export function VocabularyEditor({ initial }: { initial: Initial }) {
  const [pending, start] = useTransition();
  const [tagPalette, setTagPalette] = useState<string[]>(initial.tagPalette);
  const [accessibilityPalette, setAccessibilityPalette] = useState<string[]>(initial.accessibilityPalette);

  const ed = initial.eventDefaults ?? {};
  const initialCost = parseCostKind(ed.cost);
  const [scope, setScope] = useState<Scope | "unset">((ed.scope as Scope | undefined) ?? "unset");
  const [hasCapacityDefault, setHasCapacityDefault] = useState<boolean>(ed.capacity != null);
  const [capacity, setCapacity] = useState<string>(ed.capacity ? String(ed.capacity) : "");
  const [costKind, setCostKind] = useState<CostKind>(initialCost.kind);
  const [costAmount, setCostAmount] = useState<string>(initialCost.amount);
  const [allowPlusOnes, setAllowPlusOnes] = useState<boolean>(ed.allowPlusOnes ?? false);
  const [useWaitlist, setUseWaitlist] = useState<boolean>(ed.useWaitlist ?? true);
  const [defaultFlags, setDefaultFlags] = useState<string[]>(ed.accessibilityFlags ?? []);

  function save() {
    start(async () => {
      const eventDefaults: GroupEventDefaults = {};
      if (scope !== "unset") eventDefaults.scope = scope;
      if (hasCapacityDefault && capacity) eventDefaults.capacity = Number(capacity);
      const cost = serializeCost(costKind, costAmount);
      if (cost !== null) eventDefaults.cost = cost;
      eventDefaults.allowPlusOnes = allowPlusOnes;
      eventDefaults.useWaitlist = useWaitlist;
      if (defaultFlags.length > 0) eventDefaults.accessibilityFlags = defaultFlags;

      const hasAnyDefault = Object.keys(eventDefaults).length > 0;

      try {
        await updateGroupVocabulary(initial.id, {
          tagPalette,
          accessibilityPalette,
          eventDefaults: hasAnyDefault ? eventDefaults : null,
        });
        toast.success("Vocabulary saved");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-medium tracking-tight">Tag palette</h2>
          <p className="text-sm text-muted-foreground">
            Suggested tags that appear in the event-creation dropdown. Members can still write
            free-text tags — these are the ones you actively suggest.
          </p>
        </div>
        <TagInput
          value={tagPalette}
          onChange={setTagPalette}
          placeholder="indoor, outdoor, beginner-friendly, social…"
        />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl font-medium tracking-tight">Accessibility flags</h2>
          <p className="text-sm text-muted-foreground">
            Which accessibility flags this community uses on events. The universal set is
            pre-loaded; add your own as needed (e.g. <code className="rounded bg-muted px-1 py-0.5 text-xs">fursuit_friendly</code>, <code className="rounded bg-muted px-1 py-0.5 text-xs">leashed_pets_ok</code>).
          </p>
        </div>
        <TagInput
          value={accessibilityPalette}
          onChange={setAccessibilityPalette}
          placeholder="wheelchair_accessible, sensory_friendly…"
        />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-medium tracking-tight">Event defaults</h2>
          <p className="text-sm text-muted-foreground">
            Pre-filled values for new events in this group. Admins can still change anything per event.
          </p>
        </div>

        <div className="space-y-4 rounded-md border border-input bg-background p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Default visibility</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as Scope | "unset")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unset">No default</SelectItem>
                  <SelectItem value="PUBLIC">Anyone with the link</SelectItem>
                  <SelectItem value="MEMBERS">Group members</SelectItem>
                  <SelectItem value="VOUCHED">Vouched members</SelectItem>
                  <SelectItem value="INVITE">Invite-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Default cost</Label>
              <div className="flex flex-wrap gap-1.5">
                {(["unset", "free", "fixed", "varies", "pwyc"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setCostKind(k)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${
                      costKind === k ? "border-foreground bg-foreground text-background" : "border-input"
                    }`}
                  >
                    {k === "unset" && "No default"}
                    {k === "free" && "Free"}
                    {k === "fixed" && "Fixed"}
                    {k === "varies" && "Varies"}
                    {k === "pwyc" && "PWYC"}
                  </button>
                ))}
              </div>
              {costKind === "fixed" && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={costAmount}
                    onChange={(e) => setCostAmount(e.target.value)}
                    className="w-28"
                  />
                </div>
              )}
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <Switch checked={hasCapacityDefault} onCheckedChange={setHasCapacityDefault} />
            <span className="flex-1">
              <span className="font-medium">Default to setting a headcount limit</span>
              <span className="block text-xs text-muted-foreground">
                Most events small enough to need a cap — turn this on so admins don't forget.
              </span>
              {hasCapacityDefault && (
                <Input
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  placeholder="e.g. 20"
                  className="mt-2 w-32"
                />
              )}
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <Switch checked={useWaitlist} onCheckedChange={setUseWaitlist} />
            <span>
              <span className="font-medium">Auto-promote a waitlist when full</span>
              <span className="block text-xs text-muted-foreground">
                Off = capacity is just a suggestion. On = excess RSVPs queue up.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <Switch checked={allowPlusOnes} onCheckedChange={setAllowPlusOnes} />
            <span>
              <span className="font-medium">Allow +1 guests by default</span>
              <span className="block text-xs text-muted-foreground">
                RSVPs can bring a friend; each one counts against capacity.
              </span>
            </span>
          </label>

          <div>
            <Label>Default accessibility flags</Label>
            <p className="text-xs text-muted-foreground">
              Pre-checked when creating an event. Pick from your palette above.
            </p>
            <TagInput
              value={defaultFlags}
              onChange={setDefaultFlags}
              suggestions={accessibilityPalette}
              paletteOnly
              placeholder="Pick from your palette…"
              className="mt-1"
            />
          </div>
        </div>
      </section>

      <div className="flex justify-end border-t pt-4">
        <Button onClick={save} disabled={pending} size="lg">
          {pending ? "Saving…" : "Save vocabulary"}
        </Button>
      </div>
    </div>
  );
}
