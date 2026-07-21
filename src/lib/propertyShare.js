/**
 * Public property share links (address / lat / lng only — no private share tokens).
 */
import { APP_NAME } from "@/core/constants";
import { browsePropertyUrl } from "@/lib/browseHandoff";

/** Strip private / realtor-only fields from a property-like object for sharing. */
export function publicPropertyIdentity(property = {}) {
  const address =
    property.formatted_address ||
    property.property_address ||
    [property.address, property.city, property.state, property.zip].filter(Boolean).join(", ") ||
    "";
  const lat = Number(property.lat ?? property.latitude);
  const lng = Number(property.lng ?? property.longitude);
  return {
    address: String(address).trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    city: property.city || "",
    state: property.state || "",
    zip: property.zip || "",
  };
}

/**
 * Relative path that deep-links guests to the home on Browse (map highlight).
 * Example: `/BrowseProperties?lat=40.76&lng=-111.89&zoom=16&highlightAddress=123+Main+St`
 */
export function buildPublicPropertySharePath(property) {
  const id = publicPropertyIdentity(property);
  return browsePropertyUrl({
    lat: id.lat,
    lng: id.lng,
    formatted_address: id.address,
    address: id.address,
    city: id.city,
    state: id.state,
    zip: id.zip,
  });
}

/** Absolute URL for sharing outside the app. */
export function buildPublicPropertyShareUrl(property, { origin } = {}) {
  const path = buildPublicPropertySharePath(property);
  const base =
    origin ||
    (typeof window !== "undefined" && window.location?.origin ? window.location.origin : "");
  if (!base) return path;
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function propertyShareTitle(property) {
  const { address } = publicPropertyIdentity(property);
  return address ? `Check out ${address}` : `Check out this home on ${APP_NAME}`;
}

export function propertyShareText(property) {
  const { address } = publicPropertyIdentity(property);
  if (address) {
    return `I found this home on ${APP_NAME}: ${address}`;
  }
  return `I found a home on ${APP_NAME}`;
}

/** Web Share API payload (title, text, url). */
export function propertySharePayload(property, { origin } = {}) {
  const url = buildPublicPropertyShareUrl(property, { origin });
  return {
    title: propertyShareTitle(property),
    text: propertyShareText(property),
    url,
  };
}

export function canUseWebShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * SMS deep link — iOS prefers `sms:&body=`, Android prefers `sms:?body=`.
 * Including both query styles via `?&body=` covers most modern browsers.
 */
export function smsShareHref(body) {
  const encoded = encodeURIComponent(body);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const touchMac =
    typeof document !== "undefined" && "ontouchend" in document && /\bMac OS X\b/i.test(ua);
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || touchMac;
  return isIOS ? `sms:&body=${encoded}` : `sms:?body=${encoded}`;
}

export function mailtoShareHref({ subject, body }) {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:?${params.toString()}`;
}

export function whatsappShareHref(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function facebookShareHref(url) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function twitterShareHref({ url, text }) {
  const params = new URLSearchParams();
  if (text) params.set("text", text);
  if (url) params.set("url", url);
  return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/** Body for email / SMS that includes the share URL. */
export function propertyShareMessage(property, { origin } = {}) {
  const { text, url } = propertySharePayload(property, { origin });
  return `${text}\n${url}`;
}
