"""User presets CRUD. Scoped to current user. client_id optional for realtor client presets."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.dependencies import get_supabase_admin, get_current_user_id

router = APIRouter(prefix="/presets", tags=["presets"])


class CreatePresetBody(BaseModel):
    name: str
    weights: dict = {}
    filters: dict = {}
    client_id: str | None = None


class UpdatePresetBody(BaseModel):
    name: str | None = None
    weights: dict | None = None
    filters: dict | None = None


@router.get("")
async def list_presets(
    user_id: str = Depends(get_current_user_id),
    client_id: str | None = None,
):
    supabase = get_supabase_admin()
    q = supabase.table("user_presets").select("*").eq("user_id", user_id)
    if client_id:
        q = q.eq("client_id", client_id)
    else:
        q = q.is_("client_id", "null")
    r = q.order("created_at", desc=True).execute()
    return r.data or []


@router.post("")
async def create_preset(body: CreatePresetBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    row = {
        "user_id": user_id,
        "name": body.name,
        "weights": body.weights or {},
        "filters": body.filters or {},
        "client_id": body.client_id,
    }
    r = supabase.table("user_presets").insert(row).select().execute()
    return r.data[0] if r.data else None


@router.patch("/{preset_id}")
async def update_preset(preset_id: str, body: UpdatePresetBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.weights is not None:
        updates["weights"] = body.weights
    if body.filters is not None:
        updates["filters"] = body.filters
    if not updates:
        return {"ok": True}
    r = supabase.table("user_presets").update(updates).eq("id", preset_id).eq("user_id", user_id).select().execute()
    return r.data[0] if r.data else None


@router.delete("/{preset_id}")
async def delete_preset(preset_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    supabase.table("user_presets").delete().eq("id", preset_id).eq("user_id", user_id).execute()
    return {"ok": True}
