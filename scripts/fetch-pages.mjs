// One-time download of the 604 Madani mushaf page images (KSU "Ayat" set,
// verified 2026-07-04: uniform 622x917 PNGs, page 1 = Al-Fatiha ... page 604 = An-Nas)
// into public/pages/NNN.png so the app serves them itself — no runtime dependency
// on quran.ksu.edu.sa.
//
// Run: node scripts/fetch-pages.mjs
// Idempotent: skips files that already exist and look complete.

import { mkdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const SOURCE = (n) => `https://quran.ksu.edu.sa/png_big/${n}.png`;
const PAGE_COUNT = 604;
const CONCURRENCY = 3; // be polite to the university server
const MIN_VALID_BYTES = 10_000; // smallest real page is ~55KB; below this = truncated/error page
const OUT_DIR = path.join(import.meta.dirname, "..", "public", "pages");

await mkdir(OUT_DIR, { recursive: true });

const pending = [];
for (let n = 1; n <= PAGE_COUNT; n++) pending.push(n);

let done = 0;
let skipped = 0;
const failed = [];

async function download(n, attempt = 1) {
  const file = path.join(OUT_DIR, `${String(n).padStart(3, "0")}.png`);
  try {
    const existing = await stat(file).catch(() => null);
    if (existing && existing.size > MIN_VALID_BYTES) {
      skipped++;
      return;
    }
    const res = await fetch(SOURCE(n));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_VALID_BYTES) throw new Error(`suspiciously small (${buf.length}B)`);
    await writeFile(file, buf);
    done++;
    if (done % 50 === 0) console.log(`  ${done} downloaded...`);
  } catch (err) {
    if (attempt < 4) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      return download(n, attempt + 1);
    }
    failed.push(n);
    console.error(`page ${n}: ${err.message}`);
  }
}

async function worker() {
  while (pending.length > 0) {
    const n = pending.shift();
    await download(n);
    await new Promise((r) => setTimeout(r, 120)); // rate-limit
  }
}

console.log(`Downloading ${PAGE_COUNT} pages to ${OUT_DIR} (concurrency ${CONCURRENCY})`);
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`Done: ${done} downloaded, ${skipped} already present, ${failed.length} failed.`);
if (failed.length > 0) {
  console.error("FAILED pages:", failed.join(", "));
  process.exit(1);
}
