"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  addExternalCalendarUrl,
  importExternalCalendarFile,
  resyncExternalCalendar,
  removeExternalCalendar,
  setExternalCalendarColor,
  setExternalCalendarEnabled,
} from "@/app/_actions/external-calendars";

export interface ExternalCalendarRow {
  id: string;
  label: string;
  source: string;
  url: string | null;
  color: string;
  enabled: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  eventCount: number;
}

export function ExternalCalendars({ initial }: { initial: ExternalCalendarRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");

  function addUrl() {
    if (!label.trim() || !url.trim()) return;
    start(async () => {
      try {
        const res = await addExternalCalendarUrl({ label: label.trim(), url: url.trim() });
        if (res.ok) toast.success(`Imported ${res.count} event${res.count === 1 ? "" : "s"}.`);
        else toast.error(res.error ?? "Saved, but the first sync failed — check the URL and re-sync.");
        setLabel("");
        setUrl("");
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't add calendar");
      }
    });
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const name = file.name.replace(/\.ics$/i, "") || "Imported calendar";
    start(async () => {
      try {
        const text = await file.text();
        const res = await importExternalCalendarFile({ label: name, ics: text });
        toast.success(`Imported ${res.count} event${res.count === 1 ? "" : "s"}.`);
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't import file");
      }
    });
  }

  function resync(id: string) {
    start(async () => {
      try {
        const res = await resyncExternalCalendar(id);
        if (res.ok) toast.success(`Synced ${res.count} event${res.count === 1 ? "" : "s"}.`);
        else toast.error(res.error ?? "Sync failed");
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Sync failed");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      try {
        await removeExternalCalendar(id);
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't remove");
      }
    });
  }

  function recolor(id: string, color: string) {
    start(async () => {
      try {
        await setExternalCalendarColor(id, color);
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't update color");
      }
    });
  }

  function toggleEnabled(id: string, enabled: boolean) {
    start(async () => {
      try {
        await setExternalCalendarEnabled(id, enabled);
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't update");
      }
    });
  }

  return (
    <div className="space-y-6">
      {initial.length > 0 && (
        <ul className="space-y-2">
          {initial.map((c) => (
            <li key={c.id} className={`rounded-md border bg-card p-3 ${c.enabled ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative h-4 w-4 shrink-0 cursor-pointer rounded-full ring-1 ring-border" style={{ backgroundColor: c.color }} title="Calendar color">
                  <input
                    type="color"
                    value={c.color}
                    disabled={pending}
                    onChange={(e) => recolor(c.id, e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label={`Color for ${c.label}`}
                  />
                </label>
                <span className="font-medium">{c.label}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {c.source === "FILE" ? "file" : "subscription"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.eventCount} event{c.eventCount === 1 ? "" : "s"}
                </span>
                <div className="ml-auto flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Switch checked={c.enabled} disabled={pending} onCheckedChange={(v) => toggleEnabled(c.id, v)} />
                    Show
                  </label>
                  {c.source === "ICS_URL" && (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => resync(c.id)}>
                      Re-sync
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => remove(c.id)}>
                    Remove
                  </Button>
                </div>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.lastError ? (
                  <span className="text-destructive">⚠ {c.lastError}</span>
                ) : c.lastSyncedAt ? (
                  `Last synced ${new Date(c.lastSyncedAt).toLocaleString()}`
                ) : (
                  "Not synced yet"
                )}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-md border bg-muted/30 p-4">
        <h2 className="text-sm font-semibold">Subscribe by URL</h2>
        <p className="text-xs text-muted-foreground">
          In Google Calendar: Settings → your calendar → <em>Secret address in iCal format</em>. In Apple
          Calendar: share a calendar and copy its public URL. We refresh it periodically and only read event
          titles and times.
        </p>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
          <div>
            <Label htmlFor="label">Name</Label>
            <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My Google calendar" />
          </div>
          <div>
            <Label htmlFor="url">iCal URL</Label>
            <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/basic.ics" />
          </div>
        </div>
        <Button size="sm" disabled={pending || !label.trim() || !url.trim()} onClick={addUrl}>
          {pending ? "…" : "Add calendar"}
        </Button>
      </div>

      <div className="space-y-2 rounded-md border bg-muted/30 p-4">
        <h2 className="text-sm font-semibold">Or import a one-off .ics file</h2>
        <input
          type="file"
          accept=".ics,text/calendar"
          disabled={pending}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
      </div>
    </div>
  );
}
