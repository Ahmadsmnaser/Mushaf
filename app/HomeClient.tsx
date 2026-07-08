"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clampPage, getPageMeta, PAGE_COUNT } from "@/lib/mushaf/source";
import { useLastRead } from "@/lib/useLastRead";
import { useMarks } from "@/lib/useMarks";
import { useSyncedReaderSettings } from "@/lib/useSyncedReaderSettings";
import MarksPanel from "@/components/chrome/MarksPanel";
import AccountButton from "@/components/auth/AccountButton";
import LocalMarksMigrationPrompt from "@/components/auth/LocalMarksMigrationPrompt";
import SignInPrompt from "@/components/auth/SignInPrompt";

const arNum = (n: number) => n.toLocaleString("ar-EG");

/**
 * The landing page is the closed mushaf: the deep-green tooled-leather cover
 * of the Madani mushaf, and every action on it opens the book somewhere.
 */
export default function Home() {
  const router = useRouter();
  const lastRead = useLastRead();
  const {
    marks,
    addMark,
    updateMark,
    removeMark,
    exportStorage,
    importStorage,
    marksPending,
    isAuthenticated,
    loginPromptOpen,
    openLoginPrompt,
    closeLoginPrompt,
  } = useMarks();
  const [marksOpen, setMarksOpen] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [{ readerTheme }] = useSyncedReaderSettings();

  const goToInput = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(pageInput.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    if (Number.isFinite(n) && n >= 1) router.push(`/page/${clampPage(n)}`);
  };

  return (
    <main data-reader-theme={readerTheme} className="cover-field h-svh overflow-auto">
      <div className="cover-pattern flex min-h-full items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          <div className="mb-4 flex justify-center">
            <AccountButton tone="cover" />
          </div>
          {/* tooled double frame, like the stamped border of the cover */}
          <div className="home-frame-outer rounded-lg border p-2">
            <div className="home-frame-inner rounded-md border px-5 py-9 text-center sm:px-14 sm:py-12">
              <p className="home-title enter-rise mx-auto max-w-xl font-display text-[2rem] font-bold leading-[1.75] sm:text-[2.65rem] sm:leading-[1.65]">
                {"إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ"}
              </p>
              {/* <h1 className="mt-5 font-display text-5xl font-bold text-gold-soft sm:text-6xl">
                المصحف
              </h1> */}

              <Link
                href={`/page/${lastRead ?? 1}`}
                className="home-primary-button enter-rise mt-7 inline-flex items-baseline gap-3 rounded-full px-8 py-3 shadow-lg"
                style={{ "--enter-delay": "140ms" } as React.CSSProperties}
              >
                <span className="font-medium">
                  {lastRead ? "متابعة القراءة" : "ابدأ القراءة"}
                </span>
                <span className="home-primary-button-sub text-sm">
                  {lastRead
                    ? `صفحة ${arNum(lastRead)} · ${getPageMeta(lastRead).surahs[0]}`
                    : "من الفاتحة"}
                </span>
              </Link>
              <p className="home-muted mt-3 text-sm tracking-wide">


              </p>
              <p
                className="home-muted enter-rise mt-3 text-sm tracking-wide"
                style={{ "--enter-delay": "260ms" } as React.CSSProperties}
              >
                مصحف المدينة النبوية
              </p>
              <p
                className="home-body enter-rise mx-auto mt-4 max-w-md text-sm leading-7"
                style={{ "--enter-delay": "340ms" } as React.CSSProperties}
              >
                اقرأ كما تقرأ من المصحف
              </p>


              <div className="mt-9 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <CoverCard href="/page/1" title="الصفحة الأولى" sub="الفاتحة" delay={460} />
                <CoverCard
                  onClick={() => setMarksOpen(true)}
                  title="العلامات والملاحظات"
                  sub={marks.length > 0 ? `${arNum(marks.length)} محفوظة` : "لا شيء بعد"}
                  delay={560}
                />
                <CoverCard
                  onClick={() =>
                    router.push(`/page/${1 + Math.floor(Math.random() * PAGE_COUNT)}`)
                  }
                  title="صفحة للتأمل"
                  sub="فتح عشوائي"
                  delay={660}
                />
                <form
                  onSubmit={goToInput}
                  className="home-cover-card enter-rise flex flex-col justify-center gap-1.5 rounded-lg border px-3 py-3"
                  style={{ "--enter-delay": "760ms" } as React.CSSProperties}
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
                      className="home-page-input w-full min-w-0 rounded border bg-transparent px-2 py-1 text-center text-sm"
                    />
                    <button
                      type="submit"
                      aria-label="اذهب"
                      className="home-go-button pressable shrink-0 cursor-pointer rounded border px-2"
                    >
                      ←
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <p
            className="home-faint enter-rise mt-5 text-center text-xs tracking-wide"
            style={{ "--enter-delay": "900ms" } as React.CSSProperties}
          >
            مخصص للحواسيب والشاشات الكبيرة
          </p>
        </div>
      </div>

      <MarksPanel
        open={marksOpen}
        onClose={() => setMarksOpen(false)}
        marks={marks}
        onGo={(p) => router.push(`/page/${p}`)}
        onAddMark={addMark}
        onUpdateMark={updateMark}
        onRemoveMark={removeMark}
        exportStorage={exportStorage}
        importStorage={importStorage}
        isAuthenticated={isAuthenticated}
        saving={marksPending}
        onRequireSignIn={openLoginPrompt}
      />
      <SignInPrompt open={loginPromptOpen} onClose={closeLoginPrompt} />
      <LocalMarksMigrationPrompt />
    </main>
  );
}

function CoverCard({
  title,
  sub,
  href,
  onClick,
  delay = 0,
}: {
  title: string;
  sub: string;
  href?: string;
  onClick?: () => void;
  /** Entrance stagger, ms — part of the landing page's staged fade-up. */
  delay?: number;
}) {
  const inner = (
    <>
      <span className="block text-sm font-medium">{title}</span>
      <span className="home-card-sub mt-1 block text-xs">{sub}</span>
    </>
  );
  const className =
    "home-cover-card enter-rise block w-full cursor-pointer rounded-lg border px-3 py-3 text-center";
  const style = { "--enter-delay": `${delay}ms` } as React.CSSProperties;
  return href ? (
    <Link href={href} className={className} style={style}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={className} style={style}>
      {inner}
    </button>
  );
}
