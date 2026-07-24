import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static guard against theme-blind colors creeping back into the UI.
 *
 * Flags foreground/background/border utilities and inline SVG fills that are
 * hardcoded to pure black or white — the exact pattern that made labels
 * disappear when the active theme changed. Decorative gradient stops
 * (`from-black/…`, `to-white/…`) and brand logos are intentionally NOT banned;
 * a line may opt out explicitly with a `theme-audit-allow` comment.
 */

const roots = ["components", "app"].map((d) => join(process.cwd(), d));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

// Theme-blind class utilities: text/bg/border/ring set to black or white.
const BANNED_UTILITY = /\b(text|bg|border|ring|divide|fill|stroke)-(black|white)(\/\d+)?\b/;
// Inline SVG fill/stroke pinned to a raw black/white hex.
const BANNED_INLINE = /(fill|stroke)=["']#(000|000000|fff|ffffff)["']/i;

describe("theme color scan", () => {
  const files = roots.flatMap(walk);

  it("scans the UI source tree", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("has no theme-blind black/white utilities", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (line.includes("theme-audit-allow")) return;
        if (BANNED_UTILITY.test(line) || BANNED_INLINE.test(line)) {
          offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(offenders, `theme-blind colors found:\n${offenders.join("\n")}`).toEqual([]);
  });
});
