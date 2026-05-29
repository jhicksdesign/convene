import { test, expect } from "@playwright/test";

test.describe("Public routes", () => {
  test("home surfaces public discovery for logged-out users", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Eventide" })).toBeVisible();
    // Hero CTAs lead with browsing now that /calendar and /map are public.
    // Sign in lives in the top bar, not in main — so scope these to main.
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: /browse the calendar/i })).toBeVisible();
    await expect(main.getByRole("link", { name: /see the map/i })).toBeVisible();
    // The "Happening soon" section header renders even when there are no
    // public events seeded — its EmptyState lives below it.
    await expect(main.getByRole("heading", { name: /happening soon/i })).toBeVisible();
  });

  test("login page accepts email submission", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeEnabled();
  });

  test("terms page is reachable and lists shutdown commitments", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /shutdown commitments/i })).toBeVisible();
  });

  test("public iCal feed returns text/calendar", async ({ request }) => {
    const res = await request.get("/api/ical/public");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
  });
});
