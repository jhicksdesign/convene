"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, isAdminOf } from "@/lib/auth-helpers";
import { canSeeEvent, blockedUserIds } from "@/lib/visibility";
import { eventCommentCreate, eventCommentEdit, eventCommentReactionToggle } from "@/lib/schemas";
import { rateLimit } from "@/lib/rate-limit";
import { bump } from "@/lib/realtime";
import { dispatchMany } from "@/lib/notifications";
import { fetchCommentPage, type CommentDTO } from "@/lib/comments";

const MAX_NOTIFY_FANOUT = 200;

function preview(body: string, fallback = "Shared an image"): string {
  const t = body.trim();
  if (!t) return fallback;
  return t.length > 140 ? `${t.slice(0, 140)}…` : t;
}

async function loadEventForComment(eventId: string) {
  return db.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, scope: true, owningGroupId: true, coHosts: { select: { groupId: true } } },
  });
}

/**
 * Post a message to an event's discussion thread. Anyone who can see the event
 * can post. @mentioned users (who can also see the event) get a targeted
 * EVENT_MENTION ping; everyone else already engaged gets an EVENT_COMMENT one.
 */
export async function postComment(input: unknown): Promise<CommentDTO> {
  const data = eventCommentCreate.parse(input);
  const user = await requireUser();

  const event = await loadEventForComment(data.eventId);
  if (!event) throw new Error("Event not found");
  if (!(await canSeeEvent(user.id, event))) throw new Error("Forbidden");

  // Anti-spam: cap posts per user-event so a thread can't be flooded.
  await rateLimit(`comment:${user.id}:${event.id}`, 30, 60 * 60 * 1000, "You're posting too fast — give it a minute.");

  const comment = await db.eventComment.create({
    data: { eventId: event.id, userId: user.id, body: data.body, imageUrl: data.imageUrl ?? null },
    include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
  });

  await bump(`event:${event.id}`);

  // Resolve mentions: only users who can see the event and aren't blocked/self.
  const blocked = await blockedUserIds(user.id);
  const mentioned = new Set<string>();
  for (const uid of data.mentionedUserIds) {
    if (uid === user.id || blocked.has(uid)) continue;
    if (await canSeeEvent(uid, event)) mentioned.add(uid);
  }

  const link = `/e/${event.id}#discussion`;
  if (mentioned.size > 0) {
    await dispatchMany([...mentioned], {
      category: "EVENT_MENTION",
      title: `${user.displayName} mentioned you in ${event.title}`,
      body: preview(data.body),
      link,
    });
  }

  // Everyone else already engaged (RSVP'd, or has posted before), minus the
  // author, blocked users, and anyone already pinged via a mention.
  const [rsvps, commenters] = await Promise.all([
    db.rSVP.findMany({ where: { eventId: event.id, status: { not: "NOT_GOING" } }, select: { userId: true } }),
    db.eventComment.findMany({ where: { eventId: event.id, deletedAt: null }, select: { userId: true }, distinct: ["userId"] }),
  ]);
  const recipients = new Set<string>();
  for (const r of rsvps) recipients.add(r.userId);
  for (const c of commenters) recipients.add(c.userId);
  recipients.delete(user.id);
  for (const b of blocked) recipients.delete(b);
  for (const m of mentioned) recipients.delete(m);

  await dispatchMany([...recipients].slice(0, MAX_NOTIFY_FANOUT), {
    category: "EVENT_COMMENT",
    title: `${user.displayName} commented on ${event.title}`,
    body: preview(data.body),
    link,
  });

  revalidatePath(`/e/${event.id}`);
  return {
    id: comment.id,
    body: comment.body,
    imageUrl: comment.imageUrl,
    createdAt: comment.createdAt.toISOString(),
    editedAt: null,
    user: comment.user,
    reactions: [],
  };
}

/** Edit your own comment. Stamps editedAt so the UI can show "(edited)". */
export async function editComment(input: unknown) {
  const data = eventCommentEdit.parse(input);
  const user = await requireUser();
  const comment = await db.eventComment.findUnique({
    where: { id: data.commentId },
    select: { userId: true, deletedAt: true, event: { select: { id: true } } },
  });
  if (!comment || comment.deletedAt) throw new Error("Comment not found");
  if (comment.userId !== user.id) throw new Error("Forbidden");

  await db.eventComment.update({
    where: { id: data.commentId },
    data: { body: data.body, editedAt: new Date() },
  });
  await bump(`event:${comment.event.id}`);
  revalidatePath(`/e/${comment.event.id}`);
}

/** Soft-delete a comment — author, or an admin of the owning/co-host group. */
export async function deleteComment(commentId: string) {
  const user = await requireUser();
  const comment = await db.eventComment.findUnique({
    where: { id: commentId },
    select: {
      userId: true,
      deletedAt: true,
      event: { select: { id: true, owningGroupId: true, coHosts: { select: { groupId: true } } } },
    },
  });
  if (!comment || comment.deletedAt) return;

  let allowed = comment.userId === user.id;
  if (!allowed) {
    const groupIds = [comment.event.owningGroupId, ...comment.event.coHosts.map((c) => c.groupId)];
    for (const gid of groupIds) {
      if (await isAdminOf(user.id, gid)) {
        allowed = true;
        break;
      }
    }
  }
  if (!allowed) throw new Error("Forbidden");

  await db.eventComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  await bump(`event:${comment.event.id}`);
  revalidatePath(`/e/${comment.event.id}`);
}

/** Toggle one of your emoji reactions on a comment. */
export async function toggleReaction(input: unknown) {
  const data = eventCommentReactionToggle.parse(input);
  const user = await requireUser();
  const comment = await db.eventComment.findUnique({
    where: { id: data.commentId },
    select: { id: true, deletedAt: true, event: { select: { id: true, scope: true, owningGroupId: true } } },
  });
  if (!comment || comment.deletedAt) throw new Error("Comment not found");
  if (!(await canSeeEvent(user.id, comment.event))) throw new Error("Forbidden");

  await rateLimit(`react:${user.id}:${comment.id}`, 60, 60 * 60 * 1000, "Too many reactions — slow down.");

  const existing = await db.eventCommentReaction.findUnique({
    where: { commentId_userId_emoji: { commentId: comment.id, userId: user.id, emoji: data.emoji } },
    select: { id: true },
  });
  if (existing) {
    await db.eventCommentReaction.delete({ where: { id: existing.id } });
  } else {
    await db.eventCommentReaction.create({
      data: { commentId: comment.id, userId: user.id, emoji: data.emoji },
    });
  }
  await bump(`event:${comment.event.id}`);
  revalidatePath(`/e/${comment.event.id}`);
}

/** Page backwards into thread history (older than `beforeIso`). */
export async function loadEarlierComments(eventId: string, beforeIso: string) {
  const user = await requireUser();
  const event = await loadEventForComment(eventId);
  if (!event) throw new Error("Event not found");
  if (!(await canSeeEvent(user.id, event))) throw new Error("Forbidden");
  return fetchCommentPage(eventId, user.id, { before: new Date(beforeIso) });
}

/** Mark the thread read up to now for the current user (clears the unread divider). */
export async function markThreadRead(eventId: string) {
  const user = await requireUser();
  await db.eventThreadRead.upsert({
    where: { userId_eventId: { userId: user.id, eventId } },
    create: { userId: user.id, eventId, lastReadAt: new Date() },
    update: { lastReadAt: new Date() },
  });
}
