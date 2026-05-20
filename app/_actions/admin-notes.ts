"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { adminNoteCreate } from "@/lib/schemas";

export async function createAdminNote(input: unknown) {
  const data = adminNoteCreate.parse(input);
  const admin = await requireAdmin(data.groupId);
  return db.adminNote.create({
    data: {
      authorAdminId: admin.id,
      subjectUserId: data.subjectUserId,
      groupId: data.groupId,
      body: data.body,
      shareWithSafetyNetwork: data.shareWithSafetyNetwork,
    },
  });
}

export async function updateAdminNote(noteId: string, body: string, shareWithSafetyNetwork: boolean) {
  const note = await db.adminNote.findUnique({ where: { id: noteId } });
  if (!note) return;
  await requireAdmin(note.groupId);
  await db.adminNote.update({ where: { id: noteId }, data: { body, shareWithSafetyNetwork } });
}

export async function deleteAdminNote(noteId: string) {
  const note = await db.adminNote.findUnique({ where: { id: noteId } });
  if (!note) return;
  await requireAdmin(note.groupId);
  await db.adminNote.delete({ where: { id: noteId } });
}
