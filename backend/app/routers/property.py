"""Property search by address. Uses DB cache for consistency (same address → same result)."""
import hashlib
import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_supabase_admin, get_current_user_id
from app.llm import get_property_by_address_llm, search_properties_by_criteria_llm

router = APIRouter(prefix="/property", tags=["property"])

CACHE_TTL_SEC = 86400  # 24 hours


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

    from app.config import get_settings
    if not get_settings().openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured on the server.")
    data = await get_property_by_address_llm(address)
    if not data:
        raise HTTPException(status_code=502, detail="OpenAI returned no data. Check Railway logs for details.")
    try:
        supabase = get_supabase_admin()
        supabase.table("property_cache").upsert(
            [{"address_hash": key, "data": data}],
            on_conflict="address_hash",
        ).execute()
    except Exception:
        pass
    return data


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
