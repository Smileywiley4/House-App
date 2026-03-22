"""
Chrome Web Store API v2 proxy — service account on server, Supabase JWT + admin plan.

https://developer.chrome.com/docs/webstore/api

readonly access only allows fetchStatus; publish/upload/cancel/setPublishedDeployPercentage require readwrite.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile

from app.config import get_settings
from app.dependencies import require_admin_plan
from app.chrome_webstore_v2 import (
    chrome_webstore_configured,
    chrome_webstore_request,
    chrome_webstore_upload_package,
)

router = APIRouter(prefix="/google/chrome-webstore", tags=["google-chrome-webstore"])


def _require_cws() -> None:
    if not chrome_webstore_configured():
        raise HTTPException(
            status_code=503,
            detail="Chrome Web Store API not configured (GOOGLE_CHROME_WEBSTORE_SA_JSON_PATH).",
        )


def _is_readonly() -> bool:
    return get_settings().google_chrome_webstore_access.strip().lower() == "readonly"


def _require_write() -> None:
    if _is_readonly():
        raise HTTPException(
            status_code=403,
            detail="Chrome Web Store proxy is read-only; set GOOGLE_CHROME_WEBSTORE_ACCESS=readwrite for writes.",
        )


def _item(publisher_id: str, item_id: str) -> str:
    return f"publishers/{publisher_id}/items/{item_id}"


async def _e(method: str, path: str, **kwargs: Any) -> Any:
    try:
        return await chrome_webstore_request(method, path, **kwargs)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v2/publishers/{publisher_id}/items/{item_id}:publish")
async def cws_publish(
    publisher_id: str,
    item_id: str,
    body: dict[str, Any] = Body(default_factory=dict),
    fields: str | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_cws()
    _require_write()
    name = _item(publisher_id, item_id)
    params = {"fields": fields} if fields else None
    return await _e("POST", f"{name}:publish", params=params, json_body=body)


@router.get("/v2/publishers/{publisher_id}/items/{item_id}:fetchStatus")
async def cws_fetch_status(
    publisher_id: str,
    item_id: str,
    fields: str | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_cws()
    name = _item(publisher_id, item_id)
    params = {"fields": fields} if fields else None
    return await _e("GET", f"{name}:fetchStatus", params=params)


@router.post("/v2/publishers/{publisher_id}/items/{item_id}:cancelSubmission")
async def cws_cancel_submission(
    publisher_id: str,
    item_id: str,
    body: dict[str, Any] = Body(default_factory=dict),
    fields: str | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_cws()
    _require_write()
    name = _item(publisher_id, item_id)
    params = {"fields": fields} if fields else None
    return await _e("POST", f"{name}:cancelSubmission", params=params, json_body=body)


@router.post("/v2/publishers/{publisher_id}/items/{item_id}:setPublishedDeployPercentage")
async def cws_set_published_deploy_percentage(
    publisher_id: str,
    item_id: str,
    body: dict[str, Any] = Body(...),
    fields: str | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_cws()
    _require_write()
    name = _item(publisher_id, item_id)
    params = {"fields": fields} if fields else None
    return await _e("POST", f"{name}:setPublishedDeployPercentage", params=params, json_body=body)


@router.post("/v2/publishers/{publisher_id}/items/{item_id}:upload")
async def cws_upload(
    publisher_id: str,
    item_id: str,
    file: UploadFile = File(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_cws()
    _require_write()
    content = await file.read()
    ct = file.content_type or "application/zip"
    name = _item(publisher_id, item_id)
    try:
        return await chrome_webstore_upload_package(name, file_bytes=content, content_type=ct)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
