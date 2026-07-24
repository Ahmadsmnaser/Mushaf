"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const overlayStack: symbol[] = [];

/** Focus entry, Escape, a compact focus loop, and delayed focus restoration. */
export function useOverlayFocus(
  open: boolean,
  mounted: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const stackIdRef = useRef(Symbol("overlay"));

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const stackId = stackIdRef.current;
    overlayStack.push(stackId);
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => {
      const target =
        containerRef.current?.querySelector<HTMLElement>("[data-autofocus]") ??
        containerRef.current;
      target?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (overlayStack.at(-1) !== stackId) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !containerRef.current) return;
      const focusable = [
        ...containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ];
      if (focusable.length === 0) {
        event.preventDefault();
        containerRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey);
      const index = overlayStack.lastIndexOf(stackId);
      if (index >= 0) overlayStack.splice(index, 1);
    };
  }, [containerRef, open]);

  useEffect(() => {
    if (!mounted) return;
    return () => {
      const returnTarget = returnFocusRef.current;
      if (overlayStack.length === 0 && returnTarget?.isConnected) returnTarget.focus();
    };
  }, [mounted]);
}
