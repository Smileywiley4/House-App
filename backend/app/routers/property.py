"""Property search by address. Google for verified location, web search for real listing data, LLM to structure."""
from collections import deque
import hashlib
import logging
from time import monotonic
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from app.dependencies import get_supabase_admin, get_current_user_id, get_optional_user_id, user_has_paid_plan, require_paid_plan
from app.llm import get_property_by_address_llm, has_llm_provider, active_provider
from app.google_places import get_property_via_google, get_autoscore_data, places_v1_search_nearby
from app.web_search import search_property_listings, format_search_context, extract_listing_hints

router = APIRouter(prefix="/property", tags=["property"])
logger = logging.getLogger(__name__)
PUBLIC_SEARCH_LIMIT = 30
PUBLIC_SEARCH_WINDOW_SECONDS = 60 * 60
_public_search_hits: dict[str, deque[float]] = {}


def _enforce_public_search_limit(request: Request) -> None:
    forwarded = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded.split(",", 1)[0].strip() or (request.client.host if request.client else "unknown")
    now = monotonic()
    hits = _public_search_hits.setdefault(client_ip, deque())
    while hits and now - hits[0] >= PUBLIC_SEARCH_WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= PUBLIC_SEARCH_LIMIT:
        raise HTTPException(
            status_code=429,
            detail="Free address-search limit reached. Try again later or sign in for continued access.",
        )
    hits.append(now)


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


def _build_basic_property_response(
    address: str,
    google_data: dict | None,
    listing_hints: dict,
) -> dict:
    """Google-verified location plus listing fields parsed from public search snippets."""
    gd = google_data or {}
    has_listing = any(
        listing_hints.get(k) is not None for k in ("price", "bedrooms", "bathrooms", "sqft", "year_built")
    )
    formatted = gd.get("formatted_address") or address
    if has_listing:
        description = "Listing details from public property sites."
    elif gd:
        description = f"Location verified for {formatted}."
    else:
        description = f"Limited data available for {address}."

    return {
        "address": gd.get("address") or address,
        "city": gd.get("city", ""),
        "state": gd.get("state", ""),
        "zip": gd.get("zip", ""),
        "lat": gd.get("lat"),
        "lng": gd.get("lng"),
        "nearby_hospitals": gd.get("nearby_hospitals"),
        "nearby_schools": gd.get("nearby_schools"),
        "nearby_highways": gd.get("nearby_highways"),
        "price": listing_hints.get("price"),
        "bedrooms": listing_hints.get("bedrooms"),
        "bathrooms": listing_hints.get("bathrooms"),
        "sqft": listing_hints.get("sqft"),
        "year_built": listing_hints.get("year_built"),
        "description": description,
        "walk_score": None,
        "school_rating": None,
        "on_market": bool(listing_hints.get("on_market") or listing_hints.get("price")),
        "listing_source": listing_hints.get("listing_source"),
        "data_source": "public_listings" if has_listing else ("google_maps" if gd else None),
    }


class SearchBody(BaseModel):
    address: str = Field(..., min_length=3, max_length=300)


@router.post("/places/search-nearby")
async def places_search_nearby(
    body: dict = Body(...),
    _user_id: str = Depends(get_current_user_id),
    x_goog_field_mask: str | None = Header(None, alias="X-Goog-FieldMask"),
):
    """
    Google Places API (New) — `places:searchNearby`.
    Same JSON body as the official API. Optional header `X-Goog-FieldMask` (default includes
    displayName, formattedAddress, location, types, id). Server uses `GOOGLE_PLACES_API_KEY`.
    https://developers.google.com/maps/documentation/places/web-service/nearby-search
    """
    data, status, err = await places_v1_search_nearby(body, field_mask=x_goog_field_mask)
    if status >= 400:
        if isinstance(data, dict):
            return JSONResponse(content=data, status_code=status)
        raise HTTPException(status_code=status, detail=err or "Places searchNearby failed")
    return data


