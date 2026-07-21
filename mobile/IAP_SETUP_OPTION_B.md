# Option B — RevenueCat IAP setup (Propurty)

Follow these steps in order. Code is ready; this connects dashboards + env vars.

---

## Phase 1 — RevenueCat Test Store (do this first, ~20 min)

No Apple Developer account required yet. Uses your `test_...` key.

### 1.1 RevenueCat dashboard

1. Sign in at [app.revenuecat.com](https://app.revenuecat.com)
2. Create or open your **Propurty** project
3. Go to **Apps and providers → Test Store** (create one if missing)
4. Confirm your Test Store API key matches what’s in `mobile/.env`:
   - `EXPO_PUBLIC_RC_TEST_API_KEY=test_akUEFVWvHxtHEFXvStrcaxqkrXx`

### 1.2 Entitlement

1. **Product catalog → Entitlements → + New**
2. Identifier: **`property_pocket_pro`**
3. Display name: **Propurty Pro**

### 1.3 Test products + offering

1. **Product catalog → Products** — add three Test Store products:
   - `monthly` (subscription, 1 month)
   - `yearly` (subscription, 1 year)
   - `lifetime` (non-consumable or lifetime)
2. Attach all three to entitlement **`property_pocket_pro`**
3. **Offerings → + New** (e.g. `default`)
4. Add packages: `$rc_monthly`, `$rc_annual`, `$rc_lifetime`
5. **Mark this offering as Current** (required — app shows “No packages” without this)

### 1.4 Run the app locally

```bash
cd mobile
npm install
npx expo start
```

Open on iOS simulator or device. You should see subscription packages and be able to complete Test Store purchases (no real money).

---

## Phase 2 — Backend webhook (when API is deployed)

Webhook syncs Apple/Test purchases → `profiles.plan` in Supabase.

### 2.1 Supabase migration

Run in Supabase SQL Editor:

`supabase/migrations/20260430110000_iap_events.sql`

### 2.2 Backend env (Railway / host)

Generate a random webhook secret, then set on your backend:

```bash
REVENUECAT_WEBHOOK_SECRET=<pick-a-long-random-string>
REVENUECAT_PREMIUM_ENTITLEMENT_ID=property_pocket_pro
REVENUECAT_REALTOR_ENTITLEMENT_ID=realtor
```

### 2.3 RevenueCat webhook

In RevenueCat → **Integrations → Webhooks → + New**:

| Field | Value |
|-------|--------|
| URL | `https://YOUR_API_DOMAIN/api/webhooks/revenuecat` |
| Authorization | `Bearer <same REVENUECAT_WEBHOOK_SECRET>` |

### 2.4 Link purchases to Supabase users

Webhooks use `app_user_id` = Supabase `profiles.id`.

- **Production:** call `Purchases.logIn(supabaseUserId)` after mobile sign-in (see `mobile/services/iap.js`)
- **Dev testing:** set in `mobile/.env`:
  ```bash
  EXPO_PUBLIC_IAP_DEBUG_USER_ID=<your-supabase-user-uuid>
  ```

Verify backend health:

```bash
curl https://YOUR_API_DOMAIN/health
# look for "revenuecat_webhook_configured": true
```

---

## Phase 3 — Real App Store products (before TestFlight / submit)

### 3.1 App Store Connect

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/yr)
2. Create app with bundle ID **`com.proppocket.mobile`**
3. **Subscriptions** (or In-App Purchases):
   - `com.proppocket.mobile.monthly`
   - `com.proppocket.mobile.yearly`
   - `com.proppocket.mobile.lifetime` (non-consumable)
4. Create **Sandbox tester** (Users and Access → Sandbox)

### 3.2 RevenueCat iOS app

1. **Apps and providers → + New → Apple App Store**
2. Bundle ID: `com.proppocket.mobile`
3. Link App Store Connect products to entitlement **`property_pocket_pro`**
4. Copy **Apple public SDK key** (`appl_...`)

### 3.3 Switch mobile env for release builds

```bash
# mobile/.env (production / EAS build secrets)
EXPO_PUBLIC_RC_APPLE_API_KEY=appl_xxxxxxxx
EXPO_PUBLIC_IAP_ENTITLEMENT_ID=property_pocket_pro
# Remove or leave blank: EXPO_PUBLIC_RC_TEST_API_KEY
```

Never submit to App Store with a `test_` key.

---

## Phase 4 — Verify end-to-end

- [ ] Test Store: packages load, purchase completes, entitlement shows **active**
- [ ] Restore purchases works
- [ ] Webhook fires → row in `iap_events` → `profiles.plan` = `premium`
- [ ] `/health` shows `revenuecat_webhook_configured: true`

---

## What to send back when Phase 1 is done

Reply with:

1. Screenshot or confirmation that **Current offering** has 3 packages
2. Whether Test Store purchase worked in the app
3. Your **production API URL** (when ready for Phase 2)

Then we wire the webhook and move to Expo SDK stabilization + App Store build.
