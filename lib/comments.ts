// Shared shaping + pagination for event discussion threads, so the page's
// first render and the "load earlier" action return byte-identical DTOs.
import { db } from "@/lib/db";
import { blockedUserIds } from "@/lib/visibility";
import { COMMENT_REACTIONS } from "@/lib/schemas";

export const COMMENT_PAGE_SIZE = 50;

export interface ReactionSummary {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface CommentDTO {
  id: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  editedAt: string | null;
  user: { id: string; displayName: string; avatarUrl: string | null };
  reactions: ReactionSummary[];
}

type Row = {
  id: string;
  body: string;
  imageUrl: string | null;
  createdAt: Date;
  editedAt: Date | null;
  userId: string;
  user: { id: string; displayName: string; avatarUrl: string | null };
  reactions: { emoji: string; userId: string }[];
};

function shape(row: Row, viewerId: string): CommentDTO {
  const summary: ReactionSummary[] = [];
  for (const emoji of COMMENT_REACTIONS) {
    const matching = row.reactions.filter((r) => r.emoji === emoji);
    if (matching.length === 0) continue;
    summary.push({
      emoji,
      count: matching.length,
      mine: matching.some((r) => r.userId === viewerId),
    });
  }
  return {
    id: row.id,
    body: row.body,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    user: row.user,
    reactions: summary,
  };
}

const INCLUDE = {
  user: { select: { id: true, displayName: true, avatarUrl: true } },
  reactions: { select: { emoji: true, userId: true } },
} as const;

/**
 * Fetch one page of a thread, newest-page-first. `before` (exclusive) pages
 * backwards into history. Returns comments in ascending (chronological) order
 * plus whether older comments remain. Blocked users are stripped.
 */
export async function fetchCommentPage(
  eventId: string,
  viewerId: string,
  opts: { before?: Date } = {},
): Promise<{ comments: CommentDTO[]; hasMore: boolean }> {
  const rows = await db.eventComment.findMany({
    where: {
      eventId,
      deletedAt: null,
      ...(opts.before ? { createdAt: { lt: opts.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: COMMENT_PAGE_SIZE + 1,
    include: INCLUDE,
  });

  const hasMore = rows.length > COMMENT_PAGE_SIZE;
  const page = rows.slice(0, COMMENT_PAGE_SIZE);

  const blocked = await blockedUserIds(viewerId);
  const visible = page.filter((r) => !blocked.has(r.userId));

  // Reverse desc → asc so the thread reads top-to-bottom oldest-first.
  visible.reverse();
  return { comments: visible.map((r) => shape(r as Row, viewerId)), hasMore };
}
