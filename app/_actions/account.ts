"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { profileUpdate, privacyUpdate } from "@/lib/schemas";

export async function updateProfile(input: unknown) {
  const data = profileUpdate.parse(input);
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: {
      displayName: data.displayName,
      pronouns: data.pronouns ?? null,
      bio: data.bio ?? null,
      avatarUrl: data.avatarUrl ?? null,
      timezone: data.timezone,
      homeLat: data.homeLat ?? null,
      homeLng: data.homeLng ?? null,
    },
  });
  revalidatePath("/settings");
}

export async function updatePrivacy(input: unknown) {
  const data = privacyUpdate.parse(input);
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data });
  revalidatePath("/settings/privacy");
}

export async function updateNotificationPrefs(prefs: Record<string, { inApp: boolean; email: boolean }>) {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { notificationPrefs: prefs } });
}

export async function rotateICalToken(): Promise<string> {
  const user = await requireUser();
  const token = randomBytes(24).toString("hex");
  await db.user.update({ where: { id: user.id }, data: { iCalToken: token } });
  return token;
}

export async function revokeICalToken() {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { iCalToken: null } });
}

/** §8.9 — export everything we hold about the user as JSON. */
export async function exportUserData(): Promise<unknown> {
  const user = await requireUser();
  const [profile, rsvps, notesAbout, reportsFiled, vouchesGiven, vouchesReceived] = await Promise.all([
    db.user.findUnique({ where: { id: user.id } }),
    db.rSVP.findMany({ where: { userId: user.id }, include: { event: { select: { title: true, startsAt: true } } } }),
    db.adminNote.findMany({ where: { subjectUserId: user.id }, select: { body: true, groupId: true, createdAt: true } }),
    db.incidentReport.findMany({ where: { reporterId: user.id } }),
    db.vouch.findMany({ where: { voucherId: user.id } }),
    db.vouch.findMany({ where: { voucheeId: user.id } }),
  ]);
  return { profile, rsvps, notesAbout, reportsFiled, vouchesGiven, vouchesReceived };
}

/** §8.9 — soft-delete with 30-day grace; cron does the hard delete. */
export async function softDeleteAccount() {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: {
      deletedAt: new Date(),
      displayName: "Deleted user",
      avatarUrl: null,
      bio: null,
      searchable: false,
      showOnAttendeeLists: false,
      iCalToken: null,
    },
  });
  // Sessions cleared so the user is logged out
  await db.session.deleteMany({ where: { userId: user.id } });
}
