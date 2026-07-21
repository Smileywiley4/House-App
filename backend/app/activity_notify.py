"""In-app activity notifications (+ optional Resend email). Push deferred."""
from __future__ import annotations

import logging
import os
from typing import Any

import httpx

from app.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

# future: gamify mobile share/score loop + real FCM/web-push delivery


def create_notification(
    user_id: str,
    *,
    kind: str,
    title: str,
    body: str | None = None,
    payload: dict[str, Any] | None = None,
) -> dict | None:
    """Insert an in-app notification. Returns row or None on failure."""
    supabase = get_supabase_admin()
    try:
        ins = (
            supabase.table("user_notifications")
            .insert(
                {
                    "user_id": user_id,
                    "kind": kind,
                    "title": title,
                    "body": body,
                    "payload": payload or {},
                }
            )
            .select()
            .execute()
        )
        return ins.data[0] if ins.data else None
    except Exception:
        logger.warning("create_notification failed for %s kind=%s", user_id, kind, exc_info=True)
        return None


async def maybe_email_user(user_id: str, title: str, body: str) -> bool:
    """Send via Resend when configured; never raises."""
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key:
        return False
    supabase = get_supabase_admin()
    try:
        r = supabase.table("profiles").select("email").eq("id", user_id).limit(1).execute()
        to_email = ((r.data or [{}])[0].get("email") or "").strip()
    except Exception:
        return False
    if not to_email:
        return False
    from_addr = (os.environ.get("RESEND_FROM_EMAIL") or "").strip() or "Property Pocket <onboarding@resend.dev>"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"from": from_addr, "to": [to_email], "subject": title, "text": body},
            )
            return resp.status_code < 300
    except Exception:
        logger.warning("activity email failed", exc_info=True)
        return False


async def notify_user(
    user_id: str,
    *,
    kind: str,
    title: str,
    body: str | None = None,
    payload: dict[str, Any] | None = None,
    email: bool = False,
) -> None:
    create_notification(user_id, kind=kind, title=title, body=body, payload=payload)
    if email and body:
        await maybe_email_user(user_id, title, body)
