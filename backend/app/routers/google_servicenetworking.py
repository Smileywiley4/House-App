"""
Google Service Networking API v1 — passthrough (discovery REST).

Forwards to https://servicenetworking.googleapis.com/v1/{path}

Service account (cloud-platform). Supabase JWT + admin plan.

Examples (path segment after /v1/):
  operations
  operations/{id}
  services/servicenetworking.googleapis.com/connections?network=...

https://cloud.google.com/service-infrastructure/docs/service-networking/getting-started
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response

from app.dependencies import require_admin_plan
from app.servicenetworking_v1 import (
    servicenetworking_configured,
    servicenetworking_http_request,
    servicenetworking_v1_url,
)

router = APIRouter(prefix="/google/servicenetworking", tags=["google-servicenetworking"])


def _require_sn() -> None:
    if not servicenetworking_configured():
        raise HTTPException(
            status_code=503,
            detail="Service Networking API not configured (GOOGLE_SERVICENETWORKING_SA_JSON_PATH).",
        )


async def _proxy(request: Request, resource_path: str, *, timeout: float = 300.0) -> Response:
    _require_sn()
    method = request.method.upper()
    body = await request.body()
    ct = request.headers.get("content-type")
    query_items = list(request.query_params.multi_items())
    url = servicenetworking_v1_url(resource_path)
    try:
        resp = await servicenetworking_http_request(
            method,
            url,
            query_items=query_items,
            content=body if body else None,
            content_type=ct if body and ct else None,
            timeout=timeout,
        )
    except httpx.TimeoutException as e:
        raise HTTPException(status_code=504, detail="Service Networking upstream timeout") from e
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


@router.api_route("/v1/{resource_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def servicenetworking_v1_proxy(
    request: Request,
    resource_path: str,
    _admin: str = Depends(require_admin_plan),
):
    """Passthrough to Service Networking API v1."""
    return await _proxy(request, resource_path)
