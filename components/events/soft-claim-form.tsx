"use client";

import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createSoftClaim } from "@/app/_actions/soft-claims";

export function SoftClaimForm({ groupId }: { groupId: string }) {
  const [pending, start] = useTransition();

  function onSubmit(form: FormData) {
    start(async () => {
      await createSoftClaim({
        groupId,
        date: form.get("date") as string,
        note: (form.get("note") as string) || undefined,
      });
    });
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-2">
      <div>
        <Label htmlFor="date">Date</Label>
        <Input id="date" name="date" type="date" required />
      </div>
      <div className="flex-1 min-w-48">
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" placeholder="planning a movie night…" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "…" : "Add soft-claim"}</Button>
    </form>
  );
}
