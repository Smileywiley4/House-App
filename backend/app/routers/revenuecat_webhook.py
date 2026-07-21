"""RevenueCat webhooks -> sync Apple IAP entitlements to profiles.plan."""
from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request

from app.config import get_settings
from app.dependencies import get_supabase_admin

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _plan_from_entitlements(entitlement_ids: list[str]) -> str | None:
    s = get_settings()
    ent_set = {e for e in entitlement_ids if e}
    if s.revenuecat_realtor_entitlement_id in ent_set:
        return "realtor"
    if s.revenuecat_premium_entitlement_id in ent_set:
        return "premium"
    return None


def _profile_user_id(event: dict) -> str | None:
    aliases = event.get("aliases") or []
    if not isinstance(aliases, list):
        aliases = [aliases]
    candidates = [
        event.get("app_user_id"),
        event.get("original_app_user_id"),
        *aliases,
    ]
    for candidate in candidates:
        value = str(candidate or "").strip()
        try:
            return str(UUID(value))
        except ValueError:
            continue
    return None


@router.post("/revenuecat")
async def revenuecat_webhook(request: Request):
    s = get_settings()
    if not s.revenuecat_webhook_secret:
        raise HTTPException(status_code=503, detail="RevenueCat webhook is not configured")

    auth = request.headers.get("authorization", "")
    if auth != f"Bearer {s.revenuecat_webhook_secret}":
        raise HTTPException(status_code=401, detail="Invalid RevenueCat webhook secret")

    payload = await request.json()
    event = payload.get("event") or payload
    if not isinstance(event, dict):
        raise HTTPException(status_code=400, detail="Invalid event payload")

    app_user_id = _profile_user_id(event)
    if not app_user_id:
        raise HTTPException(status_code=400, detail="No linked account user ID in RevenueCat event")

    entitlements = event.get("entitlement_ids") or []
    if isinstance(entitlements, str):
        entitlements = [entitlements]
    entitlements = [str(x).strip() for x in entitlements if str(x).strip()]

    event_type = str(event.get("type") or "").upper()
    event_id = str(event.get("id") or "").strip() or None
    target_plan = _plan_from_entitlements(entitlements)

    supabase = get_supabase_admin()
    if event_id:
        try:
            duplicate = (
                supabase.table("iap_events")
                .select("id")
                .eq("provider", "revenuecat")
                .eq("event_id", event_id)
                .limit(1)
                .execute()
            )
            if duplicate.data:
                return {"ok": True, "duplicate": True}
        except Exception:
            # Migration may not have reached every environment yet.
            pass

    # best-effort event log for audit/debug
    try:
        event_row = {
            "provider": "revenuecat",
            "app_user_id": app_user_id,
            "event_type": event_type,
            "entitlement_ids": entitlements,
            "raw_event": event,
        }
        if event_id:
            event_row["event_id"] = event_id
        supabase.table("iap_events").insert(event_row).execute()
    except Exception:
        pass

    # Cancellation and billing-issue events can retain paid access through the
    # current period or grace period. Revoke only when RevenueCat confirms expiry.
    # Perpetual ADMIN/testing comps (admin_comp) must not be revoked by IAP expiry.
    if event_type == "EXPIRATION":
        try:
            existing = (
                supabase.table("profiles")
                .select("admin_comp, plan")
                .eq("id", app_user_id)
                .limit(1)
                .execute()
            )
            row = (existing.data or [None])[0]
            if row and row.get("admin_comp"):
                return {"ok": True, "plan": row.get("plan"), "admin_comp_preserved": True}
        except Exception:
            pass
        supabase.table("profiles").update({"plan": "free"}).eq("id", app_user_id).execute()
        return {"ok": True, "plan": "free"}

    if target_plan:
        supabase.table("profiles").update({"plan": target_plan}).eq("id", app_user_id).execute()
        return {"ok": True, "plan": target_plan}

    return {"ok": True, "plan": None}
