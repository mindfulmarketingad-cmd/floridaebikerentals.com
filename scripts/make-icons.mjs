/**
 * Rasterises the brand SVGs into the PNG/ICO files browsers and social
 * platforms need. Requires Playwright + Chromium (already present in CI images).
 *
 *   node scripts/make-icons.mjs
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "assets/img");
mkdirSync(out, { recursive: true });

const targets = [
  { svg: "mark.svg", file: "favicon-16.png", w: 16, h: 16 },
  { svg: "mark.svg", file: "favicon-32.png", w: 32, h: 32 },
  { svg: "mark.svg", file: "favicon-48.png", w: 48, h: 48 },
  { svg: "mark.svg", file: "apple-touch-icon.png", w: 180, h: 180, pad: true },
  { svg: "mark.svg", file: "icon-192.png", w: 192, h: 192 },
  { svg: "mark.svg", file: "icon-512.png", w: 512, h: 512 },
  { svg: "og-default.svg", file: "og-default.png", w: 1200, h: 630 },
];

const browser = await chromium.launch();
for (const t of targets) {
  const svg = readFileSync(resolve(out, t.svg), "utf8");
  const page = await browser.newPage({ viewport: { width: t.w, height: t.h }, deviceScaleFactor: 1 });
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:${t.pad ? "#2050c8" : "transparent"};}
     svg{display:block;width:${t.w}px;height:${t.h}px;}</style>${svg}`,
    { waitUntil: "load" }
  );
  await page.screenshot({
    path: resolve(out, t.file),
    omitBackground: !t.pad,
    type: "png",
  });
  await page.close();
  console.log("rendered", t.file);
}
await browser.close();

/* Assemble a multi-size .ico from the PNGs (ICO allows PNG payloads). */
const icoSizes = [16, 32, 48];
const images = icoSizes.map((size) => readFileSync(resolve(out, `favicon-${size}.png`)));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(images.length, 4);
let offset = 6 + images.length * 16;
const entries = [];
images.forEach((png, i) => {
  const size = icoSizes[i];
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0);
  entry.writeUInt8(size >= 256 ? 0 : size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += png.length;
  entries.push(entry);
});
writeFileSync(resolve(out, "favicon.ico"), Buffer.concat([header, ...entries, ...images]));
console.log("rendered favicon.ico");
