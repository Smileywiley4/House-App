import { Platform } from 'react-native';
import {
  documentDirectory,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import {
  getDeviceSnapshotPayload,
  submitMobileDeviceSnapshotIfDue,
  deviceSnapshotToApiBody,
} from './deviceSnapshot';

const STORE_FILE_URI =
  documentDirectory != null ? `${documentDirectory}propertypulse-local-stats.json` : null;
const WEB_STORAGE_KEY = 'propertypulse_local_stats_v1';

function normalizeStore(parsed) {
  return {
    consent: Boolean(parsed?.consent),
    buckets: parsed?.buckets && typeof parsed.buckets === 'object' ? parsed.buckets : {},
    lastSubmittedAt: parsed?.lastSubmittedAt ?? null,
  };
}

async function readStore() {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      return normalizeStore({});
    }
    try {
      const raw = localStorage.getItem(WEB_STORAGE_KEY);
      if (!raw) return normalizeStore({});
      return normalizeStore(JSON.parse(raw));
    } catch {
      return normalizeStore({});
    }
  }

  if (!STORE_FILE_URI) {
    return normalizeStore({});
  }
  try {
    const info = await getInfoAsync(STORE_FILE_URI);
    if (!info.exists) {
      return normalizeStore({});
    }
    const raw = await readAsStringAsync(STORE_FILE_URI);
    return normalizeStore(JSON.parse(raw));
  } catch {
    return normalizeStore({});
  }
}

async function writeStore(data) {
  const payload = {
    consent: Boolean(data.consent),
    buckets: data.buckets && typeof data.buckets === 'object' ? data.buckets : {},
    lastSubmittedAt: data.lastSubmittedAt ?? null,
  };

  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(payload));
    }
    return;
  }

  if (!STORE_FILE_URI) return;
  await writeAsStringAsync(STORE_FILE_URI, JSON.stringify(payload, null, 2), {
    encoding: EncodingType.UTF8,
  });
}

/** Coarse bucket key from a device snapshot (works when many fields are null). */
function buildBucketKeyFromSample(sample) {
  const os = sample.osName || sample.platform || 'unknown';
  const brand = sample.brand || sample.manufacturer || 'unknown';
  const model = sample.modelName || sample.modelId || 'unknown';
  const type = sample.deviceType != null ? String(sample.deviceType) : 'unknown';
  return `${os}|${brand}|${model}|${type}`.replace(/\s+/g, '_');
}

/**
 * One session tick + optional throttled backend snapshot (same payload shape all platforms).
 */
async function maybeSubmitAfterLocalUpdate(store) {
  const submit = await submitMobileDeviceSnapshotIfDue(store);
  if (submit.ok && submit.recorded) {
    store.lastSubmittedAt = new Date().toISOString();
    await writeStore(store);
  }
}

export async function getLocalStatsConsent() {
  const s = await readStore();
  return s.consent;
}

export async function setLocalStatsConsent(consent) {
  const s = await readStore();
  s.consent = Boolean(consent);
  await writeStore(s);
}

export async function recordLocalSessionIfConsented() {
  const s = await readStore();
  if (!s.consent) return;

  const sample = getDeviceSnapshotPayload();
  const key = buildBucketKeyFromSample(sample);
  const now = new Date().toISOString();
  const prev = s.buckets[key] || { sessions: 0, lastSeen: null, sample: null };
  s.buckets[key] = {
    sessions: (prev.sessions || 0) + 1,
    lastSeen: now,
    sample: prev.sample || sample,
  };
  await writeStore(s);

  await maybeSubmitAfterLocalUpdate(s);
}

export async function getLocalAggregates() {
  const s = await readStore();
  const rows = Object.entries(s.buckets).map(([key, v]) => ({
    key,
    sessions: v.sessions,
    lastSeen: v.lastSeen,
    sample: v.sample,
  }));
  rows.sort((a, b) => (b.sessions || 0) - (a.sessions || 0));
  return {
    consent: s.consent,
    buckets: rows,
    storePath: Platform.OS === 'web' ? `localStorage:${WEB_STORAGE_KEY}` : STORE_FILE_URI,
    lastSubmittedAt: s.lastSubmittedAt,
  };
}

export async function clearLocalStats() {
  await writeStore({ consent: false, buckets: {}, lastSubmittedAt: null });
}

/** Manual “send now” for debugging — ignores throttle. */
export async function forceSubmitDeviceSnapshotForDebug() {
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  if (!base) return { ok: false, reason: 'no_api_url' };
  const res = await fetch(`${base}/api/analytics/mobile-device-snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(deviceSnapshotToApiBody(getDeviceSnapshotPayload())),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, reason: text.slice(0, 240) || 'http_error' };
  }
  return { ok: true, status: res.status };
}
