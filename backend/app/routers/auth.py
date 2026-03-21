"""Auth routes: me, update_me. All require valid Supabase JWT."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.dependencies import get_supabase_admin, get_current_user_id

router = APIRouter(prefix="/auth", tags=["auth"])


class UpdateProfileBody(BaseModel):
    full_name: str | None = None
    default_weights: dict | None = None
    realtor_license: str | None = None
    brokerage: str | None = None
    state: str | None = None
    linked_realtor_id: str | None = None


def _profile_to_user(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "id": str(row["id"]),
        "email": row.get("email"),
        "full_name": row.get("full_name"),
        "default_weights": row.get("default_weights") or {},
        "role": row.get("role") or "user",
        "plan": row.get("plan") or "free",
        "realtor_license": row.get("realtor_license") or "",
        "brokerage": row.get("brokerage") or "",
        "state": row.get("state") or "",
        "linked_realtor_id": str(row["linked_realtor_id"]) if row.get("linked_realtor_id") else None,
    }


@router.get("/me")
async def me(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("*").eq("id", user_id).execute()
    row = r.data[0] if r.data else None
    if not row:
        supabase.table("profiles").insert({"id": user_id}).execute()
        r = supabase.table("profiles").select("*").eq("id", user_id).execute()
        row = r.data[0] if r.data else None
    return _profile_to_user(row)


@router.patch("/me")
async def update_me(body: UpdateProfileBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        r = supabase.table("profiles").select("*").eq("id", user_id).execute()
        return _profile_to_user(r.data[0] if r.data else None)
    supabase.table("profiles").update(updates).eq("id", user_id).execute()
    r = supabase.table("profiles").select("*").eq("id", user_id).execute()
    return _profile_to_user(r.data[0] if r.data else None)
