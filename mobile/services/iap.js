import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const IOS_API_KEY = process.env.EXPO_PUBLIC_RC_APPLE_API_KEY || '';
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_RC_GOOGLE_API_KEY || '';
/** RevenueCat Test Store key (test_...) — dev/debug only; never ship to App Store. */
const TEST_API_KEY = process.env.EXPO_PUBLIC_RC_TEST_API_KEY || '';
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_IAP_ENTITLEMENT_ID || 'Property Pocket Pro';
let configured = false;

function currentApiKey() {
  // Prefer platform keys; fall back to Test Store key in dev when store keys are unset.
  if (Platform.OS === 'ios' && IOS_API_KEY) return IOS_API_KEY;
  if (Platform.OS === 'android' && ANDROID_API_KEY) return ANDROID_API_KEY;
  if (__DEV__ && TEST_API_KEY) return TEST_API_KEY;
  return '';
}

export function isIapAvailableOnThisBuild() {
  return !!currentApiKey();
}

export async function configureIap() {
  if (configured) return true;
  const apiKey = currentApiKey();
  if (!apiKey) {
    console.warn('[RevenueCat] Missing SDK key for platform:', Platform.OS);
    return false;
  }
  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    await Purchases.configure({ apiKey });
    configured = true;
    return true;
  } catch (e) {
    console.warn('[RevenueCat] configure failed', e);
    return false;
  }
}

export async function getOfferings() {
  if (!isIapAvailableOnThisBuild()) return null;
  return Purchases.getOfferings();
}

export async function getCustomerInfo() {
  if (!isIapAvailableOnThisBuild()) return null;
  return Purchases.getCustomerInfo();
}

export async function restorePurchases() {
  if (!isIapAvailableOnThisBuild()) return null;
  return Purchases.restorePurchases();
}

export async function purchase(pkg) {
  if (!isIapAvailableOnThisBuild()) return null;
  return Purchases.purchasePackage(pkg);
}

export function hasActiveEntitlement(customerInfo) {
  return Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);
}

export function getEntitlementId() {
  return ENTITLEMENT_ID;
}

/** Link RevenueCat customer to Supabase user id so webhooks update profiles.plan. */
export async function loginIapUser(appUserId) {
  if (!isIapAvailableOnThisBuild() || !appUserId) return null;
  await configureIap();
  const { customerInfo } = await Purchases.logIn(String(appUserId));
  return customerInfo;
}

export async function logoutIapUser() {
  if (!isIapAvailableOnThisBuild()) return null;
  await configureIap();
  const { customerInfo } = await Purchases.logOut();
  return customerInfo;
}
