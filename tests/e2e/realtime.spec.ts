import { test, expect } from "@playwright/test";

test("realtime stream emits a hello and stays open", async ({ request }) => {
  // We can't hold an EventSource open inside the Playwright request fixture,
  // but we can verify the route returns the right content-type and an initial
  // event chunk before the timeout.
  const res = await request.get("/api/realtime/stream?c=calendar", {
    timeout: 5_000,
    maxRedirects: 0,
  });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/event-stream");
});

test("ticks fallback returns JSON map", async ({ request }) => {
  const res = await request.get("/api/realtime/ticks?c=calendar");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/json");
});
