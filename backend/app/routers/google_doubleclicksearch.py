"""
DoubleClick Search API v2 — passthrough proxy (Search Ads 360).

Forwards to https://www.googleapis.com/doubleclicksearch/v2/{path}

OAuth refresh token on server. Supabase JWT + admin plan.

Example path segment:
  agency/{agencyId}/advertiser/{advertiserId}/idmapping

https://developers.google.com/search-ads/reporting
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response

from app.dependencies import require_admin_plan
from app.doubleclicksearch_v2 import (
    doubleclicksearch_configured,
    doubleclicksearch_http_request,
    doubleclicksearch_v2_url,
)

router = APIRouter(prefix="/google/doubleclicksearch", tags=["google-doubleclicksearch"])


def _require_dcs() -> None:
    if not doubleclicksearch_configured():
        raise HTTPException(
            status_code=503,
            detail="DoubleClick Search API not configured (OAuth client + refresh token).",
        )


async def _proxy(request: Request, resource_path: str, *, timeout: float = 120.0) -> Response:
    _require_dcs()
    method = request.method.upper()
    body = await request.body()
    ct = request.headers.get("content-type")
    query_items = list(request.query_params.multi_items())
    url = doubleclicksearch_v2_url(resource_path)
    try:
        resp = await doubleclicksearch_http_request(
            method,
            url,
            query_items=query_items,
            content=body if body else None,
            content_type=ct if body and ct else None,
            timeout=timeout,
        )
    except httpx.TimeoutException as e:
        raise HTTPException(status_code=504, detail="DoubleClick Search upstream timeout") from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    resp_ct = (resp.headers.get("content-type") or "").lower()
    if resp.status_code >= 400:
        if "application/json" in resp_ct and resp.content:
            try:
                return JSONResponse(content=resp.json(), status_code=resp.status_code)
            except Exception:
                pass
        raise HTTPException(
            status_code=resp.status_code,
            detail=resp.text[:8000] if resp.text else f"HTTP {resp.status_code}",
        )

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
    )


@router.api_route("/v2/{resource_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def doubleclicksearch_v2_proxy(
    request: Request,
    resource_path: str,
    _admin: str = Depends(require_admin_plan),
):
    """Passthrough to DoubleClick Search API v2."""
    return await _proxy(request, resource_path)
