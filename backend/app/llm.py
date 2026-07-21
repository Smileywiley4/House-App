"""LLM helpers: property search and generic invoke.

Provider strategy:
- **OpenAI** (default `gpt-4o-mini`) — primary for all AI features (cost control)
- **Anthropic** — optional fallback only if `ANTHROPIC_API_KEY` is set and OpenAI fails

Set `OPENAI_API_KEY` on Railway. Anthropic is not required."""
import json
import logging
from typing import Literal

from app.config import get_settings

logger = logging.getLogger(__name__)

LlmTier = Literal["quality", "economy"]

# Feature ids kept for API compatibility; all tiers use OpenAI first.
ECONOMY_FEATURES = frozenset({
    "ai_auto_score",
    "visit_notes_to_scores",
    "realtor_draft",
    "invoke",  # generic invoke without a named feature
})

# ---------------------------------------------------------------------------
# Provider clients
# ---------------------------------------------------------------------------

def _anthropic_client():
    try:
        from anthropic import Anthropic
        key = get_settings().anthropic_api_key
        if not key:
            return None
        return Anthropic(api_key=key)
    except ImportError:
        logger.warning("anthropic package not installed, falling back to OpenAI")
        return None


def _openai_client():
    try:
        from openai import OpenAI
        key = get_settings().openai_api_key
        if not key:
            return None
        return OpenAI(api_key=key)
    except ImportError:
        return None


def has_llm_provider() -> bool:
    s = get_settings()
    return bool(s.anthropic_api_key or s.openai_api_key)


def active_provider() -> str:
    """Primary configured provider (not necessarily last used for a call)."""
    s = get_settings()
    if s.openai_api_key:
        return "openai"
    if s.anthropic_api_key:
        return "anthropic"
    return "none"


def llm_status() -> dict:
    s = get_settings()
    return {
        "primary": active_provider(),
        "anthropic_configured": bool(s.anthropic_api_key),
        "openai_configured": bool(s.openai_api_key),
        "anthropic_model": s.anthropic_model if s.anthropic_api_key else None,
        "openai_model": s.openai_model if s.openai_api_key else None,
        "prompt_cache": bool(s.anthropic_prompt_cache_ephemeral) if s.anthropic_api_key else False,
    }


# ---------------------------------------------------------------------------
# System prompts — tighter constraints for accuracy
# ---------------------------------------------------------------------------

PROPERTY_SYSTEM_WITH_DATA = """You are a real estate data extraction assistant. You receive REAL search results from public listing sites (Zillow, Redfin, Realtor.com) and verified Google location data.

STRICT RULES:
1. ONLY extract values that appear explicitly in the provided search results or Google data.
2. For price, bedrooms, bathrooms, sqft, year_built: use the EXACT numbers from the search results. If a value does not appear in any source, set it to null — NEVER estimate or infer.
3. Keep ALL Google-verified values exactly as provided (address, city, state, zip, lat, lng, nearby_hospitals, nearby_schools).
4. on_market: true ONLY if search results clearly show an active "for sale" listing. Otherwise false.
5. listing_source: the actual site name from search results (Zillow, Redfin, Realtor.com). If unclear, null.
6. description: 2-3 factual sentences summarizing ONLY what the search results state. Do not add opinions or assumptions.
7. If multiple sources disagree on a value, prefer the most recent listing source.
8. Return ONLY valid JSON with no additional text, commentary, or markdown."""

PROPERTY_SYSTEM_FALLBACK = """You are a real estate data assistant. You help structure property data into JSON.

STRICT RULES:
1. When provided with verified Google data, use those EXACT values — do not modify them.
2. For any field you cannot determine with HIGH confidence from the provided data or widely-known public records, set it to null.
3. NEVER fabricate prices, square footage, bedroom/bathroom counts, or year built.
4. It is always better to return null than to guess.
5. Return ONLY valid JSON with no additional text, commentary, or markdown."""

