"use client";

import { useState, useTransition } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Bundle {
  telegram: string;
  discord: string;
  twitter: string;
  email: string;
}

export function AnnouncementGenerator({ eventId }: { eventId: string }) {
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      const r = await fetch("/api/llm/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error === "rate_limit" ? "Daily LLM limit reached." : "Generation failed.");
        return;
      }
      const j = await r.json();
      setBundle(j.bundle);
    });
  }

  return (
    <div className="space-y-3">
      <Button onClick={run} disabled={pending}>{pending ? "Generating…" : "Generate announcements"}</Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {bundle && (
        <Tabs defaultValue="telegram">
          <TabsList>
            <TabsTrigger value="telegram">Telegram</TabsTrigger>
            <TabsTrigger value="discord">Discord</TabsTrigger>
            <TabsTrigger value="twitter">Twitter</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>
          {(["telegram","discord","twitter","email"] as const).map((k) => (
            <TabsContent key={k} value={k}>
              <div className="space-y-2">
                <Textarea value={bundle[k]} readOnly rows={k === "email" ? 12 : 6} />
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(bundle[k])}>
                  Copy
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
