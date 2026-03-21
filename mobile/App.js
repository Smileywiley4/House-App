import { useState, useRef, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
  Share,
  ActivityIndicator,
  Linking,
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
// expo-sharing: file/image URIs → shareAsync. Plain-text invites use react-native Share.
import * as Sharing from 'expo-sharing';
import * as SMS from 'expo-sms';
import * as Contacts from 'expo-contacts';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import PropertyMap from './components/PropertyMap';
import { IncomingShareBannerGate } from './components/IncomingShareBanner';
import { useNotificationObserver } from './hooks/useNotificationObserver';
import { getDeviceSnapshotPayload } from './utils/deviceSnapshot';
import {
  getLocalStatsConsent,
  setLocalStatsConsent,
  recordLocalSessionIfConsented,
  getLocalAggregates,
  clearLocalStats,
  forceSubmitDeviceSnapshotForDebug,
} from './utils/localDeviceStats';

/** How notifications are shown while the app is foregrounded. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getInviteMessage() {
  const appUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://your-property-pulse-app.com';
  return `Join me on Property Pulse: ${appUrl}/login`;
}

/**
 * Property Pulse mobile shell — camera for in-person visit photos.
 * Wire EXPO_PUBLIC_API_BASE_URL to your FastAPI backend + Supabase auth to upload
 * to POST /api/library/saved-properties/{id}/photos (same as web).
 */
export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState(null);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [expoPushToken, setExpoPushToken] = useState('');
  const [androidChannels, setAndroidChannels] = useState([]);
  const [lastNotification, setLastNotification] = useState(undefined);
  const [localStatsConsent, setLocalStatsConsentState] = useState(false);
  const [localStatsPreview, setLocalStatsPreview] = useState('');
  const camRef = useRef(null);
  const deviceSnap = useMemo(() => getDeviceSnapshotPayload(), []);

  /** Cold start + tap: opens `data.url` (see hooks/useNotificationObserver.js). With expo-router: pass navigate: router.push */
  useNotificationObserver();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    registerForPushNotificationsAsync().then((token) => {
      if (token) setExpoPushToken(token);
    });

    if (Platform.OS === 'android') {
      Notifications.getNotificationChannelsAsync().then((value) => setAndroidChannels(value ?? []));
    }

    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      setLastNotification(notification);
    });

    return () => {
      notificationListener.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getLocalStatsConsent();
      if (cancelled) return;
      setLocalStatsConsentState(c);
      if (c) await recordLocalSessionIfConsented();
      const agg = await getLocalAggregates();
      if (!cancelled) setLocalStatsPreview(JSON.stringify(agg, null, 2));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLocalStatsPreview = async () => {
    const agg = await getLocalAggregates();
    setLocalStatsPreview(JSON.stringify(agg, null, 2));
  };

  const takePicture = async () => {
    try {
      const photo = await camRef.current?.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) setPhotoUri(photo.uri);
    } catch (e) {
      Alert.alert('Camera', e?.message || 'Could not capture photo');
    }
  };

  /** Share visit JPEG via expo-sharing (works with camera `file://` URIs on device). */
  const sharePhoto = async () => {
    if (!photoUri) return;
    const can = await Sharing.isAvailableAsync();
    if (!can) {
      Alert.alert('Sharing', 'Sharing is not available on this device.');
      return;
    }
    await Sharing.shareAsync(photoUri, {
      mimeType: 'image/jpeg',
      dialogTitle: 'Share visit photo',
    });
  };

  /** Save-only permission (add to library) when supported; falls back to full request. */
  const saveToPhotoLibrary = async () => {
    if (!photoUri) return;
    setSavingToLibrary(true);
    try {
      let perm = await MediaLibrary.getPermissionsAsync(true);
      if (!perm.granted) {
        perm = await MediaLibrary.requestPermissionsAsync(true);
      }
      if (!perm.granted) {
        Alert.alert('Photos', 'Allow access to save visit photos to your library.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(photoUri);
      Alert.alert('Saved', 'Photo saved to your library.');
    } catch (e) {
      Alert.alert('Photos', e?.message || 'Could not save to library.');
    } finally {
      setSavingToLibrary(false);
    }
  };

  const inviteFromContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Contacts', 'Allow access to find email addresses to invite.');
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Emails, Contacts.Fields.Name],
    });
    const emails = [];
    (data || []).forEach((c) => {
      (c.emails || []).forEach((e) => {
        if (e?.email && e.email.includes('@')) emails.push(e.email.trim());
      });
    });
    const unique = [...new Set(emails)].slice(0, 12);
    const msg = getInviteMessage();
    const body =
      unique.length > 0
        ? `Found ${unique.length} email(s) in contacts. Use the system share sheet to send the link, or Profile → Invite on the web for tracked invites.`
        : 'No emails found in contacts.';
    Alert.alert('Invite friends', body);
    try {
      await Share.share({ message: msg, title: 'Property Pulse' });
    } catch (_) {}
  };

  /** Prefills SMS with invite link; adds up to 12 phone numbers from contacts when permission granted. */
  const inviteViaSms = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('SMS', 'SMS is not available on web.');
      return;
    }
    const available = await SMS.isAvailableAsync();
    if (!available) {
      Alert.alert(
        'SMS',
        'SMS is not available on this device (e.g. simulator, or iPad without Messages).'
      );
      return;
    }
    const msg = getInviteMessage();
    let recipients = [];
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
        });
        const seen = new Set();
        (data || []).forEach((c) => {
          (c.phoneNumbers || []).forEach((p) => {
            const raw = p?.number?.trim();
            if (raw && raw.replace(/\D/g, '').length >= 7 && !seen.has(raw)) {
              seen.add(raw);
              recipients.push(raw);
            }
          });
        });
        recipients = recipients.slice(0, 12);
      }
    } catch (_) {
      /* compose still opens without prefilled recipients */
    }

    try {
      await SMS.sendSMSAsync(recipients.length ? recipients : [], msg);
    } catch (e) {
      try {
        const body = encodeURIComponent(msg);
        const url =
          Platform.OS === 'ios'
            ? `sms:&body=${body}`
            : `sms:?body=${body}`;
        await Linking.openURL(url);
      } catch (_) {
        Alert.alert('SMS', e?.message || String(e));
      }
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Checking camera permission…</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Property Pulse — Visits</Text>
        <Text style={styles.hint}>Camera access is needed for in-person property photos.</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Allow camera</Text>
        </TouchableOpacity>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.root}>
      <Text style={styles.title}>Visit camera</Text>
      <Text style={styles.sub}>
        Capture photos on site. Upload them from the web app under Visits, or extend this screen to call your API with a
        Supabase session.
      </Text>
      <Text style={styles.deviceLine} selectable>
        {deviceSnap.manufacturer || deviceSnap.brand || '—'}:{' '}
        {deviceSnap.modelName || deviceSnap.modelId || deviceSnap.platform || '—'}
      </Text>

      <IncomingShareBannerGate onUseSharedImage={(uri) => setPhotoUri(uri)} />

      {Platform.OS !== 'web' && <PropertyMap />}

      {!photoUri ? (
        <View style={styles.camWrap}>
          <CameraView ref={camRef} style={styles.camera} facing="back" />
          <TouchableOpacity style={styles.capture} onPress={takePicture}>
            <View style={styles.captureInner} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.preview}>
          <Image source={{ uri: photoUri }} style={styles.previewImg} contentFit="cover" />
          <View style={styles.rowWrap}>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => setPhotoUri(null)}>
              <Text style={styles.btnSecondaryText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSave, savingToLibrary && styles.btnDisabled]}
              onPress={saveToPhotoLibrary}
              disabled={savingToLibrary}
            >
              {savingToLibrary ? (
                <ActivityIndicator color="#0f172a" size="small" />
              ) : (
                <Text style={styles.btnSaveText}>Save to Photos</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={sharePhoto}>
              <Text style={styles.btnText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.inviteBtn} onPress={inviteFromContacts}>
        <Text style={styles.inviteBtnText}>Invite friends (contacts)</Text>
      </TouchableOpacity>
      {Platform.OS !== 'web' && (
        <TouchableOpacity style={styles.inviteSmsBtn} onPress={inviteViaSms}>
          <Text style={styles.inviteBtnText}>Text invite link (SMS)</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.inviteHint}>
        Email invite uses the share sheet. SMS uses expo-sms (Messages) and can prefill numbers from contacts. Set
        EXPO_PUBLIC_APP_URL for your web app.
      </Text>
      <Text style={styles.mediaHint}>
        expo-media-library: after you capture a shot, use Save to Photos to store it in your gallery (upload to Property
        Pulse from the web app when signed in).
      </Text>

      {Platform.OS !== 'web' && (
        <View style={styles.pushSection}>
          <Text style={styles.pushTitle}>Push notifications</Text>
          <Text style={styles.pushMono} selectable>
            {expoPushToken || 'Token pending — use a physical device and configure EAS projectId in app.json extra.eas.'}
          </Text>
          {Platform.OS === 'android' && androidChannels.length > 0 && (
            <Text style={styles.pushHint}>
              Channels: {androidChannels.map((c) => c.id).join(', ')}
            </Text>
          )}
          {lastNotification && (
            <View style={styles.pushPreview}>
              <Text style={styles.pushHint}>
                Last: {lastNotification.request?.content?.title || '(no title)'}
              </Text>
              <Text style={styles.pushHint}>{lastNotification.request?.content?.body}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.pushTestBtn}
            onPress={async () => {
              try {
                await schedulePushNotification();
              } catch (e) {
                Alert.alert('Notification', e?.message || String(e));
              }
            }}
          >
            <Text style={styles.pushTestBtnText}>Schedule test notification (2s)</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.statsSection}>
        <Text style={styles.pushTitle}>Device insights & backend stats (optional)</Text>
        <Text style={styles.pushHint}>
          Uses expo-device + expo-constants. On native, buckets are saved in app documents; on web, in localStorage. With
          opt-in, we also POST an anonymous snapshot to your API at most once per 24h when{' '}
          <Text style={styles.pushHintCode}>EXPO_PUBLIC_API_BASE_URL</Text> is set (see{' '}
          <Text style={styles.pushHintCode}>/api/analytics/mobile-device-snapshot</Text>). No ads ID or account — coarse
          device class only.
        </Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Allow local + server snapshots</Text>
          <Switch
            value={localStatsConsent}
            onValueChange={async (v) => {
              await setLocalStatsConsent(v);
              setLocalStatsConsentState(v);
              if (v) await recordLocalSessionIfConsented();
              await refreshLocalStatsPreview();
            }}
            trackColor={{ false: '#475569', true: '#059669' }}
            thumbColor="#f8fafc"
          />
        </View>
        <TouchableOpacity
          style={styles.statsClearBtn}
          onPress={() => {
            Alert.alert(
              'Clear local stats',
              'Remove all stored buckets, last-send time, and turn off collection? (Server rows are not deleted.)',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: async () => {
                    await clearLocalStats();
                    setLocalStatsConsentState(false);
                    await refreshLocalStatsPreview();
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.statsClearBtnText}>Clear local stored data</Text>
        </TouchableOpacity>
        {__DEV__ ? (
          <TouchableOpacity
            style={styles.statsDebugBtn}
            onPress={async () => {
              const r = await forceSubmitDeviceSnapshotForDebug();
              Alert.alert(
                'API snapshot',
                r.ok ? `OK (${r.status ?? '—'})` : `Failed: ${r.reason ?? r.status ?? 'error'}`
              );
              await refreshLocalStatsPreview();
            }}
          >
            <Text style={styles.statsDebugBtnText}>Dev: send snapshot to API now</Text>
          </TouchableOpacity>
        ) : null}
        {localStatsPreview ? (
          <Text style={styles.pushMono} selectable>
            {localStatsPreview}
          </Text>
        ) : null}
      </View>
      <StatusBar style="light" />
    </ScrollView>
  );
}

async function schedulePushNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "You've got mail! 📬",
      body: 'Here is the notification body',
      data: { data: 'goes here', test: { test1: 'more data' } },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });
}

async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Property Pulse',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (!Device.isDevice) {
    return '';
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    Alert.alert('Notifications', 'Permission denied — push token unavailable.');
    return '';
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn(
        '[expo-notifications] No EAS projectId — add extra.eas.projectId in app.json or run eas init.'
      );
      return '';
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('[expo push token]', token);
    return token;
  } catch (e) {
    console.warn('[expo-notifications]', e);
    return e?.message ? String(e.message) : String(e);
  }
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#1a2234',
  },
  root: {
    flexGrow: 1,
    backgroundColor: '#1a2234',
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  inviteBtn: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#10b981',
    alignItems: 'center',
  },
  inviteSmsBtn: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#38bdf8',
    alignItems: 'center',
  },
  inviteBtnText: {
    color: '#10b981',
    fontWeight: '700',
    fontSize: 15,
  },
  inviteHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  container: {
    flex: 1,
    backgroundColor: '#fafaf8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  sub: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  deviceLine: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hint: {
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  camWrap: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  camera: {
    flex: 1,
    minHeight: 360,
  },
  capture: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#10b981',
  },
  preview: {
    flex: 1,
  },
  previewImg: {
    flex: 1,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSave: {
    backgroundColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  btnSaveText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  mediaHint: {
    color: '#475569',
    fontSize: 11,
    marginTop: 10,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  btn: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  btnSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#64748b',
  },
  btnSecondaryText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  pushSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  pushTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  pushMono: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pushHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 8,
  },
  pushPreview: {
    marginTop: 8,
  },
  pushTestBtn: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#334155',
    alignItems: 'center',
  },
  pushTestBtnText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
  statsSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  statsClearBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#64748b',
  },
  statsClearBtnText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  statsDebugBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#422006',
    borderWidth: 1,
    borderColor: '#a16207',
  },
  statsDebugBtnText: {
    color: '#fcd34d',
    fontSize: 12,
    fontWeight: '600',
  },
  pushHintCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#cbd5e1',
  },
});
