import { format } from "date-fns";
import Link from "next/link";

interface Conflict {
  title: string;
  startsAt: string;
  endsAt: string;
  calendarLabel: string;
}

export function PersonalConflictBanner({ conflicts }: { conflicts: Conflict[] }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-foreground">
        Heads up — this overlaps something on your calendar
      </p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {conflicts.map((c, i) => (
          <li key={i}>
            <span className="font-medium text-foreground/90">{c.title}</span>
            {" · "}
            {format(new Date(c.startsAt), "EEE MMM d, p")} – {format(new Date(c.endsAt), "p")}
            <span className="text-xs"> · {c.calendarLabel}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Synced from{" "}
        <Link href="/settings/calendar-import" className="underline underline-offset-4">
          your imported calendars
        </Link>
        .
      </p>
    </div>
  );
}
