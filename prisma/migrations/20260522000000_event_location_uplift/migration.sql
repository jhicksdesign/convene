-- §12.1 — location uplift: Pin / Area / TBD modes + address visibility.

-- Allow Area-mode Location rows (no street address, just a point + radius).
-- The @unique constraint stays; Postgres treats NULLs as distinct so multiple
-- area rows coexist while pin rows still de-dupe by address.
ALTER TABLE "Location" ALTER COLUMN "address" DROP NOT NULL;

-- Radius in meters. NULL = pin (specific address). Non-null = area circle.
ALTER TABLE "Location" ADD COLUMN "radius" INTEGER;

-- Per-event address reveal policy.
CREATE TYPE "EventLocationVisibility" AS ENUM ('PUBLIC', 'RSVP_CONFIRMED', 'DAY_OF');

ALTER TABLE "Event"
  ADD COLUMN "locationVisibility" "EventLocationVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "locationGeneralArea" TEXT;
