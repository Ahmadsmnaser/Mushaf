# تلاوة

تلاوة مصحف رقمي هادئ للقراءة من المتصفح، مع تسجيل دخول Google اختياري لمزامنة العلامات والملاحظات والتفضيلات وآخر صفحة قراءة.

## Local Development

```bash
npm run dev
```

Open `http://localhost:3000`.

## Vercel Environment Variables

Add these variables in Vercel Project Settings before the first public deployment:

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Production origin for metadata, canonical URLs, `sitemap.xml`, and `robots.txt`: `https://mushaf-tau.vercel.app`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. Safe to expose client-side. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase publishable key. Safe to expose client-side with RLS enabled. |
| `MOKHTASAR_API_TOKEN` | If using Mokhtasar | Server-only API token for Mokhtasar tafsir. Do not prefix with `NEXT_PUBLIC_`. |
| `MOKHTASAR_BOOK_ID` | If using Mokhtasar | Defaults to `200` when unset. |
| `QURAN_FOUNDATION_CLIENT_ID` | If used | Reserved for Quran Foundation API integration. |
| `QURAN_FOUNDATION_CLIENT_SECRET` | If used | Server-only secret. Do not prefix with `NEXT_PUBLIC_`. |

After changing environment variables in Vercel, redeploy the project so Next.js rebuilds metadata and server routes with the new values.

## Supabase Setup

1. Create or open the Supabase project.
2. Apply the database schema from `supabase/schema.sql`.
3. Enable Google OAuth in Supabase Auth.
4. Configure the production callback URL in Supabase and Google OAuth using `NEXT_PUBLIC_SITE_URL`:
   - Site URL: `https://mushaf-tau.vercel.app`
   - Callback URL: `https://mushaf-tau.vercel.app/auth/callback`
5. Add the Supabase environment variables in Vercel Project Settings.

Reading remains available without login. Login is only needed for syncing saved marks, notes, preferences, and last-read page.

## Production Metadata

The site name is `تلاوة`.

The app uses `NEXT_PUBLIC_SITE_URL` for:

- Metadata base URL and canonical URLs
- Open Graph/Twitter URL resolution
- `sitemap.xml`
- `robots.txt`

The uploaded `opened-quran.png` is used to generate:

- `app/favicon.ico`
- `app/icon.png`
- `app/apple-icon.png`

The uploaded image is a square icon asset and contains visible watermarking, so no dedicated Open Graph image is configured yet. A larger clean social preview can be added later as `app/opengraph-image.png` and `app/twitter-image.png`.

## Deployment Checks

Before deploying:

```bash
npm run lint
npm run build
```

Verify after deployment:

- Browser tab title shows `تلاوة`.
- Favicon appears next to the site title.
- `/sitemap.xml` is reachable.
- `/robots.txt` is reachable and references the sitemap.
- `/privacy` is reachable.
- Quran reader rendering, page flip/navigation, Tafsir/audio, and Supabase auth behavior are unchanged.
