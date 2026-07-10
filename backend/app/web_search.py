"""Google Custom Search for real property data from Zillow, Redfin, Realtor.com, etc."""
import logging
import re
import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"


async def search_property_listings(address: str) -> list[dict]:
    """
    Search Google for real property listing data from public sites.
    Returns a list of search result dicts with title, link, snippet.
    """
    s = get_settings()
    api_key = s.google_places_api_key
    cse_id = s.google_cse_id
    if not api_key or not cse_id:
        return []

    results = []
    queries = [
        f'"{address}" property details bedrooms bathrooms price sqft',
        f'"{address}" zillow OR redfin OR realtor.com listing',
    ]

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            for query in queries:
                resp = await client.get(GOOGLE_CSE_URL, params={
                    "key": api_key,
                    "cx": cse_id,
                    "q": query,
                    "num": 5,
                })
                data = resp.json()
                for item in data.get("items", []):
                    results.append({
                        "title": item.get("title", ""),
                        "link": item.get("link", ""),
                        "snippet": item.get("snippet", ""),
                        "source": _detect_source(item.get("link", "")),
                    })
                if results:
                    break
    except Exception as e:
        logger.error("Google Custom Search failed: %s", e)

    return results


def _detect_source(url: str) -> str:
    url = url.lower()
    if "zillow.com" in url:
        return "Zillow"
    if "redfin.com" in url:
        return "Redfin"
    if "realtor.com" in url:
        return "Realtor.com"
    if "trulia.com" in url:
        return "Trulia"
    if "homes.com" in url:
        return "Homes.com"
    return "Web"


def format_search_context(results: list[dict]) -> str:
    """Format search results into a context string for the LLM."""
    if not results:
        return ""
    lines = []
    for r in results[:8]:
        source = r.get("source", "Web")
        lines.append(f"[{source}] {r['title']}")
        if r.get("snippet"):
            lines.append(f"  {r['snippet']}")
        if r.get("link"):
            lines.append(f"  URL: {r['link']}")
        lines.append("")
    return "\n".join(lines)


def extract_listing_hints(results: list[dict]) -> dict:
    """
    Parse price, beds, baths, and sqft from listing-site search snippets.
    Used for free-tier search so users get real listing numbers without LLM.
    """
    if not results:
        return {}

    text = "\n".join(
        f"{r.get('title', '')} {r.get('snippet', '')}".strip()
        for r in results[:8]
        if r.get("title") or r.get("snippet")
    )
    if not text.strip():
        return {}

    hints: dict = {}

    prices: list[int] = []
    for match in re.finditer(r"\$\s*([\d,]+(?:\.\d{2})?)", text):
        try:
            value = int(float(match.group(1).replace(",", "")))
        except (ValueError, TypeError):
            continue
        if 10_000 <= value <= 50_000_000:
            prices.append(value)
    if prices:
        hints["price"] = prices[0]

    bed_match = re.search(r"(\d+)\s*(?:bd|bed|bedroom)s?\b", text, re.I)
    if bed_match:
        hints["bedrooms"] = int(bed_match.group(1))

    bath_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:ba|bath|bathroom)s?\b", text, re.I)
    if bath_match:
        hints["bathrooms"] = float(bath_match.group(1))

    sqft_match = re.search(r"([\d,]+)\s*(?:sq\.?\s*ft|sqft|SF)\b", text, re.I)
    if sqft_match:
        try:
            sqft = int(sqft_match.group(1).replace(",", ""))
            if 100 <= sqft <= 100_000:
                hints["sqft"] = sqft
        except (ValueError, TypeError):
            pass

    year_match = re.search(r"\bb(?:uilt|lt)\s*(?:in\s*)?(\d{4})\b", text, re.I)
    if year_match:
        year = int(year_match.group(1))
        if 1800 <= year <= 2100:
            hints["year_built"] = year

    for row in results:
        source = row.get("source")
        if source and source != "Web":
            hints["listing_source"] = source
            hints["on_market"] = True
            break

    if hints.get("price") and not hints.get("on_market"):
        hints["on_market"] = True

    return hints
