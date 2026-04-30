/**
 * After Vite build: write dist/sitemap.xml and dist/robots.txt when VITE_SITE_URL is set.
 * Run: npm run build (postbuild hook). Set VITE_SITE_URL in .env.production or CI env.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = join(__dirname, '..', 'dist');

const base = (process.env.VITE_SITE_URL || '').replace(/\/$/, '');

/** Indexable public paths (SPA routes). Adjust if you add marketing pages. */
const paths = [
  { path: '/', priority: '1.0' },
  { path: '/Home', priority: '0.9' },
  { path: '/Pricing', priority: '0.9' },
  { path: '/QuickCompare', priority: '0.8' },
  { path: '/SearchByPreset', priority: '0.8' },
  { path: '/Evaluate', priority: '0.7' },
];

function main() {
  if (!existsSync(dist)) {
    console.warn('[seo-postbuild] dist/ not found — skip.');
    return;
  }

  let robots = `# Property Pulse\nUser-agent: *\nAllow: /\n`;

  if (base) {
    const body = paths
      .map(({ path: p, priority }) => {
        const loc = p === '/' ? base : `${base}${p}`;
        return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
    writeFileSync(join(dist, 'sitemap.xml'), xml);
    robots += `\nSitemap: ${base}/sitemap.xml\n`;
  } else {
    robots += `\n# Tip: set VITE_SITE_URL for production builds to generate sitemap.xml + Sitemap line.\n`;
  }

  writeFileSync(join(dist, 'robots.txt'), robots);
  console.log('[seo-postbuild] wrote dist/robots.txt' + (base ? ' and dist/sitemap.xml' : ''));
}

main();
