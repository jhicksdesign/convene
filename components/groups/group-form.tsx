"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createGroup, updateGroup } from "@/app/_actions/groups";
import { VisibilityPresetPicker, matchPreset, PRESETS, type GroupVisibility, type JoinMode } from "@/components/groups/visibility-preset";
import { cn } from "@/lib/utils";

interface Props {
  initial?: {
    id: string;
    name: string;
    slug: string;
    color: string;
    description?: string | null;
    visibility: GroupVisibility;
    joinMode: JoinMode;
  };
}

export function GroupForm({ initial }: Props) {
  const [color, setColor] = useState(initial?.color ?? "#3366cc");
  const [visibility, setVisibility] = useState<GroupVisibility>(initial?.visibility ?? "PUBLIC_LISTED");
  const [joinMode, setJoinMode] = useState<JoinMode>(initial?.joinMode ?? "REQUEST");
  const [pending, start] = useTransition();

  // "Advanced" reveals raw visibility + joinMode pickers for users who want a
  // combination no preset captures (e.g. PUBLIC_LISTED + INVITE_ONLY).
  const presetMatch = matchPreset(visibility, joinMode);
  const [showAdvanced, setShowAdvanced] = useState(!presetMatch);

  function onSubmit(formData: FormData) {
    start(async () => {
      const payload = {
        name: formData.get("name") as string,
        slug: (formData.get("slug") as string) || undefined,
        color,
        description: (formData.get("description") as string) || undefined,
        visibility,
        joinMode,
      };
      try {
        if (initial) {
          await updateGroup(initial.id, payload);
          toast.success("Group updated");
        } else {
          // createGroup redirects on success, so this branch's toast won't show
          await createGroup(payload);
        }
      } catch (e: unknown) {
        // redirect() throws a NEXT_REDIRECT signal; re-throw so Next handles it.
        if (e instanceof Error && (e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) {
          throw e;
        }
        toast.error(e instanceof Error ? e.message : "Couldn't save group");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-7">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Group name</Label>
          <Input id="name" name="name" required defaultValue={initial?.name} placeholder="Brick Lane Book Club" />
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <Label htmlFor="slug">URL slug</Label>
            <Input id="slug" name="slug" defaultValue={initial?.slug} placeholder="auto-generated from the name" />
          </div>
          <div>
            <Label>Color</Label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Group accent color"
              className="h-9 w-16 cursor-pointer rounded-md border border-input"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} defaultValue={initial?.description ?? ""} placeholder="What kind of community is this? What kind of events do you host?" />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="font-display text-base font-medium tracking-tight">Who can see this group, and how do they join?</h2>
          <p className="text-sm text-muted-foreground">
            You can change this later. Most groups land on <em>Public · Request</em>.
          </p>
        </div>
        <VisibilityPresetPicker
          visibility={visibility}
          joinMode={joinMode}
          onChange={({ visibility: v, joinMode: j }) => {
            setVisibility(v);
            setJoinMode(j);
          }}
        />

        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showAdvanced && "rotate-180")} />
          {showAdvanced ? "Hide" : "Show"} advanced visibility controls
        </button>

        {showAdvanced && (
          <div className="grid gap-3 rounded-md border border-input bg-muted/20 p-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as GroupVisibility)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC_LISTED">Public (listed in directory)</SelectItem>
                  <SelectItem value="MEMBERS_VISIBLE">Visible to logged-in members</SelectItem>
                  <SelectItem value="INVITE_ONLY">Invite-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Join mode</Label>
              <Select value={joinMode} onValueChange={(v) => setJoinMode(v as JoinMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open (anyone can join)</SelectItem>
                  <SelectItem value="REQUEST">Request to join</SelectItem>
                  <SelectItem value="INVITE_ONLY">Invite-only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!presetMatch && (
              <p className="sm:col-span-2 text-xs text-muted-foreground">
                Custom combination — none of the {PRESETS.length} presets match. Switch to a preset for clearer messaging in the UI.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" disabled={pending} size="lg">
          {pending ? "Saving…" : initial ? "Save changes" : "Create group"}
        </Button>
      </div>
    </form>
  );
}
