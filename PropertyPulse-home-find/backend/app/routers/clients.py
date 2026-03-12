"""Clients CRUD (realtor). Scoped to current user."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.dependencies import get_supabase_admin, get_current_user_id

router = APIRouter(prefix="/clients", tags=["clients"])


class CreateClientBody(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    budget_min: int | float | None = None
    budget_max: int | float | None = None
    notes: str | None = None
    status: str = "active"


@router.get("")
async def list_clients(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = supabase.table("clients").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return r.data or []


@router.post("")
async def create_client(body: CreateClientBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    row = body.model_dump()
    row["user_id"] = user_id
    r = supabase.table("clients").insert(row).select().execute()
    return r.data[0] if r.data else None


@router.delete("/{client_id}")
async def delete_client(client_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    supabase.table("clients").delete().eq("id", client_id).eq("user_id", user_id).execute()
    return {"ok": True}