CRITERIA_SYSTEM = """You are a real estate search assistant. You suggest realistic properties that may be available based on known market conditions.

STRICT RULES:
1. Use real, plausible addresses in the requested area — street names should exist in that city.
2. Prices must reflect actual market conditions for the area and property type.
3. All values (beds, baths, sqft, year_built) must be realistic for the price point and location.
4. Return a JSON object with a "properties" key containing an array of 5-8 property objects.
5. Each object must have: address, city, state, zip, price (number), bedrooms (number), bathrooms (number), sqft (number), year_built (number), description (1 factual sentence), on_market (true), listing_source ("Market Estimate").
6. Return ONLY valid JSON with no additional text."""


# ---------------------------------------------------------------------------
# Core LLM call
# ---------------------------------------------------------------------------

def _call_anthropic(system: str, prompt: str) -> str | None:
    client = _anthropic_client()
    if not client:
        return None
    try:
        s = get_settings()
        kwargs: dict = {
            "model": s.anthropic_model,
            "max_tokens": 4096,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
        }
        if s.anthropic_prompt_cache_ephemeral:
            kwargs["cache_control"] = {"type": "ephemeral"}
        resp = client.messages.create(**kwargs)
        text = resp.content[0].text if resp.content else None
        if text:
            logger.info("LLM response from Anthropic (%s)", s.anthropic_model)
            return text
    except Exception as e:
        logger.error("Anthropic API call failed: %s", e)
    return None


def _call_openai(system: str, prompt: str, expect_json: bool = True) -> str | None:
    oai = _openai_client()
    if not oai:
        return None
    try:
        s = get_settings()
        kwargs = {}
        if expect_json:
            kwargs["response_format"] = {"type": "json_object"}
        resp = oai.chat.completions.create(
            model=s.openai_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            **kwargs,
        )
        text = resp.choices[0].message.content
        if text:
            logger.info("LLM response from OpenAI (%s)", s.openai_model)
            return text
    except Exception as e:
        logger.error("OpenAI API call failed: %s", e)
    return None


def _call_llm(system: str, prompt: str, expect_json: bool = True, tier: LlmTier = "quality") -> str | None:
    """OpenAI first for all tiers; Anthropic only as optional fallback."""
    s = get_settings()
    has_openai = bool(s.openai_api_key)
    has_claude = bool(s.anthropic_api_key)
    _ = tier  # reserved for future per-feature model overrides

    if has_openai:
        text = _call_openai(system, prompt, expect_json)
        if text:
            return text

    if has_claude:
        return _call_anthropic(system, prompt)

    return None


def tier_for_feature(feature: str | None) -> LlmTier:
    if feature and feature in ECONOMY_FEATURES:
        return "economy"
    return "quality"


def _parse_json(text: str) -> dict | list | None:
    """Extract JSON from LLM response, handling markdown fences."""
    if not text:
        return None
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        start = 1
        end = len(lines)
        for i in range(1, len(lines)):
            if lines[i].strip() == "```":
                end = i
                break
        cleaned = "\n".join(lines[start:end]).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(cleaned[start:end])
            except json.JSONDecodeError:
                pass
        start = cleaned.find("[")
        end = cleaned.rfind("]") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(cleaned[start:end])
            except json.JSONDecodeError:
                pass
    logger.error("Failed to parse JSON from LLM response: %s", text[:200])
    return None


# ---------------------------------------------------------------------------
# Property search by address
# ---------------------------------------------------------------------------

