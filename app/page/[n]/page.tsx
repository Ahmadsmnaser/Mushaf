import { redirect } from "next/navigation";
import Reader from "@/components/reader/Reader";
import { PAGE_COUNT } from "@/lib/mushaf/source";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1 || n > PAGE_COUNT) redirect("/page/1");
  return <Reader initialPage={n} />;
}
