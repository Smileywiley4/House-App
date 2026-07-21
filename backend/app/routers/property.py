"""Property search by address. Google for verified location, web search for real listing data, LLM to structure."""
import asyncio
from collections import deque
from datetime import datetime
import hashlib
import logging
from time import monotonic
import httpx
from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field
from app.config import get_settings
from app.dependencies import get_supabase_admin, get_current_user_id, get_optional_user_id, user_has_paid_plan, require_paid_plan
from app.llm import get_property_by_address_llm, has_llm_provider, active_provider
from app.google_places import autocomplete_addresses, get_property_via_google, get_autoscore_data, places_v1_search_nearby
from app.rentcast import browse_rentcast, get_rentcast_property, is_sparse_property
from app.web_search import search_property_listings, format_search_context, extract_listing_hints

router = APIRouter(prefix="/property", tags=["property"])
logger = logging.getLogger(__name__)
PUBLIC_SEARCH_LIMIT = 30
PUBLIC_BROWSE_LIMIT = 60
PUBLIC_STREET_VIEW_LIMIT = 60
PUBLIC_AUTOSCORE_LIMIT = 10
PUBLIC_SEARCH_WINDOW_SECONDS = 60 * 60
_public_search_hits: dict[str, deque[float]] = {}


def _enforce_public_search_limit(
    request: Request,
    *,
    namespace: str = "search",
    limit: int = PUBLIC_SEARCH_LIMIT,
) -> None:
    forwarded = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded.split(",", 1)[0].strip() or (request.client.host if request.client else "unknown")
    now = monotonic()
    hits = _public_search_hits.setdefault(f"{namespace}:{client_ip}", deque())
    while hits and now - hits[0] >= PUBLIC_SEARCH_WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= limit:
        raise HTTPException(
            status_code=429,
            detail="Public lookup limit reached. Try again later.",
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


def _property_fact_scores(property_data: dict | None) -> tuple[dict, dict]:
    """Score explicit property facts only; do not infer condition or affordability."""
    data = property_data or {}
    scores: dict[str, int] = {}
    facts: dict[str, dict] = {}

    bedrooms = data.get("bedrooms", data.get("beds"))
    if isinstance(bedrooms, (int, float)):
        scores["bedroom_count"] = 10 if bedrooms >= 5 else 9 if bedrooms >= 4 else 8 if bedrooms >= 3 else 6 if bedrooms >= 2 else 3
        facts["bedroom_count"] = {
            "value": f"{bedrooms:g} bedroom{'s' if bedrooms != 1 else ''}",
            "note": "Review against your household needs.",
        }

    bathrooms = data.get("bathrooms", data.get("baths"))
    if isinstance(bathrooms, (int, float)):
        scores["bathroom_count"] = 10 if bathrooms >= 3 else 9 if bathrooms >= 2.5 else 8 if bathrooms >= 2 else 6 if bathrooms >= 1.5 else 4
        facts["bathroom_count"] = {
            "value": f"{bathrooms:g} bathroom{'s' if bathrooms != 1 else ''}",
            "note": "Review against your household needs.",
        }

    sqft = data.get("sqft")
    if isinstance(sqft, (int, float)) and sqft > 0:
        scores["overall_living_space"] = 10 if sqft >= 3000 else 9 if sqft >= 2400 else 8 if sqft >= 1800 else 7 if sqft >= 1400 else 5 if sqft >= 1000 else 3
        facts["overall_living_space"] = {
            "value": f"{sqft:,.0f} sq ft",
            "note": "Higher scores indicate more total living space, not layout quality.",
        }

    annual_taxes = data.get("annual_taxes")
    assessment = data.get("tax_assessment")
    if (
        isinstance(annual_taxes, (int, float))
        and isinstance(assessment, (int, float))
        and annual_taxes >= 0
        and assessment > 0
    ):
        effective_rate = annual_taxes / assessment * 100
        scores["property_tax_cost"] = (
            10 if effective_rate <= 0.5 else 9 if effective_rate <= 1.0 else 7
            if effective_rate <= 1.5 else 5 if effective_rate <= 2.0 else 3 if effective_rate <= 2.5 else 1
        )
        facts["property_tax_cost"] = {
            "value": f"${annual_taxes:,.0f}/yr · {effective_rate:.2f}% of assessment",
            "note": "Lower effective tax rates score higher; verify current tax treatment.",
        }

    hoa_fee = data.get("hoa_fee")
    if isinstance(hoa_fee, (int, float)) and hoa_fee >= 0:
        scores["hoa_cost"] = 10 if hoa_fee == 0 else 9 if hoa_fee <= 75 else 8 if hoa_fee <= 150 else 6 if hoa_fee <= 300 else 4 if hoa_fee <= 500 else 2
        facts["hoa_cost"] = {
            "value": f"${hoa_fee:,.0f}/mo",
            "note": "Lower fees score higher; included services and amenities are not evaluated.",
        }

    features = data.get("features") if isinstance(data.get("features"), dict) else {}
    if "garage" in features:
        garage = bool(features.get("garage"))
        spaces = features.get("garageSpaces")
        scores["garage_storage"] = min(10, 7 + int(spaces or 0)) if garage else 3
        facts["garage_storage"] = {
            "value": f"Garage · {spaces:g} spaces" if garage and isinstance(spaces, (int, float)) else ("Garage" if garage else "No garage recorded"),
            "note": "Based on recorded garage availability.",
        }
    if "fireplace" in features:
        fireplace = bool(features.get("fireplace"))
        scores["fireplace"] = 9 if fireplace else 3
        facts["fireplace"] = {
            "value": "Fireplace recorded" if fireplace else "No fireplace recorded",
            "note": "Based on the property record, not an inspection.",
        }

    history = data.get("sale_history") if isinstance(data.get("sale_history"), list) else []
    sales = []
    for row in history:
        try:
            price = float(row.get("price"))
            sold_at = datetime.fromisoformat(str(row.get("date", "")).replace("Z", "+00:00")).timestamp()
            if price > 0:
                sales.append((sold_at, price))
        except (TypeError, ValueError):
            continue
    sales.sort(key=lambda item: item[0])
    if len(sales) >= 2:
        first_date, first_price = sales[0]
        last_date, last_price = sales[-1]
        years = max((last_date - first_date) / (365.25 * 24 * 60 * 60), 0)
        if years >= 1:
            annual_growth = (last_price / first_price) ** (1 / years) - 1
            growth_percent = annual_growth * 100
            growth_score = 10 if growth_percent >= 8 else 9 if growth_percent >= 6 else 7 if growth_percent >= 4 else 5 if growth_percent >= 2 else 3 if growth_percent >= 0 else 1
            for category_id in ("location_investment", "longterm_neighborhood_value"):
                scores[category_id] = growth_score
                facts[category_id] = {
                    "value": f"{growth_percent:.1f}% annualized property sale-price change",
                    "note": "Property history is one signal and does not prove future neighborhood appreciation.",
                }

    return scores, facts


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
    rentcast_data: dict | None = None,
) -> dict:
    """Merge verified location with licensed property and listing facts."""
    gd = google_data or {}
    rc = rentcast_data or {}
    has_listing = any(
        rc.get(k) is not None or listing_hints.get(k) is not None
        for k in ("price", "bedrooms", "bathrooms", "sqft", "year_built")
    )
    formatted = rc.get("formatted_address") or gd.get("formatted_address") or address
    if rc:
        description = "Property details from RentCast records and current listing data."
    elif has_listing:
        description = "Listing details from public property sites."
    elif gd:
        description = f"Location verified for {formatted}."
    else:
        description = f"Limited data available for {address}."

    return {
        "address": rc.get("address") or gd.get("address") or address,
        "formatted_address": formatted,
        "city": rc.get("city") or gd.get("city", ""),
        "state": rc.get("state") or gd.get("state", ""),
        "zip": rc.get("zip") or gd.get("zip", ""),
        "lat": rc.get("lat") or gd.get("lat"),
        "lng": rc.get("lng") or gd.get("lng"),
        "nearby_hospitals": gd.get("nearby_hospitals"),
        "nearby_schools": gd.get("nearby_schools"),
        "nearby_highways": gd.get("nearby_highways"),
        "price": rc.get("price") or listing_hints.get("price") or rc.get("last_list_price") or rc.get("estimated_value"),
        "list_price": rc.get("price"),
        "last_list_price": rc.get("last_list_price"),
        "estimated_value": rc.get("estimated_value"),
        "estimated_value_low": rc.get("estimated_value_low"),
        "estimated_value_high": rc.get("estimated_value_high"),
        "bedrooms": rc.get("bedrooms") if rc.get("bedrooms") is not None else listing_hints.get("bedrooms"),
        "bathrooms": rc.get("bathrooms") if rc.get("bathrooms") is not None else listing_hints.get("bathrooms"),
        "sqft": rc.get("sqft") if rc.get("sqft") is not None else listing_hints.get("sqft"),
        "year_built": rc.get("year_built") if rc.get("year_built") is not None else listing_hints.get("year_built"),
        "property_type": rc.get("property_type") or listing_hints.get("property_type"),
        "county": rc.get("county"),
        "lot_size": rc.get("lot_size"),
        "hoa_fee": rc.get("hoa_fee"),
        "listing_status": rc.get("listing_status"),
        "listing_type": rc.get("listing_type"),
        "listed_date": rc.get("listed_date"),
        "last_seen_date": rc.get("last_seen_date"),
        "removed_date": rc.get("removed_date"),
        "days_on_market": rc.get("days_on_market"),
        "mls_name": rc.get("mls_name"),
        "mls_number": rc.get("mls_number"),
        "listing_agent": rc.get("listing_agent"),
        "last_sale_date": rc.get("last_sale_date"),
        "last_sale_price": rc.get("last_sale_price"),
        "tax_assessment": rc.get("tax_assessment"),
        "annual_taxes": rc.get("annual_taxes"),
        "features": rc.get("features") or {},
        "sale_history": rc.get("sale_history") or [],
        "listing_history": rc.get("listing_history") or [],
        "rentcast_id": rc.get("rentcast_id"),
        "data_updated_at": rc.get("data_updated_at"),
        "description": description,
        "walk_score": None,
        "school_rating": None,
        "on_market": rc.get("on_market") if rc else bool(listing_hints.get("on_market") or listing_hints.get("price")),
        "listing_source": (
            "RentCast"
            if rc.get("price") or rc.get("last_list_price") or rc.get("estimated_value")
            else listing_hints.get("listing_source")
        ),
        "data_source": "rentcast" if rc else ("public_listings" if has_listing else ("google_maps" if gd else None)),
        "data_sources": [
            source
            for source, present in (
                ("RentCast", bool(rc)),
                ("Google Maps", bool(gd)),
                ("Public listings", bool(listing_hints)),
            )
            if present
        ],
        "price_label": (
            "Current listing price"
            if rc.get("price") is not None
            else (
                "Last listed price"
                if rc.get("last_list_price") is not None
                else (
                    "Estimated value"
                    if rc.get("estimated_value") is not None
                    else ("Listing price" if listing_hints.get("price") is not None else None)
                )
            )
        ),
    }


