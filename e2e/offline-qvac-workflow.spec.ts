import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";
import sharp from "sharp";

const enabled = process.env.REDACT_LIVE_QVAC === "1";
const sourcePath = path.join(
  process.cwd(),
  "public/test-files/redact/chat-private.png",
);

test("runs cached QVAC, human review, audit, and safe-copy export", async ({ page }, testInfo) => {
  test.skip(!enabled || testInfo.project.name !== "desktop", "opt-in real cached QVAC receipt");
  test.setTimeout(240_000);
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1"
    ) {
      remoteRequests.push(request.url());
    }
  });
  const sourceBefore = await readFile(sourcePath);
  const digestBefore = createHash("sha256").update(sourceBefore).digest("hex");

  await page.goto("/");
  await page.getByLabel("Choose a document").setInputFiles(sourcePath);
  await page.getByRole("radio", { name: "Private" }).check();
  await page
    .getByLabel("Additional direction")
    .fill("Redact direct identifiers, account numbers, and reference codes.");
  await page.getByRole("button", { name: "Prepare for review" }).click();

  await expect(page.getByLabel("Suggested redactions")).toBeVisible({
    timeout: 190_000,
  });
  await page.screenshot({
    fullPage: true,
    path: path.join(process.cwd(), "submission/evidence/ai-output.png"),
  });
  await page.getByRole("button", { name: "Accept name proposal" }).click();
  await expect(page.getByText("Accepted local suggestion").first()).toBeVisible();
  await page.getByRole("button", { name: "Reject email proposal" }).click();
  await expect(page.getByText("Rejected local suggestion").first()).toBeVisible();
  while (await page.getByRole("button", { name: /^Accept .* proposal$/ }).count()) {
    await page.getByRole("button", { name: /^Accept .* proposal$/ }).first().click();
  }
  await page.getByRole("button", { name: "Add redaction" }).click();
  await expect(page.getByRole("button", { name: "Done" })).toBeEnabled();
  await page.getByRole("button", { name: "Done" }).click();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Save copy" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("chat-private.redacted.png");
  const savedPath = await download.path();
  expect(savedPath).not.toBeNull();
  await download.saveAs(testInfo.outputPath("reviewed-test-output.png"));
  const acceptedNamePixel = await sharp(savedPath!)
    .extract({ left: 250, top: 130, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer();
  expect([...acceptedNamePixel]).toEqual([0, 0, 0]);

  const sourceAfter = await readFile(sourcePath);
  expect(createHash("sha256").update(sourceAfter).digest("hex")).toBe(digestBefore);
  expect(Buffer.compare(sourceBefore, sourceAfter)).toBe(0);
  expect(remoteRequests).toEqual([]);
});
