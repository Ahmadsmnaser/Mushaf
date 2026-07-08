"use client";

import { READER_THEME_OPTIONS, type ReaderTheme } from "@/lib/readerSettings";

export default function ThemeSwitcher({
  theme,
  onChange,
}: {
  theme: ReaderTheme;
  onChange: (t: ReaderTheme) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="ثيم القراءة">
      {READER_THEME_OPTIONS.map((t) => (
        <button
          key={t.id}
          role="radio"
          aria-checked={theme === t.id}
          aria-label={t.label}
          title={t.label}
          onClick={() => onChange(t.id)}
          className={`pressable flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-1 py-2 ${
            theme === t.id
              ? "border-accent bg-accent/10"
              : "border-gold/20 hover:border-gold/50"
          }`}
        >
          <span
            aria-hidden
            className="h-6 w-6 rounded-full border border-black/15 shadow-inner"
            style={{ backgroundColor: t.swatch }}
          />
          <span className="text-[10px] text-ink-soft">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
