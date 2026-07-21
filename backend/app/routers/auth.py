"""Auth routes: me, update_me, password sign-in, email-code signup. Most require valid Supabase JWT."""
from datetime import datetime, timezone
import logging
import time
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field
import stripe

from app.config import get_settings
from app.dependencies import get_supabase_admin, get_current_user_id
from app.google_sheets_marketing import mark_account_cancelled, upsert_account_row
from app.account_deletion import collect_export_payload, run_account_deletion
from app.signup_challenge import (
    SIGNUP_CODE_TTL_SEC,
    SIGNUP_RESEND_COOLDOWN_SEC,
    generate_six_digit_code,
    hash_signup_code,
    mint_signup_challenge,
    read_signup_challenge,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


class UpdateProfileBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str | None = Field(default=None, max_length=200)
    default_weights: dict | None = None
    realtor_license: str | None = Field(default=None, max_length=100)
    brokerage: str | None = Field(default=None, max_length=200)
    state: str | None = Field(default=None, max_length=100)
    license_number: str | None = Field(default=None, max_length=100)
    license_state: str | None = Field(default=None, max_length=2)
    brokerage_name: str | None = Field(default=None, max_length=200)
    linked_realtor_id: str | None = None
    phone: str | None = Field(default=None, max_length=50)
    marketing_opt_in: bool | None = None
    preset_digest_opt_in: bool | None = None
    avatar_url: str | None = Field(default=None, max_length=2000)
    has_seen_onboarding_quiz: bool | None = None
    has_seen_client_priority_quiz: bool | None = None


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
    challenge_token: str | None = None


class SignupConfirmBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=8, max_length=200)
    code: str = Field(min_length=6, max_length=12)
    challenge_token: str


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


async def _find_user_by_email(email: str) -> dict[str, Any] | None:
    settings = get_settings()
    base = (settings.supabase_url or "").rstrip("/")
    service = settings.supabase_service_role_key or ""
    target = email.strip().lower()
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(
            f"{base}/auth/v1/admin/users",
            params={"page": 1, "per_page": 200},
            headers={"apikey": service, "Authorization": f"Bearer {service}"},
        )
    if r.status_code >= 400:
        return None
    users = (r.json() or {}).get("users") or []
    for user in users:
        if str(user.get("email") or "").lower() == target:
            return user
    return None


async def _send_resend_code(email: str, code: str) -> bool:
    import os

    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key:
        return False
    from_addr = (os.environ.get("RESEND_FROM_EMAIL") or "").strip() or "Propurty <onboarding@resend.dev>"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "from": from_addr,
                "to": [email],
                "subject": "Your Propurty confirmation code",
                "text": (
                    f"Your Propurty confirmation code is {code}.\n\n"
                    "It expires in 15 minutes. If you did not request this, you can ignore this email."
                ),
                "html": (
                    "<p>Your Propurty confirmation code is:</p>"
                    f'<p style="font-size:28px;letter-spacing:6px;font-weight:700">{code}</p>'
                    "<p>This code expires in <strong>15 minutes</strong>.</p>"
                    "<p>If you did not request this, you can ignore this email.</p>"
                ),
            },
        )
    return r.status_code < 300


@router.post("/sign-in")
async def sign_in_with_password(body: PasswordSignInBody):
    """Password sign-in that bypasses anon-key CAPTCHA (service role grant)."""
    return await _password_grant(str(body.email).strip().lower(), body.password)


