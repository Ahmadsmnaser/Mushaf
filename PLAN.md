# PLAN — Mushaf Web App (v1)

Desktop-first, two-page open-mushaf spread, Madani 604-page images, page-flip navigation.
Next.js App Router + TypeScript + Tailwind, localStorage only, deployed on Vercel.

---

## 1. Data sources — verified live (curl, 2026-07-04)

### 1a. Page images — KSU "Ayat" Madani pages ✅ verified, self-hosted

`https://quran.ksu.edu.sa/png_big/{n}.png` for n = 1…604 (unpadded).

Verified:

- `HEAD /png_big/1.png` → `200 OK`, `image/png`, 138,178 bytes
- `HEAD /png_big/604.png` → `200 OK`, `image/png`, 82,795 bytes
- Downloaded and **visually confirmed alignment with the standard Madani 604-page layout**:
  - page 1 = سورة الفاتحة (illuminated frame)
  - page 2 = أول سورة البقرة (facing illuminated frame — the classic opening spread)
  - page 604 = الإخلاص + الفلق + الناس, with «٦٠٤» printed at the bottom
- All pages 1–604 are uniform **622 × 917 px**, palette PNG, ~60–140 KB each.
- A page **605 exists but is a different size (545×804)** — an appendix page, not Quran text.
  The adapter hard-clamps to 1–604.

**Decision: download once and self-host in `/public/pages/`** (a `scripts/fetch-pages.mjs`
run once at setup; ~55 MB total, optionally recompressed to WebP ~30 MB). Rationale:

- KSU is a university web server, not a CDN — no SLA, could block hotlinking; a broken
  image host would kill the entire app.
- Self-hosting puts images on Vercel's edge CDN, removes every runtime third-party
  dependency, and makes offline support trivial later.
- The URL is built in exactly one place (`getPageImageUrl`), so swapping back to a remote
  CDN is a one-line change.

Note: 622 px/page is roughly 1:1 with the rendered size of half a spread on a 1440p
display. Acceptable for v1; a higher-res source can be dropped into `/public/pages/`
later without code changes.

### 1b. Metadata + ayah→page — alquran.cloud ✅ verified, consumed at **build time only**

- `GET https://api.alquran.cloud/v1/quran/quran-simple` → `200`, 4.55 MB JSON.
  Shape confirmed: `data.surahs[].ayahs[]` each with
  `{ number, text, numberInSurah, juz, manzil, page, ruku, hizbQuarter, sajda }`
  and surah-level `{ number, name (Arabic), englishName, revelationType }`.
  **6,236 ayahs, pages 1–604 all covered** — this single file yields ayah→page,
  surah→first/last page, juz→first page, and hizb.
- `GET /v1/meta` → `200`, CORS `Access-Control-Allow-Origin: *`;
  `pages.count = 604`, references match. Rate limit 12 req/s (irrelevant — see below).
- We fetch `quran-uthmani` too (same shape) for properly voweled display text in search
  results.

### 1c. Rejected

- **alquran.cloud `/v1/search`** ❌ — tested `search/الرحمن/all/quran-simple` → returns
  `404 "Nothing matching your search was found"` despite الرحمن appearing dozens of
  times. The `/all/ar` variant returns matches from an Arabic *tafsir* edition, not Quran
  text. Unusable → **search is client-side** over bundled text (below).
- **quranapi.pages.dev** — works (`/api/surah.json` verified `200`) but has **no page
  numbers anywhere**, so it can't serve this app. Not used.
- **apis.quran.foundation** — out of scope for v1 (OAuth). A `// TODO` in the adapter
  documents the future API-route-proxy path for word-level highlighting.

### Net effect

**Zero runtime API calls.** Both external sources are consumed by one-time scripts;
production serves only static assets. API-down is not a runtime failure mode.

---

## 2. Data pipeline (one-time scripts, committed output)

```
scripts/fetch-pages.mjs   → /public/pages/{001..604}.png   (downloads KSU set, polite delay)
scripts/build-data.mjs    → lib/mushaf/data/indexes.json    (~25 KB, imported statically:
                              surah index {id, name_ar, first_page, last_page},
                              juz index {number, first_page},
                              page meta {surahs[], juz, hizb} per page)
                          → public/data/search-index.json    (~2.5 MB, fetched lazily only
                              when the search drawer first opens:
                              [{ ayahKey "2:255", surah_ar, ayahNo, page, text_uthmani }])
```

Search normalization (strip harakat/tatweel, unify أإآ→ا, ة→ه, ى→ي) runs in the browser
on both query and corpus — 6,236 strings normalize in milliseconds on first search.

## 3. Adapter — `lib/mushaf/source.ts`

Exactly the interface from the spec (`getSpread`, `getPageImageUrl`, `getPageMeta`,
`getSurahIndex`, `getJuzIndex`, `search`), strict types, no `any`. All functions are
synchronous reads of bundled data except `search(query)` which is async (lazy-loads the
search index once). UI imports only this module.

