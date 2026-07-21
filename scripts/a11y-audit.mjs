/**
 * Accessibility audit for main Property Pocket flows.
 * Usage: node scripts/a11y-audit.mjs
 */
import { createServer } from "http";
import { readFileSync, existsSync, statSync, writeFileSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";
import axeSource from "axe-core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");

const ROUTES = ["/", "/BrowseProperties", "/Evaluate", "/Compare", "/RealtorPortal"];

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function startStaticServer() {
  if (!existsSync(join(dist, "index.html"))) {
    throw new Error("dist/index.html missing — run npm run build first");
  }
  const server = createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    let filePath = join(dist, urlPath === "/" ? "index.html" : urlPath);
    if (!filePath.startsWith(dist)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!existsSync(filePath) || (existsSync(filePath) && statSync(filePath).isDirectory())) {
      filePath = join(dist, "index.html");
    }
    try {
      const data = readFileSync(filePath);
      res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

async function auditRoute(page, base, route) {
  await page.goto(`${base}${route}`, { waitUntil: "networkidle0", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(axeSource.source);
  return page.evaluate(async () =>
    // eslint-disable-next-line no-undef
    axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
    })
  );
}

async function main() {
  const { server, base } = await startStaticServer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const totals = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const byRule = {};
  const byRoute = {};

  try {
    for (const route of ROUTES) {
      let results;
      try {
        results = await auditRoute(page, base, route);
      } catch (err) {
        console.error(`FAILED ${route}:`, err.message);
        byRoute[route] = { error: err.message };
        continue;
      }
      const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      for (const v of results.violations) {
        const sev = v.impact || "moderate";
        const n = v.nodes.length;
        counts[sev] = (counts[sev] || 0) + n;
        totals[sev] = (totals[sev] || 0) + n;
        byRule[v.id] = byRule[v.id] || { id: v.id, impact: v.impact, help: v.help, nodes: 0, routes: [] };
        byRule[v.id].nodes += n;
        if (!byRule[v.id].routes.includes(route)) byRule[v.id].routes.push(route);
      }
      byRoute[route] = {
        violations: results.violations.length,
        nodes: counts,
        rules: results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          nodes: v.nodes.length,
        })),
      };
      console.log(`\n=== ${route} ===`, counts);
      for (const r of byRoute[route].rules) {
        console.log(`  [${r.impact}] ${r.id}: ${r.help} (${r.nodes})`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log("\n========== TOTALS ==========");
  console.log(JSON.stringify(totals, null, 2));
  writeFileSync(
    join(root, "scripts/a11y-baseline.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), totals, byRoute, byRule }, null, 2)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
