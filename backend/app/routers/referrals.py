"""Referral invite codes and claim/status APIs."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import get_settings
from app.dependencies import get_current_user_id
from app.referral_credits import (
    claim_referral_code,
    ensure_referral_invite,
    invite_url_for_code,
)
from app.supabase_client import get_supabase_admin

router = APIRouter(prefix="/referrals", tags=["referrals"])


class ClaimBody(BaseModel):
    code: str = Field(..., min_length=4, max_length=32)


@router.get("/me")
async def get_my_referral(user_id: str = Depends(get_current_user_id)):
    """Get or create this user's shareable referral link (available to free and paid)."""
    supabase = get_supabase_admin()
    invite = ensure_referral_invite(supabase, user_id)
    s = get_settings()
    code = invite["code"]
    redemptions = (
        supabase.table("referral_redemptions")
        .select("id, invitee_id, status, credit_applied_at, created_at, invitee_credit_cents, inviter_credit_cents")
        .eq("inviter_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {
        "code": code,
        "invite_url": invite_url_for_code(code, s),
        "created_at": invite.get("created_at"),
        "redemptions": redemptions.data or [],
        "reward_summary": (
            "When someone joins with your link and subscribes to Pro or Realtor, "
            "you both get credit equal to about one month of your paid plan "
            "(applied to the next invoice). Yearly plans: credit on the next renewal; "
            "cancel before then and unused credit is forfeited."
        ),
    }


@router.get("/validate")
async def validate_referral_code(code: str):
    """Public: check a referral code before signup."""
    raw = (code or "").strip()
    if len(raw) < 4:
        return {"valid": False}
    supabase = get_supabase_admin()
    r = (
        supabase.table("referral_invites")
        .select("code, inviter_id")
        .ilike("code", raw)
        .limit(1)
        .execute()
    )
    if not r.data:
        return {"valid": False, "reason": "not_found"}
    inviter_id = r.data[0]["inviter_id"]
    pr = (
        supabase.table("profiles")
        .select("full_name")
        .eq("id", inviter_id)
        .limit(1)
        .execute()
    )
    name = (pr.data[0].get("full_name") if pr.data else None) or None
    return {
        "valid": True,
        "code": r.data[0]["code"],
        "inviter": {"full_name": name} if name else {},
    }


@router.post("/claim")
async def claim_referral(body: ClaimBody, user_id: str = Depends(get_current_user_id)):
    """Call after signup when localStorage/URL has ref=CODE."""
    supabase = get_supabase_admin()
    result = claim_referral_code(supabase, invitee_id=user_id, code=body.code)
    if not result.get("ok"):
        reason = result.get("reason") or "claim_failed"
        if reason == "invalid_code":
            raise HTTPException(status_code=404, detail="Invalid referral code")
        if reason == "self_referral":
            raise HTTPException(status_code=400, detail="You cannot use your own referral link")
        raise HTTPException(status_code=400, detail=reason)
    return result
