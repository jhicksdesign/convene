"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Uploader } from "@/components/common/uploader";
import { TimezoneSelect, detectBrowserTimezone } from "@/components/ui/timezone-select";
import { HomeLocationPicker } from "@/components/settings/home-location-picker";
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
  const [timezone, setTimezone] = useState<string>(initial.timezone);
  const [homeLat, setHomeLat] = useState<number | null>(initial.homeLat ?? null);
  const [homeLng, setHomeLng] = useState<number | null>(initial.homeLng ?? null);

  // Suggest the browser's timezone when it differs from the saved one, but
  // never silently overwrite — the user might be filling this in from a
  // travel laptop.
  const detected = useMemo(() => detectBrowserTimezone(), []);
  const suggestDetected = detected && detected !== timezone;

  function onSubmit(form: FormData) {
    start(async () => {
      try {
        await updateProfile({
          displayName: form.get("displayName"),
          pronouns: form.get("pronouns") || undefined,
          bio: form.get("bio") || undefined,
          avatarUrl,
          timezone,
          homeLat,
          homeLng,
        });
        toast.success("Profile updated");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't save profile");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Uploader kind="avatar" onUploaded={setAvatarUrl} label="Replace avatar" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <Input id="pronouns" name="pronouns" defaultValue={initial.pronouns ?? ""} placeholder="they/them, she/her…" />
        </div>
      </div>

      <div>
        <Label htmlFor="bio">Bio</Label>
        <Textarea id="bio" name="bio" rows={3} defaultValue={initial.bio ?? ""} placeholder="A sentence or two so admins know who's joining." />
      </div>

      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <TimezoneSelect id="timezone" value={timezone} onChange={setTimezone} />
        <p className="mt-1 text-xs text-muted-foreground">
          Events and digests render in your local time.
          {suggestDetected && (
            <>
              {" "}
              <button
                type="button"
                onClick={() => setTimezone(detected!)}
                className="underline hover:text-foreground"
              >
                Use browser-detected: {detected}
              </button>
            </>
          )}
        </p>
      </div>

      <HomeLocationPicker
        lat={homeLat}
        lng={homeLng}
        onChange={({ lat, lng }) => {
          setHomeLat(lat);
          setHomeLng(lng);
        }}
      />

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      </div>
    </form>
  );
}
