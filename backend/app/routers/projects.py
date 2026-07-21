"""User scoring projects (folder-like) with plan limits, members, and batch rescoring."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.activity_notify import notify_user
from app.browse_scores import (
    _get_cached_location_scores,
    _live_location_scores,
    card_address,
)
from app.dependencies import get_current_user_id, get_supabase_admin
from app.project_scoring import (
    default_scoring_presets,
    normalize_presets,
    property_key_from_card,
    score_card_for_project,
    weighted_percentage,
)

router = APIRouter(prefix="/projects", tags=["projects"])

FREE_MAX_PROJECTS = 2
PAID_MAX_PROJECTS = 20
FREE_MAX_COMPARE = 2
PAID_MAX_COMPARE = 4


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _user_plan(supabase, user_id: str) -> str:
    r = supabase.table("profiles").select("plan").eq("id", user_id).execute()
    return (r.data[0] if r.data else {}).get("plan") or "free"


def _is_paid(plan: str) -> bool:
    return plan in ("premium", "realtor", "admin")


def max_projects_for_plan(plan: str) -> int:
    return PAID_MAX_PROJECTS if _is_paid(plan) else FREE_MAX_PROJECTS


def max_compare_for_plan(plan: str) -> int:
    return PAID_MAX_COMPARE if _is_paid(plan) else FREE_MAX_COMPARE


def _project_row(
    row: dict,
    property_count: int | None = None,
    *,
    membership: str | None = None,
    is_owner: bool | None = None,
) -> dict:
    out = {
        "id": str(row["id"]),
        "title": row["title"],
        "owner_user_id": str(row["user_id"]),
        "scoring_presets": normalize_presets(row.get("scoring_presets")),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }
    if property_count is not None:
        out["property_count"] = property_count
    if is_owner is not None:
        out["is_owner"] = is_owner
    if membership is not None:
        out["membership"] = membership
    return out


def _prop_row(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "property_key": row["property_key"],
        "property_address": row["property_address"],
        "lat": row.get("lat"),
        "lng": row.get("lng"),
        "property_snapshot": row.get("property_snapshot") or {},
        "auto_scores": row.get("auto_scores") or {},
        "overall_percentage": row.get("overall_percentage") or 0,
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _assert_owns_project(supabase, user_id: str, project_id: str) -> dict:
    r = supabase.table("user_projects").select("*").eq("id", project_id).eq("user_id", user_id).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Project not found")
    return r.data[0]


def _assert_can_access_project(supabase, user_id: str, project_id: str) -> tuple[dict, bool]:
    """Return (project, is_owner). Members with accepted status may access."""
    r = supabase.table("user_projects").select("*").eq("id", project_id).limit(1).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Project not found")
    project = r.data[0]
    if str(project["user_id"]) == user_id:
        return project, True
    m = (
        supabase.table("project_members")
        .select("id, status")
        .eq("project_id", project_id)
        .eq("user_id", user_id)
        .eq("status", "accepted")
        .limit(1)
        .execute()
    )
    if not m.data:
        raise HTTPException(status_code=404, detail="Project not found")
    return project, False


def _member_user_ids(supabase, project_id: str, *, include_owner: bool = True) -> list[str]:
    r = (
        supabase.table("project_members")
        .select("user_id")
        .eq("project_id", project_id)
        .eq("status", "accepted")
        .execute()
    )
    ids = [str(x["user_id"]) for x in (r.data or [])]
    if include_owner:
        p = supabase.table("user_projects").select("user_id").eq("id", project_id).limit(1).execute()
        if p.data:
            oid = str(p.data[0]["user_id"])
            if oid not in ids:
                ids.append(oid)
    return ids


async def _notify_project_activity(
    supabase,
    *,
    project: dict,
    actor_id: str,
    kind: str,
    title: str,
    body: str,
    exclude: set[str] | None = None,
):
    skip = set(exclude or set())
    skip.add(actor_id)
    for uid in _member_user_ids(supabase, str(project["id"])):
        if uid in skip:
            continue
        await notify_user(
            uid,
            kind=kind,
            title=title,
            body=body,
            payload={"project_id": str(project["id"]), "path": f"/ProjectDetail?id={project['id']}"},
        )


class CreateProjectBody(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    scoring_presets: dict[str, Any] | None = None


class UpdateProjectBody(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    scoring_presets: dict[str, Any] | None = None


class AddPropertyBody(BaseModel):
    property: dict[str, Any]
    enrich_location: bool = True


class AddPropertiesBody(BaseModel):
    properties: list[dict[str, Any]] = Field(..., min_length=1, max_length=20)
    enrich_location: bool = False


class CompareValidateBody(BaseModel):
    """Soft-check when persisting a compare selection."""
    count: int = Field(..., ge=0, le=50)


class InviteMemberBody(BaseModel):
    user_id: str | None = None
    email: str | None = None
    contact_id: str | None = None


@router.get("/limits")
async def project_limits(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    plan = _user_plan(supabase, user_id)
    r = supabase.table("user_projects").select("id").eq("user_id", user_id).execute()
    used = len(r.data or [])
    return {
        "plan": plan,
        "max_projects": max_projects_for_plan(plan),
        "projects_used": used,
        "max_compare": max_compare_for_plan(plan),
        "can_create_project": used < max_projects_for_plan(plan),
    }


@router.get("/invites")
async def list_my_project_invites(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("project_members")
        .select("*")
        .eq("user_id", user_id)
        .eq("status", "pending")
        .order("created_at", desc=True)
        .execute()
    )
    out = []
    for row in r.data or []:
        p = (
            supabase.table("user_projects")
            .select("id, title, user_id")
            .eq("id", row["project_id"])
            .limit(1)
            .execute()
        )
        project = p.data[0] if p.data else None
        inviter = None
        if row.get("invited_by"):
            pr = (
                supabase.table("profiles")
                .select("id, full_name, email")
                .eq("id", row["invited_by"])
                .limit(1)
                .execute()
            )
            inviter = pr.data[0] if pr.data else None
        out.append(
            {
                "id": str(row["id"]),
                "project_id": str(row["project_id"]),
                "status": row.get("status"),
                "created_at": row.get("created_at"),
                "project": (
                    {
                        "id": str(project["id"]),
                        "title": project.get("title"),
                        "owner_user_id": str(project["user_id"]),
                    }
                    if project
                    else None
                ),
                "invited_by": (
                    {
                        "id": str(inviter["id"]),
                        "full_name": inviter.get("full_name"),
                        "email": inviter.get("email"),
                    }
                    if inviter
                    else None
                ),
            }
        )
    return out


@router.post("/compare/validate")
async def validate_compare_count(body: CompareValidateBody, user_id: str = Depends(get_current_user_id)):
    """Soft-check compare session size against plan (used when saving/applying compare)."""
    supabase = get_supabase_admin()
    plan = _user_plan(supabase, user_id)
    limit = max_compare_for_plan(plan)
    ok = body.count <= limit
    return {
        "ok": ok,
        "count": body.count,
        "max_compare": limit,
        "plan": plan,
        "detail": None if ok else f"Your plan allows comparing up to {limit} properties.",
    }


@router.get("")
async def list_projects(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    owned = (
        supabase.table("user_projects")
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    member_rows = (
        supabase.table("project_members")
        .select("project_id, status")
        .eq("user_id", user_id)
        .eq("status", "accepted")
        .execute()
    )
    member_ids = [str(x["project_id"]) for x in (member_rows.data or [])]
    shared = []
    if member_ids:
        shared = (
            supabase.table("user_projects")
            .select("*")
            .in_("id", member_ids)
            .order("updated_at", desc=True)
            .execute()
        ).data or []

    seen = set()
    out = []
    for row in list(owned.data or []) + list(shared):
        pid = str(row["id"])
        if pid in seen:
            continue
        seen.add(pid)
        items = (
            supabase.table("user_project_properties")
            .select("id")
            .eq("project_id", row["id"])
            .execute()
        )
        is_owner = str(row["user_id"]) == user_id
        out.append(
            _project_row(
                row,
                property_count=len(items.data or []),
                is_owner=is_owner,
                membership="owner" if is_owner else "collaborator",
            )
        )
    out.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return out


@router.post("")
async def create_project(body: CreateProjectBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    plan = _user_plan(supabase, user_id)
    limit = max_projects_for_plan(plan)
    existing = supabase.table("user_projects").select("id").eq("user_id", user_id).execute()
    if len(existing.data or []) >= limit:
        raise HTTPException(
            status_code=403,
            detail=f"Project limit reached ({limit}). Upgrade for more projects."
            if not _is_paid(plan)
            else f"Project limit reached ({limit}).",
        )
    presets = normalize_presets(body.scoring_presets or default_scoring_presets())
    row = {
        "user_id": user_id,
        "title": body.title.strip(),
        "scoring_presets": presets,
        "updated_at": _now_iso(),
    }
    ins = supabase.table("user_projects").insert(row).select().execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Could not create project")
    return _project_row(ins.data[0], property_count=0)


@router.get("/{project_id}")
async def get_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    row, is_owner = _assert_can_access_project(supabase, user_id, project_id)
    props = (
        supabase.table("user_project_properties")
        .select("*")
        .eq("project_id", project_id)
        .order("overall_percentage", desc=True)
        .execute()
    )
    members = (
        supabase.table("project_members")
        .select("*")
        .eq("project_id", project_id)
        .in_("status", ["pending", "accepted"])
        .execute()
    )
    member_out = []
    for m in members.data or []:
        pr = (
            supabase.table("profiles")
            .select("id, full_name, email, username")
            .eq("id", m["user_id"])
            .limit(1)
            .execute()
        )
        p = pr.data[0] if pr.data else {}
        member_out.append(
            {
                "id": str(m["id"]),
                "user_id": str(m["user_id"]),
                "status": m.get("status"),
                "role": m.get("role"),
                "created_at": m.get("created_at"),
                "user": {
                    "id": str(p.get("id") or m["user_id"]),
                    "full_name": p.get("full_name"),
                    "email": p.get("email"),
                    "username": p.get("username"),
                },
            }
        )
    return {
        **_project_row(
            row,
            property_count=len(props.data or []),
            is_owner=is_owner,
            membership="owner" if is_owner else "collaborator",
        ),
        "properties": [_prop_row(p) for p in (props.data or [])],
        "members": member_out,
    }


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    body: UpdateProjectBody,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase_admin()
    row = _assert_owns_project(supabase, user_id, project_id)
    updates: dict[str, Any] = {"updated_at": _now_iso()}
    if body.title is not None:
        updates["title"] = body.title.strip()
    rescore = False
    if body.scoring_presets is not None:
        updates["scoring_presets"] = normalize_presets(body.scoring_presets)
        rescore = True
    upd = (
        supabase.table("user_projects")
        .update(updates)
        .eq("id", project_id)
        .eq("user_id", user_id)
        .select()
        .execute()
    )
    if not upd.data:
        raise HTTPException(status_code=500, detail="Update failed")
    project = upd.data[0]
    rescored = 0
    if rescore:
        rescored = await _rescore_project(supabase, user_id, project)
    props = (
        supabase.table("user_project_properties")
        .select("*")
        .eq("project_id", project_id)
        .order("overall_percentage", desc=True)
        .execute()
    )
    return {
        **_project_row(project, property_count=len(props.data or []), is_owner=True, membership="owner"),
        "properties": [_prop_row(p) for p in (props.data or [])],
        "rescored": rescored,
    }


@router.delete("/{project_id}")
async def delete_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    _assert_owns_project(supabase, user_id, project_id)
    supabase.table("user_projects").delete().eq("id", project_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.post("/{project_id}/members")
async def invite_member(
    project_id: str,
    body: InviteMemberBody,
    user_id: str = Depends(get_current_user_id),
):
    """Owner invites a contact (or known user) to collaborate on the project."""
    supabase = get_supabase_admin()
    project = _assert_owns_project(supabase, user_id, project_id)
    target_id = (body.user_id or "").strip() or None
    if not target_id and body.contact_id:
        cr = (
            supabase.table("user_contacts")
            .select("contact_user_id, status")
            .eq("id", body.contact_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not cr.data or cr.data[0].get("status") != "accepted":
            raise HTTPException(status_code=400, detail="Contact not found or not accepted")
        target_id = str(cr.data[0]["contact_user_id"])
    if not target_id and body.email:
        pr = (
            supabase.table("profiles")
            .select("id")
            .ilike("email", body.email.strip())
            .limit(1)
            .execute()
        )
        if not pr.data:
            raise HTTPException(status_code=404, detail="No account with that email")
        target_id = str(pr.data[0]["id"])
    if not target_id:
        raise HTTPException(status_code=400, detail="Provide user_id, email, or contact_id")
    if target_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    existing = (
        supabase.table("project_members")
        .select("*")
        .eq("project_id", project_id)
        .eq("user_id", target_id)
        .limit(1)
        .execute()
    )
    if existing.data and existing.data[0].get("status") in ("pending", "accepted"):
        raise HTTPException(status_code=400, detail="Already invited or a member")

    if existing.data:
        ins = (
            supabase.table("project_members")
            .update(
                {
                    "status": "pending",
                    "invited_by": user_id,
                    "updated_at": _now_iso(),
                }
            )
            .eq("id", existing.data[0]["id"])
            .select()
            .execute()
        )
    else:
        ins = (
            supabase.table("project_members")
            .insert(
                {
                    "project_id": project_id,
                    "user_id": target_id,
                    "invited_by": user_id,
                    "role": "collaborator",
                    "status": "pending",
                    "updated_at": _now_iso(),
                }
            )
            .select()
            .execute()
        )
    if not ins.data:
        raise HTTPException(status_code=500, detail="Could not invite")
    await notify_user(
        target_id,
        kind="project_invite",
        title="Project invite",
        body=f"You've been invited to collaborate on “{project.get('title') or 'a project'}”.",
        payload={"project_id": project_id, "member_id": str(ins.data[0]["id"]), "path": "/ProjectDetail"},
        email=True,
    )
    return {
        "id": str(ins.data[0]["id"]),
        "project_id": project_id,
        "user_id": target_id,
        "status": "pending",
    }


@router.post("/members/{member_id}/accept")
async def accept_project_invite(member_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("project_members")
        .select("*")
        .eq("id", member_id)
        .eq("user_id", user_id)
        .eq("status", "pending")
        .limit(1)
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Invite not found")
    row = r.data[0]
    upd = (
        supabase.table("project_members")
        .update({"status": "accepted", "updated_at": _now_iso()})
        .eq("id", member_id)
        .select()
        .execute()
    )
    owner_id = str(row.get("invited_by") or "")
    p = (
        supabase.table("user_projects")
        .select("title")
        .eq("id", row["project_id"])
        .limit(1)
        .execute()
    )
    title = (p.data[0].get("title") if p.data else None) or "a project"
    if owner_id:
        await notify_user(
            owner_id,
            kind="project_invite_accepted",
            title="Invite accepted",
            body=f"Someone joined “{title}”.",
            payload={"project_id": str(row["project_id"]), "path": f"/ProjectDetail?id={row['project_id']}"},
        )
    return {"ok": True, "member": upd.data[0] if upd.data else None}


@router.post("/members/{member_id}/decline")
async def decline_project_invite(member_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("project_members")
        .update({"status": "declined", "updated_at": _now_iso()})
        .eq("id", member_id)
        .eq("user_id", user_id)
        .eq("status", "pending")
        .select()
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Invite not found")
    return {"ok": True}


@router.delete("/{project_id}/members/{member_id}")
async def remove_member(
    project_id: str,
    member_id: str,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase_admin()
    _assert_owns_project(supabase, user_id, project_id)
    supabase.table("project_members").update(
        {"status": "removed", "updated_at": _now_iso()}
    ).eq("id", member_id).eq("project_id", project_id).execute()
    return {"ok": True}


@router.post("/{project_id}/properties")
async def add_property(
    project_id: str,
    body: AddPropertyBody,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase_admin()
    project, _is_owner = _assert_can_access_project(supabase, user_id, project_id)
    saved = await _upsert_property(
        supabase,
        user_id,
        project,
        body.property,
        enrich_location=body.enrich_location,
    )
    supabase.table("user_projects").update({"updated_at": _now_iso()}).eq("id", project_id).execute()
    addr = saved.get("property_address") or "a property"
    await _notify_project_activity(
        supabase,
        project=project,
        actor_id=user_id,
        kind="project_property_added",
        title="Property added to project",
        body=f"{addr} was added to “{project.get('title') or 'project'}”.",
    )
    return saved


@router.post("/{project_id}/properties/batch")
async def add_properties_batch(
    project_id: str,
    body: AddPropertiesBody,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase_admin()
    project, _is_owner = _assert_can_access_project(supabase, user_id, project_id)
    saved = []
    for card in body.properties:
        row = await _upsert_property(
            supabase,
            user_id,
            project,
            card,
            enrich_location=body.enrich_location,
        )
        saved.append(row)
    supabase.table("user_projects").update({"updated_at": _now_iso()}).eq("id", project_id).execute()
    if saved:
        await _notify_project_activity(
            supabase,
            project=project,
            actor_id=user_id,
            kind="project_property_added",
            title="Properties added to project",
            body=f"{len(saved)} home(s) added to “{project.get('title') or 'project'}”.",
        )
    return {"ok": True, "properties": saved, "count": len(saved)}


@router.delete("/{project_id}/properties/{prop_id}")
async def remove_property(
    project_id: str,
    prop_id: str,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase_admin()
    _assert_can_access_project(supabase, user_id, project_id)
    supabase.table("user_project_properties").delete().eq("id", prop_id).eq(
        "project_id", project_id
    ).execute()
    return {"ok": True}


@router.post("/{project_id}/rescore")
async def rescore_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    project, is_owner = _assert_can_access_project(supabase, user_id, project_id)
    if not is_owner:
        raise HTTPException(status_code=403, detail="Only the project owner can rescore")
    n = await _rescore_project(supabase, user_id, project)
    props = (
        supabase.table("user_project_properties")
        .select("*")
        .eq("project_id", project_id)
        .order("overall_percentage", desc=True)
        .execute()
    )
    return {
        **_project_row(project, property_count=len(props.data or []), is_owner=True, membership="owner"),
        "properties": [_prop_row(p) for p in (props.data or [])],
        "rescored": n,
    }


async def _upsert_property(
    supabase,
    user_id: str,
    project: dict,
    card: dict,
    *,
    enrich_location: bool,
) -> dict:
    if not isinstance(card, dict):
        raise HTTPException(status_code=400, detail="Invalid property payload")
    key = property_key_from_card(card)
    addr = card_address(card) or card.get("property_address") or "Unknown address"
    snapshot = dict(card)
    location: dict[str, int] = {}
    if enrich_location and addr:
        cached = _get_cached_location_scores(addr)
        if cached:
            location = cached
        else:
            try:
                location = await _live_location_scores(addr) or {}
            except Exception:
                location = {}
    if location:
        existing = snapshot.get("auto_scores") if isinstance(snapshot.get("auto_scores"), dict) else {}
        snapshot["auto_scores"] = {**existing, **location}

    scores, pct = score_card_for_project(snapshot, project.get("scoring_presets"))
    lat = card.get("lat")
    lng = card.get("lng")
    try:
        lat_f = float(lat) if lat is not None else None
        lng_f = float(lng) if lng is not None else None
    except (TypeError, ValueError):
        lat_f, lng_f = None, None

    row = {
        "project_id": project["id"],
        "user_id": user_id,
        "property_key": key,
        "property_address": addr,
        "lat": lat_f,
        "lng": lng_f,
        "property_snapshot": snapshot,
        "auto_scores": scores,
        "overall_percentage": pct,
        "updated_at": _now_iso(),
    }
    # Upsert by unique (project_id, property_key)
    existing = (
        supabase.table("user_project_properties")
        .select("id")
        .eq("project_id", project["id"])
        .eq("property_key", key)
        .limit(1)
        .execute()
    )
    if existing.data:
        upd = (
            supabase.table("user_project_properties")
            .update(row)
            .eq("id", existing.data[0]["id"])
            .select()
            .execute()
        )
        if not upd.data:
            raise HTTPException(status_code=500, detail="Could not update property")
        return _prop_row(upd.data[0])
    ins = supabase.table("user_project_properties").insert(row).select().execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Could not save property")
    return _prop_row(ins.data[0])


async def _rescore_project(supabase, user_id: str, project: dict) -> int:
    props = (
        supabase.table("user_project_properties")
        .select("*")
        .eq("project_id", project["id"])
        .execute()
    )
    presets = project.get("scoring_presets")
    weights = normalize_presets(presets)["weights"]
    n = 0
    for p in props.data or []:
        scores = p.get("auto_scores") or {}
        # Recompute from snapshot if scores empty
        if not scores and isinstance(p.get("property_snapshot"), dict):
            scores, _ = score_card_for_project(p["property_snapshot"], presets)
        pct = weighted_percentage(scores, weights)
        supabase.table("user_project_properties").update(
            {
                "auto_scores": scores,
                "overall_percentage": pct,
                "updated_at": _now_iso(),
            }
        ).eq("id", p["id"]).execute()
        n += 1
    supabase.table("user_projects").update({"updated_at": _now_iso()}).eq("id", project["id"]).execute()
    return n
