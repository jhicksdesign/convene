"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Uploader } from "@/components/common/uploader";
import { submitReport } from "@/app/_actions/reports";
import { useRouter } from "next/navigation";

const MAX_FILES = 5;

export function ReportForm({ initialSubjectId, initialEventId }: { initialSubjectId?: string; initialEventId?: string }) {
  const [pending, start] = useTransition();
  const [confidential, setConfidential] = useState(false);
  const [shareWithSafetyNetwork, setShare] = useState(false);
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
      const r = await submitReport({
        subjectId: (form.get("subjectId") as string) || initialSubjectId || null,
        eventId: (form.get("eventId") as string) || initialEventId || null,
        body: form.get("body") as string,
        evidenceUrls,
        confidential,
        shareWithSafetyNetwork,
      });
      router.push(`/reports/${r.id}`);
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="subjectId">Subject user ID (optional)</Label>
        <Input id="subjectId" name="subjectId" defaultValue={initialSubjectId} />
      </div>
      <div>
        <Label htmlFor="eventId">Event ID (optional)</Label>
        <Input id="eventId" name="eventId" defaultValue={initialEventId} />
      </div>
      <div>
        <Label htmlFor="body">What happened?</Label>
        <Textarea id="body" name="body" rows={8} required minLength={10} />
      </div>

      <div className="space-y-2">
        <Label>Evidence files (optional, up to {MAX_FILES})</Label>
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
