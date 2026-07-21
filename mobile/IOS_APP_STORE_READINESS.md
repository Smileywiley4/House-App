# iOS App Store Readiness (Propurty mobile)

This checklist is specific to `mobile/` (Expo React Native app).

## What was prepared in code

- `app.json` hardened for production:
  - Proper app name/slug/scheme
  - iOS `bundleIdentifier`, `buildNumber`, `deploymentTarget`
  - Permission strings for camera/photos/contacts/location
  - `ITSAppUsesNonExemptEncryption=false` declaration
  - `runtimeVersion` and `updates` defaults
  - `extra.eas.projectId` placeholder
- Required mobile assets created in `mobile/assets/`:
  - `icon.png`, `splash-icon.png`, `favicon.png`
  - Android adaptive icon layers
- Added `mobile/eas.json` with production build and submit profiles.
- Added npm scripts in `mobile/package.json`:
  - `doctor`, `prebuild`, `build:ios`, `submit:ios`
- Developer-only diagnostics in `App.js` are hidden in production (`__DEV__`).

---

## Actions only you can complete

## 1) Accounts and access

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/yr).
2. Create/confirm App Store Connect access at [appstoreconnect.apple.com](https://appstoreconnect.apple.com/).
3. Ensure your Apple account has:
   - App Manager or Admin role in App Store Connect
   - Access to Certificates/Identifiers/Profiles in Apple Developer.

## 2) Expo/EAS project linkage

From `mobile/`:

```bash
npx eas login
npx eas init
```

Then copy the generated EAS project id into `app.json`:

`expo.extra.eas.projectId`

## 3) Bundle id and app record

1. Keep/confirm iOS bundle id: `com.proppocket.mobile`
2. In App Store Connect: **My Apps -> + -> New App**
3. Use the same bundle id and platform iOS.
4. Put the returned numeric app id (`ascAppId`) into `mobile/eas.json`.

## 4) Build and submit

```bash
cd mobile
npm install
npm run doctor
npm run build:ios
npm run submit:ios
```

If prompted, allow EAS to manage certs/profiles unless you have an in-house signing process.

## 5) App Store metadata (required)

In App Store Connect, add:

- App name, subtitle, description, keywords
- Privacy Policy URL
- Support URL
- Marketing URL (optional)
- Category
- 1024x1024 app icon
- iPhone screenshots (required sizes)

## 6) Privacy/compliance (high rejection risk if wrong)

Complete App Privacy questionnaire accurately:

- Contacts (invite flow)
- Photos/media (capture + pick + save)
- Location (map features)
- Diagnostics/device metadata (if enabled)
- Push notifications token handling

If data can identify users or be used for tracking, answer accordingly.

## 7) Functional review prep

Apple reviewers need a clean flow:

- Provide demo account credentials in Review Notes (if login required).
- Explain why contacts/location/camera are requested and where in UI.
- Confirm no broken links, placeholder domains, or test-only text in release build.

---

## Important follow-up recommendation

This mobile app uses **Expo SDK 57** (stable). Run `npm run doctor` before each release build; all checks should pass.

See **`APP_STORE_LAUNCH_CHECKLIST.md`** for the full step-by-step launch tracker.

## IAP compliance path

Before submission, review `IOS_IAP_COMPLIANCE.md` and choose your launch path:

- launch free iOS app with no in-app digital purchase surface (fastest approval), or
- implement Apple IAP before exposing subscription upgrades in iOS.
