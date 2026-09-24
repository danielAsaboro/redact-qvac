import path from "node:path";

import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

const testFiles = path.join(process.cwd(), "public/test-files/redact");

test.beforeEach(async ({ page }) => {
  await page.route("http://127.0.0.1:4317/**", (route) => route.abort());
  await page.goto("/");
});

test("uploads an image, reviews a manual mask, and saves flattened pixels", async ({ page }, testInfo) => {
  await page.getByLabel("Choose a document").setInputFiles(
    path.join(testFiles, "chat-private.png"),
  );
  await expect(page.getByText("Privacy level")).toBeVisible();
  await page.getByRole("radio", { name: "Confidential" }).check();
  await page.getByLabel("Additional direction").fill("Hide Apollo references");
  await page.getByRole("button", { name: "Prepare for review" }).click();

  await expect(page.getByText("Safe-share preview", { exact: true })).toBeVisible();
  const canvas = page.getByLabel("Redaction canvas");
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  const start = {
    clientX: canvasBox!.x + canvasBox!.width * 0.16,
    clientY: canvasBox!.y + canvasBox!.height * 0.23,
  };
  const end = {
    clientX: canvasBox!.x + canvasBox!.width * 0.51,
    clientY: canvasBox!.y + canvasBox!.height * 0.31,
  };
  if (testInfo.project.name === "mobile") {
    await canvas.dispatchEvent("pointerdown", { ...start, button: 0, pointerId: 1, pointerType: "touch" });
    await canvas.dispatchEvent("pointermove", { ...end, button: 0, pointerId: 1, pointerType: "touch" });
    await canvas.dispatchEvent("pointerup", { ...end, button: 0, pointerId: 1, pointerType: "touch" });
  } else {
    await page.mouse.move(start.clientX, start.clientY);
    await page.mouse.down();
    await page.mouse.move(end.clientX, end.clientY, { steps: 4 });
    await page.mouse.up();
  }
  await expect(page.getByText("1 redaction").first()).toBeVisible();
  const resizeHandle = page.getByRole("button", {
    name: "Resize redaction 1 southeast",
  });
  const handleBox = await resizeHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  const handleStart = {
    clientX: handleBox!.x + handleBox!.width / 2,
    clientY: handleBox!.y + handleBox!.height / 2,
  };
  const handleEnd = { clientX: handleBox!.x + 18, clientY: handleBox!.y + 12 };
  if (testInfo.project.name === "mobile") {
    await resizeHandle.dispatchEvent("pointerdown", { ...handleStart, button: 0, pointerId: 2, pointerType: "touch" });
    await canvas.dispatchEvent("pointermove", { ...handleEnd, button: 0, pointerId: 2, pointerType: "touch" });
    await canvas.dispatchEvent("pointerup", { ...handleEnd, button: 0, pointerId: 2, pointerType: "touch" });
  } else {
    await page.mouse.move(handleStart.clientX, handleStart.clientY);
    await page.mouse.down();
    await page.mouse.move(handleEnd.clientX, handleEnd.clientY, { steps: 3 });
    await page.mouse.up();
  }

  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("heading", { name: "Your safe copy is ready" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Save copy" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("chat-private.redacted.png");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const image = sharp(downloadPath!);
  const metadata = await image.metadata();
  expect(metadata.width).toBe(1200);
  expect(metadata.height).toBe(1600);
  const pixel = await image.extract({ left: 240, top: 400, width: 1, height: 1 }).raw().toBuffer();
  expect([...pixel.slice(0, 3)]).toEqual([0, 0, 0]);

  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath("redact-complete.png"),
  });
});

test("rasterizes a multi-page PDF and saves a two-page image-only PDF", async ({ page }) => {
  await page.getByLabel("Choose a document").setInputFiles(
    path.join(testFiles, "statement-multipage.pdf"),
  );
  await expect(page.getByText("Privacy level")).toBeVisible();
  await page.getByRole("button", { name: "Prepare for review" }).click();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Add redaction" }).click();
  await page.getByRole("button", { name: "Next →" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Add redaction" }).click();
  await page.getByRole("button", { name: "Done" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Save copy" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("statement-multipage.redacted.pdf");
  const savedPath = await download.path();
  expect(savedPath).not.toBeNull();
  const bytes = await import("node:fs/promises").then((fs) => fs.readFile(savedPath!));
  const output = await PDFDocument.load(bytes);
  expect(output.getPageCount()).toBe(2);
  expect(Buffer.from(bytes).includes(Buffer.from("Maya Chen"))).toBe(false);
});

test("fits the viewport and stacks review panes on mobile", async ({ page }, testInfo) => {
  await expect(page.getByRole("heading", { name: "What do you need to share safely?" })).toBeVisible();
  let hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);

  await page.getByLabel("Choose a document").setInputFiles(path.join(testFiles, "chat-private.jpg"));
  await page.getByRole("button", { name: "Prepare for review" }).click();
  await expect(page.getByText("Safe-share preview", { exact: true })).toBeVisible();
  hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
  if (testInfo.project.name === "mobile") {
    const articles = page.locator(".comparison-grid article");
    const original = await articles.nth(0).boundingBox();
    const preview = await articles.nth(1).boundingBox();
    expect(preview!.y).toBeGreaterThan(original!.y + original!.height - 2);
  }
});
