"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createAdminNote, deleteAdminNote } from "@/app/_actions/admin-notes";

interface Note {
  id: string;
  body: string;
  shareWithSafetyNetwork: boolean;
  createdAt: string;
  authorDisplayName: string;
}

interface Props {
  subjectUserId: string;
  group: { id: string; name: string; color: string };
  notes: Note[];
}

export function AdminNoteEditor({ subjectUserId, group, notes }: Props) {
  const [body, setBody] = useState("");
  const [share, setShare] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    start(async () => {
      try {
        await createAdminNote({
          subjectUserId,
          groupId: group.id,
          body,
          shareWithSafetyNetwork: share,
        });
        setBody("");
        setShare(false);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save note");
      }
    });
  }

  function remove(id: string) {
    start(() => deleteAdminNote(id));
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: group.color }} />
        <h3 className="text-sm font-semibold">Admin notes — {group.name}</h3>
      </div>
      <ul className="space-y-2">
        {notes.length === 0 && <li className="text-xs text-muted-foreground">No notes yet.</li>}
        {notes.map((n) => (
          <li key={n.id} className="rounded border bg-background p-2 text-xs">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-muted-foreground">{n.authorDisplayName} · {new Date(n.createdAt).toLocaleDateString()}</span>
              <button onClick={() => remove(n.id)} className="text-destructive hover:underline" disabled={pending}>
                delete
              </button>
            </div>
            <p className="whitespace-pre-wrap">{n.body}</p>
            {n.shareWithSafetyNetwork && (
              <p className="mt-1 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
                shared with safety network
              </p>
            )}
          </li>
        ))}
      </ul>
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a private note about this user (visible to admins of this group only)…"
          rows={3}
        />
        <label className="flex items-center gap-2 text-xs">
          <Checkbox checked={share} onCheckedChange={(v) => setShare(!!v)} />
          Share with safety network
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button size="sm" onClick={submit} disabled={pending || body.trim().length === 0}>
          {pending ? "Saving…" : "Save note"}
        </Button>
      </div>
    </div>
  );
}
