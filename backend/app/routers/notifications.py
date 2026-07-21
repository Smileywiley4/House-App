"""Browse preference memory, listing alerts, and in-app notifications."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user_id, get_supabase_admin
from app.listing_alerts import format_filter_summary, record_browse_preference

router = APIRouter(tags=["browse-prefs-alerts"])


# ---------------------------------------------------------------------------
# Preference memory
# ---------------------------------------------------------------------------

class RememberFiltersBody(BaseModel):
    filters: dict = Field(default_factory=dict)


@router.post("/browse-prefs/remember")
async def remember_browse_filters(
    body: RememberFiltersBody,
    user_id: str = Depends(get_current_user_id),
):
    """Debounced client call after logged-in browse with non-empty filters."""
    record_browse_preference(user_id, body.filters or {})
    return {"ok": True}


@router.get("/browse-prefs/suggested")
async def suggested_browse_presets(
    user_id: str = Depends(get_current_user_id),
    limit: int = 5,
):
    """Frequent filter combos surfaced as suggested presets."""
    supabase = get_supabase_admin()
    lim = max(1, min(int(limit or 5), 12))
    try:
        r = (
            supabase.table("user_browse_preference_memory")
            .select("*")
            .eq("user_id", user_id)
            .gte("use_count", 2)
            .order("use_count", desc=True)
            .order("last_used_at", desc=True)
            .limit(lim)
            .execute()
        )
        rows = r.data or []
    except Exception:
        rows = []
    suggestions = []
    for row in rows:
        filters = row.get("filters") or {}
        name = format_filter_summary(filters) or "Frequent search"
        suggestions.append(
            {
                "id": row.get("id"),
                "name": name,
                "filters": filters,
                "use_count": row.get("use_count"),
                "last_used_at": row.get("last_used_at"),
                "suggested": True,
            }
        )
    return {"suggestions": suggestions}


@router.get("/browse-prefs/list")
async def list_browse_presets(
    user_id: str = Depends(get_current_user_id),
    client_id: str | None = None,
    limit: int = 20,
):
    """
    Unified presets for Browse + SearchByPreset:
    saved `user_presets` plus soft-learned `user_browse_preference_memory` rows.
    """
    supabase = get_supabase_admin()
    lim = max(1, min(int(limit or 20), 40))

    # Saved presets (same table/query as /api/entities/presets)
    try:
        q = supabase.table("user_presets").select("*").eq("user_id", user_id)
        if client_id:
            q = q.eq("client_id", client_id)
        else:
            q = q.is_("client_id", "null")
        saved_rows = q.order("created_at", desc=True).limit(lim).execute().data or []
    except Exception:
        saved_rows = []

    presets = []
    for row in saved_rows:
        filters = row.get("filters") or {}
        name = (row.get("name") or "").strip() or format_filter_summary(filters) or "Saved search"
        presets.append(
            {
                "id": row.get("id"),
                "name": name,
                "filters": filters,
                "weights": row.get("weights") or {},
                "client_id": row.get("client_id"),
                "created_at": row.get("created_at"),
                "kind": "preset",
                "suggested": False,
            }
        )

    # Soft-learned suggestions (skip when listing a realtor client's presets)
    suggestions: list[dict] = []
    if not client_id:
        try:
            r = (
                supabase.table("user_browse_preference_memory")
                .select("*")
                .eq("user_id", user_id)
                .gte("use_count", 2)
                .order("use_count", desc=True)
                .order("last_used_at", desc=True)
                .limit(min(lim, 12))
                .execute()
            )
            mem_rows = r.data or []
        except Exception:
            mem_rows = []
        for row in mem_rows:
            filters = row.get("filters") or {}
            suggestions.append(
                {
                    "id": row.get("id"),
                    "name": format_filter_summary(filters) or "Frequent search",
                    "filters": filters,
                    "use_count": row.get("use_count"),
                    "last_used_at": row.get("last_used_at"),
                    "kind": "suggested",
                    "suggested": True,
                }
            )

    return {
        "presets": presets,
        "suggestions": suggestions,
        # Flat list for simple clients (suggestions first, then saved)
        "items": suggestions + presets,
    }


# ---------------------------------------------------------------------------
# Listing alert subscriptions
# ---------------------------------------------------------------------------

class AlertCreateBody(BaseModel):
    name: str = "Match alert"
    criteria: dict = Field(default_factory=dict)
    email_enabled: bool = False


class AlertUpdateBody(BaseModel):
    name: str | None = None
    criteria: dict | None = None
    enabled: bool | None = None
    email_enabled: bool | None = None


@router.get("/listing-alerts")
async def list_alerts(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("listing_alert_subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return r.data or []


@router.post("/listing-alerts")
async def create_alert(body: AlertCreateBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    criteria = body.criteria or {}
    if not criteria.get("filters") and not criteria.get("city") and not (
        criteria.get("latitude") is not None and criteria.get("longitude") is not None
    ):
        raise HTTPException(status_code=400, detail="Alert criteria need a place or filters.")
    row = {
        "user_id": user_id,
        "name": (body.name or "Match alert").strip()[:120],
        "criteria": criteria,
        "email_enabled": bool(body.email_enabled),
        "enabled": True,
    }
    r = supabase.table("listing_alert_subscriptions").insert(row).select().execute()
    return r.data[0] if r.data else None


@router.patch("/listing-alerts/{alert_id}")
async def update_alert(
    alert_id: str,
    body: AlertUpdateBody,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase_admin()
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.name is not None:
        updates["name"] = body.name.strip()[:120]
    if body.criteria is not None:
        updates["criteria"] = body.criteria
    if body.enabled is not None:
        updates["enabled"] = body.enabled
    if body.email_enabled is not None:
        updates["email_enabled"] = body.email_enabled
    r = (
        supabase.table("listing_alert_subscriptions")
        .update(updates)
        .eq("id", alert_id)
        .eq("user_id", user_id)
        .select()
        .execute()
    )
    return r.data[0] if r.data else None


@router.delete("/listing-alerts/{alert_id}")
async def delete_alert(alert_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    supabase.table("listing_alert_subscriptions").delete().eq("id", alert_id).eq("user_id", user_id).execute()
    return {"ok": True}


# ---------------------------------------------------------------------------
# In-app notifications
# ---------------------------------------------------------------------------

@router.get("/notifications")
async def list_notifications(
    user_id: str = Depends(get_current_user_id),
    unread_only: bool = False,
    limit: int = 30,
):
    supabase = get_supabase_admin()
    lim = max(1, min(int(limit or 30), 100))
    q = supabase.table("user_notifications").select("*").eq("user_id", user_id)
    if unread_only:
        q = q.is_("read_at", "null")
    r = q.order("created_at", desc=True).limit(lim).execute()
    return r.data or []


@router.get("/notifications/unread-count")
async def unread_count(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    try:
        r = (
            supabase.table("user_notifications")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .is_("read_at", "null")
            .execute()
        )
        return {"count": int(r.count or 0)}
    except Exception:
        return {"count": 0}


@router.post("/notifications/{notification_id}/read")
async def mark_read(notification_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    r = (
        supabase.table("user_notifications")
        .update({"read_at": now})
        .eq("id", notification_id)
        .eq("user_id", user_id)
        .select()
        .execute()
    )
    return r.data[0] if r.data else None


@router.post("/notifications/read-all")
async def mark_all_read(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("user_notifications").update({"read_at": now}).eq("user_id", user_id).is_(
        "read_at", "null"
    ).execute()
    return {"ok": True}
