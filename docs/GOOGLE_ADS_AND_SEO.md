# Google “ads” + SEO — what applies to Property Pulse

## Two different Google products (do not confuse them)

| Name | Who it’s for | What you do | In this app |
|------|----------------|-------------|-------------|
| **Google AdSense** | **Publishers** (you own the site/app) | Put ad units on your pages; Google pays **you** for impressions/clicks (per policy) | **Yes** — `AdSlot.jsx`, `VITE_GOOGLE_ADS_*` env vars. See `docs/ADSENSE_SETUP.md`. |
| **Google Ads** (Ads API) | **Advertisers** | Buy search/display/video ads to promote a business | **Not** used to show earning ads on your own web app. Use only if **you** run paid campaigns to acquire users. |

**Earning ad revenue on Property Pulse = AdSense** (or other networks), not the Google Ads advertiser API.

### What you need from your Google / AdSense account

1. **AdSense** approved (or in progress) for your **production domain** (HTTPS).
2. Publisher ID **`ca-pub-…`** and **ad unit slot** IDs from AdSense → **Ads → By ad unit**.
3. In **`.env.local` / hosting env** (Vite):
   - `VITE_GOOGLE_ADS_CLIENT_ID=ca-pub-…`
   - `VITE_GOOGLE_ADS_SLOT_LEADERBOARD`, `…_INFEED`, optional `…_RECTANGLE`
4. **`ads.txt`** at the **root of your live site** when AdSense asks (file on your CDN/host, not only in Git).
5. **Consent / privacy** where the law requires (e.g. EEA/UK) — get legal/product guidance.

**Optional:** AdSense Management API + backend OAuth for reports (`backend/.env`, `docs/PUBLISHER_REVENUE_ADSENSE_STRIPE.md`).

---

## SEO — realistic expectations

No implementation can **guarantee** “#1 on Google.” Ranking depends on **relevance**, **quality**, **backlinks**, **competition**, **Core Web Vitals**, and **Search policies**. This repo adds **technical hygiene** so Google *can* crawl, understand, and share your pages correctly.

### Implemented in code

- **Default HTML title + description** in `index.html` (Property Pulse branding).
- **`react-helmet-async`** — per-route `<title>`, `meta description`, `canonical`, Open Graph, Twitter cards, `noindex` on login/profile-style pages (`SeoHelmet.jsx`, `Layout.jsx`, `src/core/seoConfig.js`).
- **`VITE_SITE_URL`** — canonical + JSON-LD `WebSite` when set.
- **`VITE_OG_IMAGE_URL`** — full URL for `og:image` / Twitter image (optional).
- **`postbuild`** script writes **`dist/sitemap.xml`** + **`dist/robots.txt`** when **`VITE_SITE_URL`** is set at build time (`scripts/seo-postbuild.mjs`).
- **`public/manifest.json`** + **`favicon.svg`** for PWA-style metadata.

### What you should do in Google Search Console & ops

1. **Verify** your domain in [Google Search Console](https://search.google.com/search-console).
2. **Submit sitemap**: `https://YOUR_DOMAIN/sitemap.xml` (after a production build with `VITE_SITE_URL` set).
3. **Performance**: keep LCP/CLS strong (images, fonts, code-splitting). Monitor **PageSpeed Insights**.
4. **Content**: unique, helpful copy on `/Pricing` and landing flows; avoid thin/duplicate pages.
5. **Links**: legitimate backlinks and brand mentions (partners, press, communities) — no paid link schemes.

### Optional next steps (not in repo by default)

- **Google Analytics 4** or **Tag Manager** for measurement (separate snippet / env).
- **Prerendering / SSR** for even richer snippets (bigger architecture change).
- **Localized** `hreflang` if you ship multiple countries/languages.

---

## Information to send your team (or this project) to finish setup

Please provide:

1. **Production URL** (e.g. `https://app.homescore.example`) → becomes **`VITE_SITE_URL`**.
2. **Brand decision**: final **app name** in copy (Property Pulse vs HomeScore) — we use **Property Pulse** in `constants.js` / SEO; change there if needed.
3. **AdSense** `ca-pub-…` + **slot IDs** (or confirm you’ll use **dev sample ads** only locally).
4. **OG image** absolute URL (1200×630 JPG/PNG recommended) → **`VITE_OG_IMAGE_URL`**.
5. Whether you will run **Google Ads campaigns** (paid user acquisition); if yes, that’s a separate Ads account + conversion tracking plan, not the AdSense slots.

---

*Note: We don’t have live “ask Anthropic” API access from the editor; this guide follows current Google documentation and standard technical SEO practice.*