class SearchBody(BaseModel):
    address: str = Field(..., min_length=3, max_length=300)


@router.get("/street-view")
async def street_view_image(
    request: Request,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
):
    """Proxy a cached Street View exterior so the server-side API key stays private."""
    _enforce_public_search_limit(
        request,
        namespace="street-view",
        limit=PUBLIC_STREET_VIEW_LIMIT,
    )
    settings = get_settings()
    api_key = settings.google_street_view_api_key or settings.google_places_api_key
    if not api_key:
        raise HTTPException(status_code=503, detail="Street View is not configured")
    params = {
        "size": "900x520",
        "location": f"{lat},{lng}",
        "fov": 90,
        "pitch": 0,
        "source": "outdoor",
        "return_error_code": "true",
        "key": api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            upstream = await client.get(
                "https://maps.googleapis.com/maps/api/streetview",
                params=params,
            )
    except httpx.HTTPError as exc:
        logger.warning("Street View request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Street View is temporarily unavailable") from exc
    if upstream.status_code == 404:
        raise HTTPException(status_code=404, detail="Street View imagery is unavailable for this address")
    if upstream.status_code >= 400:
        logger.warning("Street View returned HTTP %s", upstream.status_code)
        raise HTTPException(status_code=502, detail="Street View could not be loaded")
    return Response(
        content=upstream.content,
        media_type=upstream.headers.get("content-type", "image/jpeg"),
        headers={"Cache-Control": "no-store, max-age=0"},
    )


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


@router.get("/autocomplete")
async def autocomplete(
    request: Request,
    q: str = Query(..., min_length=3, max_length=120),
):
    _enforce_public_search_limit(request, namespace="autocomplete", limit=120)
    predictions = await autocomplete_addresses(q)
    return {"predictions": predictions}


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
    provider_key = "rentcast" if get_settings().rentcast_api_key else "basic"
    result_cache_key = f"v3_{provider_key}_{'paid' if is_paid else 'public'}_{key}"

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

    # Geocode first so RentCast can use the canonical Street, City, State Zip form.
    google_data = await get_property_via_google(address)
    preferred = (google_data or {}).get("formatted_address")
    rentcast_data = await get_rentcast_property(address, preferred_address=preferred)
    if google_data:
        logger.info("Google geocode: %s, %s %s", google_data.get("city"), google_data.get("state"), google_data.get("zip"))
    if rentcast_data:
        logger.info(
            "RentCast match: %s (%s)",
            rentcast_data.get("formatted_address"),
            rentcast_data.get("listing_status") or "property record",
        )

    search_addr = preferred or address
    # Always try public listing snippets when RentCast is missing core facts.
    # Do not scrape listing-site photo galleries — licensed records + snippets only.
    need_web_hints = is_sparse_property(rentcast_data) or any(
        rentcast_data.get(field) in (None, "")
        for field in ("bedrooms", "bathrooms", "sqft", "price", "year_built")
    ) if rentcast_data else True
    web_results = await search_property_listings(search_addr) if need_web_hints else []
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
            basic_data = _build_basic_property_response(address, google_data, listing_hints, rentcast_data)
            trusted_fields = (
                "address",
                "formatted_address",
                "city",
                "state",
                "zip",
                "price",
                "bedrooms",
                "bathrooms",
                "sqft",
                "year_built",
                "listing_source",
            )
            for field in trusted_fields:
                if basic_data.get(field) not in (None, ""):
                    data[field] = basic_data[field]
            for field, value in basic_data.items():
                if field not in data or data.get(field) in (None, "", [], {}):
                    data[field] = value
            _save_cache(result_cache_key, data)
            return data
        logger.warning("LLM property lookup failed; falling back to basic listing data")

    if google_data or rentcast_data or listing_hints:
        data = _build_basic_property_response(address, google_data, listing_hints, rentcast_data)
        _save_cache(result_cache_key, data)
        return data

    if not has_llm_provider():
        raise HTTPException(
            status_code=503,
            detail=(
                "Property search is not fully configured. Set GOOGLE_PLACES_API_KEY for address lookup "
                "and RENTCAST_API_KEY for verified property and listing details."
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


class BrowseBody(BaseModel):
    mode: str = Field(default="for_sale", description="for_sale | off_market")
    latitude: float | None = None
    longitude: float | None = None
    radius: float | None = Field(default=5, description="Miles")
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    filters: dict = Field(default_factory=dict)
    limit: int = 40
    offset: int = 0


@router.post("/browse")
async def browse_properties(
    request: Request,
    body: BrowseBody,
    user_id: str | None = Depends(get_optional_user_id),
):
    """Map/list inventory browse via RentCast (licensed). Guests are rate-limited."""
    if not user_id:
        _enforce_public_search_limit(request, namespace="browse", limit=PUBLIC_BROWSE_LIMIT)

    has_place = bool((body.city or "").strip() or (body.zip or "").strip())
    has_geo = body.latitude is not None and body.longitude is not None
    if not has_place and not has_geo:
        raise HTTPException(status_code=400, detail="Provide a city/ZIP or map center coordinates.")

    result = await browse_rentcast(
        mode=body.mode,
        latitude=body.latitude,
        longitude=body.longitude,
        radius=body.radius,
        city=(body.city or "").strip() or None,
        state=(body.state or "").strip() or None,
        zip_code=(body.zip or "").strip() or None,
        filters=body.filters or {},
        limit=body.limit,
        offset=body.offset,
    )
    if result.get("error") == "RentCast is not configured":
        raise HTTPException(status_code=503, detail="Property browse is not configured.")
    return result


@router.post("/search-by-criteria")
async def search_by_criteria(
    body: SearchByCriteriaBody, user_id: str = Depends(require_paid_plan)
):
    """Search properties by preset filters. Public: RentCast. Private: realtor's private_listings."""
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

    result = await browse_rentcast(
        mode="for_sale",
        city=(f.get("city") or "").strip() or None,
        state=(f.get("state") or "").strip() or None,
        zip_code=(f.get("zip") or "").strip() or None,
        filters=f,
        limit=40,
        offset=0,
    )
    if result.get("error") == "RentCast is not configured":
        raise HTTPException(
            status_code=503,
            detail="Public criteria search is unavailable until RentCast is configured.",
        )
    return {
        "source": "public",
        "properties": result.get("properties") or [],
        "total": result.get("total") or 0,
    }


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
# Auto-score endpoint: deterministic location data plus supplied property facts
# ---------------------------------------------------------------------------

class AutoScoreBody(BaseModel):
    address: str = Field(..., min_length=3, max_length=300)
    property: dict | None = None


@router.post("/autoscore")
async def autoscore(
    body: AutoScoreBody,
    request: Request,
    user_id: str | None = Depends(get_optional_user_id),
):
    """
    Return deterministic scores from location data and explicit property facts.
    Location measurements are cached; property-record scores are recomputed.
    """
    address = (body.address or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="Address is required")
    if user_id is None:
        _enforce_public_search_limit(
            request,
            namespace="autoscore",
            limit=PUBLIC_AUTOSCORE_LIMIT,
        )

    cache_key = "autoscore_" + _cache_key(address)

    google_result = None
    try:
        supabase = get_supabase_admin()
        r = supabase.table("property_cache").select("data").eq("address_hash", cache_key).execute()
        if r.data and len(r.data) > 0:
            cached = r.data[0].get("data")
            if cached:
                google_result = cached
    except Exception:
        pass

    if not google_result:
        raw = await get_autoscore_data(address)
        if raw:
            google_result = {
                "address": raw.get("formatted_address") or address,
                "scores": _compute_autoscores(raw),
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
                    [{"address_hash": cache_key, "data": google_result}],
                    on_conflict="address_hash",
                ).execute()
            except Exception:
                pass

    fact_scores, facts = _property_fact_scores(body.property)
    if not google_result and not fact_scores:
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not auto-score this property because verified location and property facts are unavailable."
            ),
        )

    result = {
        "address": (google_result or {}).get("address") or address,
        "scores": {**(google_result or {}).get("scores", {}), **fact_scores},
        "raw": (google_result or {}).get("raw", {}),
        "facts": facts,
    }

    return result
