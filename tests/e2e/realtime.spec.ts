import { test, expect } from "@playwright/test";

test("realtime stream pushes a hello event to a browser EventSource", async ({ page }) => {
  // SSE streams don't terminate, so `request.get` would hang. Open an actual
  // EventSource in a browser context and wait for the 'hello' event the route
  // sends as its first chunk.
  await page.goto("/");
  const opened = await page.evaluate<boolean>(() => {
    return new Promise<boolean>((resolve) => {
      const es = new EventSource("/api/realtime/stream?c=calendar");
      const timer = setTimeout(() => {
        es.close();
        resolve(false);
      }, 5_000);
      es.addEventListener("hello", () => {
        clearTimeout(timer);
        es.close();
        resolve(true);
      });
      es.onerror = () => {
        clearTimeout(timer);
        es.close();
        resolve(false);
      };
    });
  });
  expect(opened).toBe(true);
});

test("ticks fallback returns JSON map", async ({ request }) => {
  const res = await request.get("/api/realtime/ticks?c=calendar");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/json");
});
