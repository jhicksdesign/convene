import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import type { CalEvent } from "@/components/calendar/month-view";

export function AgendaView({ events }: { events: CalEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing on the agenda"
        description="As communities post events that match your filters, they’ll line up here, soonest first."
      />
    );
  }
  return (
    <ul className="overflow-hidden rounded-xl border bg-card" style={{ boxShadow: "var(--shadow-paper)" }}>
      {events.map((e, i) => {
        const cancelled = e.status === "CANCELLED";
        const soft = e.isSoftClaim;
        const row = (
          <span className="flex items-center gap-3 py-3 pl-5 pr-3 text-sm">
            <span className="w-32 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
              {format(new Date(e.startsAt), "EEE MMM d")}
              {!soft && <span className="ml-1 text-foreground/80">{format(new Date(e.startsAt), "p")}</span>}
            </span>
            <span
              className={`truncate font-medium ${cancelled ? "text-muted-foreground line-through" : ""} ${soft ? "text-muted-foreground" : ""}`}
            >
              {e.title}
            </span>
            {/* Status vocabulary — each non-default state gets an unmistakable
                pill rather than relying on subtle strike/opacity alone. */}
            {cancelled && (
              <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
                cancelled
              </span>
            )}
            {soft && (
              <span className="shrink-0 rounded-full border border-dashed px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground" style={{ borderColor: e.color, color: e.color }}>
                hold
              </span>
            )}
            <span className="ml-auto truncate text-xs text-muted-foreground">{e.groupName}</span>
          </span>
        );
        return (
          <li key={e.id + e.startsAt} className={`relative ${i > 0 ? "border-t border-border" : ""}`}>
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 w-1 ${soft ? "opacity-60" : ""}`}
              style={
                soft
                  ? { backgroundImage: `repeating-linear-gradient(180deg, ${e.color} 0 3px, transparent 3px 6px)` }
                  : { backgroundColor: e.color }
              }
            />
            {/* Soft claims aren't real events yet — render them as static rows,
                not links, so a tap doesn't dead-end on a missing page. */}
            {soft ? (
              <div className="cursor-default">{row}</div>
            ) : (
              <Link href={`/e/${e.id}`} className="block transition-colors hover:bg-accent/40">
                {row}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
