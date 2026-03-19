/**
 * Central route/screen configuration for PropertyPulse.
 * Use these keys for both React (web) and React Native so you can share navigation logic.
 * Web: paths are used with React Router. RN: use the same keys with React Navigation.
 */
export const ROUTE_KEYS = {
  HOME: 'Home',
  QUICK_COMPARE: 'QuickCompare',
  SEARCH_BY_PRESET: 'SearchByPreset',
  COMPARE: 'Compare',
  SIDE_BY_SIDE: 'SideBySide',
  REALTOR_PORTAL: 'RealtorPortal',
  PRICING: 'Pricing',
  PROFILE: 'Profile',
  SHARED_COMPARISON: 'SharedComparison',
  EVALUATE: 'Evaluate',
};

/** Default route when app opens (web "/" or RN initial route) */
export const DEFAULT_ROUTE = ROUTE_KEYS.HOME;

/**
 * @param {string} routeKey - e.g. "Home", "Compare"
 * @returns {string} path for web (e.g. "/Compare")
 */
export function getPathForRoute(routeKey) {
  if (!routeKey) return '/';
  const name = typeof routeKey === 'string' ? routeKey : ROUTE_KEYS[routeKey];
  return '/' + (name || '').replace(/ /g, '-');
}

/**
 * @param {string} pathname - e.g. "/Compare" or "/SideBySide"
 * @returns {string | null} route key or null
 */
export function getRouteFromPath(pathname) {
  const segment = (pathname || '').replace(/^\//, '').split('/')[0];
  if (!segment) return DEFAULT_ROUTE;
  const normalized = segment.replace(/-/g, '');
  const match = Object.values(ROUTE_KEYS).find(
    (key) => key.replace(/\s/g, '') === normalized || key.toLowerCase() === segment.toLowerCase()
  );
  return match ?? null;
}
