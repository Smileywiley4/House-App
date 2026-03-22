"""
Cloud Data Fusion API v1 / v1beta1 proxy — service account (cloud-platform), Supabase JWT + admin plan.

https://cloud.google.com/data-fusion/docs

Same routes are registered under `/v1/...` and `/v1beta1/...` (Google path prefix). v1beta1-only:
`removeIamPolicy`, `upgrade`, instance `namespaces` (+ IAM).

Query params use camelCase aliases where they match Google. Override API host with GOOGLE_DATA_FUSION_BASE_URL for regional endpoints.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from app.dependencies import require_admin_plan
from app.data_fusion_v1 import data_fusion_configured, data_fusion_request

router = APIRouter(prefix="/google/data-fusion", tags=["google-data-fusion"])


def _df_api_version(request: Request) -> str:
    return "v1beta1" if "/google/data-fusion/v1beta1/" in request.url.path else "v1"


def _require_df() -> None:
    if not data_fusion_configured():
        raise HTTPException(
            status_code=503,
            detail="Data Fusion API not configured (GOOGLE_DATA_FUSION_SA_JSON_PATH).",
        )


async def _e(
    method: str,
    path: str,
    *,
    api_version: str = "v1",
    **kwargs: Any,
) -> Any:
    try:
        return await data_fusion_request(method, path, api_version=api_version, **kwargs)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- projects.locations ---


@router.get("/v1/projects/{project_id}/locations/{location_id}")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}")
async def df_locations_get(
    project_id: str,
    location_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    name = f"projects/{project_id}/locations/{location_id}"
    return await _e("GET", name, api_version=_df_api_version(request))


@router.get("/v1/projects/{project_id}/locations")
@router.get("/v1beta1/projects/{project_id}/locations")
async def df_locations_list(
    project_id: str,
    request: Request,
    filter_: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    extra_location_types: list[str] | None = Query(None, alias="extraLocationTypes"),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    parent = f"projects/{project_id}"
    params: dict[str, Any] = {}
    if filter_:
        params["filter"] = filter_
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if extra_location_types:
        params["extraLocationTypes"] = extra_location_types
    return await _e(
        "GET",
        f"{parent}/locations",
        api_version=_df_api_version(request),
        params=params if params else None,
    )


# --- projects.locations.operations ---


@router.get("/v1/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
async def df_operations_get(
    project_id: str,
    location_id: str,
    operation_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    name = f"projects/{project_id}/locations/{location_id}/operations/{operation_id}"
    return await _e("GET", name, api_version=_df_api_version(request))


@router.delete("/v1/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
@router.delete("/v1beta1/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
async def df_operations_delete(
    project_id: str,
    location_id: str,
    operation_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    name = f"projects/{project_id}/locations/{location_id}/operations/{operation_id}"
    return await _e("DELETE", name, api_version=_df_api_version(request))


@router.get("/v1/projects/{project_id}/locations/{location_id}/operations")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/operations")
async def df_operations_list(
    project_id: str,
    location_id: str,
    request: Request,
    filter_: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    return_partial_success: bool | None = Query(None, alias="returnPartialSuccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    parent = f"projects/{project_id}/locations/{location_id}"
    params: dict[str, Any] = {}
    if filter_:
        params["filter"] = filter_
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if return_partial_success is not None:
        params["returnPartialSuccess"] = return_partial_success
    return await _e(
        "GET",
        f"{parent}/operations",
        api_version=_df_api_version(request),
        params=params if params else None,
    )


@router.post("/v1/projects/{project_id}/locations/{location_id}/operations/{operation_id}:cancel")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/operations/{operation_id}:cancel")
async def df_operations_cancel(
    project_id: str,
    location_id: str,
    operation_id: str,
    request: Request,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    name = f"projects/{project_id}/locations/{location_id}/operations/{operation_id}"
    return await _e(
        "POST",
        f"{name}:cancel",
        api_version=_df_api_version(request),
        json_body=body,
    )


# --- projects.locations.instances ---


@router.get("/v1/projects/{project_id}/locations/{location_id}/instances")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/instances")
async def df_instances_list(
    project_id: str,
    location_id: str,
    request: Request,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    order_by: str | None = Query(None, alias="orderBy"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    parent = f"projects/{project_id}/locations/{location_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if order_by:
        params["orderBy"] = order_by
    if filter_:
        params["filter"] = filter_
    return await _e(
        "GET",
        f"{parent}/instances",
        api_version=_df_api_version(request),
        params=params if params else None,
    )


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances")
async def df_instances_create(
    project_id: str,
    location_id: str,
    request: Request,
    instance_id: str = Query(..., alias="instanceId"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}/instances",
        api_version=_df_api_version(request),
        params={"instanceId": instance_id},
        json_body=body,
    )


@router.get("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
async def df_instances_get(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e("GET", name, api_version=_df_api_version(request))


@router.patch("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
@router.patch("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
async def df_instances_patch(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    update_mask: str | None = Query(None, alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    params = {"updateMask": update_mask} if update_mask else None
    return await _e("PATCH", name, api_version=_df_api_version(request), params=params, json_body=body)


@router.delete("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
@router.delete("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
async def df_instances_delete(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    force: bool | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    params = {"force": force} if force is not None else None
    return await _e("DELETE", name, api_version=_df_api_version(request), params=params)


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:restart")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:restart")
async def df_instances_restart(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e(
        "POST",
        f"{name}:restart",
        api_version=_df_api_version(request),
        json_body=body,
    )


@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:upgrade")
async def df_instances_upgrade(
    project_id: str,
    location_id: str,
    instance_id: str,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    """v1beta1 only — upgrade instance to latest stable Data Fusion version."""
    _require_df()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e("POST", f"{name}:upgrade", api_version="v1beta1", json_body=body)


@router.get("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:getIamPolicy")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:getIamPolicy")
async def df_instances_get_iam_policy(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    options_requested_policy_version: int | None = Query(
        None,
        alias="options.requestedPolicyVersion",
    ),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    resource = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    params = (
        {"options.requestedPolicyVersion": options_requested_policy_version}
        if options_requested_policy_version is not None
        else None
    )
    return await _e(
        "GET",
        f"{resource}:getIamPolicy",
        api_version=_df_api_version(request),
        params=params,
    )


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:setIamPolicy")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:setIamPolicy")
async def df_instances_set_iam_policy(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    resource = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e(
        "POST",
        f"{resource}:setIamPolicy",
        api_version=_df_api_version(request),
        json_body=body,
    )


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:testIamPermissions")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:testIamPermissions")
async def df_instances_test_iam_permissions(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    resource = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e(
        "POST",
        f"{resource}:testIamPermissions",
        api_version=_df_api_version(request),
        json_body=body,
    )


# --- v1beta1: locations.removeIamPolicy (resource under projects/{p}/locations/{l}/...) ---


@router.post(
    "/v1beta1/projects/{project_id}/locations/{location_id}/{resource_tail:path}:removeIamPolicy",
)
async def df_locations_remove_iam_policy(
    project_id: str,
    location_id: str,
    resource_tail: str,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    """v1beta1 only — `resource_tail` e.g. `instances/my-instance`."""
    _require_df()
    tail = resource_tail.strip().lstrip("/")
    resource = f"projects/{project_id}/locations/{location_id}/{tail}"
    return await _e(
        "POST",
        f"{resource}:removeIamPolicy",
        api_version="v1beta1",
        json_body=body,
    )


# --- dnsPeerings ---


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/dnsPeerings")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/dnsPeerings")
async def df_dns_peerings_create(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    dns_peering_id: str = Query(..., alias="dnsPeeringId"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    parent = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e(
        "POST",
        f"{parent}/dnsPeerings",
        api_version=_df_api_version(request),
        params={"dnsPeeringId": dns_peering_id},
        json_body=body,
    )


@router.get("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/dnsPeerings")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/dnsPeerings")
async def df_dns_peerings_list(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    parent = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e(
        "GET",
        f"{parent}/dnsPeerings",
        api_version=_df_api_version(request),
        params=params if params else None,
    )


@router.delete(
    "/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/dnsPeerings/{dns_peering_id}",
)
@router.delete(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/dnsPeerings/{dns_peering_id}",
)
async def df_dns_peerings_delete(
    project_id: str,
    location_id: str,
    instance_id: str,
    dns_peering_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    name = (
        f"projects/{project_id}/locations/{location_id}/instances/{instance_id}/dnsPeerings/{dns_peering_id}"
    )
    return await _e("DELETE", name, api_version=_df_api_version(request))


# --- versions ---


@router.get("/v1/projects/{project_id}/locations/{location_id}/versions")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/versions")
async def df_versions_list(
    project_id: str,
    location_id: str,
    request: Request,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    latest_patch_only: bool | None = Query(None, alias="latestPatchOnly"),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    parent = f"projects/{project_id}/locations/{location_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if latest_patch_only is not None:
        params["latestPatchOnly"] = latest_patch_only
    return await _e(
        "GET",
        f"{parent}/versions",
        api_version=_df_api_version(request),
        params=params if params else None,
    )


# --- v1beta1: instance namespaces ---


@router.get(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/namespaces",
)
async def df_namespaces_list(
    project_id: str,
    location_id: str,
    instance_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    view: str | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    parent = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if view:
        params["view"] = view
    return await _e(
        "GET",
        f"{parent}/namespaces",
        api_version="v1beta1",
        params=params if params else None,
    )


@router.get(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/namespaces/{namespace_id}:getIamPolicy",
)
async def df_namespaces_get_iam_policy(
    project_id: str,
    location_id: str,
    instance_id: str,
    namespace_id: str,
    options_requested_policy_version: int | None = Query(
        None,
        alias="options.requestedPolicyVersion",
    ),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    resource = (
        f"projects/{project_id}/locations/{location_id}/instances/{instance_id}/namespaces/{namespace_id}"
    )
    params = (
        {"options.requestedPolicyVersion": options_requested_policy_version}
        if options_requested_policy_version is not None
        else None
    )
    return await _e("GET", f"{resource}:getIamPolicy", api_version="v1beta1", params=params)


@router.post(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/namespaces/{namespace_id}:setIamPolicy",
)
async def df_namespaces_set_iam_policy(
    project_id: str,
    location_id: str,
    instance_id: str,
    namespace_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    resource = (
        f"projects/{project_id}/locations/{location_id}/instances/{instance_id}/namespaces/{namespace_id}"
    )
    return await _e("POST", f"{resource}:setIamPolicy", api_version="v1beta1", json_body=body)


@router.post(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/namespaces/{namespace_id}:testIamPermissions",
)
async def df_namespaces_test_iam_permissions(
    project_id: str,
    location_id: str,
    instance_id: str,
    namespace_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_df()
    resource = (
        f"projects/{project_id}/locations/{location_id}/instances/{instance_id}/namespaces/{namespace_id}"
    )
    return await _e(
        "POST",
        f"{resource}:testIamPermissions",
        api_version="v1beta1",
        json_body=body,
    )
