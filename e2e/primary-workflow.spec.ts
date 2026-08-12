import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Reset demo data" }).click();
});

test("reviews marks and records a simulated export", async ({ page }, testInfo) => {
  await expect(page.getByRole("heading", { level: 1, name: "Redact" })).toBeVisible();
  await expect(page.getByText("3 marks placed")).toBeVisible();

  await page.getByRole("button", { name: "Add manual mark" }).click();
  await expect(page.getByText("4 marks placed")).toBeVisible();

  await page.getByRole("button", { name: "Safe-share preview" }).click();
  await expect(page.getByText(/does not securely rewrite the source file/i)).toBeVisible();

  await page.getByRole("button", { name: "Record simulated export" }).click();
  await expect(page.getByText("Simulation recorded")).toBeVisible();

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("redact-safe-preview.png"),
  });
});

test("fits the viewport without horizontal page overflow", async ({ page }) => {
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});
