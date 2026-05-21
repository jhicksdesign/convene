"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Uploader } from "@/components/common/uploader";
import { updateProfile } from "@/app/_actions/account";

interface Initial {
  displayName: string;
  pronouns?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  timezone: string;
  homeLat?: number | null;
  homeLng?: number | null;
}

export function ProfileForm({ initial }: { initial: Initial }) {
  const [pending, start] = useTransition();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial.avatarUrl ?? null);
  const [displayName, setDisplayName] = useState(initial.displayName);

  function onSubmit(form: FormData) {
    start(async () => {
      try {
        await updateProfile({
          displayName: form.get("displayName"),
          pronouns: form.get("pronouns") || undefined,
          bio: form.get("bio") || undefined,
          avatarUrl,
          timezone: form.get("timezone"),
          homeLat: form.get("homeLat") ? Number(form.get("homeLat")) : null,
          homeLng: form.get("homeLng") ? Number(form.get("homeLng")) : null,
        });
        toast.success("Profile updated");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't save profile");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Uploader kind="avatar" onUploaded={setAvatarUrl} label="Replace avatar" />
        </div>
      </div>
      <div>
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="pronouns">Pronouns</Label>
        <Input id="pronouns" name="pronouns" defaultValue={initial.pronouns ?? ""} />
      </div>
      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" rows={4} defaultValue={initial.bio ?? ""} />
      </div>
      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Input id="timezone" name="timezone" defaultValue={initial.timezone} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="homeLat">Home latitude</Label>
          <Input id="homeLat" name="homeLat" type="number" step="any" defaultValue={initial.homeLat ?? ""} />
        </div>
        <div>
          <Label htmlFor="homeLng">Home longitude</Label>
          <Input id="homeLng" name="homeLng" type="number" step="any" defaultValue={initial.homeLng ?? ""} />
        </div>
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
    </form>
  );
}
