"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clampPage, getPageMeta, PAGE_COUNT } from "@/lib/mushaf/source";
import { useLastRead } from "@/lib/useLastRead";
import { useMarks } from "@/lib/useMarks";
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

  const goToInput = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(pageInput.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
    if (Number.isFinite(n) && n >= 1) router.push(`/page/${clampPage(n)}`);
  };

  return (
    <main className="cover-field h-svh overflow-auto">
      <div className="cover-pattern flex min-h-full items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          <div className="mb-4 flex justify-center">
            <AccountButton tone="cover" />
          </div>
          {/* tooled double frame, like the stamped border of the cover */}
          <div className="rounded-lg border border-gold-soft/45 p-2">
            <div className="rounded-md border border-gold-soft/25 px-5 py-9 text-center sm:px-14 sm:py-12">
              <p className="enter-rise mx-auto max-w-xl font-display text-[2rem] font-bold leading-[1.75] text-gold-soft sm:text-[2.65rem] sm:leading-[1.65]">
                {"إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ"}
              </p>
              {/* <h1 className="mt-5 font-display text-5xl font-bold text-gold-soft sm:text-6xl">
                المصحف
              </h1> */}

              <Link
                href={`/page/${lastRead ?? 1}`}
                className="enter-rise mt-7 inline-flex items-baseline gap-3 rounded-full bg-paper px-8 py-3 text-ink shadow-lg transition-[translate,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:shadow-xl active:translate-y-0 active:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                style={{ "--enter-delay": "140ms" } as React.CSSProperties}
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
              <p className="mt-3 text-sm tracking-wide text-gold-soft/80">


              </p>
              <p
                className="enter-rise mt-3 text-sm tracking-wide text-gold-soft/80"
                style={{ "--enter-delay": "260ms" } as React.CSSProperties}
              >
                مصحف المدينة النبوية
              </p>
              <p
                className="enter-rise mx-auto mt-4 max-w-md text-sm leading-7 text-paper/85"
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
                  className="enter-rise flex flex-col justify-center gap-1.5 rounded-lg border border-gold-soft/30 px-3 py-3 text-paper/90"
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
                      className="w-full min-w-0 rounded border border-gold-soft/30 bg-transparent px-2 py-1 text-center text-sm text-paper placeholder:text-paper/40"
                    />
                    <button
                      type="submit"
                      aria-label="اذهب"
                      className="pressable shrink-0 cursor-pointer rounded border border-gold-soft/40 px-2 text-gold-soft hover:bg-gold-soft/10"
                    >
                      ←
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <p
            className="enter-rise mt-5 text-center text-xs tracking-wide text-gold-soft/55"
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
      <span className="mt-1 block text-xs text-paper/60">{sub}</span>
    </>
  );
  const className =
    "enter-rise block w-full cursor-pointer rounded-lg border border-gold-soft/30 px-3 py-3 text-center text-paper/90 transition-[border-color,background-color,translate] duration-[var(--motion-fast)] ease-[var(--ease-out-soft)] hover:-translate-y-1 hover:border-gold-soft/60 hover:bg-gold-soft/10 active:translate-y-0 motion-reduce:transition-[border-color,background-color] motion-reduce:hover:translate-y-0";
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
