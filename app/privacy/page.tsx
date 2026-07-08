import type { Metadata } from "next";
import Link from "next/link";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "الخصوصية",
  description: `سياسة خصوصية ${SITE_NAME}: تسجيل الدخول بحساب Google وحفظ العلامات والملاحظات والتفضيلات عند اختيار المستخدم ذلك.`,
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: `الخصوصية | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    url: "/privacy",
  },
  twitter: {
    title: `الخصوصية | ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
};

export default function PrivacyPage() {
  return (
    <main data-reader-theme="green" className="cover-field h-svh overflow-auto">
      <div className="cover-pattern flex min-h-full items-center justify-center px-4 py-10 sm:px-8">
        <section className="home-frame-outer w-full max-w-3xl rounded-lg border p-2">
          <div className="home-frame-inner rounded-md border px-6 py-8 text-right sm:px-10 sm:py-10">
            <p className="home-muted font-ui text-sm">{SITE_NAME}</p>
            <h1 className="home-title mt-3 font-display text-4xl font-bold sm:text-5xl">
              الخصوصية
            </h1>
            <div className="home-body mt-6 space-y-5 font-ui text-base leading-8">
              <p>
                يتيح موقع {SITE_NAME} تسجيل الدخول باستخدام Google لمن يرغب في مزامنة
                بياناته الشخصية بين الأجهزة.
              </p>
              <p>
                عند تسجيل الدخول، يمكن حفظ العلامات والملاحظات والتفضيلات وآخر صفحة
                قرأتها. تُستخدم هذه البيانات لتوفير تجربة قراءة متصلة ومزامنة فقط.
              </p>
              <p>
                تبقى قراءة القرآن الكريم متاحة دون تسجيل الدخول. لا يلزم إنشاء حساب
                لاستخدام القارئ الأساسي.
              </p>
              <p>
                لا يهدف الموقع إلى جمع بيانات حساسة غير لازمة للتشغيل، ولا تُستخدم
                بياناتك الشخصية لإضافة ميزات خارجة عن تجربة القراءة والحفظ والمزامنة.
              </p>
              <p>
                يمكنك تسجيل الخروج من حسابك في أي وقت من داخل الموقع. بعد تسجيل الخروج،
                تبقى القراءة متاحة، بينما تتوقف مزامنة البيانات الخاصة بالحساب على هذا
                الجهاز.
              </p>
            </div>
            <Link
              href="/"
              className="home-primary-button mt-8 inline-flex rounded-full px-6 py-3 font-ui text-sm font-medium"
            >
              العودة إلى المصحف
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
