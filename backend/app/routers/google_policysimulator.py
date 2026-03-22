"""
Google Policy Simulator API — v1 and v1beta passthrough (discovery REST surface).

Forwards GET/POST/... to:
  https://policysimulator.googleapis.com/v1/{path}
  https://policysimulator.googleapis.com/v1beta/{path}

Service account (cloud-platform). Supabase JWT + admin plan.

https://cloud.google.com/iam/docs/simulating-access
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, Response

from app.dependencies import require_admin_plan
from app.policysimulator_v1 import (
    policysimulator_api_url,
    policysimulator_configured,
    policysimulator_http_request,
)

router = APIRouter(prefix="/google/policysimulator", tags=["google-policysimulator"])


def _require_ps() -> None:
    if not policysimulator_configured():
        raise HTTPException(
            status_code=503,
            detail="Policy Simulator API not configured (GOOGLE_POLICYSIMULATOR_SA_JSON_PATH).",
        )


async def _proxy(
    request: Request,
    resource_path: str,
    *,
    api_version: str,
    timeout: float = 300.0,
) -> Response:
    _require_ps()
    method = request.method.upper()
    body = await request.body()
    ct = request.headers.get("content-type")
    query_items = list(request.query_params.multi_items())
    url = policysimulator_api_url(api_version, resource_path)
    try:
        resp = await policysimulator_http_request(
            method,
            url,
            query_items=query_items,
            content=body if body else None,
            content_type=ct if body and ct else None,
            timeout=timeout,
        )
    except httpx.TimeoutException as e:
        raise HTTPException(status_code=504, detail="Policy Simulator upstream timeout") from e
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
async def policysimulator_v1_proxy(
    request: Request,
    resource_path: str,
    _admin: str = Depends(require_admin_plan),
):
    """Passthrough to Policy Simulator v1 (e.g. .../replays, .../orgPolicyViolationsPreviews, v1/operations/...)."""
    return await _proxy(request, resource_path, api_version="v1")


@router.api_route("/v1beta/{resource_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def policysimulator_v1beta_proxy(
    request: Request,
    resource_path: str,
    _admin: str = Depends(require_admin_plan),
):
    """Passthrough to Policy Simulator v1beta (e.g. ListReplays, orgPolicyViolationsPreviews:generate)."""
    return await _proxy(request, resource_path, api_version="v1beta")
