"use client";

import { useState, useTransition } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { updatePrivacy } from "@/app/_actions/account";
import type { PrivacyUpdate } from "@/lib/schemas";

const VIS = ["PUBLIC", "MEMBERS", "GROUP", "FRIENDS", "PRIVATE"] as const;

export function PrivacyForm({ initial }: { initial: PrivacyUpdate }) {
  const [state, setState] = useState(initial);
  const [pending, start] = useTransition();

  function set<K extends keyof PrivacyUpdate>(k: K, v: PrivacyUpdate[K]) {
    setState((s) => ({ ...s, [k]: v }));
  }

  return (
    <div className="space-y-4">
      {(["profileVisibility", "attendanceVisibility", "rsvpVisibility"] as const).map((k) => (
        <div key={k} className="flex items-center justify-between">
          <Label>{k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</Label>
          <Select value={state[k]} onValueChange={(v) => set(k, v as typeof state[typeof k])}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{VIS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Label>Searchable</Label>
        <Switch checked={state.searchable} onCheckedChange={(v) => set("searchable", v)} />
      </div>
      <div className="flex items-center justify-between">
        <Label>Show on attendee lists</Label>
        <Switch checked={state.showOnAttendeeLists} onCheckedChange={(v) => set("showOnAttendeeLists", v)} />
      </div>
      <Button onClick={() => start(() => updatePrivacy(state))} disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
