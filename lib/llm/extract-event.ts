// PRD §10.1 / §10.2 — paste-to-event and flyer OCR.
import { runLLM, extractJSON } from "@/lib/anthropic";

export interface ExtractedEvent {
  title: string | null;
  description: string | null;
  startsAtISO: string | null;
  endsAtISO: string | null;
  locationText: string | null;
  cost: string | null;
  capacity: number | null;
  tags: string[];
  accessibilityFlags: string[];
  // confidence per field — UI marks "review" on anything < 0.7
  confidence: Record<string, number>;
}

const SYSTEM = `You extract event details from text or images.
Return a single JSON object. Use null for fields you can't confidently extract.
Never fabricate dates, times, prices, or addresses.

Schema:
{
  "title": string|null,
  "description": string|null,
  "startsAtISO": ISO-8601 string|null,
  "endsAtISO": ISO-8601 string|null,
  "locationText": string|null,
  "cost": string|null,
  "capacity": int|null,
  "tags": string[],
  "accessibilityFlags": (subset of: ["wheelchair_accessible","sensory_friendly","suit_friendly_restrooms","alcohol_free","smoke_free","kid_friendly"]),
  "confidence": object mapping each field name to a 0..1 number
}

Respond ONLY with a fenced \`\`\`json block.`;

export async function extractEventFromText(userId: string, text: string): Promise<ExtractedEvent | null> {
  if (text.length > 10_000) text = text.slice(0, 10_000); // §10.4
  const msg = await runLLM({
    userId,
    model: "sonnet",
    system: SYSTEM,
    cacheSystem: true,
    maxTokens: 1500,
    messages: [{ role: "user", content: text }],
  });
  return extractJSON<ExtractedEvent>(msg);
}

export async function extractEventFromImage(
  userId: string,
  imageBase64: string,
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif",
): Promise<ExtractedEvent | null> {
  const msg = await runLLM({
    userId,
    model: "sonnet",
    system: SYSTEM,
    cacheSystem: true,
    maxTokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "Extract event details from this flyer." },
        ],
      },
    ],
  });
  return extractJSON<ExtractedEvent>(msg);
}
