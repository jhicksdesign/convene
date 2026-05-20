-- Manual migration to install pgvector and add the embedding column.
-- Run via `psql $DATABASE_URL -f prisma/migrations/manual/001_pgvector_event_embedding.sql`
-- before the first Prisma migrate that references it.
--
-- pgvector is available on Railway Postgres and Neon out of the box; no
-- superuser needed for CREATE EXTENSION on most managed providers.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Event"
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- IVFFlat index for ANN search on cosine distance.
-- The index works well once you have ~1000 rows; for v1 traffic we'd be fine
-- without it, but it's cheap to create now so search latency stays flat.
CREATE INDEX IF NOT EXISTS "Event_embedding_idx"
  ON "Event"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
