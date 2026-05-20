// Single Anthropic entry point. All LLM calls go through `runLLM()`
// which applies per-user rate limiting and centralizes model choice.
// PRD §10.4 — 50 LLM-backed actions per day per admin, $50/mo project budget.
import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
const client = new Anthropic({ apiKey });

export const MODELS = {
  // Sonnet for extraction / structured output / assistant (smart)
  sonnet: "claude-sonnet-4-6",
  // Haiku for cheap classification / quick judgments
  haiku: "claude-haiku-4-5-20251001",
} as const;

export type ModelKey = keyof typeof MODELS;

export class LLMRateLimitError extends Error {
  resetAt: Date;
  constructor(resetAt: Date) {
    super("LLM daily limit reached");
    this.resetAt = resetAt;
  }
}

const DAILY_LIMIT = Number(process.env.LLM_DAILY_LIMIT_PER_USER ?? "50");

function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function tomorrow(): Date {
  const d = today();
  d.setDate(d.getDate() + 1);
  return d;
}

async function consumeRateLimit(userId: string): Promise<void> {
  const day = today();
  const row = await db.lLMRateLimit.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (row.count > DAILY_LIMIT) throw new LLMRateLimitError(tomorrow());
}

interface RunArgs {
  userId: string;
  model: ModelKey;
  system?: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  /** When set, response_format JSON object is requested via a system suffix. */
  jsonMode?: boolean;
  /** Soft cache hint — prepend ephemeral cache marker to large system prompts. */
  cacheSystem?: boolean;
}

export async function runLLM(args: RunArgs): Promise<Anthropic.Message> {
  await consumeRateLimit(args.userId);

  const system: Anthropic.TextBlockParam[] = args.system
    ? [
        {
          type: "text",
          text: args.system,
          ...(args.cacheSystem ? { cache_control: { type: "ephemeral" } } : {}),
        },
      ]
    : [];

  return client.messages.create({
    model: MODELS[args.model],
    max_tokens: args.maxTokens ?? 1024,
    system: system.length ? system : undefined,
    messages: args.messages,
  });
}

export function extractText(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export function extractJSON<T = unknown>(msg: Anthropic.Message): T | null {
  const text = extractText(msg);
  const match = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\{[\s\S]*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}
