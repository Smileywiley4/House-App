# iOS In-App Purchase (IAP) Compliance — Property Pocket

This guide is the policy-safe path to avoid App Store rejections related to payments.

## Current state (audited + implemented)

- `mobile/App.js` now includes Apple IAP UI via RevenueCat (`react-native-purchases`) on iOS:
  - list available packages from current offering
  - buy package
  - restore purchases
- Backend webhook endpoint added: `POST /api/webhooks/revenuecat`
  - syncs entitlements to `profiles.plan`
  - logs events to `iap_events`

## Apple rule you must design around

If users can unlock digital features/content/subscriptions **inside the iOS app**, Apple generally requires:

- **StoreKit In-App Purchase (IAP)** for that purchase flow.
- No links/buttons/instructions that send users to external payment methods for digital unlocks.

Web can still use Stripe; iOS app purchase flow must be compliant.

---

## Decision path

Choose one now:

1. **No iOS purchases yet (safest launch)**
   - App is free in iOS.
   - Do not show upgrade/purchase CTA in iOS app.
   - Keep premium/realtor purchase only on web (outside app context), and avoid steering language in-app.

2. **Sell subscriptions in iOS app**
   - Implement Apple IAP (StoreKit 2 via RevenueCat or react-native-iap).
   - Backend entitlements map Apple receipts/products to `profiles.plan`.
   - Keep Stripe for web purchases.

---

## RevenueCat setup (required now)

1. Create RevenueCat project + iOS app.
2. In RevenueCat, create entitlements:
   - `property_pocket_pro`
   - `realtor` (optional if you sell this tier in iOS)
3. Add products from App Store Connect to an offering and map them to entitlements.
4. Put iOS public SDK key into `mobile/.env`:

```bash
EXPO_PUBLIC_RC_APPLE_API_KEY=appl_xxx
EXPO_PUBLIC_IAP_ENTITLEMENT_ID=property_pocket_pro
```

5. Configure RevenueCat webhook:
   - URL: `https://YOUR_API_DOMAIN/api/webhooks/revenuecat`
   - Authorization header: `Bearer <REVENUECAT_WEBHOOK_SECRET>`
6. Set backend env:

```bash
REVENUECAT_WEBHOOK_SECRET=...
REVENUECAT_PREMIUM_ENTITLEMENT_ID=property_pocket_pro
REVENUECAT_REALTOR_ENTITLEMENT_ID=realtor
```

7. Apply migration:
   - `supabase/migrations/20260430110000_iap_events.sql`

---

## Step-by-step setup

## Step 1 — Ensure no external purchase steering

- Keep all digital purchase CTAs inside Apple IAP flow.
- Do not add links/buttons to Stripe checkout inside iOS app.
- Stripe remains valid for web purchases.

## Step 2 — Reviewer-safe wording

If plan-gated features exist in mobile, wording should be neutral:
- “Feature unavailable on mobile build” (or similar),
- not “Upgrade at our website”.

## Step 3 — App Review notes

In App Store Connect Review Notes include:
- “This iOS app currently does not offer in-app digital purchases.”
- “No external payment links are provided in-app.”
- Test credentials and feature walkthrough.

## Step 4 — App Review notes (paste)

Use wording like:

> “This iOS app uses Apple In‑App Purchase for digital subscriptions. The app does not direct users to external web checkout for in-app digital feature unlocks. ‘Restore purchases’ is available in-app.”

---

## Data/privacy notes for payments

When you add IAP:
- collect only purchase entitlement metadata needed for access control.
- avoid storing raw sensitive payment details.
- update Privacy Policy and App Privacy answers.

