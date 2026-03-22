# Publisher revenue: AdSense + Stripe

## Important: two different Google products

| Product | Who uses it | Pays whom | This app |
|--------|-------------|-----------|----------|
| **[Google AdSense](https://adsense.google.com/)** | **You** (site/app **publisher**) | **Google → you** (bank/check per your AdSense settings) | Display ads: `AdSlot.jsx` + optional **AdSense Management API** for reports |
| **[Google Ads API](https://developers.google.com/google-ads/api/docs/start)** | **Advertisers** (campaign managers) | Advertiser → Google Ads | **Not** used for earning display ad revenue on your own site |

To **earn** from ads on PropertyPulse, use **AdSense** (publisher), not the Google Ads API.

Official AdSense Management API intro: [Get started](https://developers.google.com/adsense/management/getting_started).

Recommended first API report (from Google’s docs):

- `reports.generate` with `date_range: YESTERDAY`, `dimensions: DATE`, `metrics: ESTIMATED_EARNINGS`

## Can AdSense money go into Stripe?

**No — not as a standard deposit.** Google pays AdSense publishers through **Google’s payment methods** (e.g. bank transfer), not into your Stripe balance.

**Stripe** in this app is for **user subscriptions** (Premium / Realtor): customers pay you via Stripe Checkout; webhooks update `profiles.plan`.

So you typically have **two revenue lines**:

1. **Subscription (Stripe)** — MRR, invoices, Customer Portal  
2. **AdSense** — estimated earnings in AdSense UI / API; actual payouts on Google’s schedule  

For **accounting**, export or aggregate both (Stripe Dashboard + AdSense payments/reports). This repo adds **daily AdSense estimate snapshots** in Supabase for a simple internal timeline next to your Stripe activity (it does **not** move money).

## What this codebase does

### 1. Show ads (revenue surface)

- Set **`VITE_GOOGLE_ADS_CLIENT_ID`** (AdSense `ca-pub-…` client id) and **ad slot** env vars — see root `.env.example`.
- `AdSlot` loads `adsbygoogle.js` for **free** users only (`usePlan().showAds`).

### 2. AdSense Management API (server)

- **`GOOGLE_ADSENSE_CLIENT_ID`**, **`GOOGLE_ADSENSE_CLIENT_SECRET`**, **`GOOGLE_ADSENSE_REFRESH_TOKEN`** in `backend/.env`
- Scope: `adsense.readonly` (or `adsense` for write operations elsewhere)
- Proxies under `/api/integrations/google/adsense/...` (admin plan)

### 3. Daily earnings snapshot (optional)

- Backend: **`POST /api/integrations/revenue/adsense-daily-snapshot`** (admin)  
  - Calls AdSense `reports:generate` for **`YESTERDAY`** with **`ESTIMATED_EARNINGS`**
  - Upserts into **`publisher_revenue_snapshots`**
- Optional env: **`GOOGLE_ADSENSE_PUBLISHER_ACCOUNT`** = `pub-…` or `accounts/pub-…`; if unset, uses the **first** account returned by the API.

Run on a schedule (e.g. cron, GitHub Actions, or Cloud Scheduler) hitting your deployed API with an admin user token.

### 4. Stripe (subscriptions)

- Unchanged: checkout, portal, webhooks in `subscription` router and `main.py`.
- Subscription revenue is **not** written into `publisher_revenue_snapshots` (that table is for AdSense estimates unless you extend it).

## Checklist to “turn on” ad revenue

1. [AdSense](https://adsense.google.com/) — approve site/app, create ad units, get **pub id** + **slot ids** → Vite env.  
2. [Google Cloud](https://console.cloud.google.com/) — OAuth client for **AdSense Management API**, refresh token → backend env.  
3. Enable **AdSense Management API** for that project.  
4. (Optional) Run daily **`adsense-daily-snapshot`** and query `publisher_revenue_snapshots` for charts.  
5. Keep **Stripe** for Premium/Realtor; reconcile both in your books.

## Official Python samples (Google)

Google’s repo mirrors the same **AdSense Management API v2** flows (`get_all_accounts.py`, `generate_report.py`, OAuth + `client_secrets.json`):

**[googleads/googleads-adsense-examples — `v2/python`](https://github.com/googleads/googleads-adsense-examples/tree/main/v2/python)**

This project uses the **same REST API** with a server **refresh token** in `.env`. To obtain that token using the same OAuth style as the samples, run:

`backend/scripts/adsense_oauth_to_env.py` — see **`backend/scripts/README_ADSENSE.md`**.

## References

- [AdSense Management API — Get started](https://developers.google.com/adsense/management/getting_started)  
- [reports.generate](https://developers.google.com/adsense/management/reference/rest/v2/accounts.reports/generate)  
- [AdSense client libraries](https://developers.google.com/adsense/management/libraries)  
- [googleads-adsense-examples (Python v2)](https://github.com/googleads/googleads-adsense-examples/tree/main/v2/python)
