import Link from "next/link";
import { format } from "date-fns";
import type { CalEvent } from "@/components/calendar/month-view";

export function AgendaView({ events }: { events: CalEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No upcoming events.</p>;
  }
  return (
    <ul className="overflow-hidden rounded-xl border bg-card" style={{ boxShadow: "var(--shadow-paper)" }}>
      {events.map((e, i) => {
        const cancelled = e.status === "CANCELLED";
        return (
          <li
            key={e.id + e.startsAt}
            className={`relative ${i > 0 ? "border-t border-border" : ""}`}
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1"
              style={{ backgroundColor: e.color }}
            />
            <Link
              href={`/e/${e.id}`}
              className="flex items-center gap-3 py-3 pl-5 pr-3 text-sm transition-colors hover:bg-accent/40"
            >
              <span className="w-32 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {format(new Date(e.startsAt), "EEE MMM d")}
                <span className="ml-1 text-foreground/80">{format(new Date(e.startsAt), "p")}</span>
              </span>
              <span className={`truncate font-medium ${cancelled ? "line-through text-muted-foreground" : ""}`}>
                {e.title}
              </span>
              <span className="ml-auto truncate text-xs text-muted-foreground">{e.groupName}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
