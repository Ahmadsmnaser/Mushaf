# QUL Raw Data Inputs

Place downloaded QUL JSON files here before running:

```bash
node scripts/build-data.mjs
```

Expected files:

- `qpc-hafs-ayah-by-ayah.json`
  - QUL resource 86: <https://qul.tarteel.ai/resources/quran-script/86>
  - Expected shape: `{ "1:1": { "verse_key": "1:1", "text": "...", "page_number": 1, "juz_number": 1, "hizb_number": 1 } }`
- `surah-names.json`
  - QUL resource 70: <https://qul.tarteel.ai/resources/quran-metadata/70>
  - Expected shape: `{ "1": { "id": 1, "name": "Al-Fatihah", "name_simple": "Al-Fatihah", "name_arabic": "الفاتحة" } }`

The app never reads these files at runtime. The build script converts them into
static files under `lib/mushaf/data/` and `public/data/`.
