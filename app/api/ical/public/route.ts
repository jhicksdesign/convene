import { publicFeed } from "@/lib/ical";

export async function GET() {
  const body = await publicFeed();
  return new Response(body, {
    headers: { "Content-Type": "text/calendar; charset=utf-8" },
  });
}
