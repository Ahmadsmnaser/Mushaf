"use client";

import { MUSHAF_STYLE_OPTIONS, type MushafStyle } from "@/lib/readerSettings";

export default function MushafStyleSwitcher({
  mushafStyle,
  onChange,
}: {
  mushafStyle: MushafStyle;
  onChange: (style: MushafStyle) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="مظهر المصحف">
      {MUSHAF_STYLE_OPTIONS.map((style) => (
        <button
          key={style.id}
          role="radio"
          aria-checked={mushafStyle === style.id}
          aria-label={style.label}
          title={style.label}
          onClick={() => onChange(style.id)}
          className={`pressable flex cursor-pointer items-center gap-2 rounded-lg border px-2 py-2 text-start ${
            mushafStyle === style.id
              ? "border-accent bg-accent/10"
              : "border-gold/20 hover:border-gold/50"
          }`}
        >
          <span
            aria-hidden
            className="h-6 w-6 shrink-0 rounded-sm border border-black/15 shadow-inner"
            style={{ backgroundColor: style.swatch }}
          />
          <span className="min-w-0 text-[11px] text-ink-soft">{style.label}</span>
        </button>
      ))}
    </div>
  );
}
