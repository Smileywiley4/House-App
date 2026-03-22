"""
Android Management API v1 proxy — service account on server, Supabase JWT + admin plan.

https://developers.google.com/android/management

Query/body fields use snake_case in FastAPI where aliased; forwarded to Google as camelCase.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.dependencies import require_admin_plan
from app.android_management_v1 import android_management_configured, android_management_request

router = APIRouter(prefix="/google/android-management", tags=["google-android-management"])


def _require_am() -> None:
    if not android_management_configured():
        raise HTTPException(
            status_code=503,
            detail="Android Management not configured (GOOGLE_ANDROID_MANAGEMENT_SA_JSON_PATH).",
        )


def _e(enterprise_id: str) -> str:
    return f"enterprises/{enterprise_id}"


# --- signupUrls ---


@router.post("/v1/signupUrls")
async def am_signup_urls_create(
    project_id: str | None = Query(None, alias="projectId"),
    callback_url: str | None = Query(None, alias="callbackUrl"),
    admin_email: str | None = Query(None, alias="adminEmail"),
    allowed_domains: list[str] | None = Query(None, alias="allowedDomains"),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    params: dict[str, Any] = {}
    if project_id is not None:
        params["projectId"] = project_id
    if callback_url is not None:
        params["callbackUrl"] = callback_url
    if admin_email is not None:
        params["adminEmail"] = admin_email
    if allowed_domains:
        params["allowedDomains"] = allowed_domains
    try:
        return await android_management_request("POST", "signupUrls", params=params or None)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- enterprises ---


@router.get("/v1/enterprises")
async def am_enterprises_list(
    project_id: str = Query(..., alias="projectId"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    view: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    params: dict[str, Any] = {"projectId": project_id}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if view:
        params["view"] = view
    try:
        return await android_management_request("GET", "enterprises", params=params)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1/enterprises")
async def am_enterprises_create(
    project_id: str | None = Query(None, alias="projectId"),
    signup_url_name: str | None = Query(None, alias="signupUrlName"),
    enterprise_token: str | None = Query(None, alias="enterpriseToken"),
    agreement_accepted: bool | None = Query(None, alias="agreementAccepted"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    params: dict[str, Any] = {}
    if project_id is not None:
        params["projectId"] = project_id
    if signup_url_name is not None:
        params["signupUrlName"] = signup_url_name
    if enterprise_token is not None:
        params["enterpriseToken"] = enterprise_token
    if agreement_accepted is not None:
        params["agreementAccepted"] = agreement_accepted
    try:
        return await android_management_request(
            "POST", "enterprises", params=params or None, json_body=body
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1/enterprises/{enterprise_id}")
async def am_enterprises_get(
    enterprise_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = _e(enterprise_id)
    try:
        return await android_management_request("GET", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.patch("/v1/enterprises/{enterprise_id}")
async def am_enterprises_patch(
    enterprise_id: str,
    update_mask: str | None = Query(None, alias="updateMask"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = _e(enterprise_id)
    params = {"updateMask": update_mask} if update_mask else None
    try:
        return await android_management_request("PATCH", name, params=params, json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete("/v1/enterprises/{enterprise_id}")
async def am_enterprises_delete(
    enterprise_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = _e(enterprise_id)
    try:
        return await android_management_request("DELETE", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1/enterprises/{enterprise_id}:generateEnterpriseUpgradeUrl")
async def am_enterprises_generate_upgrade_url(
    enterprise_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}:generateEnterpriseUpgradeUrl"
    try:
        return await android_management_request("POST", name, json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- enrollmentTokens ---


@router.post("/v1/enterprises/{enterprise_id}/enrollmentTokens")
async def am_enrollment_tokens_create(
    enterprise_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    parent = _e(enterprise_id)
    try:
        return await android_management_request("POST", f"{parent}/enrollmentTokens", json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1/enterprises/{enterprise_id}/enrollmentTokens")
async def am_enrollment_tokens_list(
    enterprise_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    parent = _e(enterprise_id)
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await android_management_request("GET", f"{parent}/enrollmentTokens", params=params or None)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1/enterprises/{enterprise_id}/enrollmentTokens/{token_id}")
async def am_enrollment_tokens_get(
    enterprise_id: str,
    token_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/enrollmentTokens/{token_id}"
    try:
        return await android_management_request("GET", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete("/v1/enterprises/{enterprise_id}/enrollmentTokens/{token_id}")
async def am_enrollment_tokens_delete(
    enterprise_id: str,
    token_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/enrollmentTokens/{token_id}"
    try:
        return await android_management_request("DELETE", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- webTokens ---


@router.post("/v1/enterprises/{enterprise_id}/webTokens")
async def am_web_tokens_create(
    enterprise_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    parent = _e(enterprise_id)
    try:
        return await android_management_request("POST", f"{parent}/webTokens", json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- devices ---


@router.get("/v1/enterprises/{enterprise_id}/devices")
async def am_devices_list(
    enterprise_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    parent = _e(enterprise_id)
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await android_management_request("GET", f"{parent}/devices", params=params or None)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1/enterprises/{enterprise_id}/devices/{device_id}")
async def am_devices_get(
    enterprise_id: str,
    device_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/devices/{device_id}"
    try:
        return await android_management_request("GET", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.patch("/v1/enterprises/{enterprise_id}/devices/{device_id}")
async def am_devices_patch(
    enterprise_id: str,
    device_id: str,
    update_mask: str | None = Query(None, alias="updateMask"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/devices/{device_id}"
    params = {"updateMask": update_mask} if update_mask else None
    try:
        return await android_management_request("PATCH", name, params=params, json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete("/v1/enterprises/{enterprise_id}/devices/{device_id}")
async def am_devices_delete(
    enterprise_id: str,
    device_id: str,
    wipe_data_flags: list[str] | None = Query(None, alias="wipeDataFlags"),
    wipe_reason_message: str | None = Query(None, alias="wipeReasonMessage"),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/devices/{device_id}"
    params: dict[str, Any] = {}
    if wipe_data_flags:
        params["wipeDataFlags"] = wipe_data_flags
    if wipe_reason_message is not None:
        params["wipeReasonMessage"] = wipe_reason_message
    try:
        return await android_management_request("DELETE", name, params=params or None)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1/enterprises/{enterprise_id}/devices/{device_id}:issueCommand")
async def am_devices_issue_command(
    enterprise_id: str,
    device_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/devices/{device_id}:issueCommand"
    try:
        return await android_management_request("POST", name, json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- device operations ---


@router.get("/v1/enterprises/{enterprise_id}/devices/{device_id}/operations")
async def am_device_operations_list(
    enterprise_id: str,
    device_id: str,
    filter_expr: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    return_partial_success: bool | None = Query(None, alias="returnPartialSuccess"),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    op_parent = f"{_e(enterprise_id)}/devices/{device_id}/operations"
    params: dict[str, Any] = {}
    if filter_expr:
        params["filter"] = filter_expr
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if return_partial_success is not None:
        params["returnPartialSuccess"] = return_partial_success
    try:
        return await android_management_request("GET", op_parent, params=params or None)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1/enterprises/{enterprise_id}/devices/{device_id}/operations/{operation_id}")
async def am_device_operations_get(
    enterprise_id: str,
    device_id: str,
    operation_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/devices/{device_id}/operations/{operation_id}"
    try:
        return await android_management_request("GET", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1/enterprises/{enterprise_id}/devices/{device_id}/operations/{operation_id}:cancel")
async def am_device_operations_cancel(
    enterprise_id: str,
    device_id: str,
    operation_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/devices/{device_id}/operations/{operation_id}:cancel"
    try:
        return await android_management_request("POST", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- policies ---


@router.get("/v1/enterprises/{enterprise_id}/policies")
async def am_policies_list(
    enterprise_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    parent = _e(enterprise_id)
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await android_management_request("GET", f"{parent}/policies", params=params or None)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1/enterprises/{enterprise_id}/policies/{policy_id}")
async def am_policies_get(
    enterprise_id: str,
    policy_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/policies/{policy_id}"
    try:
        return await android_management_request("GET", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.patch("/v1/enterprises/{enterprise_id}/policies/{policy_id}")
async def am_policies_patch(
    enterprise_id: str,
    policy_id: str,
    update_mask: str | None = Query(None, alias="updateMask"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/policies/{policy_id}"
    params = {"updateMask": update_mask} if update_mask else None
    try:
        return await android_management_request("PATCH", name, params=params, json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete("/v1/enterprises/{enterprise_id}/policies/{policy_id}")
async def am_policies_delete(
    enterprise_id: str,
    policy_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/policies/{policy_id}"
    try:
        return await android_management_request("DELETE", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1/enterprises/{enterprise_id}/policies/{policy_id}:modifyPolicyApplications")
async def am_policies_modify_applications(
    enterprise_id: str,
    policy_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/policies/{policy_id}:modifyPolicyApplications"
    try:
        return await android_management_request("POST", name, json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1/enterprises/{enterprise_id}/policies/{policy_id}:removePolicyApplications")
async def am_policies_remove_applications(
    enterprise_id: str,
    policy_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/policies/{policy_id}:removePolicyApplications"
    try:
        return await android_management_request("POST", name, json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- applications ---


@router.get("/v1/enterprises/{enterprise_id}/applications/{package_name}")
async def am_applications_get(
    enterprise_id: str,
    package_name: str,
    language_code: str | None = Query(None, alias="languageCode"),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/applications/{package_name}"
    params = {"languageCode": language_code} if language_code else None
    try:
        return await android_management_request("GET", name, params=params)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- webApps ---


@router.get("/v1/enterprises/{enterprise_id}/webApps")
async def am_web_apps_list(
    enterprise_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    parent = _e(enterprise_id)
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await android_management_request("GET", f"{parent}/webApps", params=params or None)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1/enterprises/{enterprise_id}/webApps")
async def am_web_apps_create(
    enterprise_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    parent = _e(enterprise_id)
    try:
        return await android_management_request("POST", f"{parent}/webApps", json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1/enterprises/{enterprise_id}/webApps/{web_app_id}")
async def am_web_apps_get(
    enterprise_id: str,
    web_app_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/webApps/{web_app_id}"
    try:
        return await android_management_request("GET", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.patch("/v1/enterprises/{enterprise_id}/webApps/{web_app_id}")
async def am_web_apps_patch(
    enterprise_id: str,
    web_app_id: str,
    update_mask: str | None = Query(None, alias="updateMask"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/webApps/{web_app_id}"
    params = {"updateMask": update_mask} if update_mask else None
    try:
        return await android_management_request("PATCH", name, params=params, json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete("/v1/enterprises/{enterprise_id}/webApps/{web_app_id}")
async def am_web_apps_delete(
    enterprise_id: str,
    web_app_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/webApps/{web_app_id}"
    try:
        return await android_management_request("DELETE", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- migrationTokens ---


@router.post("/v1/enterprises/{enterprise_id}/migrationTokens")
async def am_migration_tokens_create(
    enterprise_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    parent = _e(enterprise_id)
    try:
        return await android_management_request("POST", f"{parent}/migrationTokens", json_body=body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1/enterprises/{enterprise_id}/migrationTokens")
async def am_migration_tokens_list(
    enterprise_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    parent = _e(enterprise_id)
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await android_management_request("GET", f"{parent}/migrationTokens", params=params or None)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1/enterprises/{enterprise_id}/migrationTokens/{migration_token_id}")
async def am_migration_tokens_get(
    enterprise_id: str,
    migration_token_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"{_e(enterprise_id)}/migrationTokens/{migration_token_id}"
    try:
        return await android_management_request("GET", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- provisioningInfo ---


@router.get("/v1/provisioningInfo/{provisioning_info_id}")
async def am_provisioning_info_get(
    provisioning_info_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_am()
    name = f"provisioningInfo/{provisioning_info_id}"
    try:
        return await android_management_request("GET", name)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
