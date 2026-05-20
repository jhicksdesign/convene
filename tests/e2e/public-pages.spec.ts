import { test, expect } from "@playwright/test";

test.describe("Public routes", () => {
  test("home renders the marketing pitch for logged-out users", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Convene" })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("login page accepts email submission", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("test@example.com");
    // We don't actually submit (no SMTP in CI), just verify the form renders.
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
