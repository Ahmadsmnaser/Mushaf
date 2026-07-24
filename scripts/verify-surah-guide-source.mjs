const BASE = "https://api.quranpedia.net/v1/surah/information";
const FIELD_NAMES = [
  "introduction",
  "asmaoha",
  "topics",
  "purposes",
  "grace",
  "prophet",
  "revelation",
];
const pending = Array.from({ length: 114 }, (_, index) => index + 1);
const coverage = Object.fromEntries(FIELD_NAMES.map((field) => [field, 0]));
let largest = { surah: 0, field: "", length: 0 };

async function verifyOne(surahNumber) {
  const response = await fetch(`${BASE}/${surahNumber}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Surah ${surahNumber}: HTTP ${response.status}`);
  }
  const body = await response.json();
  if (Number(body?.surah_number?.value) !== surahNumber) {
    throw new Error(`Surah ${surahNumber}: mismatched identity`);
  }
  if (typeof body?.introduction?.value !== "string" || !body.introduction.value.trim()) {
    throw new Error(`Surah ${surahNumber}: missing Arabic introduction`);
  }
  for (const field of FIELD_NAMES) {
    const value = body?.[field]?.value;
    if (typeof value === "string" && value.trim()) {
      coverage[field] += 1;
      if (value.length > largest.length) {
        largest = { surah: surahNumber, field, length: value.length };
      }
    }
  }
}

async function worker() {
  while (pending.length > 0) {
    const surahNumber = pending.shift();
    await verifyOne(surahNumber);
  }
}

await Promise.all(Array.from({ length: 6 }, () => worker()));
console.log("Verified Quranpedia Arabic Surah information: 114/114");
console.log("Field coverage:", coverage);
console.log("Largest section:", largest);
