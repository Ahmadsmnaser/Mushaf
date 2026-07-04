"use client";

import { getPageMeta } from "@/lib/mushaf/source";
import type { Bookmark } from "@/lib/useBookmarks";
import Modal from "./Modal";

const arNum = (n: number) => n.toLocaleString("ar-EG");
const hijri = new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" });

export default function BookmarksPanel({
  open,
  onClose,
  bookmarks,
  onGo,
  onRemove,
  onSetNote,
}: {
  open: boolean;
  onClose: () => void;
  bookmarks: Bookmark[];
  onGo: (page: number) => void;
  onRemove: (page: number) => void;
  onSetNote: (page: number, note: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="العلامات">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
        {bookmarks.length === 0 ? (
          <p className="py-6 text-center text-sm leading-7 text-ink-soft">
            لا علامات بعد.
            <br />
            أثناء القراءة اضغط <kbd className="rounded border border-gold/40 bg-sheet px-1.5 text-xs">B</kbd> أو زر العلامة في الشريط لحفظ موضعك.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {bookmarks.map((b) => (
              <li
                key={b.page}
                className="group rounded-lg border border-transparent px-2 py-2 transition-colors hover:border-gold/25 hover:bg-sheet"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      onGo(b.page);
                      onClose();
                    }}
                    className="flex min-w-0 cursor-pointer items-baseline gap-3 text-start"
                  >
                    <span aria-hidden className="ribbon-mini" />
                    <span className="shrink-0 text-sm">صفحة {arNum(b.page)}</span>
                    <span className="truncate font-display text-base text-accent">
                      {getPageMeta(b.page).surahs[0]}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-ink-soft">
                      {hijri.format(new Date(b.createdAt))}
                    </span>
                    <button
                      onClick={() => onRemove(b.page)}
                      aria-label={`احذف علامة صفحة ${arNum(b.page)}`}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink-soft opacity-0 transition-all hover:bg-ink/5 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="h-4 w-4">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  defaultValue={b.note ?? ""}
                  placeholder="أضف ملاحظة…"
                  onBlur={(e) => {
                    if (e.target.value !== (b.note ?? "")) onSetNote(b.page, e.target.value);
                  }}
                  className="mt-1 w-full rounded border border-transparent bg-transparent px-2 py-0.5 text-xs text-ink-soft placeholder:text-ink-soft/50 focus:border-gold/30 focus:bg-sheet"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
