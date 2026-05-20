"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { proposeSafetyNetwork, confirmSafetyNetwork } from "@/app/_actions/groups";

interface Group { id: string; name: string; color: string }
interface Edge {
  otherGroup: Group;
  state: "proposed_by_us" | "incoming" | "active";
}

interface Props {
  groupId: string;
  candidateGroups: Group[]; // groups we can propose to (not ourselves, not already linked)
  edges: Edge[];
}

export function SafetyNetworkPanel({ groupId, candidateGroups, edges }: Props) {
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<string>(candidateGroups[0]?.id ?? "");

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
                <ConfirmDialog
                  triggerLabel="Confirm"
                  pending={pending}
                  onConfirm={() => start(() => confirmSafetyNetwork(groupId, e.otherGroup.id))}
                />
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
            <ConfirmDialog
              triggerLabel="Propose"
              pending={pending}
              onConfirm={() => start(() => proposeSafetyNetwork(groupId, target))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({ triggerLabel, pending, onConfirm }: { triggerLabel: string; pending: boolean; onConfirm: () => void }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={pending}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable safety-network sharing?</DialogTitle>
          <DialogDescription>
            Your group's admins will be able to see incident reports and admin notes about your members that the other group's admins mark "share with safety network." The reverse is also true. This is intended for groups whose admins you trust. You can revoke later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={onConfirm} disabled={pending}>I understand — turn it on</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
