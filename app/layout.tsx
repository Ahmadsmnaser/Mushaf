import type { Metadata, Viewport } from "next";
import { Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

// Amiri: classical naskh with Quranic heritage — ceremonial labels only
// (surah names, drawer titles). IBM Plex Sans Arabic: quiet utility UI.
const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500"],
  variable: "--font-plex-arabic",
});

export const metadata: Metadata = {
  title: "المصحف",
  description: "مصحف المدينة النبوية للقراءة — تجربة تصفّح كالمصحف الورقي",
};

export const viewport: Viewport = {
  themeColor: "#efe6d4",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${amiri.variable} ${plexArabic.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
