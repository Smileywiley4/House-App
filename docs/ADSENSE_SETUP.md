# Google AdSense (on-site “Google ads”) — setup checklist

PropertyPulse uses **Google AdSense** for **publisher** display ads on the web app. That is **not** the same as the **Google Ads API** (used by advertisers to buy/manage campaigns).

## Quick local test (no AdSense account yet)

- Run **`npm run dev`** with **no** `VITE_GOOGLE_ADS_*` variables set.
- The app uses Google’s **sample** publisher id `ca-pub-3940256099942544` and test slot `6300978111` (from [Google’s test ad documentation](https://developers.google.com/admob/unity/test-ads)) so `<AdSlot />` requests real **test** creatives instead of the gray placeholder.
- To disable: `VITE_GOOGLE_ADS_DEMO=false` in `.env.local`.
- **Production** (`npm run build`): sample IDs are **not** auto-enabled — set your real AdSense env vars on the host.
- Ads only show for users where **`usePlan().showAds`** is true (typically **free** tier).

---

## What you configure (no secrets to send to anyone)

### 1. AdSense account & site

1. Create / use a [Google AdSense](https://www.google.com/adsense/) account.
2. Add your **production domain** and complete site review (can take time).
3. Create **ad units** (e.g. display horizontal, in-feed, display rectangle) and copy each unit’s **slot ID** (numeric).

### 2. Frontend env (`ALL/.env.local` or hosting env)

| Variable | Where to get it |
|----------|-----------------|
| `VITE_GOOGLE_ADS_CLIENT_ID` | AdSense → **Account** / **Ads** overview — publisher ID **`ca-pub-XXXXXXXX`** |
| `VITE_GOOGLE_ADS_SLOT_LEADERBOARD` | Ad unit slot for wide/top placements |
| `VITE_GOOGLE_ADS_SLOT_INFEED` | Ad unit slot for in-feed style |
| `VITE_GOOGLE_ADS_SLOT_RECTANGLE` | *(optional)* Medium rectangle; defaults to leaderboard slot if unset |

Rebuild the client after changing `VITE_*` vars (`npm run build` / your CI).

### 3. Who sees ads

Ads render only when `usePlan().showAds` is true (typically **free** users). Premium/realtor plans should not see these slots.

### 4. Production requirements

- **HTTPS** on your live domain.
- **`ads.txt`** on the site root if AdSense asks for it (points to your publisher id).
- **Privacy / consent** (GDPR, US state laws, etc.) where applicable — use your legal/compliance guidance.

### 5. Optional: revenue snapshots (Management API)

To pull **reporting** into your backend (not required for ads to show):

1. In Google Cloud: enable **AdSense Management API**.
2. OAuth desktop client + run `ALL/backend/scripts/adsense_oauth_to_env.py` (see `backend/scripts/README_ADSENSE.md`).
3. Put the printed `GOOGLE_ADSENSE_*` values in `backend/.env`.
4. Apply the Supabase migration for `publisher_revenue_snapshots` if you use that table.

---

## Troubleshooting

| Symptom | Likely cause |
|--------|----------------|
| Blank gray box | New site / unit not approved yet, ad blocker, or wrong `ca-pub` / slot |
| “Tag error” in console | Slot doesn’t belong to that `ca-pub`, or duplicate `push` on same element (this app guards that) |
| Works locally, not prod | Missing env on host, or domain not added in AdSense |

The web client loads **one** `adsbygoogle.js` per page and pushes each `<ins class="adsbygoogle">` after the script loads (`AdSlot.jsx`).
