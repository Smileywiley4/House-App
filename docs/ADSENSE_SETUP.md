# Google AdSense (on-site “Google ads”) — setup checklist

PropertyPulse uses **Google AdSense** for **publisher** display ads on the web app. That is **not** the same as the **Google Ads API** (used by advertisers to buy/manage campaigns).

## Quick local test (no AdSense account yet)

- Run **`npm run dev`** with **no** `VITE_GOOGLE_ADS_*` variables set.
- The app uses Google’s **sample** publisher id `ca-pub-3940256099942544` and test slot `6300978111` (from [Google’s test ad documentation](https://developers.google.com/admob/unity/test-ads)) so `<AdSlot />` requests real **test** creatives instead of the gray placeholder.
- To disable: `VITE_GOOGLE_ADS_DEMO=false` in `.env.local`.
- **Production** (`npm run build`): sample IDs are **not** auto-enabled — set your real AdSense env vars on the host.
- Ads only show for users where **`usePlan().showAds`** is true (typically **free** tier).

---

## What you configure

### 1. AdSense account & site

1. Create or open your [Google AdSense account](https://www.google.com/adsense/).
2. Complete **Payments information** with your legal payee name, mailing address, tax information, and payment
   method. Google may require identity/address verification before releasing payments.
3. In **Sites**, add the final production domain and [connect it to AdSense](https://support.google.com/adsense/answer/7584263).
4. Choose Google&apos;s CMP during setup, then publish the required messages under **Privacy & messaging**. Use the
   three-button European message so visitors can consent, manage options, or decline.
5. Request site review. Google says this often takes a few days but can take 2–4 weeks. Do not use live ad IDs until
   the site and account are approved.
6. After approval, create one responsive display ad unit and copy its numeric slot ID.

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

Start with the Home-page responsive unit already implemented. Do not place ads on profile, billing, private notes,
saved-property, or property-visit screens. Production silently renders nothing while IDs are unconfigured.

### 4. Vignette (“pop-up”) ads

Do **not** put a standard AdSense unit in a custom modal or popup. That can create accidental clicks and policy
violations. Use Google&apos;s supported **Vignette ads**:

1. AdSense → **Ads** → **By site**.
2. Select the production site and turn on **Auto ads**.
3. Open **Overlay formats** and enable **Vignette ads**.
4. Start with a conservative frequency and preview desktop and mobile.
5. Keep sensitive/account routes excluded in AdSense.

Vignettes are full-screen ads shown by Google between page loads; Google controls dismissal and policy behavior.

### 5. Production requirements

- **HTTPS** on your live domain.
- Publish the exact **`ads.txt`** line shown in AdSense at `https://YOUR_DOMAIN/ads.txt`. It normally resembles
  `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`; never copy another publisher&apos;s ID.
- Publish Google&apos;s certified CMP messages before ads load for regulated visitors.
- Keep the Privacy Policy accurate and obtain legal review for the regions where the product operates.

### 6. Receiving revenue

Revenue belongs to the AdSense payee account—not Vercel or Property Pocket. In AdSense:

1. Complete identity, mailing-address/PIN, and tax verification when requested.
2. Add and verify the bank account under **Payments → Payments info**.
3. Monitor finalized earnings and any payment holds.
4. Google issues payment after the account reaches the applicable payment threshold and has no holds. The commonly
   documented USD threshold is $100; confirm the threshold shown for your currency in your own account.

Never click live ads yourself, ask users to click, buy traffic intended to generate impressions, or place ads where
they may be mistaken for app controls.

### 7. Optional: revenue snapshots (Management API)

To pull **reporting** into your backend (not required for ads to show):

1. In Google Cloud: enable **AdSense Management API**.
2. OAuth desktop client + run `ALL/backend/scripts/adsense_oauth_to_env.py` (see `backend/scripts/README_ADSENSE.md`).
3. Put the printed `GOOGLE_ADSENSE_*` values in `backend/.env`.
4. Apply the Supabase migration for `publisher_revenue_snapshots` if you use that table.

### 8. Future direct partner placements

Keep paid-partner campaigns separate from AdSense units. A future implementation should use dedicated
**Sponsored** placements with campaign dates, creative approval, destination validation, impression/click reporting,
and clear disclosure. Do not inject partner creative into an AdSense container.

---

## Troubleshooting

| Symptom | Likely cause |
|--------|----------------|
| Blank gray box | New site / unit not approved yet, ad blocker, or wrong `ca-pub` / slot |
| “Tag error” in console | Slot doesn’t belong to that `ca-pub`, or duplicate `push` on same element (this app guards that) |
| Works locally, not prod | Missing env on host, or domain not added in AdSense |

The web client loads **one** `adsbygoogle.js` per page and pushes each `<ins class="adsbygoogle">` after the script loads (`AdSlot.jsx`).  
`data-ad-format` is mapped to values Google accepts (`horizontal`, `fluid`, `auto`) — not slot nicknames like `leaderboard`.
