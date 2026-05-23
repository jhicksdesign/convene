"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { createGroup, updateGroup } from "@/app/_actions/groups";

interface Props {
  initial?: {
    id: string;
    name: string;
    slug: string;
    color: string;
    description?: string | null;
    visibility: "PUBLIC_LISTED" | "MEMBERS_VISIBLE" | "INVITE_ONLY";
    joinMode: "OPEN" | "REQUEST" | "INVITE_ONLY";
  };
}

export function GroupForm({ initial }: Props) {
  const [color, setColor] = useState(initial?.color ?? "#3366cc");
  const [visibility, setVisibility] = useState(initial?.visibility ?? "MEMBERS_VISIBLE");
  const [joinMode, setJoinMode] = useState(initial?.joinMode ?? "REQUEST");
  const [pending, start] = useTransition();

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
    <form action={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Group name</Label>
        <Input id="name" name="name" required defaultValue={initial?.name} />
      </div>
      <div>
        <Label htmlFor="slug">URL slug</Label>
        <Input id="slug" name="slug" defaultValue={initial?.slug} placeholder="auto-generated" />
      </div>
      <div>
        <Label>Color</Label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 cursor-pointer rounded-md border" />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={initial?.description ?? ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Visibility</Label>
          <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLIC_LISTED">Public (listed in directory)</SelectItem>
              <SelectItem value="MEMBERS_VISIBLE">Visible to logged-in members</SelectItem>
              <SelectItem value="INVITE_ONLY">Invite-only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Join mode</Label>
          <Select value={joinMode} onValueChange={(v) => setJoinMode(v as typeof joinMode)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">Open (anyone can join)</SelectItem>
              <SelectItem value="REQUEST">Request to join</SelectItem>
              <SelectItem value="INVITE_ONLY">Invite-only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : initial ? "Save changes" : "Create group"}</Button>
    </form>
  );
}
