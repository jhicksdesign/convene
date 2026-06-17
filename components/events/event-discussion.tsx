"use client";

import { useState, useRef, useEffect, useMemo, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Uploader } from "@/components/common/uploader";
import { COMMENT_REACTIONS } from "@/lib/schemas";
import type { CommentDTO } from "@/lib/comments";
import {
  postComment,
  editComment,
  deleteComment,
  toggleReaction,
  loadEarlierComments,
  markThreadRead,
} from "@/app/_actions/comments";

interface MentionUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Props {
  eventId: string;
  currentUserId: string;
  canModerate: boolean;
  comments: CommentDTO[];
  hasMore: boolean;
  lastReadAt: string | null;
}

const URL_RE = /(https?:\/\/[^\s]+)/g;

function renderBody(text: string) {
  // Linkify bare URLs; everything else renders as plain text.
  return text.split(URL_RE).map((part, i) =>
    URL_RE.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-primary underline underline-offset-2"
      >
        {part}
      </a>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function Avatar({ user }: { user: MentionUser }) {
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase text-muted-foreground">
      {user.displayName.charAt(0)}
    </span>
  );
}

export function EventDiscussion({ eventId, currentUserId, canModerate, comments, hasMore, lastReadAt }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Pagination state: `comments` (props) is the latest page; `earlier` holds
  // older pages we've loaded. `justPosted` is the local optimistic overlay.
  // `olderHasMore` starts from the prop and is then owned by the load-earlier
  // flow (the server response tells us whether even-older pages remain).
  const [earlier, setEarlier] = useState<CommentDTO[]>([]);
  const [justPosted, setJustPosted] = useState<CommentDTO[]>([]);
  const [olderHasMore, setOlderHasMore] = useState(hasMore);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const displayed = useMemo(() => {
    const map = new Map<string, CommentDTO>();
    for (const c of justPosted) map.set(c.id, c);
    // Server rows overwrite optimistic duplicates (they carry reactions/edits).
    for (const c of [...earlier, ...comments]) map.set(c.id, c);
    return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }, [earlier, comments, justPosted]);

  // Mark read once on mount so the next visit's "new" divider is accurate.
  useEffect(() => {
    markThreadRead(eventId).catch(() => {});
  }, [eventId]);

  // Index of the first comment newer than the viewer's last visit.
  const firstUnreadIdx = useMemo(() => {
    if (!lastReadAt) return -1;
    return displayed.findIndex((c) => c.createdAt > lastReadAt && c.user.id !== currentUserId);
  }, [displayed, lastReadAt, currentUserId]);

  // ── compose ──────────────────────────────────────────────────────
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionUser[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // @mention autocomplete
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<MentionUser[]>([]);
  const mentionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Only the async fetch lives here; clearing results happens in the input
    // handlers (synchronous setState in an effect body is discouraged).
    if (mentionQuery == null || mentionQuery.length < 1) return;
    if (mentionTimer.current) clearTimeout(mentionTimer.current);
    mentionTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/events/${eventId}/mentionables?q=${encodeURIComponent(mentionQuery)}`);
        if (r.ok) setMentionResults((await r.json()).results as MentionUser[]);
      } catch {
        /* ignore */
      }
    }, 200);
    return () => {
      if (mentionTimer.current) clearTimeout(mentionTimer.current);
    };
  }, [mentionQuery, eventId]);

  function onBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setBody(value);
    const caret = e.target.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const m = /(?:^|\s)@([^\s@]{0,30})$/.exec(before);
    const q = m ? m[1] : null;
    setMentionQuery(q);
    if (!q) setMentionResults([]);
  }

  function pickMention(u: MentionUser) {
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? body.length;
    const before = body.slice(0, caret);
    const after = body.slice(caret);
    const replaced = before.replace(/(^|\s)@([^\s@]{0,30})$/, `$1@${u.displayName} `);
    const next = replaced + after;
    setBody(next);
    setMentions((prev) => (prev.some((p) => p.id === u.id) ? prev : [...prev, u]));
    setMentionQuery(null);
    setMentionResults([]);
    queueMicrotask(() => {
      el?.focus();
      const pos = replaced.length;
      el?.setSelectionRange(pos, pos);
    });
  }

  function resetCompose() {
    setBody("");
    setImageUrl(null);
    setMentions([]);
    setMentionQuery(null);
    setMentionResults([]);
  }

  function submit() {
    const text = body.trim();
    if (!text && !imageUrl) return;
    // Only keep mentions whose token still survives in the text.
    const mentionedUserIds = mentions.filter((m) => text.includes(`@${m.displayName}`)).map((m) => m.id);
    start(async () => {
      try {
        const created = await postComment({ eventId, body: text, imageUrl, mentionedUserIds });
        setJustPosted((prev) => [...prev, created]);
        resetCompose();
        textareaRef.current?.focus();
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't post");
      }
    });
  }

  async function onLoadEarlier() {
    const oldest = displayed[0];
    if (!oldest) return;
    setLoadingEarlier(true);
    try {
      const res = await loadEarlierComments(eventId, oldest.createdAt);
      setEarlier((prev) => [...res.comments, ...prev]);
      setOlderHasMore(res.hasMore);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't load earlier messages");
    } finally {
      setLoadingEarlier(false);
    }
  }

  function react(commentId: string, emoji: string) {
    start(async () => {
      try {
        await toggleReaction({ commentId, emoji });
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't react");
      }
    });
  }

  function remove(id: string) {
    start(async () => {
      try {
        await deleteComment(id);
        setEarlier((prev) => prev.filter((c) => c.id !== id));
        setJustPosted((prev) => prev.filter((c) => c.id !== id));
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't remove");
      }
    });
  }

  return (
    <section id="discussion" className="space-y-3 scroll-mt-20">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Discussion{displayed.length > 0 ? ` · ${displayed.length}` : ""}
      </h2>

      {olderHasMore && (
        <button
          type="button"
          onClick={onLoadEarlier}
          disabled={loadingEarlier}
          className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {loadingEarlier ? "Loading…" : "Load earlier messages"}
        </button>
      )}

      <ul className="space-y-3">
        {displayed.length === 0 && (
          <li className="text-sm text-muted-foreground">
            No messages yet. Ask a question, coordinate a ride, or just say you&apos;re excited.
          </li>
        )}
        {displayed.map((c, idx) => (
          <Fragment key={c.id}>
            {idx === firstUnreadIdx && (
              <li className="flex items-center gap-2" aria-label="New messages">
                <span className="h-px flex-1 bg-primary/40" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">New</span>
                <span className="h-px flex-1 bg-primary/40" />
              </li>
            )}
            <CommentItem
              comment={c}
              currentUserId={currentUserId}
              canModerate={canModerate}
              pending={pending}
              onReact={react}
              onRemove={remove}
              onEdited={() => router.refresh()}
            />
          </Fragment>
        ))}
      </ul>

      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={onBodyChange}
            onKeyDown={(e) => {
              if (mentionQuery == null && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder="Add to the discussion… use @ to mention someone"
            className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {mentionQuery != null && mentionResults.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-auto rounded-md border bg-popover shadow-md">
              {mentionResults.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickMention(u);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <Avatar user={u} />
                    <span className="truncate">{u.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {imageUrl && (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="attachment" className="h-16 w-16 rounded-md object-cover" />
            <button type="button" onClick={() => setImageUrl(null)} className="text-xs text-muted-foreground hover:text-destructive">
              Remove image
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="text-xs">
              <Uploader kind="comment" onUploaded={(url) => setImageUrl(url)} />
            </div>
            <span className="hidden text-xs text-muted-foreground sm:inline">⌘/Ctrl + Enter to send</span>
          </div>
          <Button size="sm" onClick={submit} disabled={pending || (!body.trim() && !imageUrl)}>
            {pending ? "…" : "Post"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function CommentItem({
  comment: c,
  currentUserId,
  canModerate,
  pending,
  onReact,
  onRemove,
  onEdited,
}: {
  comment: CommentDTO;
  currentUserId: string;
  canModerate: boolean;
  pending: boolean;
  onReact: (commentId: string, emoji: string) => void;
  onRemove: (id: string) => void;
  onEdited: () => void;
}) {
  const mine = c.user.id === currentUserId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [savePending, startSave] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  function save() {
    const text = draft.trim();
    if (!text) return;
    startSave(async () => {
      try {
        await editComment({ commentId: c.id, body: text });
        setEditing(false);
        onEdited();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Couldn't save");
      }
    });
  }

  return (
    <li className="flex gap-3">
      <Avatar user={c.user} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link href={`/u/${c.user.id}`} className="text-sm font-medium underline-offset-4 hover:underline">
            {c.user.displayName}
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
            {c.editedAt && <span className="ml-1">(edited)</span>}
          </span>
          {(mine || canModerate) && !editing && (
            <span className="ml-auto flex gap-2">
              {mine && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(c.body);
                    setEditing(true);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                disabled={pending}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            </span>
          )}
        </div>

        {editing ? (
          <div className="mt-1 space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              maxLength={4000}
              className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={savePending || !draft.trim()}>
                {savePending ? "…" : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {c.body && (
              <p className="whitespace-pre-wrap break-words text-sm text-foreground/90">{renderBody(c.body)}</p>
            )}
            {c.imageUrl && (
              <a href={c.imageUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={c.imageUrl}
                  alt="attachment"
                  className="max-h-64 rounded-md border object-cover"
                />
              </a>
            )}
          </>
        )}

        {/* Reactions */}
        {!editing && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {c.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                disabled={pending}
                onClick={() => onReact(c.id, r.emoji)}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
                  r.mine ? "border-primary/50 bg-primary/10" : "border-border hover:bg-accent"
                }`}
                aria-pressed={r.mine}
              >
                <span>{r.emoji}</span>
                <span className="font-mono tabular-nums text-muted-foreground">{r.count}</span>
              </button>
            ))}
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="rounded-full border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent"
                aria-label="Add reaction"
              >
                ＋
              </button>
              {pickerOpen && (
                <div className="absolute left-0 top-full z-20 mt-1 flex gap-1 rounded-md border bg-popover p-1 shadow-md">
                  {COMMENT_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        onReact(c.id, emoji);
                        setPickerOpen(false);
                      }}
                      className="rounded p-1 text-base hover:bg-accent"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
