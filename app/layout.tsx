import type { Metadata, Viewport } from "next";
import { Amiri, IBM_Plex_Sans_Arabic } from "next/font/google";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, getSiteUrl } from "@/lib/site";
import "./globals.css";

// Amiri: classical naskh with Quranic heritage - ceremonial labels only
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
  metadataBase: getSiteUrl(),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    siteName: SITE_NAME,
    locale: "ar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
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
