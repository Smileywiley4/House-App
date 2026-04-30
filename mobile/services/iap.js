import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const IOS_API_KEY = process.env.EXPO_PUBLIC_RC_APPLE_API_KEY || '';
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_RC_GOOGLE_API_KEY || '';
const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_IAP_ENTITLEMENT_ID || 'property_pocket_pro';
let configured = false;

function currentApiKey() {
  if (Platform.OS === 'ios') return IOS_API_KEY;
  if (Platform.OS === 'android') return ANDROID_API_KEY;
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
