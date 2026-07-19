const CURRENT_PROPERTY_KEY = 'propertypulse_current_property';

export function saveCurrentProperty(property) {
  if (typeof sessionStorage === 'undefined' || !property) return;
  try {
    sessionStorage.setItem(CURRENT_PROPERTY_KEY, JSON.stringify(property));
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
}

export function readCurrentProperty(address) {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const property = JSON.parse(sessionStorage.getItem(CURRENT_PROPERTY_KEY) || 'null');
    if (!property) return null;
    const expected = String(address || '').trim().toLowerCase();
    const candidates = [property.address, property.formatted_address]
      .filter(Boolean)
      .map((value) => String(value).trim().toLowerCase());
    return !expected || candidates.some((value) => value === expected || value.includes(expected) || expected.includes(value))
      ? property
      : null;
  } catch {
    return null;
  }
}
