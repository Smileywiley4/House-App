"""RevenueCat webhooks -> sync Apple IAP entitlements to profiles.plan."""
from __future__ import annotations

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

    app_user_id = (event.get("app_user_id") or "").strip()
    if not app_user_id:
        raise HTTPException(status_code=400, detail="Missing app_user_id")

    entitlements = event.get("entitlement_ids") or []
    if isinstance(entitlements, str):
        entitlements = [entitlements]
    entitlements = [str(x).strip() for x in entitlements if str(x).strip()]

    event_type = str(event.get("type") or "").upper()
    target_plan = _plan_from_entitlements(entitlements)

    supabase = get_supabase_admin()
    # best-effort event log for audit/debug
    try:
        supabase.table("iap_events").insert(
            {
                "provider": "revenuecat",
                "app_user_id": app_user_id,
                "event_type": event_type,
                "entitlement_ids": entitlements,
                "raw_event": event,
            }
        ).execute()
    except Exception:
        pass

    if event_type in {"CANCELLATION", "EXPIRATION", "SUBSCRIPTION_PAUSED", "BILLING_ISSUE"}:
        supabase.table("profiles").update({"plan": "free"}).eq("id", app_user_id).execute()
        return {"ok": True, "plan": "free"}

    if target_plan:
        supabase.table("profiles").update({"plan": target_plan}).eq("id", app_user_id).execute()
        return {"ok": True, "plan": target_plan}

    return {"ok": True, "plan": None}
