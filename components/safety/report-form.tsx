"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Uploader } from "@/components/common/uploader";
import { UserCombobox } from "@/components/common/user-combobox";
import { EventCombobox, type EventOption } from "@/components/common/event-combobox";
import { submitReport } from "@/app/_actions/reports";
import { useRouter } from "next/navigation";

const MAX_FILES = 5;

interface SubjectUser { id: string; displayName: string; avatarUrl: string | null }

interface Props {
  initialSubject?: SubjectUser | null;
  initialEvent?: EventOption | null;
}

export function ReportForm({ initialSubject, initialEvent }: Props) {
  const [pending, start] = useTransition();
  const [confidential, setConfidential] = useState(false);
  const [shareWithSafetyNetwork, setShare] = useState(false);
  const [subject, setSubject] = useState<SubjectUser | null>(initialSubject ?? null);
  const [event, setEvent] = useState<EventOption | null>(initialEvent ?? null);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const router = useRouter();

  function addEvidence(url: string) {
    setEvidenceUrls((prev) => (prev.length >= MAX_FILES ? prev : [...prev, url]));
  }
  function removeEvidence(url: string) {
    setEvidenceUrls((prev) => prev.filter((u) => u !== url));
  }

  function onSubmit(form: FormData) {
    start(async () => {
      try {
        const r = await submitReport({
          subjectId: subject?.id ?? null,
          eventId: event?.id ?? null,
          body: form.get("body") as string,
          evidenceUrls,
          confidential,
          shareWithSafetyNetwork,
        });
        toast.success("Report submitted — admins have been notified.");
        router.push(`/reports/${r.id}`);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't submit report");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <Label>Who is this about? <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <UserCombobox value={subject} onChange={setSubject} placeholder="Search by name…" />
      </div>
      <div>
        <Label>Which event? <span className="font-normal text-muted-foreground">(optional)</span></Label>
        <EventCombobox value={event} onChange={setEvent} placeholder="Search by event title…" />
      </div>
      <div>
        <Label htmlFor="body">What happened?</Label>
        <Textarea id="body" name="body" rows={8} required minLength={10} placeholder="Describe the incident. Be specific about what happened, when, and who saw it." />
      </div>

      <div className="space-y-2">
        <Label>Evidence files <span className="font-normal text-muted-foreground">(optional, up to {MAX_FILES})</span></Label>
        {evidenceUrls.length > 0 && (
          <ul className="space-y-1">
            {evidenceUrls.map((url) => (
              <li key={url} className="flex items-center justify-between rounded border bg-muted px-2 py-1 text-xs">
                <span className="truncate">{url.split("/").pop()}</span>
                <button type="button" onClick={() => removeEvidence(url)} className="text-destructive hover:underline">
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {evidenceUrls.length < MAX_FILES && (
          <Uploader kind="evidence" onUploaded={addEvidence} multiple />
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={confidential} onCheckedChange={(v) => setConfidential(!!v)} />
        Keep confidential — subject will not be notified pending admin review.
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={shareWithSafetyNetwork} onCheckedChange={(v) => setShare(!!v)} />
        Share with safety network of subject's groups (where opted-in).
      </label>
      <Button type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit report"}</Button>
    </form>
  );
}
