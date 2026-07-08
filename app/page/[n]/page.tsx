import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Reader from "@/components/reader/Reader";
import { PAGE_COUNT } from "@/lib/mushaf/source";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

const arNum = (n: number) => n.toLocaleString("ar-EG");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const n = Number((await params).n);
  const pageNumber = Number.isInteger(n) && n >= 1 && n <= PAGE_COUNT ? n : 1;
  const title = `صفحة ${arNum(pageNumber)}`;

  return {
    title,
    description: SITE_DESCRIPTION,
    alternates: {
      canonical: `/page/${pageNumber}`,
    },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description: SITE_DESCRIPTION,
      url: `/page/${pageNumber}`,
    },
    twitter: {
      title: `${title} | ${SITE_NAME}`,
      description: SITE_DESCRIPTION,
    },
  };
}

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1 || n > PAGE_COUNT) redirect("/page/1");
  return <Reader initialPage={n} />;
}
