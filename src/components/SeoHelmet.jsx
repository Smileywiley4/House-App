import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { SITE_NAME, DEFAULT_SITE_DESCRIPTION, SEO_BY_PAGE } from '@/core/seoConfig';

const SITE_URL = (import.meta.env.VITE_SITE_URL || '').replace(/\/$/, '');
const OG_IMAGE = (import.meta.env.VITE_OG_IMAGE_URL || '').trim();

/**
 * @param {object} props
 * @param {string} [props.title] - Short page title (app name appended automatically)
 * @param {string} [props.description]
 * @param {boolean} [props.noindex]
 */
export function SeoHelmet({ title, description = DEFAULT_SITE_DESCRIPTION, noindex = false }) {
  const { pathname } = useLocation();
  const path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const canonical = SITE_URL ? `${SITE_URL}${path === '/' ? '' : path}` : null;
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Compare & score homes`;

  const jsonLd =
    SITE_URL &&
    !noindex &&
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description: DEFAULT_SITE_DESCRIPTION,
    });

  return (
    <Helmet prioritizeSeoTags>
      <html lang="en" />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-image-preview:large" />
      )}
      {canonical ? <link rel="canonical" href={canonical} /> : null}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      {canonical ? <meta property="og:url" content={canonical} /> : null}
      {OG_IMAGE ? <meta property="og:image" content={OG_IMAGE} /> : null}

      <meta name="twitter:card" content={OG_IMAGE ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {OG_IMAGE ? <meta name="twitter:image" content={OG_IMAGE} /> : null}

      {jsonLd ? (
        <script type="application/ld+json">{jsonLd}</script>
      ) : null}
    </Helmet>
  );
}

/**
 * Uses SEO_BY_PAGE[currentPageName] when defined; safe fallback for unknown routes.
 * @param {{ currentPageName?: string }} props
 */
export function LayoutSeo({ currentPageName }) {
  const cfg = (currentPageName && SEO_BY_PAGE[currentPageName]) || {
    title: undefined,
    description: DEFAULT_SITE_DESCRIPTION,
    noindex: false,
  };
  return <SeoHelmet title={cfg.title} description={cfg.description} noindex={cfg.noindex} />;
}
