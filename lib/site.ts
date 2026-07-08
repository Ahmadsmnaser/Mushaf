export const SITE_NAME = "تلاوة";

export const SITE_TITLE = "تلاوة | مصحف رقمي للقراءة الهادئة";

export const SITE_DESCRIPTION =
  "تلاوة تجربة رقمية هادئة لقراءة القرآن الكريم من المتصفح، مصممة للحواسيب والشاشات الكبيرة، مع علامات شخصية، تفسير مبسط، وتلاوة صوتية.";

const DEFAULT_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): URL {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;

  try {
    return new URL(configuredUrl.endsWith("/") ? configuredUrl : `${configuredUrl}/`);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export function getCanonicalUrl(path = "/"): string {
  const baseUrl = getSiteUrl().toString().replace(/\/+$/, "");
  const normalizedPath = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}
