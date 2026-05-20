// PRD §10.3 — outbound announcement generation across 5 platforms.
import { runLLM, extractJSON } from "@/lib/anthropic";

export interface AnnouncementBundle {
  telegram: string;
  discord: string;
  twitter: string;
  fa: string; // FA journal BBCode
  email: string; // HTML
}

const SYSTEM = `You write event announcements for a furry-community calendar app.
Given event details, produce 5 platform-specific copies in JSON.

Constraints:
- telegram: markdown, <= 500 chars, opens with hook, ends with date+time+location.
- discord: markdown, can suggest a single :emoji: at the start, <= 1000 chars.
- twitter: <= 280 chars, include 1-2 relevant hashtags.
- fa: BBCode (journal style). Use [b], [url], [size=3]. ~150 words.
- email: plain HTML, no <html>/<body> wrapper. Inline tags only.

Tone: warm, inclusive, factual. Do not invent details. Don't use emojis other than the optional discord opener.

Respond ONLY with a fenced \`\`\`json block matching {telegram,discord,twitter,fa,email}.`;

export interface EventInput {
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  locationText?: string | null;
  cost?: string | null;
  groupName: string;
  accessibilityFlags?: string[];
}

export async function generateAnnouncements(userId: string, ev: EventInput): Promise<AnnouncementBundle | null> {
  const userPrompt = JSON.stringify({
    title: ev.title,
    description: ev.description,
    starts: ev.startsAt.toISOString(),
    ends: ev.endsAt.toISOString(),
    location: ev.locationText,
    cost: ev.cost,
    group: ev.groupName,
    accessibility: ev.accessibilityFlags ?? [],
  });
  const msg = await runLLM({
    userId,
    model: "sonnet",
    system: SYSTEM,
    cacheSystem: true,
    maxTokens: 2000,
    messages: [{ role: "user", content: userPrompt }],
  });
  return extractJSON<AnnouncementBundle>(msg);
}
