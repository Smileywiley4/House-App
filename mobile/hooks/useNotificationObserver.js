import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

/**
 * Handles notification opens: cold start (`getLastNotificationResponse`) and taps while running.
 * Put `data.url` on push payloads — string path (`/visits`) or full URL (`https://…`).
 *
 * When you adopt **expo-router**, pass `navigate: (url) => router.push(url)` so in-app paths work.
 * Until then, relative paths are opened via `Linking.createURL` (deep link into the dev client / standalone app).
 *
 * @param {{ navigate?: (url: string) => void }} [options]
 */
export function useNotificationObserver(options = {}) {
  const navigate = options.navigate;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    function redirect(notification) {
      const url = notification.request.content.data?.url;
      if (typeof url !== 'string' || !url.trim()) return;

      const u = url.trim();

      // expo-router style: in-app path
      if (navigate && (u.startsWith('/') || !u.includes('://'))) {
        navigate(u.startsWith('/') ? u : `/${u}`);
        return;
      }

      if (u.startsWith('http://') || u.startsWith('https://')) {
        void Linking.openURL(u);
        return;
      }

      if (u.includes('://')) {
        void Linking.openURL(u);
        return;
      }

      const path = u.startsWith('/') ? u.slice(1) : u;
      void Linking.openURL(Linking.createURL(path));
    }

    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) {
      redirect(last.notification);
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification);
    });

    return () => subscription.remove();
  }, [navigate]);
}
