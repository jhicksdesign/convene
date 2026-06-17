-- In-event discussion threads + external calendar import.

-- Notification categories for thread replies and @mentions. (Postgres 16:
-- ADD VALUE is transaction-safe; the values are simply unused until commit.)
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'EVENT_COMMENT';
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'EVENT_MENTION';

-- ─── Event discussion threads ───────────────────────────────────────
CREATE TABLE "EventComment" (
  "id"        TEXT NOT NULL,
  "eventId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "imageUrl"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "editedAt"  TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "EventComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EventComment_eventId_createdAt_idx" ON "EventComment" ("eventId", "createdAt");

ALTER TABLE "EventComment"
  ADD CONSTRAINT "EventComment_eventId_fkey" FOREIGN KEY ("eventId")
    REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventComment_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventCommentReaction" (
  "id"        TEXT NOT NULL,
  "commentId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "emoji"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventCommentReaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventCommentReaction_commentId_userId_emoji_key"
  ON "EventCommentReaction" ("commentId", "userId", "emoji");
CREATE INDEX "EventCommentReaction_commentId_idx" ON "EventCommentReaction" ("commentId");

ALTER TABLE "EventCommentReaction"
  ADD CONSTRAINT "EventCommentReaction_commentId_fkey" FOREIGN KEY ("commentId")
    REFERENCES "EventComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventCommentReaction_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EventThreadRead" (
  "userId"     TEXT NOT NULL,
  "eventId"    TEXT NOT NULL,
  "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventThreadRead_pkey" PRIMARY KEY ("userId", "eventId")
);

ALTER TABLE "EventThreadRead"
  ADD CONSTRAINT "EventThreadRead_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventThreadRead_eventId_fkey" FOREIGN KEY ("eventId")
    REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── External calendar import ───────────────────────────────────────
CREATE TABLE "ExternalCalendar" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "label"        TEXT NOT NULL,
  "url"          TEXT,
  "source"       TEXT NOT NULL DEFAULT 'ICS_URL',
  "color"        TEXT NOT NULL DEFAULT '#64748B',
  "enabled"      BOOLEAN NOT NULL DEFAULT true,
  "lastSyncedAt" TIMESTAMP(3),
  "lastError"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalCalendar_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExternalCalendar_userId_idx" ON "ExternalCalendar" ("userId");

ALTER TABLE "ExternalCalendar"
  ADD CONSTRAINT "ExternalCalendar_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExternalCalendarEvent" (
  "id"         TEXT NOT NULL,
  "calendarId" TEXT NOT NULL,
  "uid"        TEXT NOT NULL,
  "title"      TEXT NOT NULL,
  "startsAt"   TIMESTAMP(3) NOT NULL,
  "endsAt"     TIMESTAMP(3) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalCalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalCalendarEvent_calendarId_uid_key" ON "ExternalCalendarEvent" ("calendarId", "uid");
CREATE INDEX "ExternalCalendarEvent_calendarId_startsAt_idx" ON "ExternalCalendarEvent" ("calendarId", "startsAt");

ALTER TABLE "ExternalCalendarEvent"
  ADD CONSTRAINT "ExternalCalendarEvent_calendarId_fkey" FOREIGN KEY ("calendarId")
    REFERENCES "ExternalCalendar" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
