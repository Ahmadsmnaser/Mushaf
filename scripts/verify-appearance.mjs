// Dataset validation for the Mushaf appearance feature.
//
// The whole "colored Mushaf page" model rests on one fact: every page image is
// a TRANSPARENT palette PNG at a uniform size, so the CSS paper tint shows
// through the ink. If any page were opaque or a different size, a paper style
// would render wrong on that page. This script proves the canonical dataset
// still holds that invariant across all 604 pages before any style ships.
//
// Run: node scripts/verify-appearance.mjs

import { readFile } from "node:fs/promises";
import path from "node:path";

const PAGE_COUNT = 604;
const EXPECTED_W = 622;
const EXPECTED_H = 917;
const PAGES_DIR = path.join(import.meta.dirname, "..", "public", "pages");

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Parse the bits we care about from a PNG buffer. */
function inspectPng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) return { ok: false, reason: "not a PNG" };
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  // color type 6 (RGBA) / 4 (gray+A) carry alpha directly; palette (3) needs tRNS.
  let hasTRNS = false;
  let off = 8;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    if (type === "tRNS") hasTRNS = true;
    if (type === "IEND") break;
    off += 12 + len;
  }
  const transparent = colorType === 6 || colorType === 4 || hasTRNS;
  return { ok: true, width, height, colorType, transparent };
}

const problems = [];

for (let n = 1; n <= PAGE_COUNT; n++) {
  const file = path.join(PAGES_DIR, `${String(n).padStart(3, "0")}.png`);
  let buf;
  try {
    buf = await readFile(file);
  } catch {
    problems.push(`page ${n}: missing (${path.basename(file)})`);
    continue;
  }
  const info = inspectPng(buf);
  if (!info.ok) {
    problems.push(`page ${n}: ${info.reason}`);
    continue;
  }
  if (info.width !== EXPECTED_W || info.height !== EXPECTED_H) {
    problems.push(`page ${n}: ${info.width}x${info.height}, expected ${EXPECTED_W}x${EXPECTED_H}`);
  }
  if (!info.transparent) {
    problems.push(`page ${n}: OPAQUE background — paper tint would not show through`);
  }
}

if (problems.length > 0) {
  console.error(`FAIL: ${problems.length} page issue(s):`);
  for (const p of problems.slice(0, 30)) console.error("  - " + p);
  if (problems.length > 30) console.error(`  ...and ${problems.length - 30} more`);
  process.exit(1);
}

console.log(
  `OK: all ${PAGE_COUNT} pages present, ${EXPECTED_W}x${EXPECTED_H}, transparent background.`
);
console.log(
  "Theme→treatment integrity (THEME_MUSHAF_TREATMENTS covers every ReaderTheme,\n" +
  "treatment IDs are valid) is enforced at compile time by `tsc --noEmit`\n" +
  "(Record<ReaderTheme, MushafTreatment>)."
);
