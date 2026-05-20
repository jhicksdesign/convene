"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

interface Group { id: string; name: string }
interface Suggestion { date: string; reasoning: string }

interface Props {
  groups: Group[];
  defaultGroupId?: string;
  onPickDate: (date: string) => void;
}

export function AssistantSidebar({ groups, defaultGroupId, onPickDate }: Props) {
  const [groupId, setGroupId] = useState<string>(defaultGroupId ?? groups[0]?.id ?? "");
  const [question, setQuestion] = useState("");
  const [pending, start] = useTransition();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  function ask() {
    setError(null);
    start(async () => {
      const r = await fetch("/api/llm/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, question }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        setError(j.error === "rate_limit" ? "Daily LLM limit reached." : "Couldn't reach assistant.");
        return;
      }
      const j = await r.json();
      setSuggestions((j.suggestions ?? []) as Suggestion[]);
    });
  }

  return (
    <aside className="space-y-3 rounded-md border bg-muted/30 p-4 lg:sticky lg:top-20">
      <h2 className="text-sm font-semibold">Ask the scheduling assistant</h2>
      <Select value={groupId} onValueChange={setGroupId}>
        <SelectTrigger><SelectValue placeholder="For which group?" /></SelectTrigger>
        <SelectContent>
          {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="e.g. 'Find a Saturday in May that doesn't conflict with conventions or other groups.'"
        rows={3}
      />
      <Button size="sm" onClick={ask} disabled={pending || question.length < 5 || !groupId}>
        {pending ? "Thinking…" : "Suggest dates"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {suggestions.length > 0 && (
        <ul className="space-y-1.5 pt-2">
          {suggestions.map((s) => (
            <li key={s.date} className="rounded border bg-background p-2">
              <button
                type="button"
                onClick={() => onPickDate(s.date)}
                className="text-sm font-medium hover:underline"
              >
                {new Date(s.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </button>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.reasoning}</p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
