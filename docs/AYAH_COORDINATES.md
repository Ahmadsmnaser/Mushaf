# Ayah overlay coordinate source

Accessed: 2026-07-22.

The reader's 604 self-hosted images are the KSU Ayat Hafs Madani page scans. They are served locally as `public/pages/001.png` through `604.png` at 622×917 pixels. Local `001.png` was verified byte-for-byte against KSU's `png_big/1.png`; there is no cover-page offset.

Interactive geometry is requested at runtime, one visible page at a time, from KSU's fixed Hafs highlight endpoint:

`https://quran.ksu.edu.sa/interface.php?ui=pc&do=hilites&mosshaf=hafs&t=28&page={1..604}`

KSU's highlight canvas is 456×672 and uses the same scan and crop. Coordinates are scaled independently by `622/456` on x and `917/672` on y. The converter reproduces KSU's page-aware reconstruction metadata: 30-pixel lines for normal pages; the special 20-pixel opening-page layout for pages 1–2; and the 110-pixel Surah-opening separator. A multi-line Ayah becomes one to three regions.

The generated server-only page index combines the repository's QUL Quran text/key inputs with a compact KSU page-to-key boundary map and contains exactly 6,236 verse keys. This distinction matters at some page boundaries: for example, the prior QUL search artifact assigned 5:77 to page 121 although the matching local/KSU image visibly contains it on page 120. Full verification requires the KSU page-key union to equal the QUL key union exactly before the compact boundary map can be synchronized. Every runtime response must then agree exactly with the expected keys for that page. Invalid pages, missing or extra Ayahs, duplicates, malformed points, and non-positive or out-of-bounds regions are rejected. The Mushaf image remains available when geometry fails.

KSU does not expose the Basmala as a separate highlight record. At a Surah opening, its separator/Basmala space is associated with the first Ayah's reconstructed region; visual QA must account for that limitation.

KSU identifies the photographed Madani pages as originating from the King Fahd Complex. No explicit license authorizing redistribution of the coordinate corpus was found during source review. Therefore the project does not commit a 604-page coordinate corpus: the allowlisted server route fetches a page on demand and applies a 30-day server/CDN cache. Quran Android `ayahinfo` data is intentionally excluded because its 1024×1656 generated pages differ in typography, decoration, crop, and aspect ratio.

Run `npm run verify:coordinates` to politely validate all 604 upstream pages, all 6,236 QUL verse keys, geometry uniqueness/bounds, and every local image dimension.
