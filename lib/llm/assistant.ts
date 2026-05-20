// PRD §11.1 — natural-language admin assistant for date suggestions.
import { runLLM, extractJSON } from "@/lib/anthropic";
import { db } from "@/lib/db";
import { addDays, startOfDay } from "date-fns";

export interface DateSuggestion {
  date: string; // YYYY-MM-DD
  reasoning: string;
}

const SYSTEM = `You suggest dates for events in a community calendar.
Inputs are: a natural-language question from an admin, the upcoming events of
all tracked groups (next 60 days), the convention calendar, and the requesting
group's recent attendance pattern.

Return 2-3 suggestions in JSON, each with a YYYY-MM-DD date and ONE sentence
of reasoning. Prefer dates with: no hard conflicts, no co-located conventions,
matching weekday for the group's typical pattern.

Respond ONLY with a fenced \`\`\`json block: { "suggestions": [{date, reasoning}, ...] }.`;

export async function suggestDates(
  userId: string,
  groupId: string,
  question: string,
): Promise<DateSuggestion[]> {
  const horizonEnd = addDays(startOfDay(new Date()), 60);
  const [events, conventions, group] = await Promise.all([
    db.event.findMany({
      where: { startsAt: { gte: new Date(), lte: horizonEnd }, status: { in: ["CONFIRMED", "TENTATIVE"] } },
      select: { title: true, startsAt: true, endsAt: true, owningGroup: { select: { name: true } } },
      take: 200,
    }),
    db.convention.findMany({ where: { endDate: { gte: new Date() } } }),
    db.group.findUnique({ where: { id: groupId }, select: { name: true } }),
  ]);

  const context = JSON.stringify({
    requestingGroup: group?.name,
    question,
    upcomingEvents: events.map((e) => ({
      title: e.title,
      starts: e.startsAt.toISOString(),
      ends: e.endsAt.toISOString(),
      group: e.owningGroup.name,
    })),
    conventions: conventions.map((c) => ({
      name: c.name,
      starts: c.startDate.toISOString(),
      ends: c.endDate.toISOString(),
      location: c.location,
    })),
  });

  const msg = await runLLM({
    userId,
    model: "sonnet",
    system: SYSTEM,
    cacheSystem: true,
    maxTokens: 800,
    messages: [{ role: "user", content: context }],
  });

  const parsed = extractJSON<{ suggestions: DateSuggestion[] }>(msg);
  return parsed?.suggestions ?? [];
}
