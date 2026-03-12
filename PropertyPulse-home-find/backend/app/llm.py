"""LLM helpers: property search and generic invoke. Uses OpenAI; can be swapped for Anthropic."""
import json
from openai import OpenAI
from app.config import get_settings


def _openai_client() -> OpenAI | None:
    key = get_settings().openai_api_key
    if not key:
        return None
    return OpenAI(api_key=key)


PROPERTY_SYSTEM = """You are a real estate data assistant. Return accurate, consistent property data as JSON.
Use the same structure every time for the same address. Align with public records and major listing sites when possible.
Determine if the property is currently listed for sale; set on_market true only if actively for sale, else false.
Set listing_source (e.g. MLS, Zillow) when on_market is true, else null."""


async def get_property_by_address_llm(address: str) -> dict | None:
    client = _openai_client()
    if not client:
        return None
    prompt = f'For the address "{address}", return JSON with: address, city, state, zip, price (number USD), bedrooms, bathrooms, sqft, year_built, description (2-3 sentences), lat, lng, walk_score (0-100), school_rating, nearby_hospitals, nearby_highways, nearby_schools, on_market (boolean), listing_source (string or null).'
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": PROPERTY_SYSTEM},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        text = resp.choices[0].message.content
        return json.loads(text) if text else None
    except Exception:
        return None


def _safe_num(v, default=None):
    if v is None:
        return default
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return default


async def search_properties_by_criteria_llm(filters: dict) -> list:
    """Use LLM to suggest properties for sale matching filters (city, state, budget, beds, baths, etc)."""
    client = _openai_client()
    if not client:
        return []
    city = filters.get("city") or filters.get("state") or "a metropolitan area"
    budget = ""
    lo = _safe_num(filters.get("budget_min"))
    hi = _safe_num(filters.get("budget_max"))
    if lo or hi:
        if lo and hi:
            budget = f" priced between ${lo:,.0f} and ${hi:,.0f}"
        elif hi:
            budget = f" under ${hi:,.0f}"
        elif lo:
            budget = f" over ${lo:,.0f}"
    beds = f" {_safe_num(filters.get('beds_min'), 0)}+ bedrooms" if filters.get("beds_min") else ""
    baths = f" {_safe_num(filters.get('baths_min'), 0)}+ bathrooms" if filters.get("baths_min") else ""
    sqft = ""
    sq_lo, sq_hi = _safe_num(filters.get("sqft_min")), _safe_num(filters.get("sqft_max"))
    if sq_lo or sq_hi:
        if sq_lo and sq_hi:
            sqft = f", {sq_lo:,}-{sq_hi:,} sqft"
        elif sq_hi:
            sqft = f", under {sq_hi:,} sqft"
        elif sq_lo:
            sqft = f", over {sq_lo:,} sqft"
    prompt = f"""Find 5-8 residential properties currently for sale in {city}{budget}{beds}{baths}{sqft}.
Return a JSON array of objects, each with: address, city, state, zip, price (number), bedrooms, bathrooms, sqft, year_built, description (1 sentence), on_market (true), listing_source (e.g. "MLS", "Zillow").
Use realistic addresses and data. If city/state is vague, pick a real metro area."""
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
        )
        text = resp.choices[0].message.content
        if not text:
            return []
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
        if isinstance(parsed, dict) and "properties" in parsed:
            return parsed["properties"]
        if isinstance(parsed, dict) and "results" in parsed:
            return parsed["results"]
        return []
    except Exception:
        return []


async def invoke_llm(prompt: str, response_json_schema: dict | None = None) -> dict | None:
    client = _openai_client()
    if not client:
        return None
    kwargs = {}
    if response_json_schema:
        kwargs["response_format"] = {"type": "json_object"}
    try:
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )
        text = resp.choices[0].message.content
        if not text:
            return None
        return json.loads(text) if response_json_schema else {"result": text}
    except Exception:
        return None
