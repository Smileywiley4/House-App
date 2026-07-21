"""In-app feedback / bug reports → store + email support@proppocket.com via Resend.

TODO(rebrand): support@proppocket.com inbox / DNS not migrated — keep until new support address is live.
"""
from __future__ import annotations

import base64
import logging
import os
import re
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from app.dependencies import get_optional_user_id, get_supabase_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/support", tags=["support"])

# TODO(rebrand): leave @proppocket.com until support inbox migrates
SUPPORT_INBOX = (os.environ.get("SUPPORT_EMAIL") or "").strip() or "support@proppocket.com"
MAX_MESSAGE_LEN = 8000
MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024  # 2 MB decoded
_DATA_URL_RE = re.compile(
    r"^data:(image/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$",
    re.IGNORECASE,
)


class FeedbackBody(BaseModel):
    category: Literal["problem", "feedback"] = "feedback"
    message: str = Field(..., min_length=1, max_length=MAX_MESSAGE_LEN)
    page_url: str | None = Field(None, max_length=2000)
    contact_email: str | None = Field(None, max_length=320)
    screenshot_base64: str | None = None

    @field_validator("message")
    @classmethod
    def strip_message(cls, v: str) -> str:
        text = (v or "").strip()
        if not text:
            raise ValueError("Message is required")
        return text

    @field_validator("contact_email")
    @classmethod
    def normalize_email(cls, v: str | None) -> str | None:
        if v is None:
            return None
        email = v.strip().lower()
        if not email:
            return None
        if "@" not in email or "." not in email.split("@")[-1]:
            raise ValueError("Enter a valid email address")
        return email

    @field_validator("page_url")
    @classmethod
    def strip_page_url(cls, v: str | None) -> str | None:
        if v is None:
            return None
        url = v.strip()
        return url[:2000] if url else None


def _parse_screenshot(raw: str | None) -> tuple[bytes | None, str | None]:
    """Return (bytes, content_type) or (None, None). Raises HTTPException on bad input."""
    if not raw:
        return None, None
    text = raw.strip()
    if not text:
        return None, None
    content_type = "image/png"
    b64 = text
    m = _DATA_URL_RE.match(text)
    if m:
        content_type = m.group(1).lower()
        if content_type == "image/jpg":
            content_type = "image/jpeg"
        b64 = m.group(2)
    elif text.startswith("data:"):
        raise HTTPException(status_code=400, detail="Screenshot must be a PNG, JPEG, WebP, or GIF image.")
    try:
        data = base64.b64decode(b64, validate=False)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid screenshot encoding.") from None
    if len(data) > MAX_SCREENSHOT_BYTES:
        raise HTTPException(status_code=400, detail="Screenshot must be under 2 MB.")
    if len(data) < 32:
        raise HTTPException(status_code=400, detail="Screenshot file looks empty or corrupt.")
    return data, content_type


async def _send_support_email(
    *,
    category: str,
    message: str,
    page_url: str | None,
    user_id: str | None,
    user_email: str | None,
    contact_email: str | None,
    user_agent: str | None,
    screenshot: bytes | None,
    screenshot_type: str | None,
    row_id: str | None,
) -> bool:
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key:
        logger.warning("RESEND_API_KEY not set; feedback stored but not emailed")
        return False
    from_addr = (
        (os.environ.get("RESEND_FROM_EMAIL") or "").strip()
        or "Propurty <onboarding@resend.dev>"
    )
    kind = "Bug report" if category == "problem" else "Feedback"
    reply_to = contact_email or user_email
    lines = [
        f"Category: {kind}",
        f"Page: {page_url or '(unknown)'}",
        f"User ID: {user_id or '(guest)'}",
        f"Account email: {user_email or '(none)'}",
        f"Contact email: {contact_email or '(none)'}",
        f"User-Agent: {user_agent or '(none)'}",
        f"Feedback ID: {row_id or '(none)'}",
        "",
        message,
    ]
    payload: dict = {
        "from": from_addr,
        "to": [SUPPORT_INBOX],
        "subject": f"[Propurty] {kind}",
        "text": "\n".join(lines),
    }
    if reply_to:
        payload["reply_to"] = reply_to
    if screenshot and screenshot_type:
        ext = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp",
            "image/gif": "gif",
        }.get(screenshot_type, "bin")
        payload["attachments"] = [
            {
                "filename": f"screenshot.{ext}",
                "content": base64.b64encode(screenshot).decode("ascii"),
                "content_type": screenshot_type,
            }
        ]
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
        if r.status_code >= 300:
            logger.warning("Resend feedback email failed: %s %s", r.status_code, r.text[:300])
            return False
        return True
    except Exception:
        logger.warning("Resend feedback email exception", exc_info=True)
        return False


@router.post("/feedback")
async def submit_feedback(
    body: FeedbackBody,
    request: Request,
    user_id: str | None = Depends(get_optional_user_id),
):
    """Accept bug reports / feedback. Auth optional; includes user id/email when logged in."""
    screenshot, screenshot_type = _parse_screenshot(body.screenshot_base64)
    user_agent = (request.headers.get("user-agent") or "")[:500] or None

    user_email: str | None = None
    if user_id:
        try:
            supabase = get_supabase_admin()
            r = (
                supabase.table("profiles")
                .select("email")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            user_email = ((r.data or [{}])[0].get("email") or "").strip() or None
        except Exception:
            logger.warning("Could not load profile email for feedback user %s", user_id, exc_info=True)

    if not user_id and not body.contact_email:
        # Guests can still submit; reply path is weaker without email
        pass

    row_id: str | None = None
    stored = False
    try:
        supabase = get_supabase_admin()
        ins = (
            supabase.table("support_feedback")
            .insert(
                {
                    "category": body.category,
                    "message": body.message,
                    "page_url": body.page_url,
                    "user_id": user_id,
                    "user_email": user_email,
                    "contact_email": body.contact_email,
                    "user_agent": user_agent,
                    "has_screenshot": bool(screenshot),
                    "email_sent": False,
                }
            )
            .select("id")
            .execute()
        )
        if ins.data:
            row_id = ins.data[0].get("id")
            stored = True
    except Exception:
        logger.warning("support_feedback insert failed (migration applied?)", exc_info=True)

    emailed = await _send_support_email(
        category=body.category,
        message=body.message,
        page_url=body.page_url,
        user_id=user_id,
        user_email=user_email,
        contact_email=body.contact_email,
        user_agent=user_agent,
        screenshot=screenshot,
        screenshot_type=screenshot_type,
        row_id=row_id,
    )

    if emailed and row_id:
        try:
            get_supabase_admin().table("support_feedback").update({"email_sent": True}).eq(
                "id", row_id
            ).execute()
        except Exception:
            pass

    if not stored and not emailed:
        raise HTTPException(
            status_code=503,
            detail="Could not submit feedback right now. Please email support@proppocket.com.",
        )

    return {
        "ok": True,
        "id": row_id,
        "emailed": emailed,
        "stored": stored,
    }
