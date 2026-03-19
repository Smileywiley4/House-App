"""Property search by address. Google for verified location data, LLM for enrichment, DB cache for consistency."""
import hashlib
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_supabase_admin, get_current_user_id
from app.llm import get_property_by_address_llm, search_properties_by_criteria_llm
from app.google_places import get_property_via_google

router = APIRouter(prefix="/property", tags=["property"])
logger = logging.getLogger(__name__)


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
        logger.info("Google data found for '%s': %s, %s %s", address, google_data.get("city"), google_data.get("state"), google_data.get("zip"))

    from app.config import get_settings
    if not get_settings().openai_api_key:
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
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured on the server.")

    data = await get_property_by_address_llm(address, google_data=google_data)
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
