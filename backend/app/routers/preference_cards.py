"""Opt-in shareable preference pattern cards (importance priorities only)."""
from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.config import get_settings
from app.dependencies import get_current_user_id, get_supabase_admin
from app.preference_patterns import (
    aggregate_from_scores,
    aggregate_from_weights,
    public_card_payload,
)

router = APIRouter(prefix="/preference-cards", tags=["preference-cards"])

TOKEN_ALPHABET = string.ascii_lowercase + string.digits


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_token(length: int = 22) -> str:
    return "".join(secrets.choice(TOKEN_ALPHABET) for _ in range(length))


def _share_url(token: str) -> str:
    base = (get_settings().app_public_url or "https://house-app-rho.vercel.app").rstrip("/")
    return f"{base}/PreferenceCard?t={token}"


def _load_score_rows(supabase, user_id: str) -> list[dict]:
    r = (
        supabase.table("property_scores")
        .select("id, scores, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )
    return r.data or []


def _load_profile(supabase, user_id: str) -> dict:
    r = (
        supabase.table("profiles")
        .select("full_name, default_weights")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else {}


def _compute_pattern(supabase, user_id: str, *, top_n: int = 3) -> dict:
    rows = _load_score_rows(supabase, user_id)
    pattern = aggregate_from_scores(rows, top_n=top_n)
    if pattern.get("homes_scored", 0) > 0 and pattern.get("top_priorities"):
        return pattern
    profile = _load_profile(supabase, user_id)
    weights = profile.get("default_weights") or {}
    if isinstance(weights, dict) and weights:
        return aggregate_from_weights(weights, top_n=top_n)
    # Last resort: average across saved presets
    presets = (
        supabase.table("user_presets")
        .select("weights")
        .eq("user_id", user_id)
        .limit(20)
        .execute()
    )
    merged: dict[str, list[float]] = {}
    for p in presets.data or []:
        w = p.get("weights") or {}
        if not isinstance(w, dict):
            continue
        for cid, raw in w.items():
            try:
                v = float(raw)
            except (TypeError, ValueError):
                continue
            merged.setdefault(str(cid), []).append(v)
    if merged:
        avg_weights = {cid: sum(vs) / len(vs) for cid, vs in merged.items()}
        return aggregate_from_weights(avg_weights, top_n=top_n)
    return pattern


def _owner_share_row(supabase, user_id: str) -> dict | None:
    r = (
        supabase.table("preference_share_cards")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    return r.data[0] if r.data else None


class EnableShareBody(BaseModel):
    include_first_name: bool = False
    rotate_token: bool = False


class UpdateShareBody(BaseModel):
    include_first_name: bool | None = None


@router.get("/preview")
async def preview_preference_card(user_id: str = Depends(get_current_user_id)):
    """Logged-in preview — never creates a public link."""
    supabase = get_supabase_admin()
    pattern = _compute_pattern(supabase, user_id)
    profile = _load_profile(supabase, user_id)
    share = _owner_share_row(supabase, user_id)
    include_name = bool(share.get("include_first_name")) if share else False
    card = public_card_payload(
        pattern,
        include_first_name=include_name,
        full_name=profile.get("full_name"),
        regenerated_at=_now_iso(),
    )
    return {
        "card": card,
        "share": {
            "enabled": bool(share),
            "token": share.get("token") if share else None,
            "share_url": _share_url(share["token"]) if share else None,
            "include_first_name": include_name,
            "created_at": share.get("created_at") if share else None,
            "regenerated_at": share.get("regenerated_at") if share else None,
        },
        "can_share": bool(card.get("top_priorities")),
    }


@router.post("/share")
async def enable_or_rotate_share(body: EnableShareBody, user_id: str = Depends(get_current_user_id)):
    """Explicit opt-in: create or rotate a public share token."""
    supabase = get_supabase_admin()
    pattern = _compute_pattern(supabase, user_id)
    if not pattern.get("top_priorities"):
        raise HTTPException(
            status_code=400,
            detail="Score at least one home (or save preference weights) before sharing a preference card.",
        )
    existing = _owner_share_row(supabase, user_id)
    now = _now_iso()
    if existing and not body.rotate_token:
        upd = (
            supabase.table("preference_share_cards")
            .update(
                {
                    "include_first_name": body.include_first_name,
                    "updated_at": now,
                    "regenerated_at": now,
                }
            )
            .eq("user_id", user_id)
            .select()
            .execute()
        )
        row = upd.data[0] if upd.data else existing
    else:
        token = _new_token()
        if existing:
            upd = (
                supabase.table("preference_share_cards")
                .update(
                    {
                        "token": token,
                        "include_first_name": body.include_first_name,
                        "updated_at": now,
                        "regenerated_at": now,
                    }
                )
                .eq("user_id", user_id)
                .select()
                .execute()
            )
            row = upd.data[0] if upd.data else {**existing, "token": token}
        else:
            for _ in range(6):
                token = _new_token()
                try:
                    ins = (
                        supabase.table("preference_share_cards")
                        .insert(
                            {
                                "user_id": user_id,
                                "token": token,
                                "include_first_name": body.include_first_name,
                                "created_at": now,
                                "updated_at": now,
                                "regenerated_at": now,
                            }
                        )
                        .select()
                        .execute()
                    )
                    if ins.data:
                        row = ins.data[0]
                        break
                except Exception:
                    continue
            else:
                raise HTTPException(status_code=500, detail="Could not allocate share token")
    profile = _load_profile(supabase, user_id)
    card = public_card_payload(
        pattern,
        include_first_name=bool(row.get("include_first_name")),
        full_name=profile.get("full_name"),
        regenerated_at=row.get("regenerated_at") or now,
    )
    return {
        "card": card,
        "share": {
            "enabled": True,
            "token": row["token"],
            "share_url": _share_url(row["token"]),
            "include_first_name": bool(row.get("include_first_name")),
            "created_at": row.get("created_at"),
            "regenerated_at": row.get("regenerated_at"),
        },
    }


@router.post("/regenerate")
async def regenerate_card(user_id: str = Depends(get_current_user_id)):
    """Refresh summary from latest scored homes. Keeps the same token if sharing is enabled."""
    supabase = get_supabase_admin()
    pattern = _compute_pattern(supabase, user_id)
    if not pattern.get("top_priorities"):
        raise HTTPException(status_code=400, detail="Not enough preference data to regenerate.")
    share = _owner_share_row(supabase, user_id)
    now = _now_iso()
    if share:
        supabase.table("preference_share_cards").update(
            {"regenerated_at": now, "updated_at": now}
        ).eq("user_id", user_id).execute()
        share = {**share, "regenerated_at": now, "updated_at": now}
    profile = _load_profile(supabase, user_id)
    include_name = bool(share.get("include_first_name")) if share else False
    card = public_card_payload(
        pattern,
        include_first_name=include_name,
        full_name=profile.get("full_name"),
        regenerated_at=now,
    )
    return {
        "card": card,
        "share": {
            "enabled": bool(share),
            "token": share.get("token") if share else None,
            "share_url": _share_url(share["token"]) if share else None,
            "include_first_name": include_name,
            "created_at": share.get("created_at") if share else None,
            "regenerated_at": share.get("regenerated_at") if share else None,
        },
    }


@router.patch("/share")
async def update_share(body: UpdateShareBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    share = _owner_share_row(supabase, user_id)
    if not share:
        raise HTTPException(status_code=404, detail="No active preference share link")
    patch: dict = {"updated_at": _now_iso()}
    if body.include_first_name is not None:
        patch["include_first_name"] = body.include_first_name
    upd = (
        supabase.table("preference_share_cards")
        .update(patch)
        .eq("user_id", user_id)
        .select()
        .execute()
    )
    row = upd.data[0] if upd.data else {**share, **patch}
    pattern = _compute_pattern(supabase, user_id)
    profile = _load_profile(supabase, user_id)
    card = public_card_payload(
        pattern,
        include_first_name=bool(row.get("include_first_name")),
        full_name=profile.get("full_name"),
        regenerated_at=row.get("regenerated_at"),
    )
    return {
        "card": card,
        "share": {
            "enabled": True,
            "token": row["token"],
            "share_url": _share_url(row["token"]),
            "include_first_name": bool(row.get("include_first_name")),
            "created_at": row.get("created_at"),
            "regenerated_at": row.get("regenerated_at"),
        },
    }


@router.delete("/share")
async def revoke_share(user_id: str = Depends(get_current_user_id)):
    """Revoke public access — link stops working immediately."""
    supabase = get_supabase_admin()
    supabase.table("preference_share_cards").delete().eq("user_id", user_id).execute()
    return {"ok": True, "enabled": False}


@router.get("/public/{token}")
async def get_public_card(token: str):
    """Public JSON for the preference card page. Preferences only."""
    raw = (token or "").strip()
    if len(raw) < 12 or len(raw) > 64 or not all(c in TOKEN_ALPHABET for c in raw):
        raise HTTPException(status_code=404, detail="Not found")
    supabase = get_supabase_admin()
    r = (
        supabase.table("preference_share_cards")
        .select("user_id, include_first_name, regenerated_at, token")
        .eq("token", raw)
        .limit(1)
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Not found")
    row = r.data[0]
    pattern = _compute_pattern(supabase, row["user_id"])
    if not pattern.get("top_priorities"):
        raise HTTPException(status_code=404, detail="Not found")
    profile = _load_profile(supabase, row["user_id"])
    # Touch regenerated_at so the public view always reflects live history
    return public_card_payload(
        pattern,
        include_first_name=bool(row.get("include_first_name")),
        full_name=profile.get("full_name"),
        regenerated_at=row.get("regenerated_at") or _now_iso(),
    )


@router.get("/public/{token}/og", response_class=HTMLResponse)
async def public_card_og_html(token: str):
    """Lightweight HTML with OG meta for link previews (no address/price/photo)."""
    raw = (token or "").strip()
    if len(raw) < 12 or len(raw) > 64 or not all(c in TOKEN_ALPHABET for c in raw):
        raise HTTPException(status_code=404, detail="Not found")
    supabase = get_supabase_admin()
    r = (
        supabase.table("preference_share_cards")
        .select("user_id, include_first_name, regenerated_at")
        .eq("token", raw)
        .limit(1)
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Not found")
    row = r.data[0]
    pattern = _compute_pattern(supabase, row["user_id"])
    if not pattern.get("top_priorities"):
        raise HTTPException(status_code=404, detail="Not found")
    profile = _load_profile(supabase, row["user_id"])
    card = public_card_payload(
        pattern,
        include_first_name=bool(row.get("include_first_name")),
        full_name=profile.get("full_name"),
        regenerated_at=row.get("regenerated_at"),
    )
    settings = get_settings()
    app_url = (settings.app_public_url or "https://house-app-rho.vercel.app").rstrip("/")
    page_url = f"{app_url}/PreferenceCard?t={raw}"
    title = "Preference pattern · Property Pocket"
    desc = (card.get("summary_line") or "A home-scoring preference pattern.").replace('"', "'")
    og_image = f"{app_url}/og-default.png"
    # Prefer site OG if configured via public URL path; crawlers still get text.
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>{title}</title>
  <meta name="description" content="{desc}" />
  <meta name="robots" content="noindex, follow" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:url" content="{page_url}" />
  <meta property="og:image" content="{og_image}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="{title}" />
  <meta name="twitter:description" content="{desc}" />
  <meta http-equiv="refresh" content="0;url={page_url}" />
  <link rel="canonical" href="{page_url}" />
</head>
<body>
  <p><a href="{page_url}">View preference pattern</a></p>
  <p>{desc}</p>
</body>
</html>"""
    return HTMLResponse(content=html)
