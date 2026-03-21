"""Saved properties, visit photos, folders, and realtor sharing (paid plans)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field, HttpUrl

from app.dependencies import require_paid_plan, require_realtor_plan
from app.supabase_client import get_supabase_admin
from app.listing_photos import extract_listing_image_urls, fetch_listing_html

router = APIRouter(prefix="/library", tags=["library"])

BUCKET = "property-photos"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _saved_row(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "property_address": row["property_address"],
        "place_id": row.get("place_id"),
        "scores": row.get("scores") or [],
        "weighted_total": row.get("weighted_total") or 0,
        "max_possible": row.get("max_possible") or 0,
        "percentage": row.get("percentage") or 0,
        "personal_score": row.get("personal_score"),
        "visit_notes": row.get("visit_notes"),
        "external_listing_url": row.get("external_listing_url"),
        "property_snapshot": row.get("property_snapshot") or {},
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _photo_row(row: dict, signed_url: str | None = None) -> dict:
    out = {
        "id": str(row["id"]),
        "saved_property_id": str(row["saved_property_id"]),
        "storage_path": row["storage_path"],
        "source": row.get("source") or "user_upload",
        "caption": row.get("caption"),
        "sort_order": row.get("sort_order") or 0,
        "created_at": row.get("created_at"),
    }
    if signed_url:
        out["signed_url"] = signed_url
    return out


def _sign_url(supabase, path: str) -> str | None:
    try:
        r = supabase.storage.from_(BUCKET).create_signed_url(path, 3600)
        if isinstance(r, dict):
            return r.get("signedURL") or r.get("signed_url")
        return getattr(r, "signed_url", None) or getattr(r, "signedURL", None)
    except Exception:
        return None


class CreateSavedPropertyBody(BaseModel):
    property_address: str = Field(..., min_length=3, max_length=2000)
    place_id: str | None = None
    scores: list[dict] = Field(default_factory=list)
    weighted_total: int = 0
    max_possible: int = 0
    percentage: int = 0
    personal_score: int | None = Field(None, ge=1, le=10)
    visit_notes: str | None = None
    external_listing_url: str | None = None
    property_snapshot: dict[str, Any] = Field(default_factory=dict)


class UpdateSavedPropertyBody(BaseModel):
    scores: list[dict] | None = None
    weighted_total: int | None = None
    max_possible: int | None = None
    percentage: int | None = None
    personal_score: int | None = Field(None, ge=1, le=10)
    visit_notes: str | None = None
    external_listing_url: str | None = None
    property_snapshot: dict[str, Any] | None = None


class CreateFolderBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sort_order: int = 0


class FolderItemBody(BaseModel):
    saved_property_id: str


class ShareBody(BaseModel):
    realtor_id: str
    message: str | None = Field(None, max_length=2000)
    include_photos: bool = True


class PeerShareBody(BaseModel):
    recipient_user_id: str = Field(..., min_length=10)
    folder_id: str | None = None
    saved_property_id: str | None = None
    message: str | None = Field(None, max_length=2000)


class ImportListingBody(BaseModel):
    listing_url: HttpUrl


def _assert_owns_saved(supabase, user_id: str, saved_id: str) -> dict:
    r = supabase.table("user_saved_properties").select("*").eq("id", saved_id).eq("user_id", user_id).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Saved property not found")
    return r.data[0]


def _get_saved_readable(supabase, viewer_id: str, saved_id: str) -> tuple[dict | None, str | None]:
    """Return (row, 'owner'|'peer') or (None, None)."""
    r = supabase.table("user_saved_properties").select("*").eq("id", saved_id).execute()
    if not r.data:
        return None, None
    row = r.data[0]
    if row["user_id"] == viewer_id:
        return row, "owner"
    ps = (
        supabase.table("library_peer_shares")
        .select("id")
        .eq("recipient_user_id", viewer_id)
        .eq("saved_property_id", saved_id)
        .limit(1)
        .execute()
    )
    if ps.data:
        return row, "peer"
    # Folder share: can open each listing inside a folder shared with you
    folder_rows = (
        supabase.table("property_folder_items").select("folder_id").eq("saved_property_id", saved_id).execute()
    )
    for fr in folder_rows.data or []:
        fid = fr["folder_id"]
        sh = (
            supabase.table("library_peer_shares")
            .select("id")
            .eq("recipient_user_id", viewer_id)
            .eq("folder_id", fid)
            .limit(1)
            .execute()
        )
        if sh.data:
            return row, "peer"
    return None, None


def _assert_owns_folder(supabase, user_id: str, folder_id: str) -> dict:
    r = supabase.table("property_folders").select("*").eq("id", folder_id).eq("user_id", user_id).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Folder not found")
    return r.data[0]


async def _assert_realtor_subscribed(supabase, realtor_id: str) -> dict:
    r = supabase.table("profiles").select("id, plan, full_name, email").eq("id", realtor_id).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Realtor not found")
    row = r.data[0]
    if (row.get("plan") or "free") not in ("realtor", "admin"):
        raise HTTPException(status_code=400, detail="Target user must have an active Realtor subscription")
    return row


@router.get("/users/search")
async def search_users_for_sharing(q: str = "", user_id: str = Depends(require_paid_plan)):
    """Find any profile by name or email (for sharing folders / saved properties)."""
    supabase = get_supabase_admin()
    needle = (q or "").strip().lower()
    r = supabase.table("profiles").select("id, full_name, email, plan").limit(80).execute()
    rows = r.data or []
    if needle:
        rows = [
            x
            for x in rows
            if x.get("id") != user_id
            and (
                needle in (x.get("full_name") or "").lower()
                or needle in (x.get("email") or "").lower()
            )
        ][:25]
    else:
        rows = [x for x in rows if x.get("id") != user_id][:25]
    return [
        {
            "id": str(x["id"]),
            "full_name": x.get("full_name"),
            "email": x.get("email"),
            "plan": x.get("plan") or "free",
        }
        for x in rows
    ]


@router.get("/realtors/search")
async def search_realtors(q: str = "", user_id: str = Depends(require_paid_plan)):
    """Find subscribed realtors by name or email (for linking / sharing)."""
    supabase = get_supabase_admin()
    needle = (q or "").strip().lower()
    r = (
        supabase.table("profiles")
        .select("id, full_name, email, brokerage, state, plan")
        .in_("plan", ["realtor", "admin"])
        .limit(80)
        .execute()
    )
    rows = r.data or []
    if needle:
        rows = [
            x
            for x in rows
            if needle in (x.get("full_name") or "").lower()
            or needle in (x.get("email") or "").lower()
            or needle in (x.get("brokerage") or "").lower()
        ][:25]
    else:
        rows = rows[:25]
    return [
        {
            "id": str(x["id"]),
            "full_name": x.get("full_name"),
            "email": x.get("email"),
            "brokerage": x.get("brokerage"),
            "state": x.get("state"),
        }
        for x in rows
    ]


@router.post("/saved-properties")
async def create_saved_property(body: CreateSavedPropertyBody, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    row = {
        "user_id": user_id,
        "property_address": body.property_address.strip(),
        "place_id": body.place_id,
        "scores": body.scores,
        "weighted_total": body.weighted_total,
        "max_possible": body.max_possible,
        "percentage": body.percentage,
        "personal_score": body.personal_score,
        "visit_notes": body.visit_notes,
        "external_listing_url": str(body.external_listing_url) if body.external_listing_url else None,
        "property_snapshot": body.property_snapshot,
        "updated_at": _now_iso(),
    }
    r = supabase.table("user_saved_properties").upsert([row], on_conflict="user_id,property_address").select().execute()
    if not r.data:
        raise HTTPException(status_code=500, detail="Could not save property")
    return _saved_row(r.data[0])


@router.get("/saved-properties")
async def list_saved_properties(user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("user_saved_properties")
        .select("*")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return [_saved_row(row) for row in (r.data or [])]


@router.get("/saved-properties/{saved_id}")
async def get_saved_property(saved_id: str, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    row, access = _get_saved_readable(supabase, user_id, saved_id)
    if not row or not access:
        raise HTTPException(status_code=404, detail="Saved property not found")
    pr = (
        supabase.table("user_property_photos")
        .select("*")
        .eq("saved_property_id", saved_id)
        .order("sort_order")
        .execute()
    )
    photos = []
    for p in pr.data or []:
        url = _sign_url(supabase, p["storage_path"])
        photos.append(_photo_row(p, url))
    data = _saved_row(row)
    data["photos"] = photos
    data["access"] = access
    if access == "peer":
        owner_p = supabase.table("profiles").select("id, full_name, email").eq("id", row["user_id"]).execute()
        data["owner"] = (
            {
                "id": str(owner_p.data[0]["id"]),
                "full_name": owner_p.data[0].get("full_name"),
                "email": owner_p.data[0].get("email"),
            }
            if owner_p.data
            else {}
        )
    return data


@router.patch("/saved-properties/{saved_id}")
async def update_saved_property(
    saved_id: str, body: UpdateSavedPropertyBody, user_id: str = Depends(require_paid_plan)
):
    supabase = get_supabase_admin()
    _assert_owns_saved(supabase, user_id, saved_id)
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        r = supabase.table("user_saved_properties").select("*").eq("id", saved_id).execute()
        return _saved_row(r.data[0])
    updates["updated_at"] = _now_iso()
    if "external_listing_url" in updates and updates["external_listing_url"] is not None:
        updates["external_listing_url"] = str(updates["external_listing_url"])
    supabase.table("user_saved_properties").update(updates).eq("id", saved_id).eq("user_id", user_id).execute()
    r = supabase.table("user_saved_properties").select("*").eq("id", saved_id).execute()
    return _saved_row(r.data[0]) if r.data else {}


@router.delete("/saved-properties/{saved_id}")
async def delete_saved_property(saved_id: str, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    row = _assert_owns_saved(supabase, user_id, saved_id)
    pr = supabase.table("user_property_photos").select("storage_path").eq("saved_property_id", saved_id).execute()
    for p in pr.data or []:
        try:
            supabase.storage.from_(BUCKET).remove([p["storage_path"]])
        except Exception:
            pass
    supabase.table("user_saved_properties").delete().eq("id", saved_id).eq("user_id", user_id).execute()
    return {"ok": True, "id": str(row["id"])}


@router.post("/saved-properties/{saved_id}/photos")
async def upload_photo(
    saved_id: str,
    file: UploadFile = File(...),
    caption: str | None = None,
    user_id: str = Depends(require_paid_plan),
):
    supabase = get_supabase_admin()
    _assert_owns_saved(supabase, user_id, saved_id)
    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    content_type = file.content_type or "image/jpeg"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")
    ext = "jpg"
    if "png" in content_type:
        ext = "png"
    elif "webp" in content_type:
        ext = "webp"
    elif "gif" in content_type:
        ext = "gif"
    path = f"{user_id}/{saved_id}/{uuid.uuid4().hex}.{ext}"
    try:
        supabase.storage.from_(BUCKET).upload(
            path,
            raw,
            file_options={"content-type": content_type, "upsert": "true"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Upload failed") from e

    row = {
        "user_id": user_id,
        "saved_property_id": saved_id,
        "storage_path": path,
        "source": "user_upload",
        "caption": caption,
        "sort_order": 0,
    }
    ins = supabase.table("user_property_photos").insert(row).select().execute()
    if not ins.data:
        try:
            supabase.storage.from_(BUCKET).remove([path])
        except Exception:
            pass
        raise HTTPException(status_code=500, detail="Could not save photo metadata")
    signed = _sign_url(supabase, path)
    return _photo_row(ins.data[0], signed)


@router.delete("/saved-properties/{saved_id}/photos/{photo_id}")
async def delete_photo(saved_id: str, photo_id: str, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    _assert_owns_saved(supabase, user_id, saved_id)
    r = (
        supabase.table("user_property_photos")
        .select("*")
        .eq("id", photo_id)
        .eq("saved_property_id", saved_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Photo not found")
    path = r.data[0]["storage_path"]
    try:
        supabase.storage.from_(BUCKET).remove([path])
    except Exception:
        pass
    supabase.table("user_property_photos").delete().eq("id", photo_id).execute()
    return {"ok": True}


@router.post("/saved-properties/{saved_id}/import-listing-photos")
async def import_listing_photos(saved_id: str, body: ImportListingBody, user_id: str = Depends(require_paid_plan)):
    """Fetch a public listing URL and import likely property images into this saved property."""
    supabase = get_supabase_admin()
    _assert_owns_saved(supabase, user_id, saved_id)
    url = str(body.listing_url)
    try:
        html = await fetch_listing_html(url)
    except Exception as e:
        raise HTTPException(status_code=400, detail="Could not fetch listing page") from e
    img_urls = extract_listing_image_urls(url, html)
    if not img_urls:
        raise HTTPException(status_code=422, detail="No listing images found on that page")

    added = []
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(25.0),
        follow_redirects=True,
        headers={"User-Agent": "PropertyPulse/1.0"},
    ) as client:
        for src in img_urls:
            try:
                resp = await client.get(src)
                resp.raise_for_status()
                data = resp.content
                if len(data) > MAX_UPLOAD_BYTES:
                    continue
                ct = resp.headers.get("content-type", "image/jpeg")
                if not ct.startswith("image/"):
                    continue
                ext = "jpg"
                if "png" in ct:
                    ext = "png"
                elif "webp" in ct:
                    ext = "webp"
                path = f"{user_id}/{saved_id}/import-{uuid.uuid4().hex}.{ext}"
                supabase.storage.from_(BUCKET).upload(
                    path,
                    data,
                    file_options={"content-type": ct, "upsert": "true"},
                )
                ins = (
                    supabase.table("user_property_photos")
                    .insert(
                        {
                            "user_id": user_id,
                            "saved_property_id": saved_id,
                            "storage_path": path,
                            "source": "listing_import",
                            "caption": None,
                            "sort_order": len(added),
                        }
                    )
                    .select()
                    .execute()
                )
                if ins.data:
                    signed = _sign_url(supabase, path)
                    added.append(_photo_row(ins.data[0], signed))
            except Exception:
                continue

    if not added:
        raise HTTPException(status_code=422, detail="Could not download any images from the listing")

    supabase.table("user_saved_properties").update(
        {"external_listing_url": url, "updated_at": _now_iso()}
    ).eq("id", saved_id).execute()
    return {"imported": len(added), "photos": added}


@router.post("/saved-properties/{saved_id}/share")
async def share_with_realtor(saved_id: str, body: ShareBody, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    _assert_owns_saved(supabase, user_id, saved_id)
    if body.realtor_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")
    realtor = await _assert_realtor_subscribed(supabase, body.realtor_id)
    link = supabase.table("profiles").select("linked_realtor_id").eq("id", user_id).execute()
    linked = (link.data[0] if link.data else {}).get("linked_realtor_id")
    if linked and str(linked) != str(body.realtor_id):
        # still allow explicit share to any subscribed realtor
        pass

    share_row = {
        "buyer_id": user_id,
        "realtor_id": body.realtor_id,
        "saved_property_id": saved_id,
        "message": body.message,
        "include_photos": body.include_photos,
        "shared_at": _now_iso(),
    }
    ins = supabase.table("property_realtor_shares").insert(share_row).select().execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Share failed")
    return {
        "id": str(ins.data[0]["id"]),
        "realtor": {"id": str(realtor["id"]), "full_name": realtor.get("full_name"), "email": realtor.get("email")},
    }


@router.get("/realtor/inbox")
async def realtor_inbox(user_id: str = Depends(require_realtor_plan)):
    supabase = get_supabase_admin()
    r = (
        supabase.table("property_realtor_shares")
        .select("*")
        .eq("realtor_id", user_id)
        .order("shared_at", desc=True)
        .limit(100)
        .execute()
    )
    out = []
    for sh in r.data or []:
        sid = sh["saved_property_id"]
        pr = supabase.table("user_saved_properties").select("*").eq("id", sid).execute()
        if not pr.data:
            continue
        prop = pr.data[0]
        buyer_r = supabase.table("profiles").select("full_name, email").eq("id", sh["buyer_id"]).execute()
        buyer = buyer_r.data[0] if buyer_r.data else {}
        photos = []
        if sh.get("include_photos"):
            ph = supabase.table("user_property_photos").select("*").eq("saved_property_id", sid).execute()
            for p in ph.data or []:
                photos.append(_photo_row(p, _sign_url(supabase, p["storage_path"])))
        out.append(
            {
                "share_id": str(sh["id"]),
                "shared_at": sh.get("shared_at"),
                "message": sh.get("message"),
                "buyer": {"id": str(sh["buyer_id"]), **buyer},
                "property": _saved_row(prop),
                "photos": photos,
            }
        )
    return out


@router.post("/folders")
async def create_folder(body: CreateFolderBody, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    row = {"user_id": user_id, "name": body.name.strip(), "sort_order": body.sort_order}
    ins = supabase.table("property_folders").insert(row).select().execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Could not create folder")
    x = ins.data[0]
    return {"id": str(x["id"]), "name": x["name"], "sort_order": x["sort_order"], "created_at": x.get("created_at")}


@router.get("/folders")
async def list_folders(user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    r = supabase.table("property_folders").select("*").eq("user_id", user_id).order("sort_order").execute()
    folders = []
    for f in r.data or []:
        cnt = (
            supabase.table("property_folder_items")
            .select("id", count="exact")
            .eq("folder_id", f["id"])
            .execute()
        )
        # supabase count - simplified: fetch items count
        items = supabase.table("property_folder_items").select("saved_property_id").eq("folder_id", f["id"]).execute()
        n = len(items.data or [])
        folders.append(
            {
                "id": str(f["id"]),
                "name": f["name"],
                "sort_order": f.get("sort_order") or 0,
                "item_count": n,
                "created_at": f.get("created_at"),
            }
        )
    return folders


@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    supabase.table("property_folders").delete().eq("id", folder_id).eq("user_id", user_id).execute()
    return {"ok": True}


@router.post("/folders/{folder_id}/items")
async def add_to_folder(folder_id: str, body: FolderItemBody, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    fr = supabase.table("property_folders").select("id").eq("id", folder_id).eq("user_id", user_id).execute()
    if not fr.data:
        raise HTTPException(status_code=404, detail="Folder not found")
    _assert_owns_saved(supabase, user_id, body.saved_property_id)
    try:
        ins = (
            supabase.table("property_folder_items")
            .insert({"folder_id": folder_id, "saved_property_id": body.saved_property_id})
            .select()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Already in folder or invalid")
    return {"ok": True, "id": str(ins.data[0]["id"]) if ins.data else None}


@router.delete("/folders/{folder_id}/items/{saved_property_id}")
async def remove_from_folder(folder_id: str, saved_property_id: str, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    fr = supabase.table("property_folders").select("id").eq("id", folder_id).eq("user_id", user_id).execute()
    if not fr.data:
        raise HTTPException(status_code=404, detail="Folder not found")
    supabase.table("property_folder_items").delete().eq("folder_id", folder_id).eq(
        "saved_property_id", saved_property_id
    ).execute()
    return {"ok": True}


# ── Peer sharing (folders & saved properties between accounts) ──


@router.post("/peer-shares")
async def create_peer_share(body: PeerShareBody, user_id: str = Depends(require_paid_plan)):
    """Share a folder or a single saved visit with another user (read-only for them)."""
    supabase = get_supabase_admin()
    if body.recipient_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot share with yourself")
    rec = supabase.table("profiles").select("id").eq("id", body.recipient_user_id).execute()
    if not rec.data:
        raise HTTPException(status_code=404, detail="Recipient not found")

    folder_id = body.folder_id
    saved_id = body.saved_property_id
    if (folder_id is None) == (saved_id is None):
        raise HTTPException(status_code=400, detail="Provide exactly one of folder_id or saved_property_id")

    if folder_id:
        _assert_owns_folder(supabase, user_id, folder_id)
        row = {
            "owner_user_id": user_id,
            "recipient_user_id": body.recipient_user_id,
            "folder_id": folder_id,
            "saved_property_id": None,
            "message": body.message,
        }
    else:
        _assert_owns_saved(supabase, user_id, saved_id)
        row = {
            "owner_user_id": user_id,
            "recipient_user_id": body.recipient_user_id,
            "folder_id": None,
            "saved_property_id": saved_id,
            "message": body.message,
        }

    try:
        ins = supabase.table("library_peer_shares").insert(row).select().execute()
    except Exception:
        raise HTTPException(status_code=400, detail="Already shared or could not create share")
    if not ins.data:
        raise HTTPException(status_code=500, detail="Share failed")
    return {"id": str(ins.data[0]["id"]), "ok": True}


@router.delete("/peer-shares/{share_id}")
async def delete_peer_share(share_id: str, user_id: str = Depends(require_paid_plan)):
    supabase = get_supabase_admin()
    r = supabase.table("library_peer_shares").select("*").eq("id", share_id).execute()
    if not r.data:
        raise HTTPException(status_code=404, detail="Share not found")
    row = r.data[0]
    if row["owner_user_id"] != user_id and row["recipient_user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")
    supabase.table("library_peer_shares").delete().eq("id", share_id).execute()
    return {"ok": True}


@router.get("/shared-with-me")
async def shared_with_me(user_id: str = Depends(require_paid_plan)):
    """Properties and folders others shared with you."""
    supabase = get_supabase_admin()
    r = (
        supabase.table("library_peer_shares")
        .select("*")
        .eq("recipient_user_id", user_id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    out: list[dict] = []
    for sh in r.data or []:
        oid = sh["owner_user_id"]
        owner_p = supabase.table("profiles").select("id, full_name, email").eq("id", oid).execute()
        owner = owner_p.data[0] if owner_p else {}
        base = {
            "share_id": str(sh["id"]),
            "message": sh.get("message"),
            "created_at": sh.get("created_at"),
            "owner": {
                "id": str(owner.get("id", oid)),
                "full_name": owner.get("full_name"),
                "email": owner.get("email"),
            },
        }
        if sh.get("saved_property_id"):
            sid = sh["saved_property_id"]
            pr = supabase.table("user_saved_properties").select("*").eq("id", sid).execute()
            if not pr.data:
                continue
            prop = pr.data[0]
            ph_rows = (
                supabase.table("user_property_photos").select("*").eq("saved_property_id", sid).order("sort_order").execute()
            )
            photos = []
            for p in ph_rows.data or []:
                photos.append(_photo_row(p, _sign_url(supabase, p["storage_path"])))
            out.append(
                {
                    **base,
                    "kind": "saved_property",
                    "property": _saved_row(prop),
                    "photos": photos,
                }
            )
        elif sh.get("folder_id"):
            fid = sh["folder_id"]
            fr = supabase.table("property_folders").select("*").eq("id", fid).execute()
            if not fr.data:
                continue
            folder = fr.data[0]
            items = supabase.table("property_folder_items").select("saved_property_id").eq("folder_id", fid).execute()
            properties: list[dict] = []
            for it in items.data or []:
                sid = it["saved_property_id"]
                pr = supabase.table("user_saved_properties").select("*").eq("id", sid).execute()
                if pr.data:
                    properties.append(_saved_row(pr.data[0]))
            out.append(
                {
                    **base,
                    "kind": "folder",
                    "folder": {
                        "id": str(folder["id"]),
                        "name": folder.get("name"),
                        "sort_order": folder.get("sort_order"),
                    },
                    "properties": properties,
                }
            )
    return out


@router.get("/peer-shares/outgoing")
async def peer_shares_outgoing(user_id: str = Depends(require_paid_plan)):
    """Shares you created with other people."""
    supabase = get_supabase_admin()
    r = (
        supabase.table("library_peer_shares")
        .select("*")
        .eq("owner_user_id", user_id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    out = []
    for sh in r.data or []:
        rid = sh["recipient_user_id"]
        rp = supabase.table("profiles").select("id, full_name, email").eq("id", rid).execute()
        rec = rp.data[0] if rp.data else {}
        item: dict = {
            "share_id": str(sh["id"]),
            "message": sh.get("message"),
            "created_at": sh.get("created_at"),
            "recipient": {
                "id": str(rec.get("id", rid)),
                "full_name": rec.get("full_name"),
                "email": rec.get("email"),
            },
        }
        if sh.get("saved_property_id"):
            sid = sh["saved_property_id"]
            pr = supabase.table("user_saved_properties").select("property_address").eq("id", sid).execute()
            item["kind"] = "saved_property"
            item["saved_property_id"] = str(sid)
            item["property_address"] = pr.data[0].get("property_address") if pr.data else ""
        else:
            fid = sh["folder_id"]
            fr = supabase.table("property_folders").select("name").eq("id", fid).execute()
            item["kind"] = "folder"
            item["folder_id"] = str(fid)
            item["folder_name"] = fr.data[0].get("name") if fr.data else ""
        out.append(item)
    return out
