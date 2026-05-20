// Canonical recurrence helper. Calendar views and iCal export both call expand().
import { RRule, RRuleSet, rrulestr } from "rrule";
import { addMilliseconds } from "date-fns";

export interface EventInstance {
  parentId: string;
  startsAt: Date;
  endsAt: Date;
  isException: boolean;
}

interface RecurrentEvent {
  id: string;
  startsAt: Date;
  endsAt: Date;
  rrule?: string | null;
  recurrenceExceptions?: Date[];
}

/** Expand a possibly recurring event into instances overlapping [from, to]. */
export function expand(ev: RecurrentEvent, from: Date, to: Date): EventInstance[] {
  if (!ev.rrule) {
    if (ev.endsAt < from || ev.startsAt > to) return [];
    return [{ parentId: ev.id, startsAt: ev.startsAt, endsAt: ev.endsAt, isException: false }];
  }

  const duration = ev.endsAt.getTime() - ev.startsAt.getTime();
  const set = new RRuleSet();
  const rule = rrulestr(ev.rrule, { dtstart: ev.startsAt }) as RRule;
  set.rrule(rule);
  for (const ex of ev.recurrenceExceptions ?? []) set.exdate(ex);

  return set.between(from, to, true).map((dt) => ({
    parentId: ev.id,
    startsAt: dt,
    endsAt: addMilliseconds(dt, duration),
    isException: false,
  }));
}

export function expandAll(events: RecurrentEvent[], from: Date, to: Date): EventInstance[] {
  return events.flatMap((e) => expand(e, from, to));
}
