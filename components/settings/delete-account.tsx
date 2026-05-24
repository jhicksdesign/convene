"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { softDeleteAccount } from "@/app/_actions/account";

export function DeleteAccount({ confirmValue, label }: { confirmValue: string; label: string }) {
  const [confirm, setConfirm] = useState("");
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const matches = confirm.trim().toLowerCase() === confirmValue.toLowerCase();

  function onDelete() {
    if (!matches) return;
    start(async () => {
      try {
        await softDeleteAccount();
        toast.success("Account scheduled for deletion. You're signed out.");
        router.push("/");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't delete account");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirm(""); }}>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete my account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete your account?
          </DialogTitle>
          <DialogDescription>
            This signs you out and anonymizes your name + avatar everywhere. You have <strong>30 days</strong>
            to restore by emailing support. After that, it's permanent.
            <br /><br />
            Attendance history is kept (anonymized) for admin accuracy.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="delete-confirm" className="text-sm">
            Type your {label} <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{confirmValue}</code> to confirm:
          </Label>
          <Input
            id="delete-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={confirmValue}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!matches || pending}
            onClick={onDelete}
          >
            {pending ? "Deleting…" : "Delete my account permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
