import Link from "next/link";
import { format } from "date-fns";
import type { CalEvent } from "@/components/calendar/month-view";

export function AgendaView({ events }: { events: CalEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming events.</p>;
  }
  return (
    <ul className="divide-y rounded-md border bg-background">
      {events.map((e) => (
        <li key={e.id + e.startsAt} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
          <span className="w-32 shrink-0 text-xs text-muted-foreground">{format(new Date(e.startsAt), "EEE MMM d, p")}</span>
          <Link href={`/e/${e.id}`} className="truncate hover:underline">{e.title}</Link>
          <span className="ml-auto truncate text-xs text-muted-foreground">{e.groupName}</span>
        </li>
      ))}
    </ul>
  );
}
