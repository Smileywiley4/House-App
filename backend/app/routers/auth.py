"""Auth routes: me, update_me. All require valid Supabase JWT."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field

from app.dependencies import get_supabase_admin, get_current_user_id
from app.google_sheets_marketing import append_marketing_signup

router = APIRouter(prefix="/auth", tags=["auth"])


class UpdateProfileBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, max_length=200)
    default_weights: dict | None = None
    realtor_license: str | None = Field(default=None, max_length=100)
    brokerage: str | None = Field(default=None, max_length=200)
    state: str | None = Field(default=None, max_length=100)
    linked_realtor_id: str | None = None
    phone: str | None = Field(default=None, max_length=50)
    marketing_opt_in: bool | None = None


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
        "phone": row.get("phone") or "",
        "marketing_opt_in": bool(row.get("marketing_opt_in")),
    }


def _auth_user_metadata(supabase, user_id: str) -> dict:
    try:
        resp = supabase.auth.admin.get_user_by_id(user_id)
        user = getattr(resp, "user", None) or (resp if isinstance(resp, dict) else {})
        if hasattr(user, "user_metadata"):
            return user.user_metadata or {}
        if isinstance(user, dict):
            return user.get("user_metadata") or user.get("raw_user_meta_data") or {}
    except Exception:
        pass
    return {}


def _auth_user_email(supabase, user_id: str) -> str | None:
    try:
        resp = supabase.auth.admin.get_user_by_id(user_id)
        user = getattr(resp, "user", None) or (resp if isinstance(resp, dict) else {})
        if hasattr(user, "email"):
            return user.email
        if isinstance(user, dict):
            return user.get("email")
    except Exception:
        pass
    return None


def _display_name_from_metadata(meta: dict) -> str | None:
    for key in ("full_name", "name", "given_name"):
        val = (meta.get(key) or "").strip()
        if val:
            return val
    given = (meta.get("given_name") or "").strip()
    family = (meta.get("family_name") or "").strip()
    combined = f"{given} {family}".strip()
    return combined or None


def _profile_insert_from_auth(supabase, user_id: str) -> dict:
    meta = _auth_user_metadata(supabase, user_id)
    opt_in = bool(meta.get("marketing_opt_in"))
    payload = {
        "id": user_id,
        "email": _auth_user_email(supabase, user_id),
        "full_name": _display_name_from_metadata(meta),
        "phone": (meta.get("phone") or "").strip() or None,
        "marketing_opt_in": opt_in,
    }
    if opt_in:
        payload["marketing_opt_in_at"] = datetime.now(timezone.utc).isoformat()
    # A first GET/PATCH can arrive concurrently after sign-up. Upsert makes
    # the backend fallback safe when the auth.users profile trigger is delayed
    # or was not yet deployed for an OAuth user.
    supabase.table("profiles").upsert(payload, on_conflict="id").execute()
    r = supabase.table("profiles").select("*").eq("id", user_id).execute()
    return r.data[0] if r.data else payload


async def maybe_sync_marketing_profile(supabase, row: dict | None, *, source: str = "signup") -> dict | None:
    """Append to Google Sheets once when marketing_opt_in is true."""
    if not row or not row.get("marketing_opt_in") or row.get("marketing_sheet_synced_at"):
        return row

    synced = await append_marketing_signup(
        user_id=str(row["id"]),
        email=row.get("email"),
        full_name=row.get("full_name"),
        phone=row.get("phone"),
        plan=row.get("plan") or "free",
        marketing_opt_in=True,
        source=source,
        signed_up_at=row.get("marketing_opt_in_at") or row.get("created_at"),
    )
    if synced:
        now = datetime.now(timezone.utc).isoformat()
        supabase.table("profiles").update({"marketing_sheet_synced_at": now}).eq("id", row["id"]).execute()
        row["marketing_sheet_synced_at"] = now
    return row


@router.get("/me")
async def me(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("*").eq("id", user_id).execute()
    row = r.data[0] if r.data else None
    if not row:
        row = _profile_insert_from_auth(supabase, user_id)
        r = supabase.table("profiles").select("*").eq("id", user_id).execute()
        row = r.data[0] if r.data else row
    row = await maybe_sync_marketing_profile(supabase, row)
    return _profile_to_user(row)


@router.patch("/me")
async def update_me(body: UpdateProfileBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    existing = supabase.table("profiles").select("*").eq("id", user_id).execute()
    if not existing.data:
        _profile_insert_from_auth(supabase, user_id)
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        r = supabase.table("profiles").select("*").eq("id", user_id).execute()
        row = r.data[0] if r.data else None
        row = await maybe_sync_marketing_profile(supabase, row, source="profile_update")
        return _profile_to_user(row)

    if "marketing_opt_in" in updates and updates["marketing_opt_in"]:
        r = supabase.table("profiles").select("marketing_opt_in").eq("id", user_id).execute()
        prev = (r.data[0] if r.data else {}).get("marketing_opt_in")
        if not prev:
            updates["marketing_opt_in_at"] = datetime.now(timezone.utc).isoformat()
    elif "marketing_opt_in" in updates and not updates["marketing_opt_in"]:
        updates["marketing_opt_in_at"] = None

    if "phone" in updates:
        phone = (updates["phone"] or "").strip()
        updates["phone"] = phone or None

    supabase.table("profiles").update(updates).eq("id", user_id).execute()
    r = supabase.table("profiles").select("*").eq("id", user_id).execute()
    row = r.data[0] if r.data else None
    row = await maybe_sync_marketing_profile(supabase, row, source="profile_update")
    return _profile_to_user(row)