**Spread pairing (the RTL rule, implemented once, here):**
```
spreadStart(n) = n is odd ? n : n - 1
rightPage = spreadStart      // LOWER number — read first
leftPage  = spreadStart + 1  // higher number
```
Spreads: (1,2), (3,4), …, (603,604) — matches the physical mushaf, where الفاتحة (1, right)
faces أول البقرة (2, left). Verified against the downloaded images. No orphan pages
(604 is even, so the last spread is complete).

**Correction (post-review):** "next" = +2 pages, and the physical motion is
**left → right** — in an RTL book the unread stack sits on the LEFT and advancing
lifts the left page rightward over the spine (mirror of an English book).
ArrowRight/right-drag/right button = next. The original plan line "flip moves
right→left" was wrong and has been superseded.

## 4. Component tree

```
app/layout.tsx                 <html dir="rtl" lang="ar">, fonts, paper background, theme
app/page.tsx                   redirect → /page/{lastRead ?? 1}
app/page/[n]/page.tsx          the reader (validates n ∈ 1..604, else redirect to 1)

components/
  reader/
    MushafSpread.tsx           lays out right+left PageImage from getSpread(n)
    PageImage.tsx              <img> + paper-texture skeleton + on-error retry/fallback state
    useFlipNavigation.ts       next/prev, keyboard (← next, → prev, Space next),
                               preloads spreads n±2 via new Image()
    FlipAnimation.tsx          react-pageflip if it cooperates with RTL, else Framer Motion
  chrome/
    TopBar.tsx                 quiet bar: current surah/juz/page, fades out while reading
    JumpDrawer.tsx             command-style picker: surah / juz / page number
    SearchDrawer.tsx           query → results list → navigate to page
    BookmarksDrawer.tsx        list + jump + remove
    WirdPanel.tsx              goal setting, today progress, streak, 90-day heatmap
lib/
  mushaf/source.ts + data/     adapter + generated indexes
  storage.ts                   versioned, SSR-safe localStorage helpers
  wird.ts                      day-rollover + streak logic (pure functions, unit-testable)
```

Flip library evaluation happens first thing in M1: `react-pageflip` (StPageFlip) has no
native RTL mode — the candidate workaround is feeding it a reversed page array. If the
flip direction or shadow reads wrong, fall back immediately to a Framer Motion right→left
fold; the mushaf must feel correct, the library is disposable.

## 5. Persistence schema (localStorage, all keys versioned)

```ts
"mushaf.v1.lastPage"  : number                       // written on every settled navigation
"mushaf.v1.bookmarks" : { page: number; createdAt: string }[]
"mushaf.v1.wird"      : {
  goal: number;                                      // current pages/day target
  days: Record<string, { read: number; goal: number }>;
  // key = LOCAL date "2026-07-04" (device clock, as specced)
  // `read`  = count of distinct pages viewed that day
  // `goal`  = snapshot of the goal when that day first logged,
  //           so past streak days aren't retroactively broken by raising the goal
}
```

- **"Page read" definition (assumption, veto at review):** a page counts once per day
  after being visible ≥ 3 seconds — distinct-pages-with-dwell, so rapid flipping to
  navigate doesn't inflate the wird. Tracked per day as a Set of page numbers in memory,
  persisted as the count + the set for today only.
- **Streak:** computed (never stored) by walking back from today through `days`, counting
  consecutive dates where `read >= goal`. Today counts if already met, otherwise the
  streak shown is "as of yesterday". Missing date = broken streak.
- **Rollover:** the day key is recomputed on every write; entries older than 120 days are
  pruned. Heatmap renders the last ~90 days from `days`.

## 6. Failure modes

| Failure | Handling |
|---|---|
| Page image 404/error | paper-toned placeholder with page number + retry button; never blank |
| Search index fetch fails | inline error in drawer with retry; reader unaffected |
| Corrupt/missing localStorage | zod-lite validation on read → fall back to defaults, never crash |
| Invalid page in URL | clamp/redirect to page 1 |
| API down | not a runtime failure mode — no runtime APIs |

## 7. Design notes

Warm off-white paper canvas (`#faf6ef`-family), single deep-green accent, generous
whitespace, subtle page-edge shadow between the two pages to sell the spine. Arabic UI
chrome in a clean naskh (self-hosted **Noto Naskh Arabic** — no external font CDN calls).
Chrome auto-fades during reading. Dark mode: cheap version only (dark canvas +
`filter` softening on page images) if it looks good; dropped if it cheapens the mushaf.

## 8. Milestones

- **M1 — The mushaf.** Scripts + data pipeline, adapter, `/page/[n]`, two-page spread,
  flip (library decision), keyboard, preloading, skeletons, responsive single-page
  collapse. *Review gate: does it feel like a mushaf? Is RTL order right at البقرة?*
- **M2 — Navigation.** TopBar, JumpDrawer (surah/juz/page), last-read restore, `/` redirect.
- **M3 — Bookmarks + Wird.** Both features, streak logic with unit tests on rollover, heatmap.
- **M4 — Search + polish.** SearchDrawer, all failure states, dark-mode decision, README.

Pause for your review after each milestone.

---

**Open decisions flagged for your go:** (1) self-host images as recommended above,
(2) the ≥3s-dwell definition of "page read" for the wird.
