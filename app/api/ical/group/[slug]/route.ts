import { groupFeed } from "@/lib/ical";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await groupFeed(slug);
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
}
