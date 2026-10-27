// 사용법: node marketing/instagram/render.mjs  → slides/slide-1.png ~ slide-8.png (1080x1350)
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "slides");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
await page.goto(pathToFileURL(join(here, "carousel.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const slides = await page.$$("section.slide");
for (const [i, el] of slides.entries()) {
  await el.screenshot({ path: join(out, `slide-${i + 1}.png`) });
}
await browser.close();
console.log(`rendered ${slides.length} slides → ${out}`);
