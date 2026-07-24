"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AyahOverlayRecord } from "@/lib/mushaf/ayahRegions";
import type { MenuAnchorRect } from "./AyahOverlay";

type Action = "play" | "repeat" | "tafsir" | "copy" | "bookmark" | "note" | "share";

const ACTIONS: Array<{ id: Action; label: string }> = [
  { id: "play", label: "تشغيل" },
  { id: "repeat", label: "تكرار ٣ مرات" },
  { id: "tafsir", label: "التفسير" },
  { id: "copy", label: "نسخ الآية" },
  { id: "bookmark", label: "حفظ علامة" },
  { id: "note", label: "إضافة ملاحظة" },
  { id: "share", label: "مشاركة" },
];

const GAP = 10;
const EDGE = 12;

export default function AyahContextMenu({
  open = true,
  record,
  anchor,
  layoutKey,
  bookmarked,
  onAction,
  onClose,
}: {
  open?: boolean;
  record: AyahOverlayRecord;
  anchor: MenuAnchorRect;
  layoutKey: string;
  bookmarked: boolean;
  onAction: (action: Action) => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: anchor.left, top: anchor.bottom + GAP });

  useLayoutEffect(() => {
    const place = () => {
      const menu = menuRef.current;
      if (!menu) return;
      const width = menu.offsetWidth;
      const height = menu.offsetHeight;
      const candidates = [
        { left: anchor.left + anchor.width / 2 - width / 2, top: anchor.top - height - GAP },
        { left: anchor.left + anchor.width / 2 - width / 2, top: anchor.bottom + GAP },
        anchor.left > window.innerWidth / 2
          ? { left: anchor.left - width - GAP, top: anchor.top + anchor.height / 2 - height / 2 }
          : { left: anchor.right + GAP, top: anchor.top + anchor.height / 2 - height / 2 },
      ];
      const fitting = candidates.find(
        (candidate) =>
          candidate.left >= EDGE &&
          candidate.top >= EDGE &&
          candidate.left + width <= window.innerWidth - EDGE &&
          candidate.top + height <= window.innerHeight - EDGE
      );
      const candidate = fitting ?? candidates[1];
      setPosition({
        left: Math.min(Math.max(EDGE, candidate.left), window.innerWidth - width - EDGE),
        top: Math.min(Math.max(EDGE, candidate.top), window.innerHeight - height - EDGE),
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, layoutKey]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose(true);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(true);
      }
      if (event.key !== "Tab" || !menuRef.current) return;
      const buttons = [...menuRef.current.querySelectorAll<HTMLButtonElement>("button")];
      if (!buttons.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-hidden={!open}
      inert={!open}
      aria-label={`إجراءات الآية ${record.verseKey}`}
      dir="rtl"
      className={`ayah-context-menu fixed z-[90] grid w-[min(19rem,calc(100vw-24px))] grid-cols-2 gap-1 rounded-xl border border-gold/30 bg-sheet/95 p-2 text-ink shadow-2xl backdrop-blur-md ${
        open ? "ayah-context-menu-visible" : ""
      }`}
      style={{ left: position.left, top: position.top }}
    >
      <div className="col-span-2 border-b border-gold/15 px-2 py-1 text-center text-xs text-ink-soft">
        الآية {record.verseKey}
      </div>
      {ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          role="menuitem"
          className="cursor-pointer rounded-lg px-3 py-2 text-right text-sm transition-colors hover:bg-accent/10 focus-visible:bg-accent/10"
          onClick={() => onAction(action.id)}
        >
          {action.id === "bookmark" && bookmarked ? "إزالة العلامة" : action.label}
        </button>
      ))}
    </div>
  );
}

export type AyahMenuAction = Action;
