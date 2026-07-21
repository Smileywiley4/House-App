"""User scoring projects (folder-like) with plan limits and batch rescoring."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

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


def _project_row(row: dict, property_count: int | None = None) -> dict:
    out = {
        "id": str(row["id"]),
        "title": row["title"],
        "scoring_presets": normalize_presets(row.get("scoring_presets")),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }
    if property_count is not None:
        out["property_count"] = property_count
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
    r = (
        supabase.table("user_projects")
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    out = []
    for row in r.data or []:
        items = (
            supabase.table("user_project_properties")
            .select("id")
            .eq("project_id", row["id"])
            .execute()
        )
        out.append(_project_row(row, property_count=len(items.data or [])))
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
    row = _assert_owns_project(supabase, user_id, project_id)
    props = (
        supabase.table("user_project_properties")
        .select("*")
        .eq("project_id", project_id)
        .order("overall_percentage", desc=True)
        .execute()
    )
    return {
        **_project_row(row, property_count=len(props.data or [])),
        "properties": [_prop_row(p) for p in (props.data or [])],
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
        **_project_row(project, property_count=len(props.data or [])),
        "properties": [_prop_row(p) for p in (props.data or [])],
        "rescored": rescored,
    }


@router.delete("/{project_id}")
async def delete_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    _assert_owns_project(supabase, user_id, project_id)
    supabase.table("user_projects").delete().eq("id", project_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.post("/{project_id}/properties")
async def add_property(
    project_id: str,
    body: AddPropertyBody,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase_admin()
    project = _assert_owns_project(supabase, user_id, project_id)
    saved = await _upsert_property(
        supabase,
        user_id,
        project,
        body.property,
        enrich_location=body.enrich_location,
    )
    supabase.table("user_projects").update({"updated_at": _now_iso()}).eq("id", project_id).execute()
    return saved


@router.post("/{project_id}/properties/batch")
async def add_properties_batch(
    project_id: str,
    body: AddPropertiesBody,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase_admin()
    project = _assert_owns_project(supabase, user_id, project_id)
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
    return {"ok": True, "properties": saved, "count": len(saved)}


@router.delete("/{project_id}/properties/{prop_id}")
async def remove_property(
    project_id: str,
    prop_id: str,
    user_id: str = Depends(get_current_user_id),
):
    supabase = get_supabase_admin()
    _assert_owns_project(supabase, user_id, project_id)
    supabase.table("user_project_properties").delete().eq("id", prop_id).eq(
        "project_id", project_id
    ).eq("user_id", user_id).execute()
    return {"ok": True}


@router.post("/{project_id}/rescore")
async def rescore_project(project_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    project = _assert_owns_project(supabase, user_id, project_id)
    n = await _rescore_project(supabase, user_id, project)
    props = (
        supabase.table("user_project_properties")
        .select("*")
        .eq("project_id", project_id)
        .order("overall_percentage", desc=True)
        .execute()
    )
    return {
        **_project_row(project, property_count=len(props.data or [])),
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
        .eq("user_id", user_id)
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