@router.post("/signup-start")
async def signup_start(body: PasswordSignUpBody):
    """Send a 15-minute email confirmation code. Does not finish signup."""
    if not body.terms_accepted:
        raise HTTPException(status_code=400, detail="Please agree to the Terms of Service to create an account.")
    email = str(body.email).strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required.")

    prior = read_signup_challenge(body.challenge_token)
    if prior and prior.get("email") == email and prior.get("iat"):
        elapsed = time.time() - float(prior["iat"])
        if elapsed < SIGNUP_RESEND_COOLDOWN_SEC:
            wait = int(SIGNUP_RESEND_COOLDOWN_SEC - elapsed) + 1
            raise HTTPException(status_code=429, detail=f"Please wait {wait}s before requesting another code.")

    existing = await _find_user_by_email(email)
    if existing and existing.get("email_confirmed_at"):
        raise HTTPException(status_code=400, detail="An account with this email already exists. Sign in instead.")

    settings = get_settings()
    base = (settings.supabase_url or "").rstrip("/")
    service = settings.supabase_service_role_key or ""
    meta = {
        "terms_accepted": True,
        "marketing_opt_in": bool(body.marketing_opt_in),
        "intended_plan": body.intended_plan,
        "signup_pending": True,
    }
    if body.full_name and body.full_name.strip():
        meta["full_name"] = body.full_name.strip()
    if body.phone and body.phone.strip():
        meta["phone"] = body.phone.strip()

    now = int(time.time())
    expires_at = now + SIGNUP_CODE_TTL_SEC
    code = generate_six_digit_code()
    challenge: dict[str, Any] = {
        "email": email,
        "exp": expires_at,
        "iat": now,
        "intended_plan": body.intended_plan,
        "marketing_opt_in": bool(body.marketing_opt_in),
        "terms_accepted": True,
        "full_name": meta.get("full_name"),
        "phone": meta.get("phone"),
    }

    delivery = "resend"
    if await _send_resend_code(email, code):
        challenge["mode"] = "custom"
        challenge["code_hash"] = hash_signup_code(code, email)
        # Ensure unconfirmed auth user exists with this password.
        async with httpx.AsyncClient(timeout=30.0) as client:
            if existing:
                await client.put(
                    f"{base}/auth/v1/admin/users/{existing['id']}",
                    headers={"apikey": service, "Authorization": f"Bearer {service}", "Content-Type": "application/json"},
                    json={"password": body.password, "email_confirm": False, "user_metadata": meta},
                )
            else:
                await client.post(
                    f"{base}/auth/v1/admin/users",
                    headers={"apikey": service, "Authorization": f"Bearer {service}", "Content-Type": "application/json"},
                    json={"email": email, "password": body.password, "email_confirm": False, "user_metadata": meta},
                )
    else:
        delivery = "supabase"
        challenge["mode"] = "supabase_otp"
        async with httpx.AsyncClient(timeout=30.0) as client:
            if not existing:
                await client.post(
                    f"{base}/auth/v1/admin/users",
                    headers={"apikey": service, "Authorization": f"Bearer {service}", "Content-Type": "application/json"},
                    json={"email": email, "password": body.password, "email_confirm": False, "user_metadata": meta},
                )
            otp = await client.post(
                f"{base}/auth/v1/otp",
                headers={"apikey": service, "Authorization": f"Bearer {service}", "Content-Type": "application/json"},
                json={"email": email, "create_user": False, "data": meta},
            )
        if otp.status_code >= 400:
            detail = "Could not send confirmation email"
            try:
                detail = otp.json().get("msg") or detail
            except Exception:
                pass
            # Fallback: mint code via generate_link (no email send) only when debug enabled.
            import os
            if os.environ.get("SIGNUP_OTP_DEBUG") == "1":
                async with httpx.AsyncClient(timeout=30.0) as client:
                    link = await client.post(
                        f"{base}/auth/v1/admin/generate_link",
                        headers={
                            "apikey": service,
                            "Authorization": f"Bearer {service}",
                            "Content-Type": "application/json",
                        },
                        json={"type": "magiclink", "email": email},
                    )
                link_data = link.json() if link.status_code < 400 else {}
                debug_code = str(link_data.get("email_otp") or "")
                if debug_code:
                    challenge["mode"] = "custom"
                    challenge["code_hash"] = hash_signup_code(debug_code, email)
                    token = mint_signup_challenge(challenge)
                    return {
                        "email": email,
                        "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat(),
                        "expires_in": SIGNUP_CODE_TTL_SEC,
                        "challenge_token": token,
                        "delivery": "debug",
                        "debug_code": debug_code,
                    }
            raise HTTPException(status_code=429 if otp.status_code == 429 else 502, detail=str(detail))

    token = mint_signup_challenge(challenge)
    return {
        "email": email,
        "expires_at": datetime.fromtimestamp(expires_at, tz=timezone.utc).isoformat(),
        "expires_in": SIGNUP_CODE_TTL_SEC,
        "challenge_token": token,
        "delivery": delivery,
    }


