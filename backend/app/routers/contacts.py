"""Contact book: search users, send/accept requests, list contacts."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.activity_notify import notify_user
from app.dependencies import get_current_user_id, get_supabase_admin

router = APIRouter(prefix="/contacts", tags=["contacts"])

CONTACT_ROLES = frozenset({"client", "realtor", "other"})


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _profile_public(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "full_name": row.get("full_name"),
        "email": row.get("email"),
        "username": row.get("username"),
        "plan": row.get("plan") or "free",
        "license_verification_status": row.get("license_verification_status") or "self_reported",
        "brokerage_name": row.get("brokerage_name") or row.get("brokerage") or "",
    }


def _contact_row(row: dict, other: dict | None = None) -> dict:
    out = {
        "id": str(row["id"]),
        "user_id": str(row["user_id"]),
        "contact_user_id": str(row["contact_user_id"]),
        "status": row.get("status"),
        "contact_role": row.get("contact_role"),
        "label": row.get("label"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }
    if other:
        out["contact"] = _profile_public(other)
    return out


class AddContactBody(BaseModel):
    contact_user_id: str | None = None
    email: str | None = None
    username: str | None = None
    contact_role: str | None = Field(None, max_length=20)
    label: str | None = Field(None, max_length=120)


class UpdateContactBody(BaseModel):
    contact_role: str | None = Field(None, max_length=20)
    label: str | None = Field(None, max_length=120)


@router.get("/search")
async def search_users(q: str = "", user_id: str = Depends(get_current_user_id)):
    """Find users by email, username, or name (logged-in only)."""
    supabase = get_supabase_admin()
    needle = (q or "").strip().lower()
    if len(needle) < 2:
        return []
    r = (
        supabase.table("profiles")
        .select("id, full_name, email, username, plan, license_verification_status, brokerage_name, brokerage")
        .limit(120)
        .execute()
    )
    out = []
    for x in r.data or []:
        if str(x["id"]) == user_id:
            continue
        hay = " ".join(
            [
                (x.get("full_name") or "").lower(),
                (x.get("email") or "").lower(),
                (x.get("username") or "").lower(),
            ]
        )
        if needle in hay:
            out.append(_profile_public(x))
        if len(out) >= 25:
            break
    return out


@router.get("")
async def list_contacts(user_id: str = Depends(get_current_user_id)):
    """Accepted contacts + outgoing pending you initiated."""
    supabase = get_supabase_admin()
    outgoing = (
        supabase.table("user_contacts")
        .select("*")
        .eq("user_id", user_id)
        .in_("status", ["pending", "accepted"])
        .order("updated_at", desc=True)
        .execute()
    )
    incoming = (
        supabase.table("user_contacts")
        .select("*")
        .eq("contact_user_id", user_id)
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    ids = set()
    for row in (outgoing.data or []) + (incoming.data or []):
        ids.add(str(row["user_id"]))
        ids.add(str(row["contact_user_id"]))
    ids.discard(user_id)
    profiles: dict[str, dict] = {}
    if ids:
        pr = (
            supabase.table("profiles")
            .select("id, full_name, email, username, plan, license_verification_status, brokerage_name, brokerage")
            .in_("id", list(ids))
            .execute()
        )
        for p in pr.data or []:
            profiles[str(p["id"])] = p

    accepted = []
    pending_out = []
    for row in outgoing.data or []:
        other_id = str(row["contact_user_id"])
        packed = _contact_row(row, profiles.get(other_id))
        if row.get("status") == "accepted":
            accepted.append(packed)
        else:
            pending_out.append(packed)

    pending_in = []
    for row in incoming.data or []:
        other_id = str(row["user_id"])
        pending_in.append(_contact_row(row, profiles.get(other_id)))

    return {
        "accepted": accepted,
        "pending_outgoing": pending_out,
        "pending_incoming": pending_in,
    }


@router.post("")
async def add_contact(body: AddContactBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    role = (body.contact_role or "").strip().lower() or None
    if role and role not in CONTACT_ROLES:
        raise HTTPException(status_code=400, detail="contact_role must be client, realtor, or other")

    target_id = (body.contact_user_id or "").strip() or None
    if not target_id and body.email:
        email = body.email.strip().lower()
        pr = supabase.table("profiles").select("id").ilike("email", email).limit(1).execute()
        if not pr.data:
            raise HTTPException(status_code=404, detail="No account found with that email")
        target_id = str(pr.data[0]["id"])
    if not target_id and body.username:
        uname = body.username.strip().lstrip("@")
        pr = (
            supabase.table("profiles")
            .select("id")
            .ilike("username", uname)
            .limit(1)
            .execute()
        )
        if not pr.data:
            raise HTTPException(status_code=404, detail="No account found with that username")
        target_id = str(pr.data[0]["id"])
    if not target_id:
        raise HTTPException(status_code=400, detail="Provide contact_user_id, email, or username")
    if target_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    existing = (
        supabase.table("user_contacts")
        .select("*")
        .eq("user_id", user_id)
        .eq("contact_user_id", target_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        row = existing.data[0]
        if row.get("status") == "accepted":
            raise HTTPException(status_code=400, detail="Already in your contacts")
        if row.get("status") == "pending":
            raise HTTPException(status_code=400, detail="Request already pending")
        upd = (
            supabase.table("user_contacts")
            .update(
                {
                    "status": "pending",
                    "contact_role": role,
                    "label": (body.label or "").strip() or None,
                    "updated_at": _now_iso(),
                }
            )
            .eq("id", row["id"])
            .select()
            .execute()
        )
        row = upd.data[0] if upd.data else row
    else:
        # Reciprocal pending from them → auto-accept both directions
        reciprocal = (
            supabase.table("user_contacts")
            .select("*")
            .eq("user_id", target_id)
            .eq("contact_user_id", user_id)
            .eq("status", "pending")
            .limit(1)
            .execute()
        )
        if reciprocal.data:
            supabase.table("user_contacts").update(
                {"status": "accepted", "updated_at": _now_iso()}
            ).eq("id", reciprocal.data[0]["id"]).execute()
            ins = (
                supabase.table("user_contacts")
                .insert(
                    {
                        "user_id": user_id,
                        "contact_user_id": target_id,
                        "status": "accepted",
                        "contact_role": role,
                        "label": (body.label or "").strip() or None,
                        "updated_at": _now_iso(),
                    }
                )
                .select()
                .execute()
            )
            row = ins.data[0] if ins.data else None
            await notify_user(
                target_id,
                kind="contact_accepted",
                title="Contact accepted",
                body="Someone accepted your contact request on Propurty.",
                payload={"user_id": user_id},
            )
        else:
            ins = (
                supabase.table("user_contacts")
                .insert(
                    {
                        "user_id": user_id,
                        "contact_user_id": target_id,
                        "status": "pending",
                        "contact_role": role,
                        "label": (body.label or "").strip() or None,
                        "updated_at": _now_iso(),
                    }
                )
                .select()
                .execute()
            )
            row = ins.data[0] if ins.data else None
            await notify_user(
                target_id,
                kind="contact_request",
                title="New contact request",
                body="Someone wants to add you as a contact on Propurty.",
                payload={"from_user_id": user_id, "contact_id": str(row["id"]) if row else None},
            )

    if not row:
        raise HTTPException(status_code=500, detail="Could not create contact")
    pr = (
        supabase.table("profiles")
        .select("id, full_name, email, username, plan, license_verification_status, brokerage_name, brokerage")
        .eq("id", target_id)
        .limit(1)
        .execute()
    )
    return _contact_row(row, pr.data[0] if pr.data else None)


@router.post("/{contact_id}/accept")
async def accept_contact(contact_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("user_contacts")
        .select("*")
        .eq("id", contact_id)
        .eq("contact_user_id", user_id)
        .eq("status", "pending")
        .limit(1)
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Pending request not found")
    row = r.data[0]
    from_id = str(row["user_id"])
    supabase.table("user_contacts").update(
        {"status": "accepted", "updated_at": _now_iso()}
    ).eq("id", contact_id).execute()
    # Ensure reverse edge exists as accepted
    rev = (
        supabase.table("user_contacts")
        .select("id")
        .eq("user_id", user_id)
        .eq("contact_user_id", from_id)
        .limit(1)
        .execute()
    )
    if rev.data:
        supabase.table("user_contacts").update(
            {"status": "accepted", "updated_at": _now_iso()}
        ).eq("id", rev.data[0]["id"]).execute()
    else:
        supabase.table("user_contacts").insert(
            {
                "user_id": user_id,
                "contact_user_id": from_id,
                "status": "accepted",
                "updated_at": _now_iso(),
            }
        ).execute()
    await notify_user(
        from_id,
        kind="contact_accepted",
        title="Contact accepted",
        body="Your contact request was accepted.",
        payload={"user_id": user_id},
    )
    return {"ok": True}


@router.post("/{contact_id}/decline")
async def decline_contact(contact_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("user_contacts")
        .update({"status": "declined", "updated_at": _now_iso()})
        .eq("id", contact_id)
        .eq("contact_user_id", user_id)
        .eq("status", "pending")
        .select()
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Pending request not found")
    return {"ok": True}


@router.patch("/{contact_id}")
async def update_contact(
    contact_id: str,
    body: UpdateContactBody,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase_admin()
    role = body.contact_role
    if role is not None:
        role = role.strip().lower() or None
        if role and role not in CONTACT_ROLES:
            raise HTTPException(status_code=400, detail="Invalid contact_role")
    updates: dict = {"updated_at": _now_iso()}
    if body.contact_role is not None:
        updates["contact_role"] = role
    if body.label is not None:
        updates["label"] = body.label.strip() or None
    upd = (
        supabase.table("user_contacts")
        .update(updates)
        .eq("id", contact_id)
        .eq("user_id", user_id)
        .select()
        .execute()
    )
    if not upd.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    return _contact_row(upd.data[0])


@router.delete("/{contact_id}")
async def remove_contact(contact_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("user_contacts")
        .select("*")
        .eq("id", contact_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Contact not found")
    other = str(r.data[0]["contact_user_id"])
    supabase.table("user_contacts").delete().eq("id", contact_id).execute()
    supabase.table("user_contacts").delete().eq("user_id", other).eq(
        "contact_user_id", user_id
    ).execute()
    return {"ok": True}
