"""Private listings CRUD (realtor). Scoped to current user."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.dependencies import get_supabase_admin, get_current_user_id

router = APIRouter(prefix="/private_listings", tags=["private_listings"])


class CreateListingBody(BaseModel):
    address: str
    city: str | None = None
    state: str | None = None
    zip: str | None = None
    price: int | float | None = None
    bedrooms: int | None = None
    bathrooms: int | None = None
    sqft: int | None = None
    year_built: int | None = None
    status: str = "off_market"
    client_id: str | None = None
    notes: str | None = None


@router.get("")
async def list_listings(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = supabase.table("private_listings").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return r.data or []


@router.post("")
async def create_listing(body: CreateListingBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    row = body.model_dump()
    row["user_id"] = user_id
    r = supabase.table("private_listings").insert(row).select().execute()
    return r.data[0] if r.data else None


@router.delete("/{listing_id}")
async def delete_listing(listing_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    supabase.table("private_listings").delete().eq("id", listing_id).eq("user_id", user_id).execute()
    return {"ok": True}
