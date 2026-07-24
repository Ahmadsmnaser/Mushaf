"use client";

import { useEffect, useId, useRef } from "react";
import { usePresence } from "@/components/motion/Presence";
import { MOTION } from "@/lib/motion";

const modalStack: symbol[] = [];
let scrollLocks = 0;
let previousBodyOverflow = "";

function lockDocumentScroll() {
  if (scrollLocks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}

function unlockDocumentScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = previousBodyOverflow;
}

/**
 * Minimal dialog shell shared by the jump modal and bookmarks panel:
 * backdrop click / Escape to close, focus moved inside on open.
 *
 * Stays mounted while closed (visibility flips after the exit fade — the
 * .modal-shell presence pattern in globals.css) so closing animates instead
 * of vanishing; `inert` keeps the hidden dialog out of the tab order.
 */
export default function Modal({
  open,
  onClose,
  title,
  maxWidth = "max-w-lg",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: string;
  children: React.ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const stackIdRef = useRef(Symbol("modal"));
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const presence = usePresence(open, MOTION.duration.dialog);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || !presence.mounted) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const stackId = stackIdRef.current;
    modalStack.push(stackId);
    const focusFrame = window.requestAnimationFrame(() => {
      const target =
        cardRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        cardRef.current;
      target?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (modalStack.at(-1) !== stackId) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !cardRef.current) return;
      const focusable = [
        ...cardRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ),
      ];
      if (focusable.length === 0) {
        e.preventDefault();
        cardRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKey);
      const index = modalStack.lastIndexOf(stackId);
      if (index >= 0) modalStack.splice(index, 1);
    };
  }, [open, presence.mounted]);

  useEffect(() => {
    if (!presence.mounted) return;
    lockDocumentScroll();
    return () => {
      unlockDocumentScroll();
      const returnTarget = returnFocusRef.current;
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [presence.mounted]);

  if (!presence.mounted) return null;
  const interactive = open && presence.phase !== "exiting";

  return (
    <div
      className={`modal-shell modal-present fixed inset-0 z-50 flex items-center justify-center p-4 ${
        presence.phase === "visible" ? "modal-open" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-hidden={!interactive}
      inert={!interactive}
      data-presence={presence.phase}
    >
      <div
        className="modal-backdrop absolute inset-0 bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={cardRef}
        tabIndex={-1}
        className={`modal-card relative flex max-h-[85svh] w-full ${maxWidth} flex-col overflow-hidden rounded-[14px] border border-gold/30 bg-paper shadow-[0_30px_60px_-20px_rgba(40,30,14,.5)] outline-none`}
      >
        <div className="flex items-center justify-between border-b border-gold/20 px-5 py-3">
          <h2 id={titleId} className="font-display text-xl text-accent">{title}</h2>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="pressable flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-ink/5 hover:text-ink"
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
