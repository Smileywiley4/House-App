"""Google Custom Search for real property data from Zillow, Redfin, Realtor.com, etc."""
import logging
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
