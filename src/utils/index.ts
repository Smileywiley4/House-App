import { getPathForRoute } from '@/core/routes';

/** Build path for a page (uses shared route config for web/RN portability). */
export function createPageUrl(pageName: string) {
    return getPathForRoute(pageName);
}