async def get_property_by_address_llm(
    address: str,
    google_data: dict | None = None,
    web_search_context: str | None = None,
) -> dict | None:
    if not has_llm_provider():
        return None

    has_web_data = bool(web_search_context and web_search_context.strip())

    if has_web_data:
        system = PROPERTY_SYSTEM_WITH_DATA
        parts = [f'Extract property details for "{address}" from the following real search results and verified data.\n']
        if google_data:
            known = json.dumps({k: v for k, v in google_data.items() if v is not None}, indent=2)
            parts.append(f"VERIFIED GOOGLE DATA (use these values exactly, do not override):\n{known}\n")
        parts.append(f"REAL SEARCH RESULTS FROM PUBLIC LISTING SITES:\n{web_search_context}\n")
        parts.append(
            "Return a JSON object with these fields:\n"
            "- address (string), city (string), state (string), zip (string)\n"
            "- price (number in USD or null if not found in sources)\n"
            "- bedrooms (number or null), bathrooms (number or null)\n"
            "- sqft (number or null), year_built (number or null)\n"
            "- description (2-3 factual sentences from listing data only)\n"
            "- lat (number), lng (number)\n"
            "- walk_score (number 0-100 or null), school_rating (string or null)\n"
            "- nearby_hospitals (string or null), nearby_highways (string or null), nearby_schools (string or null)\n"
            "- on_market (boolean — true only if actively listed for sale)\n"
            "- listing_source (string site name or null)\n"
            "\nRemember: null is always better than a guess."
        )
        prompt = "\n".join(parts)
    elif google_data:
        system = PROPERTY_SYSTEM_FALLBACK
        known = json.dumps({k: v for k, v in google_data.items() if v is not None}, indent=2)
        prompt = (
            f'For the property at "{address}", I have these VERIFIED details from Google:\n{known}\n\n'
            f'Keep ALL of those values exactly as provided — do not modify any Google-verified field.\n'
            f'For the remaining fields, only fill in values you can determine with high confidence from public records:\n'
            f'price (number USD or null), bedrooms (number or null), bathrooms (number or null), '
            f'sqft (number or null), year_built (number or null), '
            f'description (2-3 sentences — if limited info, say so honestly), '
            f'walk_score (0-100 or null), school_rating (string or null), '
            f'on_market (boolean, default false), listing_source (string or null), nearby_highways (string or null).\n'
            f'Return a single JSON object. Use null for anything uncertain.'
        )
    else:
        system = PROPERTY_SYSTEM_FALLBACK
        prompt = (
            f'For the address "{address}", return a JSON object with:\n'
            f'address, city, state, zip, price (number USD or null), '
            f'bedrooms (number or null), bathrooms (number or null), sqft (number or null), '
            f'year_built (number or null), description (2-3 sentences or "Limited data available"), '
            f'lat (number or null), lng (number or null), walk_score (0-100 or null), '
            f'school_rating (string or null), nearby_hospitals (string or null), '
            f'nearby_highways (string or null), nearby_schools (string or null), '
            f'on_market (false), listing_source (null).\n'
            f'Set any field to null if you are not confident in the value.'
        )

    text = _call_llm(system, prompt, expect_json=True, tier="quality")
    result = _parse_json(text)

    if not isinstance(result, dict):
        return None

    if google_data:
        for k, v in google_data.items():
            if v is not None:
                result[k] = v

    if has_web_data:
        result["data_source"] = "public_listings"

    result["llm_provider"] = active_provider()
    return result


# ---------------------------------------------------------------------------
# Search by criteria (city, budget, beds, etc.)
# ---------------------------------------------------------------------------

def _safe_num(v, default=None):
    if v is None:
        return default
    try:
        return int(float(v))
    except (ValueError, TypeError):
        return default


async def search_properties_by_criteria_llm(filters: dict) -> list:
    if not has_llm_provider():
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

    prompt = (
        f"Find 5-8 residential properties that could realistically be for sale in {city}{budget}{beds}{baths}{sqft}.\n"
        f"Use real street names that exist in that city. Prices must reflect actual {city} market conditions.\n"
        f'Return a JSON object with a "properties" key containing an array of objects.'
    )

    text = _call_llm(CRITERIA_SYSTEM, prompt, expect_json=True, tier="economy")
    parsed = _parse_json(text)

    if isinstance(parsed, list):
        return parsed
    if isinstance(parsed, dict):
        if "properties" in parsed:
            return parsed["properties"]
        if "results" in parsed:
            return parsed["results"]
    return []


# ---------------------------------------------------------------------------
# Generic invoke (used by frontend AI features)
# ---------------------------------------------------------------------------

async def invoke_llm(
    prompt: str,
    response_json_schema: dict | None = None,
    feature: str | None = None,
) -> dict | None:
    if not has_llm_provider():
        return None

    tier = tier_for_feature(feature)
    system = "You are a helpful assistant. Follow instructions precisely and return accurate information."
    if response_json_schema:
        system += " Return your response as valid JSON only, with no additional text."

    text = _call_llm(system, prompt, expect_json=bool(response_json_schema), tier=tier)
    if not text:
        return None

    if response_json_schema:
        result = _parse_json(text)
        return result if isinstance(result, dict) else None

    return {"result": text}
