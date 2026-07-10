"""Realtor → client property assignments for gamified walk-through."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_supabase_admin, require_paid_plan, require_realtor_plan

router = APIRouter(prefix="/realtor", tags=["realtor-assignments"])


class AssignPropertyBody(BaseModel):
    client_user_id: str | None = None
    client_id: str | None = None
    client_email: str | None = None
    property_address: str
    property_snapshot: dict = {}
    message: str | None = None


@router.post("/assignments")
async def assign_property(body: AssignPropertyBody, user_id: str = Depends(require_realtor_plan)):
    supabase = get_supabase_admin()
    address = (body.property_address or "").strip()
    if not address:
        raise HTTPException(status_code=400, detail="property_address required")

    client_user_id = body.client_user_id
    client_id = body.client_id

    if not client_user_id and body.client_email:
        cr = (
            supabase.table("clients")
            .select("id, client_user_id, email")
            .eq("user_id", user_id)
            .ilike("email", body.client_email.strip())
            .limit(1)
            .execute()
        )
        if cr.data:
            client_id = cr.data[0]["id"]
            client_user_id = cr.data[0].get("client_user_id")

    if not client_user_id and client_id:
        cr = supabase.table("clients").select("client_user_id").eq("id", client_id).eq("user_id", user_id).execute()
        if cr.data:
            client_user_id = cr.data[0].get("client_user_id")

    if not client_user_id:
        raise HTTPException(
            status_code=400,
            detail="Client must have a linked app account (client_user_id). Invite them to register first.",
        )

    ins = (
        supabase.table("realtor_property_assignments")
        .insert(
            {
                "realtor_id": user_id,
                "client_user_id": client_user_id,
                "client_id": client_id,
                "property_address": address,
                "property_snapshot": body.property_snapshot or {},
                "message": body.message,
            }
        )
        .execute()
    )
    row = ins.data[0] if ins.data else None
    if not row:
        raise HTTPException(status_code=500, detail="Could not create assignment")
    return row


@router.get("/assignments/sent")
async def list_sent_assignments(user_id: str = Depends(require_realtor_plan)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("realtor_property_assignments")
        .select("*")
        .eq("realtor_id", user_id)
        .order("assigned_at", desc=True)
        .limit(50)
        .execute()
    )
    return r.data or []


@router.get("/assignments/inbox")
async def client_assignment_inbox(user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("realtor_property_assignments")
        .select("*")
        .eq("client_user_id", user_id)
        .in_("status", ["pending", "in_progress"])
        .order("assigned_at", desc=True)
        .execute()
    )
    return r.data or []


@router.patch("/assignments/{assignment_id}/read")
async def mark_assignment_read(assignment_id: str, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    supabase.table("realtor_property_assignments").update(
        {"read_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", assignment_id).eq("client_user_id", user_id).execute()
    return {"ok": True}
