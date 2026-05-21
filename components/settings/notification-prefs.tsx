"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateNotificationPrefs } from "@/app/_actions/account";

const CATEGORIES = [
  ["FRIEND_REQUEST", "Friend requests"],
  ["FRIEND_ACCEPTED", "Friend accepted"],
  ["VOUCH_RECEIVED", "Vouches"],
  ["EVENT_UPDATED", "Event updates"],
  ["EVENT_CANCELLED", "Event cancellations"],
  ["WAITLIST_PROMOTED", "Waitlist promotions"],
  ["CONDITIONAL_TRIGGERED", "Conditional RSVPs"],
  ["ADMIN_ACTION", "Admin actions against you"],
  ["REPORT_STATUS", "Report status updates"],
  ["WEEKLY_DIGEST", "Weekly digest"],
] as const;

type Prefs = Record<string, { inApp: boolean; email: boolean }>;

export function NotificationPrefs({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [pending, start] = useTransition();

  function toggle(cat: string, channel: "inApp" | "email", v: boolean) {
    setPrefs((p) => ({ ...p, [cat]: { ...(p[cat] ?? { inApp: true, email: true }), [channel]: v } }));
  }

  return (
    <div className="space-y-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-2">Category</th>
            <th className="py-2">In-app</th>
            <th className="py-2">Email</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map(([key, label]) => {
            const p = prefs[key] ?? { inApp: true, email: true };
            return (
              <tr key={key} className="border-t">
                <td className="py-2"><Label>{label}</Label></td>
                <td><Switch checked={p.inApp} onCheckedChange={(v) => toggle(key, "inApp", v)} /></td>
                <td><Switch checked={p.email} onCheckedChange={(v) => toggle(key, "email", v)} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Button
        onClick={() =>
          start(async () => {
            try {
              await updateNotificationPrefs(prefs);
              toast.success("Notification preferences updated");
            } catch (e: unknown) {
              toast.error(e instanceof Error ? e.message : "Couldn't save");
            }
          })
        }
        disabled={pending}
      >
        {pending ? "Saving…" : "Save preferences"}
      </Button>
    </div>
  );
}