@router.post("/signup-confirm")
async def signup_confirm(body: SignupConfirmBody):
    """Verify the email code and finish signup (session returned)."""
    challenge = read_signup_challenge(body.challenge_token)
    if not challenge:
        raise HTTPException(
            status_code=400,
            detail="This confirmation code has expired or is invalid. Please request a new code.",
        )
    email = str(body.email).strip().lower()
    if email != challenge.get("email"):
        raise HTTPException(status_code=400, detail="Email does not match this confirmation request.")
    code = str(body.code).strip()
    if not code.isdigit() or not (6 <= len(code) <= 12):
        raise HTTPException(status_code=400, detail="Enter the confirmation code from your email.")

    settings = get_settings()
    base = (settings.supabase_url or "").rstrip("/")
    service = settings.supabase_service_role_key or ""
    mode = challenge.get("mode") or "custom"

    if mode in ("custom", "supabase_debug"):
        if hash_signup_code(code, email) != challenge.get("code_hash"):
            raise HTTPException(status_code=400, detail="That confirmation code is incorrect. Please try again.")
    else:
        async with httpx.AsyncClient(timeout=30.0) as client:
            verify = await client.post(
                f"{base}/auth/v1/verify",
                headers={"apikey": service, "Authorization": f"Bearer {service}", "Content-Type": "application/json"},
                json={"type": "email", "email": email, "token": code},
            )
        if verify.status_code >= 400:
            detail = "That confirmation code is incorrect or expired."
            try:
                detail = verify.json().get("msg") or detail
            except Exception:
                pass
            raise HTTPException(status_code=400, detail=str(detail))

    user = await _find_user_by_email(email)
    if not user or not user.get("id"):
        raise HTTPException(status_code=400, detail="Signup session not found. Please start again.")

    meta = {
        "terms_accepted": True,
        "marketing_opt_in": bool(challenge.get("marketing_opt_in")),
        "intended_plan": challenge.get("intended_plan") or "free",
        "signup_pending": False,
    }
    if challenge.get("full_name"):
        meta["full_name"] = challenge["full_name"]
    if challenge.get("phone"):
        meta["phone"] = challenge["phone"]

    async with httpx.AsyncClient(timeout=30.0) as client:
        upd = await client.put(
            f"{base}/auth/v1/admin/users/{user['id']}",
            headers={"apikey": service, "Authorization": f"Bearer {service}", "Content-Type": "application/json"},
            json={"password": body.password, "email_confirm": True, "user_metadata": meta},
        )
    if upd.status_code >= 400:
        detail = "Could not finish signup. Please try again."
        try:
            detail = upd.json().get("msg") or detail
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=str(detail))

    return await _password_grant(email, body.password)


@router.post("/sign-up")
async def sign_up_legacy_removed():
    """Legacy instant signup removed — use signup-start + signup-confirm."""
    raise HTTPException(
        status_code=400,
        detail="Signup now requires email confirmation. Use /api/auth/signup-start then /api/auth/signup-confirm.",
    )


