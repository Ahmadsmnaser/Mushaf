import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { READER_THEMES, type ReaderTheme } from "@/lib/readerConfig";

/**
 * Theme contrast audit.
 *
 * Reads the REAL token definitions out of app/globals.css (not a hand-copied
 * fixture, so it can never drift from the stylesheet) and verifies that every
 * theme keeps its meaningful foreground/background pairs above the WCAG
 * minimums:
 *   - normal body text        >= 4.5:1
 *   - large text / UI / muted  >= 3:1
 *
 * Only solid (hex / rgba) tokens are validated — gradients, color-mix() and
 * data-uri patterns are decorative and are resolved visually, not here.
 */

const cssPath = join(process.cwd(), "app", "globals.css");
const css = readFileSync(cssPath, "utf8");

type Rgba = { r: number; g: number; b: number; a: number };
type Tokens = Record<string, string>;

/** Extract the flat color tokens (hex / rgb / rgba) declared inside a block. */
function block(selector: string): Tokens {
  // Find `selector ... { ... }` — [^{]* absorbs any grouped selectors
  // (e.g. `[…="black"], […="night"]`) and whitespace before the brace.
  // These token blocks contain no nested braces.
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}[^{]*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`Selector not found in globals.css: ${selector}`);
  const tokens: Tokens = {};
  const decl = /--([\w-]+):\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = decl.exec(match[1]))) {
    const name = m[1];
    const value = m[2].trim();
    if (/^#[0-9a-f]{3,8}$/i.test(value) || /^rgba?\([^)]*\)$/i.test(value)) {
      tokens[name] = value;
    }
  }
  return tokens;
}

const root = block(":root");
// The generic attribute block supplies the beige/paper defaults.
const beige = { ...root, ...block("[data-reader-theme]") };
const white = { ...root, ...block('[data-reader-theme="white"]') };
const green = { ...root, ...block('[data-reader-theme="green"]') };
const navy = { ...root, ...block('[data-reader-theme="navy"]') };
// Night/black share one block; match on its first selector.
const black = { ...root, ...block('[data-reader-theme="black"]') };

const PALETTES: Record<ReaderTheme, Tokens> = { beige, white, green, navy, black };

function parseColor(input: string): Rgba {
  const value = input.trim();
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }
  const nums = value
    .slice(value.indexOf("(") + 1, value.indexOf(")"))
    .split(",")
    .map((n) => parseFloat(n));
  return { r: nums[0], g: nums[1], b: nums[2], a: nums[3] ?? 1 };
}

/** Composite a (possibly translucent) foreground over an opaque background. */
function over(fg: Rgba, bg: Rgba): Rgba {
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

function relLuminance({ r, g, b }: Rgba): number {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(fgToken: string, bgToken: string): number {
  const bg = parseColor(bgToken);
  const fg = over(parseColor(fgToken), bg);
  const l1 = relLuminance(fg);
  const l2 = relLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function ratio(palette: Tokens, fg: string, bg: string): number {
  const fgv = palette[fg];
  const bgv = palette[bg];
  if (!fgv) throw new Error(`Missing token --${fg}`);
  if (!bgv) throw new Error(`Missing token --${bg}`);
  return contrast(fgv, bgv);
}

// [foreground token, background token, minimum ratio, human label]
const BODY = 4.5;
const LARGE = 3; // large text / UI components / muted supporting text

const PAIRS: Array<[string, string, number, string]> = [
  // Landing / cover field — the surfaces that broke in the audit.
  ["home-title", "home-bg", LARGE, "cover title"],
  ["home-text", "home-bg", BODY, "cover body text"],
  ["home-muted", "home-bg", LARGE, "cover subtitle"],
  ["home-button-fg", "home-button-bg", BODY, "cover primary button label"],
  // The account/Google control on the cover uses --home-text over --home-bg
  // (see .home-account-* in globals.css) — same guarantee as cover body text.

  // Chrome / modals / panels (paper + ink + accent flip together per theme).
  ["ink", "paper", BODY, "body text on paper"],
  ["ink", "sheet", BODY, "body text on raised sheet"],
  ["ink-soft", "paper", LARGE, "muted text on paper"],
  ["accent", "paper", LARGE, "accent heading on paper"],
  ["paper", "accent", BODY, "inverse label on accent button"],
  ["danger", "paper", BODY, "error text on paper"],
];

describe("theme contrast audit", () => {
  const themes = Object.keys(READER_THEMES) as ReaderTheme[];

  it("defines every advertised theme in globals.css", () => {
    for (const theme of themes) {
      expect(PALETTES[theme], `palette for "${theme}"`).toBeDefined();
      expect(PALETTES[theme].paper, `--paper for "${theme}"`).toBeDefined();
    }
  });

  for (const theme of themes) {
    describe(`${theme} theme`, () => {
      for (const [fg, bg, min, label] of PAIRS) {
        it(`${label} (--${fg} on --${bg}) >= ${min}:1`, () => {
          const value = ratio(PALETTES[theme], fg, bg);
          expect(
            value,
            `${theme}: --${fg} on --${bg} = ${value.toFixed(2)}:1 (need ${min})`
          ).toBeGreaterThanOrEqual(min);
        });
      }
    });
  }
});
