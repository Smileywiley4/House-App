# Property Pulse — Expo mobile

## Notifications (`expo-notifications`)

Install (matches your Expo SDK):

```bash
npx expo install expo-notifications
```

This project includes:

- **`app.json`** — plugin with Android accent color `#10b981` and default FCM channel `default`.
- **`App.js`** — `setNotificationHandler` (banner + list, no sound/badge in foreground), Android channel `default`, `registerForPushNotificationsAsync` using **`expo-device`** + **`expo-constants`** for EAS `projectId`, listener for received notifications, **`useNotificationObserver()`** for tap / cold-start handling, and a **Push notifications** section with token, channel IDs, and **Schedule test notification (2s)**.
- **`hooks/useNotificationObserver.js`** — Same idea as expo-router’s layout pattern: `getLastNotificationResponse()` plus `addNotificationResponseReceivedListener`, reads **`data.url`** from the payload. **Without expo-router:** opens `https://…` in the browser, other schemes via `Linking`, and app paths via **`expo-linking`** `createURL`. **With expo-router:** pass `useNotificationObserver({ navigate: (url) => router.push(url) })`.

Next steps for **push**:

1. Run `eas init` / link the project and add **`extra.eas.projectId`** in `app.json` (or `app.config.js`) so `Constants.expoConfig.extra.eas.projectId` is set — required for `getExpoPushTokenAsync`.
2. Send the displayed Expo push token to your backend and use Expo’s push API or FCM/APNs as documented.
3. For Android FCM, add `google-services.json`; for iOS, enable Push Notifications capability.

Rebuild native projects after adding the plugin or changing `extra`.

## Device data & local aggregates (`expo-device`)

```bash
npx expo install expo-device
```

Already in **`package.json`**. Used for:

- **Push** — `Device.isDevice` so simulators skip token registration.
- **Cross-platform snapshot** — **`utils/deviceSnapshot.js`** builds a safe payload from **`expo-device`** + **`expo-constants`** (nulls on web / unknown fields are OK).
- **Local store** — **`utils/localDeviceStats.js`**: native → JSON in app documents; **web** → **`localStorage`**. Opt-in switch in **`App.js`** increments **coarse buckets** (same fields as snapshot).
- **Backend analytics** — If **`EXPO_PUBLIC_API_BASE_URL`** is set and the user opts in, the app **POSTs** at most **once per 24 hours** to **`POST /api/analytics/mobile-device-snapshot`** (FastAPI → Supabase **`mobile_device_snapshots`**). Apply migration **`20250301000000_mobile_device_snapshots.sql`**. **Dev builds:** “Send snapshot to API now” bypasses throttle. Add **rate limiting** at your API gateway in production if the endpoint is public.

## SMS (`expo-sms`)

Install (matches your Expo SDK):

```bash
npx expo install expo-sms
```

Already in this project’s **`package.json`**. **`App.js`** includes **Text invite link (SMS)** — opens the system SMS composer with the same invite message as email share, optionally prefilling up to 12 numbers from contacts (requires contacts permission). If `sendSMSAsync` fails (e.g. some Android `smsto:` edge cases), it falls back to `Linking.openURL` with a `sms:` URL.

SMS is unavailable in the **iOS Simulator** and on **web**; use a physical phone with cellular / Messages.

## Sharing (`expo-sharing`)

Install (matches your Expo SDK):

```bash
npx expo install expo-sharing
```

Already in this project’s **`package.json`**. The **`expo-sharing`** config plugin in **`app.json`** sets:

- **iOS** — share extension / activation: up to **5 images** (`activationRule.supportsImageWithMaxCount`).
- **Android** — `singleShareMimeTypes` / `multipleShareMimeTypes` both **`image/*`** so the app can appear as a target when sharing images from other apps.

Rebuild native projects after changing plugin options (`npx expo prebuild` or EAS Build).

- **`Sharing.shareAsync(uri, { mimeType, dialogTitle })`** — opens the OS share sheet for a **local file URI** (e.g. the visit photo from `expo-camera`). Used by the **Share** button after you capture a photo in **`App.js`**.
- **Text-only invites** use React Native **`Share.share`** (invite flow) — that’s the right API for a message string; `expo-sharing` is aimed at sharing files.

**Receiving shares** (other apps → Property Pulse):

- **`utils/redirectSystemPath.js`** — export **`redirectSystemPath`** for **Expo Router** `unstable_settings`: if the system URL’s hostname is **`expo-sharing`**, it returns **`/handle-share`** so you can route to a screen that reads payloads with **`useIncomingShare()`** or **`getSharedPayloads()`** from `expo-sharing`.
- **`App.js`** — **`IncomingShareBannerGate`** (native only) uses **`useIncomingShare()`** so images shared into the app can be opened as the visit photo without a router.
- **`examples/handle-share.route.example.tsx`** — starter screen when you add **`expo-router`** and a **`/handle-share`** route.

## Images (`expo-image`)

```bash
npx expo install expo-image
```

Included in **`package.json`**. **`app.json`** registers the **`expo-image`** config plugin with **`disableLibdav1d`: true** (skips libdav1d in native builds when you don’t need that AVIF path). **`App.js`** and **`IncomingShareBanner.js`** use **`Image`** from **`expo-image`** (`contentFit` instead of `resizeMode`) for better caching and performance. Rebuild native projects after changing plugin options.

## File system (`expo-file-system`)

```bash
npx expo install expo-file-system
```

Included in **`package.json`**. **`app.json`** registers the **`expo-file-system`** config plugin with:

- **`supportsOpeningDocumentsInPlace`: true** — iOS: lets the app open documents in place (Files / document browser integration).
- **`enableFileSharing`: true** — exposes app documents in the **Files** app / iTunes file sharing where applicable.

Use the API to read/write app documents & cache, download files, and get **content URIs** (e.g. **`getContentUriAsync`** from **`expo-file-system/legacy`** for **`expo-sms`** attachments on Android). On SDK 56+, classic helpers like **`documentDirectory`**, **`readAsStringAsync`**, and **`writeAsStringAsync`** live under **`expo-file-system/legacy`** (see **`utils/localDeviceStats.js`**). Rebuild native projects after changing plugin options.

## Maps (`expo-maps`)

- **Apple Maps** on iOS, **Google Maps** on Android (`components/PropertyMap.js`).
- **Not available in Expo Go** — use a [development build](https://docs.expo.dev/develop/development-builds/introduction/) or EAS Build.
- **iOS deployment target** is set to **18.0** in `app.json` (required by expo-maps).
- **Android:** set your Google Maps SDK API key for production:

```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "YOUR_ANDROID_KEY"
    }
  }
}
```

Or use `app.config.js` and `process.env` so keys are not committed.

## Location

The `expo-maps` config plugin requests **when-in-use** location so the map can show the user dot and “my location” UI after the user taps **Enable location**.

## Media library (`expo-media-library`)

Install (matches your Expo SDK):

```bash
npx expo install expo-media-library
```

Already configured in this project:

- **`package.json`** — `expo-media-library` dependency.
- **`app.json`** — config plugin with `photosPermission`, `savePhotosPermission`, and iOS `NSPhotoLibraryAddUsageDescription` for saving captures.
- **`App.js`** — **Save to Photos** uses `MediaLibrary.requestPermissionsAsync(true)` (save-only when supported) and `MediaLibrary.saveToLibraryAsync(uri)` after you take a picture.

Rebuild native projects after plugin changes (`npx expo prebuild` or EAS).

## Env

- `EXPO_PUBLIC_APP_URL` — web app URL for invite links / deep links.
- Google Maps key — Android (see above).
