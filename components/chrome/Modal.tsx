"use client";

import { useEffect, useRef } from "react";

/**
 * Minimal dialog shell shared by the jump modal and bookmarks panel:
 * backdrop click / Escape to close, focus moved inside on open.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const target =
      cardRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      cardRef.current;
    target?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={cardRef}
        tabIndex={-1}
        className="modal-card relative flex max-h-[85svh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-gold/30 bg-paper shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-gold/20 px-5 py-3">
          <h2 className="font-display text-xl text-accent">{title}</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
