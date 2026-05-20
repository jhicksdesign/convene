// OpenAI text-embedding-3-small — 1536-dim, $0.02 per million tokens.
// Used to enable "similar events" semantic search via pgvector cosine distance.
//
// No-op when OPENAI_API_KEY is unset, so the rest of the app keeps working.
import OpenAI from "openai";
import { db } from "@/lib/db";

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const MODEL = "text-embedding-3-small";
const DIMS = 1536;

interface EmbedSourceFields {
  title: string;
  description: string | null;
  tags: string[];
  accessibilityFlags: string[];
}

function buildText(ev: EmbedSourceFields): string {
  return [
    ev.title,
    ev.description ?? "",
    ev.tags.join(" "),
    ev.accessibilityFlags.join(" "),
  ].filter(Boolean).join("\n").slice(0, 8000);
}

export async function embed(text: string): Promise<number[] | null> {
  if (!client) return null;
  const res = await client.embeddings.create({ model: MODEL, input: text, dimensions: DIMS });
  return res.data[0]?.embedding ?? null;
}

/** Write embedding into Event.embedding using raw SQL (Prisma can't bind vector yet). */
export async function embedAndStoreEvent(eventId: string, fields: EmbedSourceFields): Promise<void> {
  if (!client) return;
  try {
    const vec = await embed(buildText(fields));
    if (!vec) return;
    // pgvector accepts the literal [0.1,0.2,...] textual form.
    const literal = `[${vec.join(",")}]`;
    await db.$executeRawUnsafe(
      `UPDATE "Event" SET embedding = $1::vector WHERE id = $2`,
      literal,
      eventId,
    );
  } catch (err) {
    console.error("[embeddings] embedAndStoreEvent failed", err);
  }
}

/** Cosine-nearest events to a seed event. Honors visibility on the caller's side. */
export async function similarEventIds(seedEventId: string, limit = 6): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "Event"
       WHERE id <> $1
         AND embedding IS NOT NULL
         AND "cancelledAt" IS NULL
       ORDER BY embedding <=> (SELECT embedding FROM "Event" WHERE id = $1)
       LIMIT $2`,
    seedEventId,
    limit,
  );
  return rows.map((r) => r.id);
}
