"use client";

import { useEffect, useRef, useState } from "react";
import { getPageImageUrl, PAGE_HEIGHT, PAGE_WIDTH } from "@/lib/mushaf/source";

const arNum = (n: number) => n.toLocaleString("ar-EG");

type Status = "loading" | "ready" | "error";

function PageSurface({ children }: { children: React.ReactNode }) {
  return (
    <div className="quran-page-surface relative h-full w-full">
      <div className="quran-page-frame absolute inset-[1.05%]">
        <div className="quran-page-image-slot absolute inset-[0.65%]">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * One mushaf page: the image on a paper-toned sheet, with a quiet skeleton
 * while loading and a retry state on failure — never a blank rectangle.
 */
export default function PageImage({ page }: { page: number }) {
  const [status, setStatus] = useState<Status>("loading");
  const [attempt, setAttempt] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  // onLoad can be missed for already-cached images; check `complete` too.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setStatus("ready");
    else setStatus("loading");
  }, [page, attempt]);

  if (status === "error") {
    return (
      <PageSurface>
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-ink-soft">
          <p className="text-sm">تعذّر تحميل الصفحة {arNum(page)}</p>
          <button
            onClick={() => setAttempt((a) => a + 1)}
            className="cursor-pointer rounded-md border border-ink-soft/40 px-3 py-1 text-xs transition-colors hover:border-accent hover:text-accent"
          >
            إعادة المحاولة
          </button>
        </div>
      </PageSurface>
    );
  }

  return (
    // Fixed paper white, never themed: the KSU page PNGs have a transparent
    // background, so this backing IS the paper of the mushaf page.
    <PageSurface>
      {/* eslint-disable-next-line @next/next/no-img-element -- 604 static
          same-size PNGs served from /public; the optimizer adds nothing */}
      <img
        key={attempt}
        ref={imgRef}
        src={getPageImageUrl(page) + (attempt > 0 ? `?retry=${attempt}` : "")}
        alt={`صفحة ${arNum(page)} من المصحف`}
        width={PAGE_WIDTH}
        height={PAGE_HEIGHT}
        draggable={false}
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
        className={`h-full w-full object-contain transition-opacity duration-200 ${
          status === "ready" ? "opacity-100" : "opacity-0"
        }`}
      />
      {status === "loading" && (
        <div className="absolute inset-2 animate-pulse rounded-sm bg-ink-soft/5" />
      )}
    </PageSurface>
  );
}
