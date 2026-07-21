"""Promo / access code redemption."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user_id, get_supabase_admin
from app.google_sheets_marketing import upsert_account_row
from app.google_sheets_promo import (
    find_promo_code,
    increment_promo_code_uses,
    resolve_granted_plan,
)
from app.routers.auth import _profile_to_user

router = APIRouter(prefix="/promo", tags=["promo"])
logger = logging.getLogger(__name__)


class RedeemPromoBody(BaseModel):
    code: str = Field(..., min_length=2, max_length=64)
    # When the code grants "any" plan, client may request premium or realtor.
    plan_id: str | None = Field(default="premium", max_length=32)


@router.post("/redeem")
async def redeem_promo(body: RedeemPromoBody, user_id: str = Depends(get_current_user_id)):
    code = (body.code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Enter a promo code.")

    promo, row_number = await find_promo_code(code)
    if not promo:
        raise HTTPException(status_code=404, detail="That code is not valid.")

    if promo["status"] not in {"active", "enabled", "on"}:
        raise HTTPException(status_code=400, detail="That code is inactive.")

    if promo["max_uses"] is not None and promo["times_used"] >= promo["max_uses"]:
        raise HTTPException(status_code=400, detail="That code has reached its usage limit.")

    granted = resolve_granted_plan(promo, body.plan_id)
    if not granted:
        # 100% discount codes grant the requested paid plan without Stripe.
        discount = promo.get("discount_percent")
        if discount is not None and float(discount) >= 100:
            requested = (body.plan_id or "premium").strip().lower()
            granted = requested if requested in {"premium", "realtor"} else "premium"
        elif (promo.get("benefit") or "").startswith("discount"):
            raise HTTPException(
                status_code=400,
                detail="This discount code is not available for one-click apply yet. Use it at Stripe Checkout, or contact support.",
            )
        else:
            raise HTTPException(status_code=400, detail="This code cannot grant access.")

    # Perpetual comps: ADMIN and other 100% free_access grants never expire via billing webhooks.
    discount = promo.get("discount_percent")
    is_perpetual_comp = (
        code == "ADMIN"
        or (promo.get("benefit") or "") in {"free_access", "free", "grant_plan"}
        or (discount is not None and float(discount) >= 100)
    )

    supabase = get_supabase_admin()
    existing = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    row = existing.data[0] if existing.data else None
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found.")

    previous_code = (row.get("promo_code") or "").strip().upper()
    if previous_code == code and (row.get("plan") or "free") == granted and (
        not is_perpetual_comp or bool(row.get("admin_comp"))
    ):
        return {
            "ok": True,
            "already_applied": True,
            "plan": granted,
            "code": code,
            "admin_comp": bool(row.get("admin_comp")),
            "profile": _profile_to_user(row),
        }

    now = datetime.now(timezone.utc).isoformat()
    updates = {
        "plan": granted,
        "promo_code": code,
        "promo_code_redeemed_at": now,
        "updated_at": now,
    }
    if is_perpetual_comp:
        updates["admin_comp"] = True
    try:
        supabase.table("profiles").update(updates).eq("id", user_id).execute()
    except Exception as exc:
        # Older DBs may lack admin_comp until migration is applied.
        if is_perpetual_comp and "admin_comp" in updates:
            logger.warning("admin_comp update failed (migration pending?): %s", exc)
            updates.pop("admin_comp", None)
            supabase.table("profiles").update(updates).eq("id", user_id).execute()
        else:
            raise
    refreshed = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    row = refreshed.data[0] if refreshed.data else {**row, **updates}

    if row_number:
        await increment_promo_code_uses(row_number, promo["times_used"])

    # Force Accounts sheet update with promo columns + new plan.
    await upsert_account_row(
        user_id=str(row["id"]),
        email=row.get("email"),
        full_name=row.get("full_name"),
        phone=row.get("phone"),
        plan=row.get("plan") or granted,
        state=row.get("state"),
        brokerage=row.get("brokerage"),
        realtor_license=row.get("realtor_license"),
        marketing_opt_in=bool(row.get("marketing_opt_in")),
        account_status="Active",
        source="promo_redeem",
        signed_up_at=row.get("created_at"),
        promo_code=code,
        promo_code_used=True,
    )
    row["marketing_sheet_synced_at"] = now
    try:
        supabase.table("profiles").update({"marketing_sheet_synced_at": now}).eq("id", user_id).execute()
    except Exception:
        pass

    logger.info(
        "Promo %s redeemed by user %s → plan %s (admin_comp=%s)",
        code,
        user_id,
        granted,
        is_perpetual_comp,
    )
    perpetual_note = " Access does not expire." if is_perpetual_comp else ""
    return {
        "ok": True,
        "already_applied": False,
        "plan": granted,
        "code": code,
        "admin_comp": is_perpetual_comp,
        "message": f"Code applied. Your plan is now {granted.title()}.{perpetual_note}",
        "profile": _profile_to_user(row),
    }
