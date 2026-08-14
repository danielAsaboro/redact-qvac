import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

const outputDirectory = fileURLToPath(
  new URL("../public/test-files/redact/", import.meta.url),
);

await mkdir(outputDirectory, { recursive: true });

const chatSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
  <rect width="1200" height="1600" fill="#f4f1ea"/>
  <rect x="85" y="70" width="1030" height="1460" rx="34" fill="#ffffff" stroke="#17211b" stroke-width="4"/>
  <circle cx="155" cy="155" r="38" fill="#d95f45"/>
  <text x="215" y="145" font-family="Arial" font-size="34" font-weight="700" fill="#17211b">Maya Chen</text>
  <text x="215" y="185" font-family="Arial" font-size="22" fill="#667069">maya.chen@example.com</text>
  <line x1="120" y1="230" x2="1080" y2="230" stroke="#d8ddd9" stroke-width="3"/>
  <rect x="145" y="305" width="720" height="150" rx="28" fill="#edf0ed"/>
  <text x="190" y="360" font-family="Arial" font-size="27" fill="#17211b">Please send the contract to 18 Willow Road.</text>
  <text x="190" y="405" font-family="Arial" font-size="27" fill="#17211b">My phone is +1 415 555 0184.</text>
  <rect x="335" y="515" width="720" height="150" rx="28" fill="#dcecdf"/>
  <text x="380" y="570" font-family="Arial" font-size="27" fill="#17211b">Got it. I will use account 8841 0932</text>
  <text x="380" y="615" font-family="Arial" font-size="27" fill="#17211b">and reference APOLLO-4471.</text>
  <rect x="145" y="725" width="660" height="105" rx="28" fill="#edf0ed"/>
  <text x="190" y="790" font-family="Arial" font-size="27" fill="#17211b">Thanks — keep the amount confidential.</text>
  <text x="120" y="1460" font-family="Arial" font-size="22" fill="#667069">Controlled test document • no real personal information</text>
</svg>`);

await sharp(chatSvg).png().toFile(`${outputDirectory}/chat-private.png`);
await sharp(chatSvg).jpeg({ quality: 90 }).toFile(
  `${outputDirectory}/chat-private.jpg`,
);

async function createStatement(pageCount) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);

  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([612, 792]);
    const pageNumber = index + 1;
    page.drawText("NORTHSTAR BUSINESS ACCOUNT", {
      x: 54,
      y: 725,
      size: 19,
      font: bold,
      color: rgb(0.08, 0.13, 0.1),
    });
    page.drawText(`Statement page ${pageNumber} of ${pageCount}`, {
      x: 54,
      y: 692,
      size: 11,
      font: regular,
    });
    page.drawText("Account holder: Maya Chen", {
      x: 54,
      y: 645,
      size: 13,
      font: regular,
    });
    page.drawText("Account number: 8841 0932", {
      x: 54,
      y: 618,
      size: 13,
      font: regular,
    });
    page.drawText("Billing address: 18 Willow Road, Oakland CA", {
      x: 54,
      y: 591,
      size: 13,
      font: regular,
    });
    page.drawText("Date", { x: 54, y: 525, size: 12, font: bold });
    page.drawText("Description", { x: 150, y: 525, size: 12, font: bold });
    page.drawText("Reference", { x: 350, y: 525, size: 12, font: bold });
    page.drawText("Amount", { x: 500, y: 525, size: 12, font: bold });
    const rows = [
      ["2026-08-03", "Apollo Consulting", "APOLLO-4471", "$4,820.00"],
      ["2026-08-07", "Payroll", "PAY-3918", "$8,100.00"],
      ["2026-08-11", "Office lease", "LEASE-882", "$2,950.00"],
    ];
    rows.forEach((row, rowIndex) => {
      const y = 485 - rowIndex * 42;
      page.drawText(row[0], { x: 54, y, size: 11, font: regular });
      page.drawText(row[1], { x: 150, y, size: 11, font: regular });
      page.drawText(row[2], { x: 350, y, size: 11, font: regular });
      page.drawText(row[3], { x: 500, y, size: 11, font: regular });
    });
    page.drawText("Controlled test document — values are fictional", {
      x: 54,
      y: 54,
      size: 10,
      font: regular,
      color: rgb(0.38, 0.42, 0.39),
    });
  }

  document.setTitle("Controlled Redact test statement");
  document.setProducer("Redact controlled-file generator");
  return document.save({ useObjectStreams: false });
}

await writeFile(
  `${outputDirectory}/statement-confidential.pdf`,
  await createStatement(1),
);
await writeFile(
  `${outputDirectory}/statement-multipage.pdf`,
  await createStatement(2),
);
await writeFile(
  `${outputDirectory}/unreadable.pdf`,
  Buffer.from("%PDF-1.7\nThis controlled file is intentionally unreadable.\n%%EOF\n"),
);

console.log(`Prepared Redact test files in ${outputDirectory}`);
