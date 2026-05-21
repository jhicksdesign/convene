"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { proposeSafetyNetwork, confirmSafetyNetwork } from "@/app/_actions/groups";

interface Group { id: string; name: string; color: string }
interface Edge {
  otherGroup: Group;
  state: "proposed_by_us" | "incoming" | "active";
}

interface Props {
  groupId: string;
  candidateGroups: Group[];
  edges: Edge[];
}

export function SafetyNetworkPanel({ groupId, candidateGroups, edges }: Props) {
  const [target, setTarget] = useState<string>(candidateGroups[0]?.id ?? "");
  const [dialog, setDialog] = useState<{ kind: "propose" | "confirm"; otherId: string; otherName: string } | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    if (!dialog) return;
    setError(null);
    start(async () => {
      try {
        if (dialog.kind === "propose") {
          await proposeSafetyNetwork(groupId, dialog.otherId);
          toast.success(`Proposed safety-network partnership with ${dialog.otherName}.`);
        } else {
          await confirmSafetyNetwork(groupId, dialog.otherId);
          toast.success(`Safety-network active with ${dialog.otherName}.`);
        }
        setDialog(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Safety network sharing is mutual. When both sides confirm, your admin team and theirs
        can see admin notes and incident reports that the original author marked shareable.
        Turn this on only for groups whose admins you trust to act on that information.
      </p>

      <div>
        <h3 className="text-sm font-semibold">Active edges</h3>
        <ul className="mt-2 divide-y rounded-md border">
          {edges.filter((e) => e.state === "active").length === 0 && (
            <li className="p-3 text-xs text-muted-foreground">No active safety-network partners.</li>
          )}
          {edges.filter((e) => e.state === "active").map((e) => (
            <li key={e.otherGroup.id} className="flex items-center gap-2 p-3 text-sm">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.otherGroup.color }} />
              {e.otherGroup.name}
            </li>
          ))}
        </ul>
      </div>

      {edges.filter((e) => e.state === "incoming").length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Awaiting your confirmation</h3>
          <ul className="mt-2 divide-y rounded-md border">
            {edges.filter((e) => e.state === "incoming").map((e) => (
              <li key={e.otherGroup.id} className="flex items-center justify-between p-3 text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: e.otherGroup.color }} />
                  {e.otherGroup.name}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialog({ kind: "confirm", otherId: e.otherGroup.id, otherName: e.otherGroup.name })}
                >
                  Confirm
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {edges.filter((e) => e.state === "proposed_by_us").length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Pending their confirmation</h3>
          <ul className="mt-2 divide-y rounded-md border">
            {edges.filter((e) => e.state === "proposed_by_us").map((e) => (
              <li key={e.otherGroup.id} className="p-3 text-sm text-muted-foreground">
                {e.otherGroup.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {candidateGroups.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Propose new partner</h3>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger><SelectValue placeholder="Pick a group" /></SelectTrigger>
                <SelectContent>
                  {candidateGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!target}
              onClick={() => {
                const g = candidateGroups.find((c) => c.id === target);
                if (g) setDialog({ kind: "propose", otherId: g.id, otherName: g.name });
              }}
            >
              Propose
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(v) => { if (!v) { setDialog(null); setError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.kind === "confirm" ? `Accept partnership with ${dialog.otherName}?` : `Propose partnership to ${dialog?.otherName}?`}
            </DialogTitle>
            <DialogDescription>
              Your group's admins will be able to see incident reports and admin notes about your members that the other group's admins mark "share with safety network." The reverse is also true. This is intended for groups whose admins you trust. You can revoke later.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={run} disabled={pending}>
              {pending ? "Working…" : "I understand — turn it on"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
