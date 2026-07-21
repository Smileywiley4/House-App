# App Store & Play Store compliance checklist

Property Pocket (house-app). Use this when shipping **native iOS / Android wrappers**. Web compliance items live in Privacy, Terms, Profile (deletion/export), and Pricing.

**Recommend qualified attorney review before public launch.** Nothing here claims immunity from legal claims.

---

## Already implemented on web (shipped)

- [x] Privacy Policy + Terms linked from signup, login, checkout/Pricing, footer
- [x] Explicit signup consent (Terms + Privacy checkbox required)
- [x] Account deletion in Profile → Security (confirm `DELETE`)
  - Cancels Stripe subscriptions **immediately** (no next-period charge)
  - Clears plan entitlements; forfeits unused referral credits
  - Wipes avatars / visit photos (best-effort); auth user delete cascades personal rows
  - Clears local/session auth + handoff storage on the deleting device
  - Marks Google Sheets **Accounts** CRM row `Deleted` + clears contact PII
  - Writes `account_deletion_log` (minimal audit; no card data)
- [x] Download my data (Profile → Security) + Privacy documents contact path
- [x] Location / photos only after user action + purpose copy in UI
- [x] Subscription auto-renew + cancel path disclosed on Pricing / Terms / Billing
- [x] AI / OpenAI processor disclosure in Privacy
- [x] Children: not directed to under 13 (or 16 where applicable)
- [x] Cookies / local storage disclosure; ads only for guests/free (paid ad-free)

---

## Apple App Store (native)

| Item | Status / action |
|------|-----------------|
| Privacy Policy URL in App Store Connect | Point to production `/Privacy` |
| Account deletion in-app | Required if account creation exists — wire same API as web |
| Sign in with Apple | **Required** if Google (or other third-party) Sign-In is offered on iOS |
| Purpose strings (Info.plist) | `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSCameraUsageDescription` — match real features |
| App Privacy labels | Map to actual data: account, location (if used), photos, contacts/shares (user-initiated), purchase history via Apple |
| Subscriptions / IAP | See **critical IAP risk** below |
| No scraping | Use licensed data only (e.g. RentCast); Terms already prohibit scraping |

### Critical launch risk — Stripe WebView vs IAP

If paid digital features are unlocked **only** via Stripe checkout inside a native WebView (or in-app browser) on iOS, **Apple may require In-App Purchase** for digital goods/subscriptions. Current production billing is **Stripe on web**. Before shipping a paid iOS app that sells Premium/Realtor in-app:

1. Confirm with counsel / Apple guidelines whether reader-app or other exceptions apply.
2. Prefer App Store IAP (e.g. RevenueCat already partially integrated in backend) for in-app unlocks on iOS.
3. Do **not** silently ship Stripe-only unlocks inside a native shell without resolving this.

---

## Google Play

| Item | Status / action |
|------|-----------------|
| Data safety form | Declare collected data types matching Privacy (account, location optional, photos, etc.) |
| Account deletion | Same in-app deletion + URL if required |
| Permission declarations | Location, camera, photos — only if features use them; purpose text must match |
| Subscriptions | Play Billing for in-app digital subscriptions when selling inside the Play app |

---

## Native-only follow-ups (when wrappers ship)

1. Add Info.plist / Android permission strings (location, photo library, camera).
2. If Google Sign-In on iOS → add Sign in with Apple.
3. Decide IAP vs external web purchase model; document App Store Connect answers.
4. Complete App Privacy / Play Data safety questionnaires from live Privacy Policy.
5. Test account deletion end-to-end on device builds (billing cancel + session wipe).
6. Attorney review of Privacy, Terms, subscription copy, and advertising disclosures.

---

## Production legal URLs (update if domain changes)

- Home: `https://proppocket.com/` (or current production host)
- Privacy: `https://proppocket.com/Privacy`
- Terms: `https://proppocket.com/Terms`
- Support: `https://proppocket.com/Support` / `support@proppocket.com`
