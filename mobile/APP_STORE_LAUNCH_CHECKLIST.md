# App Store Launch Checklist — Property Pocket

Last updated after Expo SDK 57 stabilization. Use this as the single launch tracker.

---

## Done in code (no action needed)

- [x] App branding: **Property Pocket** / **Prop Pocket**
- [x] iOS bundle ID: `com.proppocket.mobile`
- [x] Permission strings (camera, photos, contacts, location)
- [x] `ITSAppUsesNonExemptEncryption=false`
- [x] App icons + splash assets in `mobile/assets/`
- [x] RevenueCat IAP integration (`react-native-purchases`)
- [x] Entitlement ID aligned: **`Property Pocket Pro`**
- [x] Restore purchases UI
- [x] Dev-only debug sections hidden in production (`__DEV__`)
- [x] **Expo SDK 57 stable** (migrated off canary)
- [x] `expo-doctor`: 20/20 checks passing
- [x] Splash screen via `expo-splash-screen` plugin
- [x] EAS build/submit profiles in `eas.json`
- [x] Backend RevenueCat webhook: `POST /api/webhooks/revenuecat`

---

## Phase 1 — Apple & Expo accounts (you)

### 1.1 Apple Developer Program
- [ ] Enroll at [developer.apple.com/programs](https://developer.apple.com/programs/) ($99/yr)
- [ ] Confirm access to [App Store Connect](https://appstoreconnect.apple.com/)

### 1.2 App Store Connect app record
- [ ] **My Apps → + → New App**
- [ ] Platform: iOS
- [ ] Name: **Property Pocket**
- [ ] Bundle ID: **com.proppocket.mobile** (register in Certificates, Identifiers & Profiles first if needed)
- [ ] Copy the numeric **Apple ID** (ascAppId) — paste into `mobile/eas.json` → `submit.production.ios.ascAppId`

### 1.3 Expo Application Services (EAS)
From `mobile/`:

```bash
npx eas login
npx eas init
```

- [ ] Copy EAS project ID into `mobile/app.json` → `expo.extra.eas.projectId` (replace `REPLACE_WITH_EAS_PROJECT_ID`)
- [ ] Set `mobile/eas.json` → `submit.production.ios.appleId` to your Apple ID email

---

## Phase 2 — RevenueCat + App Store products (you)

You already set up Test Store offerings. For **App Store submission** you need real Apple products.

### 2.1 App Store Connect subscriptions
- [ ] **Features → Subscriptions** (or In-App Purchases)
- [ ] Create subscription group (e.g. "Property Pocket Pro")
- [ ] Add products, e.g.:
  - `com.proppocket.mobile.monthly`
  - `com.proppocket.mobile.yearly`
  - `com.proppocket.mobile.lifetime` (non-consumable, if offering lifetime)
- [ ] Submit products for review (can be with app binary)

### 2.2 RevenueCat production iOS app
- [ ] **Apps & providers → + → Apple App Store**
- [ ] Bundle ID: `com.proppocket.mobile`
- [ ] Link App Store Connect (Shared Secret / App Store Connect API key)
- [ ] Map products to entitlement **`Property Pocket Pro`**
- [ ] Copy **Apple public SDK key** (`appl_...`)

### 2.3 EAS secrets (never commit keys)

```bash
cd mobile
eas secret:create --name EXPO_PUBLIC_RC_APPLE_API_KEY --value appl_YOUR_KEY --scope project
eas secret:create --name EXPO_PUBLIC_APP_URL --value https://YOUR_WEB_URL --scope project
eas secret:create --name EXPO_PUBLIC_API_BASE_URL --value https://YOUR_API_URL --scope project
```

**Do not** set `EXPO_PUBLIC_RC_TEST_API_KEY` on production builds.

### 2.4 Backend webhook (when API is live)

On Railway/host:

```bash
REVENUECAT_WEBHOOK_SECRET=<random-secret>
REVENUECAT_PREMIUM_ENTITLEMENT_ID="Property Pocket Pro"
```

RevenueCat → Integrations → Webhooks:
- URL: `https://YOUR_API/api/webhooks/revenuecat`
- Authorization: `Bearer <REVENUECAT_WEBHOOK_SECRET>`

Run Supabase migration: `supabase/migrations/20260430110000_iap_events.sql`

---

## Phase 3 — Build & TestFlight (you + EAS)

```bash
cd mobile
npm install
npm run doctor          # should show 20/20 passed
npm run build:ios       # production profile → EAS cloud build
```

- [ ] Install build on physical iPhone via TestFlight
- [ ] Test purchase with **Sandbox Apple ID** (not Test Store key in production build)
- [ ] Test **Restore purchases**
- [ ] Confirm entitlement shows active
- [ ] Verify no placeholder URLs or dev-only UI in release build

Preview build (internal testing, faster iteration):

```bash
npm run build:ios:preview
```

---

## Phase 4 — App Store Connect metadata (you)

Required before submission:

| Item | Notes |
|------|--------|
| App name + subtitle | Property Pocket |
| Description + keywords | Home comparison, scoring |
| Privacy Policy URL | **Required** — host on your web domain |
| Support URL | **Required** |
| Category | e.g. Lifestyle or Productivity |
| 1024×1024 icon | Use `mobile/assets/icon.png` |
| iPhone screenshots | 6.7" and 6.5" minimum |
| App Privacy questionnaire | Contacts, photos, location, purchases |
| Age rating | Complete questionnaire |

### App Review notes (paste)

> This app uses Apple In-App Purchase for digital subscriptions via RevenueCat. Restore purchases is available in-app. Camera is used for property visit photos. Location is used for map features. Contacts are used only when the user taps Invite friends.

Provide sandbox tester credentials if login is required.

---

## Phase 5 — Submit

```bash
cd mobile
npm run submit:ios
```

Or submit from [expo.dev](https://expo.dev) after build completes.

- [ ] Select production build
- [ ] Complete export compliance (already declared in app.json)
- [ ] Submit for review

---

## Quick command reference

| Goal | Command |
|------|---------|
| Local dev (Test Store) | `npx expo start` then `npx expo run:ios` |
| Health check | `npm run doctor` |
| Production iOS build | `npm run build:ios` |
| Submit to App Store | `npm run submit:ios` |

---

## Current blockers (fill these in)

| Item | Status |
|------|--------|
| Apple Developer enrolled | ? |
| App Store Connect app created | ? |
| EAS project ID in app.json | Placeholder |
| ascAppId in eas.json | Placeholder |
| RevenueCat `appl_` key in EAS secrets | ? |
| Privacy Policy URL | ? |
| Production API URL for webhook | ? |

---

## Related docs

- `IOS_APP_STORE_READINESS.md` — technical prep summary
- `IOS_IAP_COMPLIANCE.md` — Apple payment rules
- `IAP_SETUP_OPTION_B.md` — RevenueCat step-by-step
