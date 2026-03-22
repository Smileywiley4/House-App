"""
Google Drive API v3 proxy — passthrough to discovery REST surface.

- JSON:   GET/POST/PATCH/PUT/DELETE → https://www.googleapis.com/drive/v3/{path}
- Upload: POST/PUT/PATCH → https://www.googleapis.com/upload/drive/v3/{path}
- Resumable: POST/PUT/PATCH → https://www.googleapis.com/resumable/upload/drive/v3/{path}

Service account + optional Workspace user impersonation (domain-wide delegation).
Supabase JWT + admin plan required.

https://developers.google.com/workspace/drive/
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response

from app.dependencies import require_admin_plan
from app.drive_v3 import (
    drive_configured,
    drive_http_request,
    drive_json_url,
    drive_resumable_url,
    drive_upload_url,
)

router = APIRouter(prefix="/google/drive", tags=["google-drive"])


def _require_drive() -> None:
    if not drive_configured():
        raise HTTPException(
            status_code=503,
            detail="Google Drive API not configured (GOOGLE_DRIVE_SA_JSON_PATH).",
        )


def _query_items(request: Request) -> list[tuple[str, str]]:
    return list(request.query_params.multi_items())


def _hop_by_hop() -> frozenset[str]:
    return frozenset(
        {
            "connection",
            "keep-alive",
            "proxy-authenticate",
            "proxy-authorization",
            "te",
            "trailers",
            "transfer-encoding",
            "upgrade",
            "host",
            "content-length",
            "authorization",
        }
    )


def _forwardable_headers(request: Request) -> dict[str, str]:
    """Forward client headers needed for Drive media / resumable uploads."""
    skip = _hop_by_hop()
    out: dict[str, str] = {}
    for key, value in request.headers.items():
        lk = key.lower()
        if lk in skip:
            continue
        if lk in ("content-type", "content-range") or lk.startswith("x-goog-") or lk.startswith("x-upload-"):
            out[key] = value
    return out


async def _proxy(
    request: Request,
    url: str,
    *,
    timeout: float = 300.0,
) -> Response:
    _require_drive()
    method = request.method.upper()
    body = await request.body()
    ct = request.headers.get("content-type")
    query_items = _query_items(request)
    fwd = _forwardable_headers(request)

    try:
        resp = await drive_http_request(
            method,
            url,
            query_items=query_items,
            content=body if body else None,
            content_type=ct if body and ct else None,
            forward_headers=fwd or None,
            timeout=timeout,
        )
    except httpx.TimeoutException as e:
        raise HTTPException(status_code=504, detail="Drive API upstream timeout") from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    resp_ct = (resp.headers.get("content-type") or "").lower()
    out_headers: dict[str, str] = {}
    for h in ("content-disposition", "content-range", "location", "x-goog-upload-status"):
        v = resp.headers.get(h)
        if v:
            out_headers[h] = v

    if resp.status_code >= 400:
        if "application/json" in resp_ct and resp.content:
            try:
                return JSONResponse(content=resp.json(), status_code=resp.status_code)
            except Exception:
                pass
        detail = resp.text[:8000] if resp.text else f"HTTP {resp.status_code}"
        raise HTTPException(status_code=resp.status_code, detail=detail)

    if resp.status_code == 204 or not resp.content:
        return Response(status_code=204)

    if "application/json" in resp_ct or resp_ct.endswith("+json"):
        try:
            return JSONResponse(content=resp.json(), status_code=resp.status_code)
        except Exception:
            pass

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type") or "application/octet-stream",
        headers=out_headers,
    )


@router.api_route("/v3/{resource_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def drive_v3_json_proxy(
    request: Request,
    resource_path: str,
    _admin: str = Depends(require_admin_plan),
):
    url = drive_json_url(resource_path)
    return await _proxy(request, url)


@router.api_route("/upload/v3/{resource_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def drive_v3_upload_proxy(
    request: Request,
    resource_path: str,
    _admin: str = Depends(require_admin_plan),
):
    url = drive_upload_url(resource_path)
    return await _proxy(request, url, timeout=600.0)


@router.api_route("/resumable/v3/{resource_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def drive_v3_resumable_proxy(
    request: Request,
    resource_path: str,
    _admin: str = Depends(require_admin_plan),
):
    url = drive_resumable_url(resource_path)
    return await _proxy(request, url, timeout=600.0)
