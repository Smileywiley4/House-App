"""
Google Data Manager API v1 proxy — service account (datamanager scope), Supabase JWT + admin plan.

Optional upstream headers (forwarded when set): `login-account`, `linked-account`
(format: `accountTypes/{type}/accounts/{id}`).

https://developers.google.com/data-manager
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query

from app.datamanager_v1 import datamanager_configured, datamanager_request
from app.dependencies import require_admin_plan

router = APIRouter(prefix="/google/datamanager", tags=["google-datamanager"])


def _require_dm() -> None:
    if not datamanager_configured():
        raise HTTPException(
            status_code=503,
            detail="Data Manager API not configured (GOOGLE_DATAMANAGER_SA_JSON_PATH).",
        )


def _account_headers(
    login_account: str | None = Header(None, alias="login-account"),
    linked_account: str | None = Header(None, alias="linked-account"),
) -> dict[str, str]:
    h: dict[str, str] = {}
    if login_account:
        h["login-account"] = login_account
    if linked_account:
        h["linked-account"] = linked_account
    return h


async def _e(method: str, path: str, **kwargs: Any) -> Any:
    try:
        return await datamanager_request(method, path, **kwargs)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


def _acc(account_type: str, account_id: str) -> str:
    return f"accountTypes/{account_type}/accounts/{account_id}"


# --- top-level ---


@router.post("/v1/audienceMembers:ingest")
async def dm_audience_members_ingest(
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    return await _e("POST", "audienceMembers:ingest", json_body=body, timeout=300.0)


@router.post("/v1/audienceMembers:remove")
async def dm_audience_members_remove(
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    return await _e("POST", "audienceMembers:remove", json_body=body, timeout=300.0)


@router.post("/v1/events:ingest")
async def dm_events_ingest(
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    return await _e("POST", "events:ingest", json_body=body, timeout=300.0)


@router.get("/v1/requestStatus:retrieve")
async def dm_request_status_retrieve(
    request_id: str = Query(..., alias="requestId"),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    return await _e("GET", "requestStatus:retrieve", params={"requestId": request_id})


# --- insights ---


@router.post("/v1/accountTypes/{account_type}/accounts/{account_id}/insights:retrieve")
async def dm_insights_retrieve(
    account_type: str,
    account_id: str,
    body: dict[str, Any] = Body(...),
    auth_headers: dict[str, str] = Depends(_account_headers),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    parent = _acc(account_type, account_id)
    return await _e(
        "POST",
        f"{parent}/insights:retrieve",
        json_body=body,
        extra_headers=auth_headers or None,
    )


# --- partner links ---


@router.post("/v1/accountTypes/{account_type}/accounts/{account_id}/partnerLinks")
async def dm_partner_links_create(
    account_type: str,
    account_id: str,
    body: dict[str, Any] = Body(...),
    auth_headers: dict[str, str] = Depends(_account_headers),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    parent = _acc(account_type, account_id)
    return await _e(
        "POST",
        f"{parent}/partnerLinks",
        json_body=body,
        extra_headers=auth_headers or None,
    )


@router.delete(
    "/v1/accountTypes/{account_type}/accounts/{account_id}/partnerLinks/{partner_link_id}"
)
async def dm_partner_links_delete(
    account_type: str,
    account_id: str,
    partner_link_id: str,
    auth_headers: dict[str, str] = Depends(_account_headers),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    name = f"{_acc(account_type, account_id)}/partnerLinks/{partner_link_id}"
    return await _e("DELETE", name, extra_headers=auth_headers or None)


@router.get("/v1/accountTypes/{account_type}/accounts/{account_id}/partnerLinks:search")
async def dm_partner_links_search(
    account_type: str,
    account_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    auth_headers: dict[str, str] = Depends(_account_headers),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    parent = _acc(account_type, account_id)
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    return await _e(
        "GET",
        f"{parent}/partnerLinks:search",
        params=params if params else None,
        extra_headers=auth_headers or None,
    )


# --- user list direct licenses ---


@router.post("/v1/accountTypes/{account_type}/accounts/{account_id}/userListDirectLicenses")
async def dm_direct_licenses_create(
    account_type: str,
    account_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    parent = _acc(account_type, account_id)
    return await _e("POST", f"{parent}/userListDirectLicenses", json_body=body)


@router.get(
    "/v1/accountTypes/{account_type}/accounts/{account_id}/userListDirectLicenses/{license_id}"
)
async def dm_direct_licenses_get(
    account_type: str,
    account_id: str,
    license_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    name = f"{_acc(account_type, account_id)}/userListDirectLicenses/{license_id}"
    return await _e("GET", name)


@router.patch(
    "/v1/accountTypes/{account_type}/accounts/{account_id}/userListDirectLicenses/{license_id}"
)
async def dm_direct_licenses_patch(
    account_type: str,
    account_id: str,
    license_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str | None = Query(None, alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    name = f"{_acc(account_type, account_id)}/userListDirectLicenses/{license_id}"
    params = {"updateMask": update_mask} if update_mask else None
    return await _e("PATCH", name, params=params, json_body=body)


@router.get("/v1/accountTypes/{account_type}/accounts/{account_id}/userListDirectLicenses")
async def dm_direct_licenses_list(
    account_type: str,
    account_id: str,
    filter_: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    parent = _acc(account_type, account_id)
    params: dict[str, Any] = {}
    if filter_:
        params["filter"] = filter_
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e("GET", f"{parent}/userListDirectLicenses", params=params if params else None)


# --- user list global licenses ---


@router.post("/v1/accountTypes/{account_type}/accounts/{account_id}/userListGlobalLicenses")
async def dm_global_licenses_create(
    account_type: str,
    account_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    parent = _acc(account_type, account_id)
    return await _e("POST", f"{parent}/userListGlobalLicenses", json_body=body)


@router.patch(
    "/v1/accountTypes/{account_type}/accounts/{account_id}/userListGlobalLicenses/{license_id}"
)
async def dm_global_licenses_patch(
    account_type: str,
    account_id: str,
    license_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str | None = Query(None, alias="updateMask"),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    name = f"{_acc(account_type, account_id)}/userListGlobalLicenses/{license_id}"
    params = {"updateMask": update_mask} if update_mask else None
    return await _e("PATCH", name, params=params, json_body=body)


@router.get(
    "/v1/accountTypes/{account_type}/accounts/{account_id}/userListGlobalLicenses/{license_id}"
)
async def dm_global_licenses_get(
    account_type: str,
    account_id: str,
    license_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    name = f"{_acc(account_type, account_id)}/userListGlobalLicenses/{license_id}"
    return await _e("GET", name)


@router.get("/v1/accountTypes/{account_type}/accounts/{account_id}/userListGlobalLicenses")
async def dm_global_licenses_list(
    account_type: str,
    account_id: str,
    filter_: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    parent = _acc(account_type, account_id)
    params: dict[str, Any] = {}
    if filter_:
        params["filter"] = filter_
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e("GET", f"{parent}/userListGlobalLicenses", params=params if params else None)


@router.get(
    "/v1/accountTypes/{account_type}/accounts/{account_id}/userListGlobalLicenses/"
    "{global_license_id}/userListGlobalLicenseCustomerInfos"
)
async def dm_global_license_customer_infos_list(
    account_type: str,
    account_id: str,
    global_license_id: str,
    filter_: str | None = Query(None, alias="filter"),
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    parent = f"{_acc(account_type, account_id)}/userListGlobalLicenses/{global_license_id}"
    params: dict[str, Any] = {}
    if filter_:
        params["filter"] = filter_
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    return await _e(
        "GET",
        f"{parent}/userListGlobalLicenseCustomerInfos",
        params=params if params else None,
    )


# --- user lists ---


@router.get("/v1/accountTypes/{account_type}/accounts/{account_id}/userLists/{user_list_id}")
async def dm_user_lists_get(
    account_type: str,
    account_id: str,
    user_list_id: str,
    auth_headers: dict[str, str] = Depends(_account_headers),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    name = f"{_acc(account_type, account_id)}/userLists/{user_list_id}"
    return await _e("GET", name, extra_headers=auth_headers or None)


@router.get("/v1/accountTypes/{account_type}/accounts/{account_id}/userLists")
async def dm_user_lists_list(
    account_type: str,
    account_id: str,
    page_size: int | None = Query(None, alias="pageSize"),
    page_token: str | None = Query(None, alias="pageToken"),
    filter_: str | None = Query(None, alias="filter"),
    auth_headers: dict[str, str] = Depends(_account_headers),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    parent = _acc(account_type, account_id)
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    if filter_:
        params["filter"] = filter_
    return await _e(
        "GET",
        f"{parent}/userLists",
        params=params if params else None,
        extra_headers=auth_headers or None,
    )


@router.post("/v1/accountTypes/{account_type}/accounts/{account_id}/userLists")
async def dm_user_lists_create(
    account_type: str,
    account_id: str,
    body: dict[str, Any] = Body(...),
    validate_only: bool | None = Query(None, alias="validateOnly"),
    auth_headers: dict[str, str] = Depends(_account_headers),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    parent = _acc(account_type, account_id)
    params = {"validateOnly": validate_only} if validate_only is not None else None
    return await _e(
        "POST",
        f"{parent}/userLists",
        params=params,
        json_body=body,
        extra_headers=auth_headers or None,
    )


@router.patch("/v1/accountTypes/{account_type}/accounts/{account_id}/userLists/{user_list_id}")
async def dm_user_lists_patch(
    account_type: str,
    account_id: str,
    user_list_id: str,
    body: dict[str, Any] = Body(...),
    update_mask: str | None = Query(None, alias="updateMask"),
    validate_only: bool | None = Query(None, alias="validateOnly"),
    auth_headers: dict[str, str] = Depends(_account_headers),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    name = f"{_acc(account_type, account_id)}/userLists/{user_list_id}"
    params: dict[str, Any] = {}
    if update_mask:
        params["updateMask"] = update_mask
    if validate_only is not None:
        params["validateOnly"] = validate_only
    return await _e(
        "PATCH",
        name,
        params=params if params else None,
        json_body=body,
        extra_headers=auth_headers or None,
    )


@router.delete("/v1/accountTypes/{account_type}/accounts/{account_id}/userLists/{user_list_id}")
async def dm_user_lists_delete(
    account_type: str,
    account_id: str,
    user_list_id: str,
    validate_only: bool | None = Query(None, alias="validateOnly"),
    auth_headers: dict[str, str] = Depends(_account_headers),
    _admin: str = Depends(require_admin_plan),
):
    _require_dm()
    name = f"{_acc(account_type, account_id)}/userLists/{user_list_id}"
    params = {"validateOnly": validate_only} if validate_only is not None else None
    return await _e("DELETE", name, params=params, extra_headers=auth_headers or None)
