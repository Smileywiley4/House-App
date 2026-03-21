import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

/**
 * Cross-platform device + app metadata for analytics (expo-device + expo-constants).
 * Safe on web, simulators, and missing fields — uses null / fallbacks, no advertising ID.
 */
export function getDeviceSnapshotPayload() {
  return {
    platform: Platform.OS,
    osName: Device.osName ?? null,
    osVersion: Device.osVersion ?? null,
    manufacturer: Device.manufacturer ?? null,
    brand: Device.brand ?? null,
    modelName: Device.modelName ?? null,
    modelId: Device.modelId ?? null,
    deviceType: Device.deviceType ?? null,
    isDevice: typeof Device.isDevice === 'boolean' ? Device.isDevice : null,
    designName: Device.designName ?? null,
    productName: Device.productName ?? null,
    totalMemoryBytes: Device.totalMemory ?? null,
    deviceYearClass: Device.deviceYearClass ?? null,
    appVersion: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? null,
    appBuild: Constants.nativeBuildVersion ?? null,
    expoRuntime: Constants.executionEnvironment ?? null,
    clientTimestamp: new Date().toISOString(),
  };
}

function truncStr(v, maxLen) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function intOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

/**
 * API body keys expected by FastAPI (snake_case).
 * Coerces types so JSON never sends numbers where Pydantic expects strings (e.g. iOS modelId).
 */
export function deviceSnapshotToApiBody(payload) {
  return {
    platform: truncStr(payload.platform, 32),
    os_name: truncStr(payload.osName, 64),
    os_version: truncStr(payload.osVersion, 64),
    manufacturer: truncStr(payload.manufacturer, 128),
    brand: truncStr(payload.brand, 128),
    model_name: truncStr(payload.modelName, 128),
    model_id: truncStr(payload.modelId, 128),
    device_type: intOrNull(payload.deviceType),
    is_physical_device: typeof payload.isDevice === 'boolean' ? payload.isDevice : null,
    design_name: truncStr(payload.designName, 128),
    product_name: truncStr(payload.productName, 128),
    total_memory_bytes: intOrNull(payload.totalMemoryBytes),
    device_year_class: intOrNull(payload.deviceYearClass),
    app_version: truncStr(payload.appVersion, 64),
    app_build: truncStr(payload.appBuild, 64),
    expo_runtime: truncStr(payload.expoRuntime, 64),
    client_timestamp: payload.clientTimestamp,
  };
}

const DEFAULT_SUBMIT_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * POST one snapshot if EXPO_PUBLIC_API_BASE_URL is set and last submit is older than interval.
 * @param {{ lastSubmittedAt?: string | null }} throttleState
 * @param {number} [intervalMs]
 * @returns {Promise<{ ok: boolean; recorded?: boolean; reason?: string; status?: number }>}
 */
export async function submitMobileDeviceSnapshotIfDue(throttleState, intervalMs = DEFAULT_SUBMIT_INTERVAL_MS) {
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
  if (!base) {
    return { ok: false, reason: 'no_api_url' };
  }
  const now = Date.now();
  const last = throttleState?.lastSubmittedAt ? Date.parse(throttleState.lastSubmittedAt) : 0;
  if (Number.isFinite(last) && now - last < intervalMs) {
    return { ok: true, reason: 'throttled' };
  }

  const body = deviceSnapshotToApiBody(getDeviceSnapshotPayload());

  try {
    const res = await fetch(`${base}/api/analytics/mobile-device-snapshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, reason: 'http_error', status: res.status };
    }
    return { ok: true, recorded: true };
  } catch (e) {
    return { ok: false, reason: 'network', message: e?.message };
  }
}
