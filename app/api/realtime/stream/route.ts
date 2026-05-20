import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE stream backed by Postgres LISTEN/NOTIFY.
// Each client connection opens a dedicated pg client (LISTEN requires its own
// connection — pgbouncer / Prisma's connection pool can't multiplex it).
// Heartbeats every 25s keep proxies from timing out.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const channels = new Set(url.searchParams.getAll("c").slice(0, 20));

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return new Response("DB not configured", { status: 500 });

  const client = new Client({ connectionString: dbUrl });

  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      function send(line: string) {
        if (closed) return;
        try { controller.enqueue(encoder.encode(line)); } catch { /* connection gone */ }
      }

      try {
        await client.connect();
        await client.query(`LISTEN "convene"`);

        client.on("notification", (msg) => {
          if (msg.channel !== "convene" || !msg.payload) return;
          try {
            const data = JSON.parse(msg.payload) as { channel: string; ts: number };
            if (!channels.has(data.channel)) return;
            send(`data: ${msg.payload}\n\n`);
          } catch {
            // ignore malformed
          }
        });

        client.on("error", () => {
          send(`event: error\ndata: {}\n\n`);
        });

        // initial hello so EventSource fires onopen quickly
        send(`event: hello\ndata: {}\n\n`);

        heartbeat = setInterval(() => send(`: ping\n\n`), 25_000);
      } catch (e) {
        send(`event: error\ndata: {"message":"connect failed"}\n\n`);
        controller.close();
      }
    },
    async cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      try { await client.end(); } catch { /* ignore */ }
    },
  });

  req.signal.addEventListener("abort", async () => {
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    try { await client.end(); } catch { /* ignore */ }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // disable buffering on nginx proxies
    },
  });
}