def _profile_to_user(row: dict | None) -> dict | None:
    if not row:
        return None
    license_number = (row.get("license_number") or row.get("realtor_license") or "") or ""
    brokerage_name = (row.get("brokerage_name") or row.get("brokerage") or "") or ""
    license_state = (row.get("license_state") or "") or ""
    out = {
        "id": str(row["id"]),
        "email": row.get("email"),
        "full_name": row.get("full_name"),
        "default_weights": row.get("default_weights") or {},
        "role": row.get("role") or "user",
        "plan": row.get("plan") or "free",
        "realtor_license": license_number,
        "license_number": license_number,
        "brokerage": brokerage_name,
        "brokerage_name": brokerage_name,
        "state": row.get("state") or "",
        "license_state": license_state,
        "license_verification_status": row.get("license_verification_status") or "self_reported",
        "license_verified_at": row.get("license_verified_at"),
        "license_verification_notes": row.get("license_verification_notes") or "",
        "linked_realtor_id": str(row["linked_realtor_id"]) if row.get("linked_realtor_id") else None,
        "phone": row.get("phone") or "",
        "marketing_opt_in": bool(row.get("marketing_opt_in")),
        "promo_code": row.get("promo_code") or "",
        "avatar_url": row.get("avatar_url") or "",
        "has_seen_onboarding_quiz": bool(row.get("has_seen_onboarding_quiz")),
        "has_seen_client_priority_quiz": bool(row.get("has_seen_client_priority_quiz")),
    }
    if "preset_digest_opt_in" in row or True:
        out["preset_digest_opt_in"] = bool(row.get("preset_digest_opt_in"))
    return out


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
    # Prefer live auth email (source of truth after email-change confirmation).
    auth_email = _auth_user_email(supabase, user_id)
    if auth_email and row and (row.get("email") or "").lower() != auth_email.lower():
        supabase.table("profiles").update({"email": auth_email}).eq("id", user_id).execute()
        row = {**row, "email": auth_email}
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

    if "avatar_url" in updates:
        avatar = (updates["avatar_url"] or "").strip()
        updates["avatar_url"] = avatar or None

    # Align license fields; never accept client-set verification via PATCH /me.
    if "license_number" in updates or "realtor_license" in updates:
        number = (updates.get("license_number") or updates.get("realtor_license") or "").strip()
        updates["license_number"] = number or None
        updates["realtor_license"] = number or None
    if "brokerage_name" in updates or "brokerage" in updates:
        brokerage = (updates.get("brokerage_name") or updates.get("brokerage") or "").strip()
        updates["brokerage_name"] = brokerage or None
        updates["brokerage"] = brokerage or None
    if "license_state" in updates and updates["license_state"] is not None:
        updates["license_state"] = (updates["license_state"] or "").strip().upper()[:2] or None
    if any(k in updates for k in ("license_number", "realtor_license", "license_state")):
        existing_row = existing.data[0] if existing.data else {}
        prev_num = (existing_row.get("license_number") or existing_row.get("realtor_license") or "")
        prev_state = (existing_row.get("license_state") or "")
        new_num = updates.get("license_number", prev_num) or ""
        new_state = updates.get("license_state", prev_state) or ""
        if new_num != prev_num or new_state != prev_state:
            updates["license_verification_status"] = "self_reported"
            updates["license_verified_at"] = None
            updates["license_verification_notes"] = None
            updates["license_verification_source"] = None

    supabase.table("profiles").update(updates).eq("id", user_id).execute()
    r = supabase.table("profiles").select("*").eq("id", user_id).execute()
    row = r.data[0] if r.data else None
    row = await maybe_sync_marketing_profile(supabase, row, source="profile_update", force=True)
    return _profile_to_user(row)


@router.get("/me/export")
async def export_me(user_id: str = Depends(get_current_user_id)):
    """Download a JSON snapshot of the signed-in user's primary account data."""
    supabase = get_supabase_admin()
    return collect_export_payload(supabase, user_id)


@router.delete("/me", status_code=204)
async def delete_me(body: DeleteAccountBody, user_id: str = Depends(get_current_user_id)):
    """
    Permanently delete the signed-in account:
    cancel Stripe immediately (no next-period charge), mark Sheets CRM Deleted,
    wipe storage, forfeit referrals, delete auth user (cascades personal data).
    """
    del body
    supabase = get_supabase_admin()
    await run_account_deletion(
        supabase,
        user_id,
        auth_email=_auth_user_email(supabase, user_id),
    )
    return Response(status_code=204)
