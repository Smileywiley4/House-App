"""Property search by address. Google for verified location, web search for real listing data, LLM to structure."""
import hashlib
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_supabase_admin, get_current_user_id
from app.llm import get_property_by_address_llm, search_properties_by_criteria_llm, has_llm_provider, active_provider
from app.google_places import get_property_via_google, get_autoscore_data
from app.web_search import search_property_listings, format_search_context

router = APIRouter(prefix="/property", tags=["property"])
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Deterministic scoring formulas: distance in miles → score 1-10
# These never change, guaranteeing the same address always gets the same score.
# ---------------------------------------------------------------------------

def _distance_score(miles: float | None, best: float = 0.5, worst: float = 10.0) -> int:
    """Convert distance in miles to a 1-10 score. Closer = higher."""
    if miles is None:
        return 5
    if miles <= best:
        return 10
    if miles >= worst:
        return 1
    ratio = (miles - best) / (worst - best)
    return max(1, min(10, round(10 - ratio * 9)))


def _count_score(count: int, good: int = 10, great: int = 20) -> int:
    """Convert a count of nearby places to a 1-10 score. More = higher."""
    if count >= great:
        return 10
    if count <= 0:
        return 2
    ratio = count / great
    return max(2, min(10, round(2 + ratio * 8)))


def _compute_autoscores(raw: dict) -> dict:
    """
    Given raw Google distance/count data, return deterministic category scores.
    Only scores categories where real Google data is available.
    """
    scores = {}

    scores["hospital_distance"] = _distance_score(raw.get("hospital_mi"), best=0.5, worst=8.0)
    scores["schools"] = _distance_score(raw.get("school_mi"), best=0.3, worst=5.0)
    scores["public_transportation"] = _distance_score(raw.get("transit_mi"), best=0.2, worst=5.0)
    scores["neighborhood_safety"] = _distance_score(raw.get("police_mi"), best=0.5, worst=8.0)

    grocery_mi = raw.get("grocery_mi")
    park_mi = raw.get("park_mi")
    restaurants = raw.get("restaurants_count", 0)
    stores = raw.get("stores_count", 0)

    walkability_parts = []
    if grocery_mi is not None:
        walkability_parts.append(_distance_score(grocery_mi, best=0.3, worst=3.0))
    if park_mi is not None:
        walkability_parts.append(_distance_score(park_mi, best=0.2, worst=2.0))
    walkability_parts.append(_count_score(restaurants, good=5, great=15))
    walkability_parts.append(_count_score(stores, good=5, great=15))
    scores["location_lifestyle"] = max(1, min(10, round(sum(walkability_parts) / len(walkability_parts))))

    fire_mi = raw.get("fire_mi")
    police_mi = raw.get("police_mi")
    safety_parts = [scores["neighborhood_safety"]]
    if fire_mi is not None:
        safety_parts.append(_distance_score(fire_mi, best=0.5, worst=8.0))
    scores["neighborhood_safety"] = max(1, min(10, round(sum(safety_parts) / len(safety_parts))))

    highway_score = 5
    if grocery_mi is not None and raw.get("transit_mi") is not None:
        avg_infra = (grocery_mi + raw["transit_mi"]) / 2
        highway_score = _distance_score(avg_infra, best=0.5, worst=6.0)
    scores["highway_access"] = highway_score

    return scores


def _normalize_address(addr: str) -> str:
    if not addr:
        return ""
    return " ".join(addr.strip().lower().split())


def _cache_key(addr: str) -> str:
    return hashlib.sha256(_normalize_address(addr).encode()).hexdigest()


class SearchBody(BaseModel):
    address: str


@router.post("/search")
async def search(body: SearchBody):
    address = (body.address or "").strip()
    if not address:
        return {"error": "Address is required"}
    key = _cache_key(address)

    try:
        supabase = get_supabase_admin()
        r = supabase.table("property_cache").select("data").eq("address_hash", key).execute()
        if r.data and len(r.data) > 0:
            row = r.data[0]
            return row.get("data") or {}
    except Exception:
        pass

    google_data = await get_property_via_google(address)
    if google_data:
        logger.info("Google geocode: %s, %s %s", google_data.get("city"), google_data.get("state"), google_data.get("zip"))

    search_addr = google_data.get("formatted_address") or address if google_data else address
    web_results = await search_property_listings(search_addr)
    web_context = format_search_context(web_results)
    if web_context:
        sources = set(r.get("source") for r in web_results if r.get("source") != "Web")
        logger.info("Web search found %d results from: %s", len(web_results), ", ".join(sources) or "web")

    if not has_llm_provider():
        if google_data:
            data = {
                "address": google_data.get("address") or address,
                "city": google_data.get("city", ""),
                "state": google_data.get("state", ""),
                "zip": google_data.get("zip", ""),
                "lat": google_data.get("lat"),
                "lng": google_data.get("lng"),
                "nearby_hospitals": google_data.get("nearby_hospitals"),
                "nearby_schools": google_data.get("nearby_schools"),
                "nearby_highways": google_data.get("nearby_highways"),
                "price": None, "bedrooms": None, "bathrooms": None, "sqft": None,
                "year_built": None, "description": "Property details from Google Maps.",
                "walk_score": None, "school_rating": None,
                "on_market": False, "listing_source": None,
            }
            _save_cache(key, data)
            return data
        raise HTTPException(status_code=503, detail="No LLM provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.")

    logger.info("Using LLM provider: %s", active_provider())
    data = await get_property_by_address_llm(
        address,
        google_data=google_data,
        web_search_context=web_context or None,
    )
    if not data:
        raise HTTPException(status_code=502, detail="Property lookup failed. Check Railway logs for details.")

    _save_cache(key, data)
    return data