@router.post("/search")
async def search(
    body: SearchBody,
    request: Request,
    user_id: str | None = Depends(get_optional_user_id),
):
    address = (body.address or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="Address is required")
    if user_id is None:
        _enforce_public_search_limit(request)
    key = _cache_key(address)

    supabase = None
    is_paid = False
    try:
        supabase = get_supabase_admin()
        is_paid = bool(user_id and user_has_paid_plan(supabase, user_id))
    except Exception:
        # Basic public lookup must remain available even if profile/cache
        # persistence is temporarily unavailable.
        logger.warning("Supabase unavailable during property lookup", exc_info=True)
    result_cache_key = key if is_paid else f"public_{key}"

    # Paid and public results use separate keys so AI-enriched paid data cannot
    # be replayed to a free or anonymous caller.
    try:
        r = (
            supabase.table("property_cache")
            .select("data")
            .eq("address_hash", result_cache_key)
            .execute()
            if supabase
            else None
        )
        if r and r.data and len(r.data) > 0:
            row = r.data[0]
            return row.get("data") or {}
    except Exception:
        pass

    google_data = await get_property_via_google(address)
    if google_data:
        logger.info("Google geocode: %s, %s %s", google_data.get("city"), google_data.get("state"), google_data.get("zip"))

    search_addr = google_data.get("formatted_address") or address if google_data else address
    web_results = await search_property_listings(search_addr)
    listing_hints = extract_listing_hints(web_results)
    web_context = format_search_context(web_results)
    if web_context:
        sources = set(r.get("source") for r in web_results if r.get("source") != "Web")
        logger.info("Web search found %d results from: %s", len(web_results), ", ".join(sources) or "web")
    if listing_hints.get("price"):
        logger.info("Parsed listing hints: price=%s beds=%s", listing_hints.get("price"), listing_hints.get("bedrooms"))

    if is_paid and has_llm_provider():
        logger.info("Using LLM provider: %s", active_provider())
        data = await get_property_by_address_llm(
            address,
            google_data=google_data,
            web_search_context=web_context or None,
        )
        if data:
            # Keep explicitly parsed listing facts when an LLM omits a field.
            # Paid users must not receive less complete address/price data than
            # the non-LLM fallback from the same verified search results.
            basic_data = _build_basic_property_response(address, google_data, listing_hints)
            for field in (
                "address",
                "city",
                "state",
                "zip",
                "price",
                "bedrooms",
                "bathrooms",
                "sqft",
                "year_built",
                "listing_source",
            ):
                if data.get(field) in (None, "") and basic_data.get(field) not in (None, ""):
                    data[field] = basic_data[field]
            _save_cache(key, data)
            return data
        logger.warning("LLM property lookup failed; falling back to basic listing data")

    if google_data or listing_hints:
        data = _build_basic_property_response(address, google_data, listing_hints)
        _save_cache(result_cache_key, data)
        return data

    if not has_llm_provider():
        raise HTTPException(
            status_code=503,
            detail=(
                "Property search is not fully configured. Set GOOGLE_PLACES_API_KEY for address lookup "
                "and GOOGLE_CSE_ID for listing prices, or configure ANTHROPIC_API_KEY / OPENAI_API_KEY."
            ),
        )

    raise HTTPException(
        status_code=404,
        detail="Could not find this address. Try adding city and state (e.g. Gilbert, AZ).",
    )


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
    body: SearchByCriteriaBody, user_id: str = Depends(require_paid_plan)
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

    # Do not present generated addresses or prices as market inventory. Enable
    # this only after wiring a licensed listing provider with a query endpoint.
    raise HTTPException(
        status_code=503,
        detail=(
            "Public criteria search is temporarily unavailable until a verified "
            "listing-data provider is configured. Private listings remain available."
        ),
    )


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
    address: str = Field(..., min_length=3, max_length=300)


@router.post("/autoscore")
async def autoscore(body: AutoScoreBody, _user_id: str = Depends(get_current_user_id)):
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
            detail=(
                "Could not geocode this address. Set GOOGLE_PLACES_API_KEY on the backend and enable "
                "**Geocoding API** and **Places API** (Nearby Search) for that key's GCP project. "
                "See docs/API_CONFIGURATION.md → Google Auto-Score."
            ),
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
