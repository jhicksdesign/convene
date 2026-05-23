-- Multi-tenant vocabulary on Group + per-community scoping for Convention.

-- Per-group curated vocabulary. tagPalette + accessibilityPalette default to empty
-- arrays; the application backfills accessibilityPalette with the universal set
-- on group creation. eventDefaults is a free-form JSON prefill bag (shape:
-- { scope, capacity, cost, allowPlusOnes, useWaitlist, accessibilityFlags }).
ALTER TABLE "Group"
  ADD COLUMN "tagPalette" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "accessibilityPalette" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "eventDefaults" JSONB;

-- Backfill the universal accessibility flag set on existing groups so the
-- accessibility filter chips don't disappear in the UI post-migration.
-- Fursuit-specific flags are intentionally NOT backfilled (admins add per-group).
UPDATE "Group"
SET "accessibilityPalette" = ARRAY[
  'wheelchair_accessible',
  'sensory_friendly',
  'alcohol_free',
  'smoke_free',
  'kid_friendly'
]::TEXT[]
WHERE cardinality("accessibilityPalette") = 0;

-- Convention scoping. NULL = global (legacy / cross-community), non-null = scoped
-- to one community. Conflict detection filters to (groupId IN allowed_set OR NULL).
ALTER TABLE "Convention" ADD COLUMN "groupId" TEXT;
CREATE INDEX "Convention_groupId_idx" ON "Convention" ("groupId");
