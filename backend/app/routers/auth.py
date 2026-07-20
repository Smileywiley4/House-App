"""Auth routes: me, update_me, password sign-in/up. Most require valid Supabase JWT."""
from datetime import datetime, timezone
import logging
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
import stripe

from app.config import get_settings
from app.dependencies import get_supabase_admin, get_current_user_id
from app.google_sheets_marketing import mark_account_cancelled, upsert_account_row

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


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


class DeleteAccountBody(BaseModel):
    confirmation: Literal["DELETE"]


class PasswordSignInBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=200)


class PasswordSignUpBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=200)
    full_name: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=50)
    marketing_opt_in: bool = False
    terms_accepted: bool = False
    intended_plan: Literal["free", "premium", "realtor"] = "free"


async def _password_grant(email: str, password: str) -> dict[str, Any]:
    """
    Exchange email/password for a session using the service role.

    Supabase CAPTCHA only applies to the anon key. The service role grant is how
    the app stays usable when Turnstile/Supabase CAPTCHA is misconfigured.
    """
    settings = get_settings()
    base = (settings.supabase_url or "").rstrip("/")
    service = settings.supabase_service_role_key or ""
    if not base or not service:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            f"{base}/auth/v1/token?grant_type=password",
            headers={
                "apikey": service,
                "Authorization": f"Bearer {service}",
                "Content-Type": "application/json",
            },
            json={"email": email, "password": password},
        )
    if r.status_code >= 400:
        detail = "Invalid email or password"
        try:
            payload = r.json()
            detail = payload.get("error_description") or payload.get("msg") or payload.get("error") or detail
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=str(detail))
    data = r.json()
    if not data.get("access_token") or not data.get("refresh_token"):
        raise HTTPException(status_code=502, detail="Auth service did not return a session")
    return data


@router.post("/sign-in")
async def sign_in_with_password(body: PasswordSignInBody):
    """Password sign-in that bypasses anon-key CAPTCHA (service role grant)."""
    return await _password_grant(str(body.email).strip().lower(), body.password)


@router.post("/sign-up")
async def sign_up_with_password(body: PasswordSignUpBody):
    """
    Create an account (admin API) then return a session via service-role password grant.
    Bypasses CAPTCHA misconfiguration on the new Supabase project.
    """
    if not body.terms_accepted:
        raise HTTPException(status_code=400, detail="Please agree to the Terms of Service to create an account.")
    settings = get_settings()
    supabase = get_supabase_admin()
    email = str(body.email).strip().lower()
    meta = {
        "terms_accepted": True,
        "marketing_opt_in": bool(body.marketing_opt_in),
        "intended_plan": body.intended_plan,
    }
    if body.full_name and body.full_name.strip():
        meta["full_name"] = body.full_name.strip()
    if body.phone and body.phone.strip():
        meta["phone"] = body.phone.strip()
    try:
        supabase.auth.admin.create_user(
            {
                "email": email,
                "password": body.password,
                "email_confirm": True,
                "user_metadata": meta,
            }
        )
    except Exception as exc:
        msg = str(exc).lower()
        if "already" in msg or "registered" in msg or "exists" in msg:
            raise HTTPException(status_code=400, detail="An account with this email already exists. Sign in instead.") from exc
        logger.exception("Admin create_user failed")
        raise HTTPException(status_code=400, detail="Could not create account. Please try again.") from exc
    try:
        return await _password_grant(email, body.password)
    except HTTPException:
        # Account exists; ask them to sign in if grant fails for any reason.
        raise HTTPException(
            status_code=400,
            detail="Account created, but automatic sign-in failed. Please sign in with your email and password.",
        )


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
        "promo_code": row.get("promo_code") or "",
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


async def maybe_sync_marketing_profile(
    supabase,
    row: dict | None,
    *,
    source: str = "signup",
    force: bool = False,
) -> dict | None:
    """Upsert account contact fields to Google Sheets (never payment / card data)."""
    if not row:
        return row
    # First sync always; later syncs when force=True (profile updates).
    if row.get("marketing_sheet_synced_at") and not force:
        return row

    synced = await upsert_account_row(
        user_id=str(row["id"]),
        email=row.get("email"),
        full_name=row.get("full_name"),
        phone=row.get("phone"),
        plan=row.get("plan") or "free",
        state=row.get("state"),
        brokerage=row.get("brokerage"),
        realtor_license=row.get("realtor_license"),
        marketing_opt_in=bool(row.get("marketing_opt_in")),
        account_status="Active",
        source=source,
        signed_up_at=row.get("created_at") or row.get("marketing_opt_in_at"),
        promo_code=row.get("promo_code"),
        promo_code_used=bool(row.get("promo_code")),
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
        row = await maybe_sync_marketing_profile(supabase, row, source="profile_update", force=True)
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
    row = await maybe_sync_marketing_profile(supabase, row, source="profile_update", force=True)
    return _profile_to_user(row)


@router.delete("/me", status_code=204)
async def delete_me(body: DeleteAccountBody, user_id: str = Depends(get_current_user_id)):
    """Permanently delete the signed-in account and first cancel web billing."""
    del body  # validation above requires an explicit destructive confirmation
    settings = get_settings()
    supabase = get_supabase_admin()
    profile_response = (
        supabase.table("profiles")
        .select("stripe_customer_id")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile = profile_response.data[0] if profile_response.data else {}
    stripe_customer_id = profile.get("stripe_customer_id")

    if stripe_customer_id:
        if not settings.stripe_secret_key:
            raise HTTPException(
                status_code=503,
                detail="Account deletion is temporarily unavailable while billing is being verified.",
            )
        try:
            stripe.api_key = settings.stripe_secret_key
            subscriptions = stripe.Subscription.list(
                customer=stripe_customer_id,
                status="all",
                limit=100,
            )
            cancellable = {"active", "trialing", "past_due", "unpaid", "paused"}
            for subscription in subscriptions.auto_paging_iter():
                if getattr(subscription, "status", None) in cancellable:
                    stripe.Subscription.cancel(subscription.id)
        except Exception as exc:
            logger.exception("Could not cancel Stripe subscriptions before account deletion")
            raise HTTPException(
                status_code=502,
                detail="We could not cancel web billing, so the account was not deleted. Please try again.",
            ) from exc

    if not await mark_account_cancelled(user_id):
        raise HTTPException(
            status_code=502,
            detail="We could not update account records, so the account was not deleted. Please try again.",
        )

    try:
        # This audit table intentionally has no auth foreign key, so remove it explicitly.
        supabase.table("iap_events").delete().eq("app_user_id", user_id).execute()
        supabase.auth.admin.delete_user(user_id)
    except Exception as exc:
        logger.exception("Supabase account deletion failed")
        raise HTTPException(
            status_code=502,
            detail="Account deletion failed. No further action is required; please try again.",
        ) from exc
    return Response(status_code=204)
