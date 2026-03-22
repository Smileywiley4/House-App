"""
Google Policy Analyzer API v1 proxy — service account (cloud-platform), Supabase JWT + admin plan.

Queries policy activities for projects, organizations, or folders.

https://cloud.google.com/iam/docs/policy-analyzer
"""
from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import require_admin_plan
from app.policyanalyzer_v1 import policyanalyzer_configured, policyanalyzer_request

router = APIRouter(prefix="/google/policyanalyzer", tags=["google-policyanalyzer"])


def _require_pa() -> None:
    if not policyanalyzer_configured():
        raise HTTPException(
            status_code=503,
            detail="Policy Analyzer API not configured (GOOGLE_POLICYANALYZER_SA_JSON_PATH).",
        )


async def _e(method: str, path: str, **kwargs: Any) -> Any:
    try:
        return await policyanalyzer_request(method, path, **kwargs)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


def _activities_query_path(
    scope: Literal["projects", "organizations", "folders"],
    resource_id: str,
    location_id: str,
    activity_type_id: str,
) -> str:
    return (
        f"{scope}/{resource_id}/locations/{location_id}/activityTypes/{activity_type_id}/activities:query"
    )


@router.get("/v1/{scope}/{resource_id}/locations/{location_id}/activityTypes/{activity_type_id}/activities:query")
async def policyanalyzer_activities_query(
    scope: Literal["projects", "organizations", "folders"],
    resource_id: str,
    location_id: str,
    activity_type_id: str,
    filter_: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    """GET activities:query for projects | organizations | folders."""
    _require_pa()
    path = _activities_query_path(scope, resource_id, location_id, activity_type_id)
    params: dict[str, Any] = {}
    if filter_ is not None:
        params["filter"] = filter_
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e("GET", path, params=params if params else None)