def _save_cache(key: str, data: dict):
    try:
        supabase = get_supabase_admin()
        supabase.table("property_cache").upsert(
            [{"address_hash": key, "data": data}],
            on_conflict="address_hash",
        ).execute()
    except Exception:
        pass


class SearchByCriteriaBody(BaseModel):
    filters: dict = {}
    source: str = "public"  # "public" | "private"


@router.post("/search-by-criteria")
async def search_by_criteria(
    body: SearchByCriteriaBody, user_id: str = Depends(get_current_user_id)
):
    """Search properties by preset filters. Public: LLM-suggested listings. Private: realtor's private_listings."""
    f = body.filters or {}
    source = (body.source or "public").lower()

    if source == "private":
        supabase = get_supabase_admin()
        q = supabase.table("private_listings").select("*").eq("user_id", user_id)
        # Apply filters
        if f.get("budget_min") is not None:
            q = q.gte("price", float(f["budget_min"]))
        if f.get("budget_max") is not None:
            q = q.lte("price", float(f["budget_max"]))
        if f.get("beds_min") is not None:
            q = q.gte("bedrooms", int(f["beds_min"]))
        if f.get("baths_min") is not None:
            try:
                v = int(float(f["baths_min"]))
                q = q.gte("bathrooms", v)
            except (ValueError, TypeError):
                pass
        if f.get("sqft_min") is not None:
            q = q.gte("sqft", int(f["sqft_min"]))
        if f.get("sqft_max") is not None:
            q = q.lte("sqft", int(f["sqft_max"]))
        if f.get("city"):
            q = q.ilike("city", f"%{str(f['city']).strip()}%")
        if f.get("state"):
            q = q.ilike("state", f"%{str(f['state']).strip()}%")
        if f.get("zip"):
            q = q.ilike("zip", f"%{str(f['zip']).strip()}%")
        r = q.order("created_at", desc=True).execute()
        rows = r.data or []
        return {
            "source": "private",
            "properties": [_listing_to_property(x) for x in rows],
        }

    # Public: use LLM to suggest matching properties
    props = await search_properties_by_criteria_llm(f)
    return {"source": "public", "properties": props or []}


def _listing_to_property(row: dict) -> dict:
    return {
        "address": row.get("address"),
        "city": row.get("city"),
        "state": row.get("state"),
        "zip": row.get("zip"),
        "price": row.get("price"),
        "bedrooms": row.get("bedrooms"),
        "bathrooms": row.get("bathrooms"),
        "sqft": row.get("sqft"),
        "year_built": row.get("year_built"),
        "description": row.get("notes") or "",
        "on_market": True,
        "listing_source": "Private Listing",
        "id": row.get("id"),
    }


# ---------------------------------------------------------------------------
# Auto-score endpoint: deterministic, Google-data-only, cached forever
# ---------------------------------------------------------------------------

class AutoScoreBody(BaseModel):
    address: str


@router.post("/autoscore")
async def autoscore(body: AutoScoreBody):
    """
    Return deterministic scores for categories that can be scored from Google data.
    Results are cached so the same address always returns the same scores.
    """
    address = (body.address or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="Address is required")

    cache_key = "autoscore_" + _cache_key(address)

    try:
        supabase = get_supabase_admin()
        r = supabase.table("property_cache").select("data").eq("address_hash", cache_key).execute()
        if r.data and len(r.data) > 0:
            cached = r.data[0].get("data")
            if cached:
                return cached
    except Exception:
        pass

    raw = await get_autoscore_data(address)
    if not raw:
        raise HTTPException(
            status_code=503,
            detail="Could not retrieve location data. Ensure GOOGLE_PLACES_API_KEY is configured.",
        )

    scores = _compute_autoscores(raw)

    result = {
        "address": raw.get("formatted_address") or address,
        "scores": scores,
        "raw": {
            "hospital_mi": raw.get("hospital_mi"),
            "school_mi": raw.get("school_mi"),
            "transit_mi": raw.get("transit_mi"),
            "grocery_mi": raw.get("grocery_mi"),
            "park_mi": raw.get("park_mi"),
            "police_mi": raw.get("police_mi"),
            "fire_mi": raw.get("fire_mi"),
            "restaurants_nearby": raw.get("restaurants_count"),
            "stores_nearby": raw.get("stores_count"),
        },
    }

    try:
        supabase = get_supabase_admin()
        supabase.table("property_cache").upsert(
            [{"address_hash": cache_key, "data": result}],
            on_conflict="address_hash",
        ).execute()
    except Exception:
        pass

    return result
