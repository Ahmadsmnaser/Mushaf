"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clampPage, getPageMeta, PAGE_COUNT } from "@/lib/mushaf/source";
import { useLastRead } from "@/lib/useLastRead";
import { useBookmarks } from "@/lib/useBookmarks";
import BookmarksPanel from "@/components/chrome/BookmarksPanel";

const arNum = (n: number) => n.toLocaleString("ar-EG");

/**
 * The landing page is the closed mushaf: the deep-green tooled-leather cover
 * of the Madani mushaf, and every action on it opens the book somewhere.
 */
export default function Home() {
  const router = useRouter();
  const lastRead = useLastRead();
  const { bookmarks, remove, setNote } = useBookmarks();
  const [marksOpen, setMarksOpen] = useState(false);
  const [pageInput, setPageInput] = useState("");

  const goToInput = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(pageInput.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    if (Number.isFinite(n) && n >= 1) router.push(`/page/${clampPage(n)}`);
  };

  return (
    <main className="cover-field h-svh overflow-auto">
      <div className="cover-pattern flex min-h-full items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          {/* tooled double frame, like the stamped border of the cover */}
          <div className="rounded-lg border border-gold-soft/45 p-2">
            <div className="rounded-md border border-gold-soft/25 px-5 py-10 text-center sm:px-14 sm:py-14">
              <p className="mb-4 text-sm tracking-wide text-gold-soft/80">
                مصحف المدينة النبوية
              </p>
              <h1 className="font-display text-6xl font-bold text-gold-soft sm:text-7xl">
                المصحف
              </h1>
              <p className="mx-auto mt-5 max-w-md text-sm leading-7 text-paper/85">
                اقرأ كما تقرأ من المصحف الورقي: صفحتان متقابلتان، وتقليبٌ
                كالورق، لا شيء يشغلك عن الآيات.
              </p>

              <Link
                href={`/page/${lastRead ?? 1}`}
                className="mt-8 inline-flex items-baseline gap-3 rounded-full bg-paper px-8 py-3 text-ink shadow-lg transition-transform hover:scale-[1.02]"
              >
                <span className="font-medium">
                  {lastRead ? "متابعة القراءة" : "ابدأ القراءة"}
                </span>
                <span className="text-sm text-ink-soft">
                  {lastRead
                    ? `صفحة ${arNum(lastRead)} · ${getPageMeta(lastRead).surahs[0]}`
                    : "من الفاتحة"}
                </span>
              </Link>

              <div className="mt-10 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <CoverCard href="/page/1" title="الصفحة الأولى" sub="الفاتحة" />
                <CoverCard
                  onClick={() => setMarksOpen(true)}
                  title="العلامات"
                  sub={bookmarks.length > 0 ? `${arNum(bookmarks.length)} محفوظة` : "لا شيء بعد"}
                />
                <CoverCard
                  onClick={() =>
                    router.push(`/page/${1 + Math.floor(Math.random() * PAGE_COUNT)}`)
                  }
                  title="صفحة للتأمل"
                  sub="فتح عشوائي"
                />
                <form
                  onSubmit={goToInput}
                  className="flex flex-col justify-center gap-1.5 rounded-lg border border-gold-soft/30 px-3 py-3 text-paper/90"
                >
                  <label htmlFor="go-page" className="text-sm">
                    اذهب إلى صفحة
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="go-page"
                      type="text"
                      inputMode="numeric"
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      placeholder={`١–${arNum(PAGE_COUNT)}`}
                      className="w-full min-w-0 rounded border border-gold-soft/30 bg-transparent px-2 py-1 text-center text-sm text-paper placeholder:text-paper/40"
                    />
                    <button
                      type="submit"
                      aria-label="اذهب"
                      className="shrink-0 cursor-pointer rounded border border-gold-soft/40 px-2 text-gold-soft transition-colors hover:bg-gold-soft/10"
                    >
                      ←
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-gold-soft/60">
            مصحف المدينة — {arNum(PAGE_COUNT)} صفحة · تُحفظ علاماتك وموضع قراءتك على هذا الجهاز
          </p>
        </div>
      </div>

      <BookmarksPanel
        open={marksOpen}
        onClose={() => setMarksOpen(false)}
        bookmarks={bookmarks}
        onGo={(p) => router.push(`/page/${p}`)}
        onRemove={remove}
        onSetNote={setNote}
      />
    </main>
  );
}

function CoverCard({
  title,
  sub,
  href,
  onClick,
}: {
  title: string;
  sub: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-1 block text-xs text-paper/60">{sub}</span>
    </>
  );
  const className =
    "block cursor-pointer rounded-lg border border-gold-soft/30 px-3 py-3 text-center text-paper/90 transition-colors hover:border-gold-soft/60 hover:bg-gold-soft/10";
  return href ? (
    <Link href={href} className={className}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
