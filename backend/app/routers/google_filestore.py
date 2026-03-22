"""
Cloud Filestore API v1 / v1beta1 proxy — service account (cloud-platform), Supabase JWT + admin plan.

Same routes under `/v1/...` and `/v1beta1/...`. **v1beta1-only:** instance **shares** (multi-share instances).

https://cloud.google.com/filestore/
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from app.dependencies import require_admin_plan
from app.filestore_v1 import filestore_configured, filestore_request

router = APIRouter(prefix="/google/filestore", tags=["google-filestore"])


def _fs_api_version(request: Request) -> str:
    return "v1beta1" if "/google/filestore/v1beta1/" in request.url.path else "v1"


def _require_fs() -> None:
    if not filestore_configured():
        raise HTTPException(
            status_code=503,
            detail="Filestore API not configured (GOOGLE_FILESTORE_SA_JSON_PATH).",
        )


async def _e(
    method: str,
    path: str,
    *,
    api_version: str = "v1",
    **kwargs: Any,
) -> Any:
    try:
        return await filestore_request(method, path, api_version=api_version, **kwargs)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- locations ---


@router.get("/v1/projects/{project_id}/locations/{location_id}")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}")
async def fs_locations_get(
    project_id: str,
    location_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    return await _e("GET", f"projects/{project_id}/locations/{location_id}", api_version=_fs_api_version(request))


@router.get("/v1/projects/{project_id}/locations")
@router.get("/v1beta1/projects/{project_id}/locations")
async def fs_locations_list(
    project_id: str,
    request: Request,
    filter_: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    extra_location_types: list[str] | None = Query(None, alias="extraLocationTypes"),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
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
        api_version=_fs_api_version(request),
        params=params if params else None,
    )


# --- operations ---


@router.get("/v1/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
async def fs_operations_get(
    project_id: str,
    location_id: str,
    operation_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    return await _e(
        "GET",
        f"projects/{project_id}/locations/{location_id}/operations/{operation_id}",
        api_version=_fs_api_version(request),
    )


@router.delete("/v1/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
@router.delete("/v1beta1/projects/{project_id}/locations/{location_id}/operations/{operation_id}")
async def fs_operations_delete(
    project_id: str,
    location_id: str,
    operation_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    return await _e(
        "DELETE",
        f"projects/{project_id}/locations/{location_id}/operations/{operation_id}",
        api_version=_fs_api_version(request),
    )


@router.get("/v1/projects/{project_id}/locations/{location_id}/operations")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/operations")
async def fs_operations_list(
    project_id: str,
    location_id: str,
    request: Request,
    filter_: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    return_partial_success: bool | None = Query(None, alias="returnPartialSuccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
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
        api_version=_fs_api_version(request),
        params=params if params else None,
    )


@router.post("/v1/projects/{project_id}/locations/{location_id}/operations/{operation_id}:cancel")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/operations/{operation_id}:cancel")
async def fs_operations_cancel(
    project_id: str,
    location_id: str,
    operation_id: str,
    request: Request,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/operations/{operation_id}"
    return await _e("POST", f"{name}:cancel", api_version=_fs_api_version(request), json_body=body)


# --- instances ---


@router.get("/v1/projects/{project_id}/locations/{location_id}/instances")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/instances")
async def fs_instances_list(
    project_id: str,
    location_id: str,
    request: Request,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    order_by: str | None = Query(None, alias="orderBy"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
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
        api_version=_fs_api_version(request),
        params=params if params else None,
    )


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances")
async def fs_instances_create(
    project_id: str,
    location_id: str,
    request: Request,
    instance_id: str = Query(..., alias="instanceId"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}/instances",
        api_version=_fs_api_version(request),
        params={"instanceId": instance_id},
        json_body=body,
    )


@router.get("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
async def fs_instances_get(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    return await _e(
        "GET",
        f"projects/{project_id}/locations/{location_id}/instances/{instance_id}",
        api_version=_fs_api_version(request),
    )


@router.patch("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
@router.patch("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
async def fs_instances_patch(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    update_mask: str | None = Query(None, alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    params = {"updateMask": update_mask} if update_mask else None
    return await _e("PATCH", name, api_version=_fs_api_version(request), params=params, json_body=body)


@router.delete("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
@router.delete("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}")
async def fs_instances_delete(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    force: bool | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    params = {"force": force} if force is not None else None
    return await _e("DELETE", name, api_version=_fs_api_version(request), params=params)


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:restore")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:restore")
async def fs_instances_restore(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e("POST", f"{name}:restore", api_version=_fs_api_version(request), json_body=body)


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:revert")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:revert")
async def fs_instances_revert(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e("POST", f"{name}:revert", api_version=_fs_api_version(request), json_body=body)


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:promoteReplica")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:promoteReplica")
async def fs_instances_promote_replica(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e("POST", f"{name}:promoteReplica", api_version=_fs_api_version(request), json_body=body)


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:pauseReplica")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:pauseReplica")
async def fs_instances_pause_replica(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e("POST", f"{name}:pauseReplica", api_version=_fs_api_version(request), json_body=body)


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:resumeReplica")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}:resumeReplica")
async def fs_instances_resume_replica(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e("POST", f"{name}:resumeReplica", api_version=_fs_api_version(request), json_body=body)


# --- snapshots ---


@router.get("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots")
async def fs_snapshots_list(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    order_by: str | None = Query(None, alias="orderBy"),
    filter_: str | None = Query(None, alias="filter"),
    return_partial_success: bool | None = Query(None, alias="returnPartialSuccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    parent = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if order_by:
        params["orderBy"] = order_by
    if filter_:
        params["filter"] = filter_
    if return_partial_success is not None:
        params["returnPartialSuccess"] = return_partial_success
    return await _e(
        "GET",
        f"{parent}/snapshots",
        api_version=_fs_api_version(request),
        params=params if params else None,
    )


@router.get(
    "/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots/{snapshot_id}",
)
@router.get(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots/{snapshot_id}",
)
async def fs_snapshots_get(
    project_id: str,
    location_id: str,
    instance_id: str,
    snapshot_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = (
        f"projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots/{snapshot_id}"
    )
    return await _e("GET", name, api_version=_fs_api_version(request))


@router.post("/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots")
async def fs_snapshots_create(
    project_id: str,
    location_id: str,
    instance_id: str,
    request: Request,
    snapshot_id: str = Query(..., alias="snapshotId"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    parent = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e(
        "POST",
        f"{parent}/snapshots",
        api_version=_fs_api_version(request),
        params={"snapshotId": snapshot_id},
        json_body=body,
    )


@router.delete(
    "/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots/{snapshot_id}",
)
@router.delete(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots/{snapshot_id}",
)
async def fs_snapshots_delete(
    project_id: str,
    location_id: str,
    instance_id: str,
    snapshot_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = (
        f"projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots/{snapshot_id}"
    )
    return await _e("DELETE", name, api_version=_fs_api_version(request))


@router.patch(
    "/v1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots/{snapshot_id}",
)
@router.patch(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots/{snapshot_id}",
)
async def fs_snapshots_patch(
    project_id: str,
    location_id: str,
    instance_id: str,
    snapshot_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    update_mask: str | None = Query(None, alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = (
        f"projects/{project_id}/locations/{location_id}/instances/{instance_id}/snapshots/{snapshot_id}"
    )
    params = {"updateMask": update_mask} if update_mask else None
    return await _e("PATCH", name, api_version=_fs_api_version(request), params=params, json_body=body)


# --- v1beta1: instance shares (multi-share) ---


@router.get(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/shares",
)
async def fs_shares_list(
    project_id: str,
    location_id: str,
    instance_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    order_by: str | None = Query(None, alias="orderBy"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    parent = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if order_by:
        params["orderBy"] = order_by
    if filter_:
        params["filter"] = filter_
    return await _e("GET", f"{parent}/shares", api_version="v1beta1", params=params if params else None)


@router.get(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/shares/{share_id}",
)
async def fs_shares_get(
    project_id: str,
    location_id: str,
    instance_id: str,
    share_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}/shares/{share_id}"
    return await _e("GET", name, api_version="v1beta1")


@router.post(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/shares",
)
async def fs_shares_create(
    project_id: str,
    location_id: str,
    instance_id: str,
    share_id: str = Query(..., alias="shareId"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    parent = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}"
    return await _e(
        "POST",
        f"{parent}/shares",
        api_version="v1beta1",
        params={"shareId": share_id},
        json_body=body,
    )


@router.delete(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/shares/{share_id}",
)
async def fs_shares_delete(
    project_id: str,
    location_id: str,
    instance_id: str,
    share_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}/shares/{share_id}"
    return await _e("DELETE", name, api_version="v1beta1")


@router.patch(
    "/v1beta1/projects/{project_id}/locations/{location_id}/instances/{instance_id}/shares/{share_id}",
)
async def fs_shares_patch(
    project_id: str,
    location_id: str,
    instance_id: str,
    share_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str | None = Query(None, alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/instances/{instance_id}/shares/{share_id}"
    params = {"updateMask": update_mask} if update_mask else None
    return await _e("PATCH", name, api_version="v1beta1", params=params, json_body=body)


# --- backups ---


@router.get("/v1/projects/{project_id}/locations/{location_id}/backups")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/backups")
async def fs_backups_list(
    project_id: str,
    location_id: str,
    request: Request,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    order_by: str | None = Query(None, alias="orderBy"),
    filter_: str | None = Query(None, alias="filter"),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
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
        f"{parent}/backups",
        api_version=_fs_api_version(request),
        params=params if params else None,
    )


@router.get("/v1/projects/{project_id}/locations/{location_id}/backups/{backup_id}")
@router.get("/v1beta1/projects/{project_id}/locations/{location_id}/backups/{backup_id}")
async def fs_backups_get(
    project_id: str,
    location_id: str,
    backup_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    return await _e(
        "GET",
        f"projects/{project_id}/locations/{location_id}/backups/{backup_id}",
        api_version=_fs_api_version(request),
    )


@router.post("/v1/projects/{project_id}/locations/{location_id}/backups")
@router.post("/v1beta1/projects/{project_id}/locations/{location_id}/backups")
async def fs_backups_create(
    project_id: str,
    location_id: str,
    request: Request,
    backup_id: str = Query(..., alias="backupId"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}/backups",
        api_version=_fs_api_version(request),
        params={"backupId": backup_id},
        json_body=body,
    )


@router.delete("/v1/projects/{project_id}/locations/{location_id}/backups/{backup_id}")
@router.delete("/v1beta1/projects/{project_id}/locations/{location_id}/backups/{backup_id}")
async def fs_backups_delete(
    project_id: str,
    location_id: str,
    backup_id: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    return await _e(
        "DELETE",
        f"projects/{project_id}/locations/{location_id}/backups/{backup_id}",
        api_version=_fs_api_version(request),
    )


@router.patch("/v1/projects/{project_id}/locations/{location_id}/backups/{backup_id}")
@router.patch("/v1beta1/projects/{project_id}/locations/{location_id}/backups/{backup_id}")
async def fs_backups_patch(
    project_id: str,
    location_id: str,
    backup_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    update_mask: str | None = Query(None, alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_fs()
    name = f"projects/{project_id}/locations/{location_id}/backups/{backup_id}"
    params = {"updateMask": update_mask} if update_mask else None
    return await _e("PATCH", name, api_version=_fs_api_version(request), params=params, json_body=body)
