/**
 * Expo Router: pass to `unstable_settings.redirectSystemPath` in your root `app/_layout.tsx`.
 * Share-extension / system URLs from `expo-sharing` use hostname `expo-sharing`; redirect to a
 * route (e.g. `/handle-share`) that reads payloads with `useIncomingShare()` or `getSharedPayloads()`.
 *
 * @param {{ path: string; initial: boolean }} args
 * @returns {Promise<string>}
 */
export async function redirectSystemPath({ path, initial }) {
  try {
    if (new URL(path).hostname === 'expo-sharing') {
      return '/handle-share';
    }
    return path;
  } catch {
    return '/';
  }
}
