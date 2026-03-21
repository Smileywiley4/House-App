"""Email invitations to join Property Pulse (premium)."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_current_user_id, require_paid_plan
from app.supabase_client import get_supabase_admin
from app.config import get_settings

router = APIRouter(prefix="/invitations", tags=["invitations"])

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class SendInvitesBody(BaseModel):
    emails: list[str] = Field(..., min_length=1, max_length=50)
    message: str | None = Field(None, max_length=2000)


class AcceptInviteBody(BaseModel):
    token: str = Field(..., min_length=10, max_length=80)


@router.post("")
async def send_invitations(body: SendInvitesBody, user_id: str = Depends(require_paid_plan)):
    """Create pending invites; returns shareable URLs with tokens."""
    supabase = get_supabase_admin()
    s = get_settings()
    base = (s.app_public_url or "http://localhost:5173").rstrip("/")
    out = []
    seen: set[str] = set()
    for raw in body.emails:
        email = (raw or "").strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        if not EMAIL_RE.match(email):
            continue
        tok = str(uuid.uuid4())
        row = {
            "inviter_id": user_id,
            "invitee_email": email,
            "token": tok,
            "personal_message": body.message,
            "status": "pending",
        }
        ins = supabase.table("app_invitations").insert(row).select().execute()
        if ins.data:
            out.append(
                {
                    "email": email,
                    "token": tok,
                    "invite_url": f"{base}/login?invite={tok}",
                }
            )
    return {"invites": out}


@router.get("/validate")
async def validate_invitation(token: str):
    """Public: check token before sign-in / sign-up."""
    if not token or len(token) < 10:
        return {"valid": False}
    supabase = get_supabase_admin()
    r = supabase.table("app_invitations").select("*").eq("token", token.strip()).execute()
    if not r.data:
        return {"valid": False, "reason": "not_found"}
    row = r.data[0]
    if row.get("status") != "pending":
        return {"valid": False, "reason": "already_used"}
    inviter_id = row["inviter_id"]
    pr = supabase.table("profiles").select("full_name, email").eq("id", inviter_id).execute()
    inviter = pr.data[0] if pr.data else {}
    return {
        "valid": True,
        "invitee_email": row.get("invitee_email"),
        "message": row.get("personal_message"),
        "inviter": {
            "full_name": inviter.get("full_name"),
            "email": inviter.get("email"),
        },
    }


@router.post("/accept")
async def accept_invitation(body: AcceptInviteBody, user_id: str = Depends(get_current_user_id)):
    """Call after login when profile email matches the invite."""
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("email").eq("id", user_id).execute()
    email = (r.data[0] if r.data else {}).get("email") or ""
    if not email:
        raise HTTPException(status_code=400, detail="Profile email not set")
    inv = supabase.table("app_invitations").select("*").eq("token", body.token.strip()).execute()
    if not inv.data:
        raise HTTPException(status_code=404, detail="Invalid invite")
    row = inv.data[0]
    if row.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Invite already used")
    if row["invitee_email"].lower().strip() != email.lower().strip():
        raise HTTPException(
            status_code=403,
            detail="Sign in with the email address this invitation was sent to",
        )
    supabase.table("app_invitations").update(
        {
            "status": "accepted",
            "accepted_at": _now_iso(),
            "accepted_user_id": user_id,
        }
    ).eq("id", row["id"]).execute()
    return {"ok": True}


@router.get("/sent")
async def list_sent_invitations(user_id: str = Depends(require_paid_plan)):
    """Invites you have created (pending + accepted)."""
    supabase = get_supabase_admin()
    r = (
        supabase.table("app_invitations")
        .select("id, invitee_email, status, created_at, accepted_at, token")
        .eq("inviter_id", user_id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    s = get_settings()
    base = (s.app_public_url or "http://localhost:5173").rstrip("/")
    out = []
    for row in r.data or []:
        tok = row.get("token")
        out.append(
            {
                "id": str(row["id"]),
                "invitee_email": row.get("invitee_email"),
                "status": row.get("status"),
                "created_at": row.get("created_at"),
                "accepted_at": row.get("accepted_at"),
                "invite_url": f"{base}/login?invite={tok}" if row.get("status") == "pending" and tok else None,
            }
        )
    return out
