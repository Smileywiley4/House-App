"""Best-effort extraction of listing image URLs from a public property listing page."""
from __future__ import annotations

import re
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (compatible; PropertyPulse/1.0; +https://propertypulse.app) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
MAX_HTML_BYTES = 2_000_000
MAX_IMAGES = 12
BLOCKED_HOSTS = frozenset({"localhost", "127.0.0.1", "0.0.0.0", "::1"})


def _is_image_url(url: str) -> bool:
    u = url.lower().split("?")[0]
    return any(u.endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"))


def _normalize_url(base: str, href: str) -> str | None:
    if not href or href.startswith("data:") or href.startswith("javascript:"):
        return None
    try:
        joined = urljoin(base, href.strip())
        parsed = urlparse(joined)
        if parsed.scheme not in ("http", "https"):
            return None
        if parsed.hostname and parsed.hostname.lower() in BLOCKED_HOSTS:
            return None
        return joined
    except Exception:
        return None


def extract_listing_image_urls(page_url: str, html: str) -> list[str]:
    """Parse HTML and collect likely property-photo URLs (deduped, capped)."""
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    out: list[str] = []

    def add(u: str | None) -> None:
        if not u or u in seen:
            return
        if not _is_image_url(u):
            return
        seen.add(u)
        out.append(u)
        if len(out) >= MAX_IMAGES:
            return

    # Open Graph / Twitter
    for meta in soup.find_all("meta"):
        prop = (meta.get("property") or meta.get("name") or "").lower()
        if prop in ("og:image", "og:image:url", "twitter:image", "twitter:image:src"):
            content = meta.get("content")
            if content:
                add(_normalize_url(page_url, content))

    # link rel=image_src
    for link in soup.find_all("link", rel=re.compile(r"image_src", re.I)):
        href = link.get("href")
        add(_normalize_url(page_url, href))

    # img tags (larger pages often use lazy loading)
    for img in soup.find_all("img"):
        for attr in ("data-src", "data-lazy-src", "data-original", "src"):
            val = img.get(attr)
            if val:
                add(_normalize_url(page_url, val))
        if len(out) >= MAX_IMAGES:
            break

    # JSON-LD image
    for script in soup.find_all("script", type=re.compile(r"ld\+json", re.I)):
        if len(out) >= MAX_IMAGES:
            break
        try:
            import json

            data = json.loads(script.string or "{}")
            if isinstance(data, dict):
                img = data.get("image")
                if isinstance(img, str):
                    add(_normalize_url(page_url, img))
                elif isinstance(img, list):
                    for item in img:
                        if isinstance(item, str):
                            add(_normalize_url(page_url, item))
                        elif isinstance(item, dict) and item.get("url"):
                            add(_normalize_url(page_url, item["url"]))
        except Exception:
            continue

    return out[:MAX_IMAGES]


async def fetch_listing_html(page_url: str) -> str:
    parsed = urlparse(page_url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http(s) URLs are allowed")
    if parsed.hostname and parsed.hostname.lower() in BLOCKED_HOSTS:
        raise ValueError("URL host is not allowed")

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(20.0),
        follow_redirects=True,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    ) as client:
        r = await client.get(page_url)
        r.raise_for_status()
        body = r.content[:MAX_HTML_BYTES]
        return body.decode(r.encoding or "utf-8", errors="replace")
