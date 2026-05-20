"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { setSignalsOptIn } from "@/app/_actions/groups";

export function SignalsOptIn({ groupId }: { groupId: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turn on the signals dashboard?</DialogTitle>
          <DialogDescription>
            The signals dashboard shows aggregate, anonymous patterns about your group:
            attendance overlap with other groups (top 3), a 90-day GOING trend, and a count of
            regulars who have stopped attending. We never expose individual member identities
            to admins of groups those members aren't in.
            <br /><br />
            You can turn this off at any time from the group settings.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Not now</Button>
          </DialogClose>
          <Button
            disabled={pending}
            onClick={() => start(async () => { await setSignalsOptIn(groupId, true); setOpen(false); })}
          >
            Turn it on
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SignalsToggleOff({ groupId }: { groupId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(() => setSignalsOptIn(groupId, false))}
    >
      Turn signals off
    </Button>
  );
}
