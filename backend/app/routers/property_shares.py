"""Property shares: send to client for scoring, inbox, return scores, view tracking."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.activity_notify import notify_user
from app.dependencies import get_current_user_id, get_supabase_admin, require_realtor_plan

router = APIRouter(prefix="/shares", tags=["property-shares"])

# Display lifecycle: Sent → Viewed → Scored (maps pending_score/viewed/returned|scored)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_plan(supabase, user_id: str) -> str:
    r = supabase.table("profiles").select("plan").eq("id", user_id).execute()
    return (r.data[0] if r.data else {}).get("plan") or "free"


def _sanitize_url(raw: str | None) -> str | None:
    if not raw:
        return None
    s = raw.strip()
    if not s:
        return None
    if len(s) > 2000:
        raise HTTPException(status_code=400, detail="private_listing_url too long")
    parsed = urlparse(s)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=400, detail="private_listing_url must be http(s)")
    return s


def _extract_media(payload: dict) -> list[str]:
    urls: list[str] = []
    for key in ("image_url", "street_view_url", "primary_photo", "photo_url"):
        v = payload.get(key)
        if isinstance(v, str) and v.startswith("http"):
            urls.append(v)
    photos = payload.get("photos") or payload.get("images") or payload.get("media_urls")
    if isinstance(photos, list):
        for p in photos:
            if isinstance(p, str) and p.startswith("http"):
                urls.append(p)
            elif isinstance(p, dict):
                u = p.get("url") or p.get("href")
                if isinstance(u, str) and u.startswith("http"):
                    urls.append(u)
    # Dedupe preserve order
    seen = set()
    out = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out[:12]


def _display_status(row: dict) -> str:
    """User-facing lifecycle: Sent → Viewed → Scored."""
    status = (row.get("status") or "").strip()
    if status == "cancelled":
        return "Cancelled"
    if status in ("returned", "scored") or row.get("scored_at"):
        return "Scored"
    if status == "viewed" or row.get("viewed_at"):
        return "Viewed"
    return "Sent"


def _share_row(row: dict, extra: dict | None = None) -> dict:
    out = {
        "id": str(row["id"]),
        "from_user_id": str(row["from_user_id"]),
        "to_user_id": str(row["to_user_id"]),
        "property_payload": row.get("property_payload") or {},
        "media_urls": row.get("media_urls") or [],
        "private_listing_url": row.get("private_listing_url"),
        "message": row.get("message"),
        "status": row.get("status"),
        "display_status": _display_status(row),
        "scores": row.get("scores") or {},
        "viewed_at": row.get("viewed_at"),
        "scored_at": row.get("scored_at"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }
    if extra:
        out.update(extra)
    return out


def _profile_brief(supabase, uid: str) -> dict:
    r = (
        supabase.table("profiles")
        .select("id, full_name, email, username, license_verification_status, brokerage_name, brokerage, plan")
        .eq("id", uid)
        .limit(1)
        .execute()
    )
    p = r.data[0] if r.data else {}
    return {
        "id": str(p.get("id") or uid),
        "full_name": p.get("full_name"),
        "email": p.get("email"),
        "username": p.get("username"),
        "plan": p.get("plan") or "free",
        "license_verification_status": p.get("license_verification_status") or "self_reported",
        "brokerage_name": p.get("brokerage_name") or p.get("brokerage") or "",
    }


class SendShareBody(BaseModel):
    to_user_ids: list[str] = Field(..., min_length=1, max_length=20)
    property: dict[str, Any] = Field(default_factory=dict)
    message: str | None = Field(None, max_length=2000)
    private_listing_url: str | None = Field(None, max_length=2000)
    media_urls: list[str] | None = None


class ReturnScoresBody(BaseModel):
    scores: dict[str, Any] = Field(default_factory=dict)
    message: str | None = Field(None, max_length=2000)


@router.post("")
async def send_for_scoring(body: SendShareBody, user_id: str = Depends(require_realtor_plan)):
    """Realtor (+ admin) sends property to contact(s) for scoring."""
    supabase = get_supabase_admin()
    private_url = _sanitize_url(body.private_listing_url)
    payload = dict(body.property or {})
    media = body.media_urls if body.media_urls is not None else _extract_media(payload)
    media = [u for u in (media or []) if isinstance(u, str) and u.startswith("http")][:12]

    created = []
    for raw_to in body.to_user_ids:
        to_id = (raw_to or "").strip()
        if not to_id or to_id == user_id:
            continue
        # Prefer accepted contact; allow any registered user id if contact exists either way
        contact = (
            supabase.table("user_contacts")
            .select("id, status, contact_role")
            .eq("user_id", user_id)
            .eq("contact_user_id", to_id)
            .eq("status", "accepted")
            .limit(1)
            .execute()
        )
        if not contact.data:
            raise HTTPException(
                status_code=400,
                detail=f"Recipient {to_id} must be an accepted contact first",
            )
        ins = (
            supabase.table("property_shares")
            .insert(
                {
                    "from_user_id": user_id,
                    "to_user_id": to_id,
                    "property_payload": payload,
                    "media_urls": media,
                    "private_listing_url": private_url,
                    "message": (body.message or "").strip() or None,
                    "status": "pending_score",
                    "scores": {},
                    "updated_at": _now_iso(),
                }
            )
            .select()
            .execute()
        )
        if not ins.data:
            continue
        row = ins.data[0]
        addr = (
            payload.get("address")
            or payload.get("formattedAddress")
            or payload.get("property_address")
            or "a property"
        )
        await notify_user(
            to_id,
            kind="property_share",
            title="Home shared for scoring",
            body=f"Your realtor shared {addr} for you to score.",
            payload={
                "share_id": str(row["id"]),
                "path": "/SharedHomes",
                "has_private_listing": bool(private_url),
            },
            email=True,
        )
        created.append(_share_row(row, {"to_user": _profile_brief(supabase, to_id)}))

    if not created:
        raise HTTPException(status_code=400, detail="No shares created")
    return {"ok": True, "shares": created, "count": len(created)}


@router.get("/inbox")
async def shared_inbox(user_id: str = Depends(get_current_user_id)):
    """Homes sent to me for scoring (and recent returned)."""
    supabase = get_supabase_admin()
    r = (
        supabase.table("property_shares")
        .select("*")
        .eq("to_user_id", user_id)
        .in_("status", ["pending_score", "viewed", "scored", "returned"])
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    out = []
    for row in r.data or []:
        out.append(_share_row(row, {"from_user": _profile_brief(supabase, str(row["from_user_id"]))}))
    return out


@router.get("/sent")
async def sent_shares(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    plan = _user_plan(supabase, user_id)
    if plan not in ("realtor", "admin"):
        raise HTTPException(status_code=403, detail="Realtor plan required")
    r = (
        supabase.table("property_shares")
        .select("*")
        .eq("from_user_id", user_id)
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    out = []
    for row in r.data or []:
        out.append(_share_row(row, {"to_user": _profile_brief(supabase, str(row["to_user_id"]))}))
    return out


@router.get("/pending-count")
async def pending_count(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("property_shares")
        .select("id", count="exact")
        .eq("to_user_id", user_id)
        .in_("status", ["pending_score", "viewed"])
        .execute()
    )
    count = r.count if r.count is not None else len(r.data or [])
    return {"count": count}


def _payload_address(payload: dict) -> str:
    return (
        payload.get("address")
        or payload.get("formattedAddress")
        or payload.get("formatted_address")
        or payload.get("property_address")
        or "Unknown address"
    )


def _payload_price(payload: dict) -> float | int | None:
    for key in ("price", "list_price", "listPrice", "asking_price"):
        v = payload.get(key)
        if isinstance(v, (int, float)):
            return v
        if isinstance(v, str) and v.strip():
            try:
                return float(v.replace(",", "").replace("$", "").strip())
            except ValueError:
                continue
    return None


def _score_percentage(scores: Any) -> int | None:
    if not isinstance(scores, dict):
        return None
    for key in ("percentage", "overall_percentage", "score"):
        v = scores.get(key)
        if isinstance(v, (int, float)):
            return int(round(v))
        if isinstance(v, str) and v.strip():
            try:
                return int(round(float(v)))
            except ValueError:
                continue
    return None


@router.get("/client-report")
async def client_comparison_report(
    contact_user_id: str,
    user_id: str = Depends(require_realtor_plan),
):
    """
    All properties a contact scored and returned to this realtor (shared scorecards).
    Efficient: indexed filter on from_user_id + to_user_id + status.
    """
    contact_id = (contact_user_id or "").strip()
    if not contact_id:
        raise HTTPException(status_code=400, detail="contact_user_id required")
    if contact_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot report on yourself")

    supabase = get_supabase_admin()
    contact = (
        supabase.table("user_contacts")
        .select("id, status, contact_role, label")
        .eq("user_id", user_id)
        .eq("contact_user_id", contact_id)
        .eq("status", "accepted")
        .limit(1)
        .execute()
    )
    if not contact.data:
        raise HTTPException(
            status_code=404,
            detail="Contact not found — add them as an accepted contact first",
        )

    r = (
        supabase.table("property_shares")
        .select("*")
        .eq("from_user_id", user_id)
        .eq("to_user_id", contact_id)
        .in_("status", ["returned", "scored"])
        .order("updated_at", desc=True)
        .limit(200)
        .execute()
    )

    properties = []
    for row in r.data or []:
        payload = row.get("property_payload") or {}
        scores = row.get("scores") or {}
        if not isinstance(payload, dict):
            payload = {}
        if not isinstance(scores, dict):
            scores = {}
        properties.append(
            {
                "share_id": str(row["id"]),
                "address": _payload_address(payload),
                "price": _payload_price(payload),
                "score": _score_percentage(scores),
                "date_scored": row.get("scored_at") or row.get("updated_at") or row.get("created_at"),
                "status": row.get("status"),
                "display_status": _display_status(row),
                "message": scores.get("_client_note") or row.get("message"),
            }
        )

    properties.sort(
        key=lambda p: (
            p["score"] is None,
            -(p["score"] if p["score"] is not None else 0),
            p.get("date_scored") or "",
        ),
    )

    return {
        "ok": True,
        "client": _profile_brief(supabase, contact_id),
        "contact": {
            "id": str(contact.data[0]["id"]),
            "contact_role": contact.data[0].get("contact_role"),
            "label": contact.data[0].get("label"),
        },
        "properties": properties,
        "count": len(properties),
    }


@router.get("/{share_id}")
async def get_share(share_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = supabase.table("property_shares").select("*").eq("id", share_id).limit(1).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Share not found")
    row = r.data[0]
    if user_id not in (str(row["from_user_id"]), str(row["to_user_id"])):
        raise HTTPException(status_code=403, detail="Not a participant")
    return _share_row(
        row,
        {
            "from_user": _profile_brief(supabase, str(row["from_user_id"])),
            "to_user": _profile_brief(supabase, str(row["to_user_id"])),
        },
    )



@router.post("/{share_id}/view")
async def mark_viewed(share_id: str, user_id: str = Depends(get_current_user_id)):
    """Recipient opened the shared home (detail sheet or Evaluate). Idempotent."""
    supabase = get_supabase_admin()
    r = supabase.table("property_shares").select("*").eq("id", share_id).limit(1).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Share not found")
    row = r.data[0]
    if str(row["to_user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Only the recipient can mark viewed")
    if row.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Share was cancelled")

    if row.get("status") in ("returned", "scored") or row.get("scored_at"):
        return _share_row(row)
    if row.get("viewed_at") or row.get("status") == "viewed":
        return _share_row(row)

    now = _now_iso()
    upd = (
        supabase.table("property_shares")
        .update(
            {
                "viewed_at": now,
                "status": "viewed",
                "updated_at": now,
            }
        )
        .eq("id", share_id)
        .eq("status", "pending_score")
        .select()
        .execute()
    )
    if upd.data:
        return _share_row(upd.data[0])
    again = supabase.table("property_shares").select("*").eq("id", share_id).limit(1).execute()
    return _share_row(again.data[0] if again.data else row)


@router.post("/{share_id}/return")
async def return_scores(
    share_id: str,
    body: ReturnScoresBody,
    user_id: str = Depends(get_current_user_id),
):
    """Client sends scored results back to realtor."""
    supabase = get_supabase_admin()
    r = supabase.table("property_shares").select("*").eq("id", share_id).limit(1).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Share not found")
    row = r.data[0]
    if str(row["to_user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Only the recipient can return scores")
    if row.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Share was cancelled")

    scores = body.scores if isinstance(body.scores, dict) else {}
    note = (body.message or "").strip() or None
    payload = dict(row.get("property_payload") or {})
    if note:
        scores = {**scores, "_client_note": note}

    now = _now_iso()
    patch: dict[str, Any] = {
        "scores": scores,
        "status": "returned",
        "scored_at": now,
        "updated_at": now,
    }
    if not row.get("viewed_at"):
        patch["viewed_at"] = now

    upd = (
        supabase.table("property_shares")
        .update(patch)
        .eq("id", share_id)
        .select()
        .execute()
    )
    if not upd.data:
        raise HTTPException(status_code=500, detail="Could not update share")
    from_id = str(row["from_user_id"])
    addr = (
        payload.get("address")
        or payload.get("formattedAddress")
        or payload.get("property_address")
        or "a property"
    )
    await notify_user(
        from_id,
        kind="property_share_returned",
        title="Client scored a home",
        body=f"Scores came back for {addr}.",
        payload={"share_id": share_id, "path": "/SharedHomes?tab=sent"},
        email=True,
    )
    return _share_row(upd.data[0])


@router.post("/{share_id}/cancel")
async def cancel_share(share_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("property_shares")
        .update({"status": "cancelled", "updated_at": _now_iso()})
        .eq("id", share_id)
        .eq("from_user_id", user_id)
        .select()
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Share not found")
    return {"ok": True}
