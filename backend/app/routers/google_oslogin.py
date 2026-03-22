"""
Cloud OS Login API v1 / v1beta proxy — service account (cloud-platform), Supabase JWT + admin plan.

Same routes under `/v1/...` and `/v1beta/...`. **v1beta-only query:** `view` on loginProfile / importSshPublicKey.
**v1beta-only paths:** `users/.../projects/.../zones/...:signSshPublicKey` and `.../locations/...:signSshPublicKey`.

https://cloud.google.com/compute/docs/oslogin/

`user_id` path segments should be URL-encoded (e.g. email → %40).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request

from app.dependencies import require_admin_plan
from app.oslogin_v1 import oslogin_configured, oslogin_request

router = APIRouter(prefix="/google/oslogin", tags=["google-oslogin"])


def _os_api_version(request: Request) -> str:
    return "v1beta" if "/google/oslogin/v1beta/" in request.url.path else "v1"


def _require_oslogin() -> None:
    if not oslogin_configured():
        raise HTTPException(
            status_code=503,
            detail="OS Login API not configured (GOOGLE_OSLOGIN_SA_JSON_PATH).",
        )


async def _e(method: str, path: str, *, api_version: str = "v1", **kwargs: Any) -> Any:
    try:
        return await oslogin_request(method, path, api_version=api_version, **kwargs)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- projects.locations (regional sign — v1 uses SignSshPublicKeyRequest family; v1beta uses regional request body) ---


@router.post("/v1/projects/{project_id}/locations/{location_id}:signSshPublicKey")
@router.post("/v1beta/projects/{project_id}/locations/{location_id}:signSshPublicKey")
async def oslogin_sign_ssh_public_key(
    project_id: str,
    location_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_oslogin()
    parent = f"projects/{project_id}/locations/{location_id}"
    return await _e(
        "POST",
        f"{parent}:signSshPublicKey",
        api_version=_os_api_version(request),
        json_body=body,
    )


# --- users ---


@router.get("/v1/users/{user_id}/loginProfile")
@router.get("/v1beta/users/{user_id}/loginProfile")
async def oslogin_get_login_profile(
    user_id: str,
    request: Request,
    project_id: str = Query(..., alias="projectId"),
    system_id: str | None = Query(None, alias="systemId"),
    view: str | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_oslogin()
    name = f"users/{user_id}"
    params: dict[str, Any] = {"projectId": project_id}
    if system_id:
        params["systemId"] = system_id
    if view and _os_api_version(request) == "v1beta":
        params["view"] = view
    return await _e("GET", f"{name}/loginProfile", api_version=_os_api_version(request), params=params)


@router.post("/v1/users/{user_id}:importSshPublicKey")
@router.post("/v1beta/users/{user_id}:importSshPublicKey")
async def oslogin_import_ssh_public_key(
    user_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    project_id: str | None = Query(None, alias="projectId"),
    regions: list[str] | None = Query(None),
    view: str | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_oslogin()
    parent = f"users/{user_id}"
    params: dict[str, Any] = {}
    if project_id:
        params["projectId"] = project_id
    if regions:
        params["regions"] = regions
    if view and _os_api_version(request) == "v1beta":
        params["view"] = view
    return await _e(
        "POST",
        f"{parent}:importSshPublicKey",
        api_version=_os_api_version(request),
        params=params if params else None,
        json_body=body,
    )


# --- users.sshPublicKeys ---


@router.post("/v1/users/{user_id}/sshPublicKeys")
@router.post("/v1beta/users/{user_id}/sshPublicKeys")
async def oslogin_ssh_keys_create(
    user_id: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_oslogin()
    parent = f"users/{user_id}"
    return await _e("POST", f"{parent}/sshPublicKeys", api_version=_os_api_version(request), json_body=body)


@router.get("/v1/users/{user_id}/sshPublicKeys/{fingerprint}")
@router.get("/v1beta/users/{user_id}/sshPublicKeys/{fingerprint}")
async def oslogin_ssh_keys_get(
    user_id: str,
    fingerprint: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_oslogin()
    name = f"users/{user_id}/sshPublicKeys/{fingerprint}"
    return await _e("GET", name, api_version=_os_api_version(request))


@router.patch("/v1/users/{user_id}/sshPublicKeys/{fingerprint}")
@router.patch("/v1beta/users/{user_id}/sshPublicKeys/{fingerprint}")
async def oslogin_ssh_keys_patch(
    user_id: str,
    fingerprint: str,
    request: Request,
    body: dict[str, Any] = Body(...),
    update_mask: str | None = Query(None, alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_oslogin()
    name = f"users/{user_id}/sshPublicKeys/{fingerprint}"
    params = {"updateMask": update_mask} if update_mask else None
    return await _e("PATCH", name, api_version=_os_api_version(request), params=params, json_body=body)


@router.delete("/v1/users/{user_id}/sshPublicKeys/{fingerprint}")
@router.delete("/v1beta/users/{user_id}/sshPublicKeys/{fingerprint}")
async def oslogin_ssh_keys_delete(
    user_id: str,
    fingerprint: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_oslogin()
    name = f"users/{user_id}/sshPublicKeys/{fingerprint}"
    return await _e("DELETE", name, api_version=_os_api_version(request))


# --- users.projects ---


@router.post("/v1/users/{user_id}/projects/{project_ref}")
@router.post("/v1beta/users/{user_id}/projects/{project_ref}")
async def oslogin_provision_posix_account(
    user_id: str,
    project_ref: str,
    request: Request,
    body: dict[str, Any] = Body(default_factory=dict),
    _admin: str = Depends(require_admin_plan),
):
    """`project_ref` is the GCP project ID (or number) in the resource name."""
    _require_oslogin()
    name = f"users/{user_id}/projects/{project_ref}"
    return await _e("POST", name, api_version=_os_api_version(request), json_body=body)


@router.delete("/v1/users/{user_id}/projects/{project_ref}")
@router.delete("/v1beta/users/{user_id}/projects/{project_ref}")
async def oslogin_delete_posix_account(
    user_id: str,
    project_ref: str,
    request: Request,
    _admin: str = Depends(require_admin_plan),
):
    _require_oslogin()
    name = f"users/{user_id}/projects/{project_ref}"
    return await _e("DELETE", name, api_version=_os_api_version(request))


# --- v1beta: user + project + zone/location sign (SignSshPublicKeyRequest: sshPublicKey only) ---


@router.post(
    "/v1beta/users/{user_id}/projects/{project_ref}/zones/{zone_id}:signSshPublicKey",
)
async def oslogin_user_project_zone_sign_ssh(
    user_id: str,
    project_ref: str,
    zone_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_oslogin()
    parent = f"users/{user_id}/projects/{project_ref}/zones/{zone_id}"
    return await _e("POST", f"{parent}:signSshPublicKey", api_version="v1beta", json_body=body)


@router.post(
    "/v1beta/users/{user_id}/projects/{project_ref}/locations/{location_id}:signSshPublicKey",
)
async def oslogin_user_project_location_sign_ssh(
    user_id: str,
    project_ref: str,
    location_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_oslogin()
    parent = f"users/{user_id}/projects/{project_ref}/locations/{location_id}"
    return await _e("POST", f"{parent}:signSshPublicKey", api_version="v1beta", json_body=body)
