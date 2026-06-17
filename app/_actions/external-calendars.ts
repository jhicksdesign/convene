"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { externalCalendarUrlCreate, externalCalendarFileImport } from "@/lib/schemas";
import {
  assertSafeCalendarUrl,
  syncExternalCalendar,
  importICSText,
  CalendarFetchError,
} from "@/lib/ical-import";

const MAX_CALENDARS_PER_USER = 10;

// Distinct, legible defaults so multiple calendars are tellable apart on the
// overlay; the user can recolor any of them afterwards.
const COLOR_PALETTE = ["#64748B", "#0EA5E9", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B", "#EF4444", "#14B8A6"];

/** Returns the count, throwing if the user is already at the cap. */
async function assertUnderLimit(userId: string): Promise<number> {
  const count = await db.externalCalendar.count({ where: { userId } });
  if (count >= MAX_CALENDARS_PER_USER) {
    throw new Error(`You can subscribe to at most ${MAX_CALENDARS_PER_USER} calendars.`);
  }
  return count;
}

/** Subscribe a calendar by its private iCal (ICS) URL and pull it immediately. */
export async function addExternalCalendarUrl(input: unknown) {
  const data = externalCalendarUrlCreate.parse(input);
  const user = await requireUser();
  await rateLimit(`extcal:${user.id}`, 20, 60 * 60 * 1000, "Too many calendar changes — try again later.");
  const count = await assertUnderLimit(user.id);

  // Validate the URL shape (and SSRF-guard) before persisting.
  try {
    assertSafeCalendarUrl(data.url);
  } catch (e) {
    throw new Error(e instanceof CalendarFetchError ? e.message : "Invalid calendar URL.");
  }

  const cal = await db.externalCalendar.create({
    data: { userId: user.id, label: data.label, url: data.url, source: "ICS_URL", color: COLOR_PALETTE[count % COLOR_PALETTE.length] },
    select: { id: true },
  });

  const result = await syncExternalCalendar(cal.id);
  revalidatePath("/settings/calendar-import");
  // Surface the first-sync outcome to the caller; the row is kept either way
  // so the user can fix the URL and re-sync.
  return { id: cal.id, ...result };
}

/** One-off import of an uploaded .ics file (Apple/Outlook export, etc.). */
export async function importExternalCalendarFile(input: unknown) {
  const data = externalCalendarFileImport.parse(input);
  const user = await requireUser();
  await rateLimit(`extcal:${user.id}`, 20, 60 * 60 * 1000, "Too many calendar changes — try again later.");
  const existingCount = await assertUnderLimit(user.id);

  if (!data.ics.includes("BEGIN:VCALENDAR")) throw new Error("That file isn't an iCal (.ics) calendar.");

  const cal = await db.externalCalendar.create({
    data: { userId: user.id, label: data.label, source: "FILE", lastSyncedAt: new Date(), color: COLOR_PALETTE[existingCount % COLOR_PALETTE.length] },
    select: { id: true },
  });
  const count = await importICSText(cal.id, data.ics);
  revalidatePath("/settings/calendar-import");
  return { id: cal.id, ok: true, count };
}

export async function resyncExternalCalendar(calendarId: string) {
  const user = await requireUser();
  const cal = await db.externalCalendar.findUnique({
    where: { id: calendarId },
    select: { userId: true },
  });
  if (!cal || cal.userId !== user.id) throw new Error("Forbidden");
  const result = await syncExternalCalendar(calendarId);
  revalidatePath("/settings/calendar-import");
  return result;
}

async function ownedCalendar(calendarId: string, userId: string) {
  const cal = await db.externalCalendar.findUnique({ where: { id: calendarId }, select: { userId: true } });
  if (!cal || cal.userId !== userId) throw new Error("Forbidden");
}

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function setExternalCalendarColor(calendarId: string, color: string) {
  const user = await requireUser();
  await ownedCalendar(calendarId, user.id);
  if (!HEX.test(color)) throw new Error("Invalid color.");
  await db.externalCalendar.update({ where: { id: calendarId }, data: { color } });
  revalidatePath("/settings/calendar-import");
  revalidatePath("/calendar");
}

export async function setExternalCalendarEnabled(calendarId: string, enabled: boolean) {
  const user = await requireUser();
  await ownedCalendar(calendarId, user.id);
  await db.externalCalendar.update({ where: { id: calendarId }, data: { enabled } });
  revalidatePath("/settings/calendar-import");
  revalidatePath("/calendar");
}

export async function removeExternalCalendar(calendarId: string) {
  const user = await requireUser();
  const cal = await db.externalCalendar.findUnique({
    where: { id: calendarId },
    select: { userId: true },
  });
  if (!cal || cal.userId !== user.id) throw new Error("Forbidden");
  await db.externalCalendar.delete({ where: { id: calendarId } });
  revalidatePath("/settings/calendar-import");
}
