"""
AdSense Platform API proxy (Google `v1alpha`) — A4P sub-accounts + Transparent Platform (accounts/…/platforms).

Same OAuth credentials as AdSense Management. Mutations require GOOGLE_ADSENSE_ACCESS=readwrite.
IDs are typically `pub-…` segments; full resource names (with slashes) are accepted where applicable.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.config import get_settings
from app.dependencies import require_admin_plan
from app.google_adsense_v2 import adsense_configured
from app.google_adsense_platform_v1 import (
    ListTransparentPlatformChildSitesResponse,
    ListTransparentPlatformGroupsResponse,
    ListTransparentPlatformsResponse,
    PlatformAccount,
    PlatformCloseAccountResponse,
    PlatformEvent,
    PlatformListAccountsResponse,
    PlatformListSitesResponse,
    PlatformLookupAccountResponse,
    PlatformRequestSiteReviewResponse,
    PlatformSite,
    PlatformEmpty,
    TransparentPlatform,
    TransparentPlatformChildSite,
    TransparentPlatformGroup,
    account_platform_child_sites_get,
    account_platform_child_sites_list,
    account_platform_child_sites_patch,
    account_platform_groups_get,
    account_platform_groups_list,
    account_platform_groups_patch,
    account_platforms_get,
    account_platforms_list,
    platform_accounts_close,
    platform_accounts_create,
    platform_accounts_get,
    platform_accounts_list,
    platform_accounts_lookup,
    platform_events_create,
    platform_sites_create,
    platform_sites_delete,
    platform_sites_get,
    platform_sites_list,
    platform_sites_request_review,
)

router = APIRouter(prefix="/google/adsense-platform", tags=["google-adsense-platform"])


def _require_adsense() -> None:
    if not adsense_configured():
        raise HTTPException(status_code=503, detail="AdSense OAuth not configured.")


def _require_write() -> None:
    if (get_settings().google_adsense_access or "").lower().strip() != "readwrite":
        raise HTTPException(
            status_code=403,
            detail="AdSense Platform write operations require GOOGLE_ADSENSE_ACCESS=readwrite",
        )


# --- platforms/{platform}/accounts (classic A4P) ---


@router.get("/v1alpha/platforms/{platform_id}/accounts", response_model=PlatformListAccountsResponse)
async def asp_accounts_list(
    platform_id: str,
    page_size: int | None = Query(None, ge=1, le=10000),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await platform_accounts_list(platform_id, page_size=page_size, page_token=page_token)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1alpha/platforms/{platform_id}/accounts:lookup", response_model=PlatformLookupAccountResponse)
async def asp_accounts_lookup(
    platform_id: str,
    creation_request_id: str | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await platform_accounts_lookup(platform_id, creation_request_id=creation_request_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1alpha/platforms/{platform_id}/accounts/{account_id}", response_model=PlatformAccount)
async def asp_accounts_get(
    platform_id: str,
    account_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await platform_accounts_get(platform_id, account_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1alpha/platforms/{platform_id}/accounts", response_model=PlatformAccount)
async def asp_accounts_create(
    platform_id: str,
    body: dict[str, Any],
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    _require_write()
    try:
        return await platform_accounts_create(platform_id, body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1alpha/platforms/{platform_id}/accounts/{account_id}:close", response_model=PlatformCloseAccountResponse)
async def asp_accounts_close(
    platform_id: str,
    account_id: str,
    body: dict[str, Any] | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    _require_write()
    try:
        return await platform_accounts_close(platform_id, account_id, body or {})
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1alpha/platforms/{platform_id}/accounts/{account_id}/events", response_model=PlatformEvent)
async def asp_events_create(
    platform_id: str,
    account_id: str,
    body: dict[str, Any],
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    _require_write()
    try:
        return await platform_events_create(platform_id, account_id, body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get(
    "/v1alpha/platforms/{platform_id}/accounts/{account_id}/sites",
    response_model=PlatformListSitesResponse,
)
async def asp_sites_list(
    platform_id: str,
    account_id: str,
    page_size: int | None = Query(None, ge=1, le=10000),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await platform_sites_list(platform_id, account_id, page_size=page_size, page_token=page_token)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1alpha/platforms/{platform_id}/accounts/{account_id}/sites/{site_id}", response_model=PlatformSite)
async def asp_sites_get(
    platform_id: str,
    account_id: str,
    site_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await platform_sites_get(platform_id, account_id, site_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/v1alpha/platforms/{platform_id}/accounts/{account_id}/sites", response_model=PlatformSite)
async def asp_sites_create(
    platform_id: str,
    account_id: str,
    body: dict[str, Any],
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    _require_write()
    try:
        return await platform_sites_create(platform_id, account_id, body)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/v1alpha/platforms/{platform_id}/accounts/{account_id}/sites/{site_id}:requestReview",
    response_model=PlatformRequestSiteReviewResponse,
)
async def asp_sites_request_review(
    platform_id: str,
    account_id: str,
    site_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    _require_write()
    try:
        return await platform_sites_request_review(platform_id, account_id, site_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete("/v1alpha/platforms/{platform_id}/accounts/{account_id}/sites/{site_id}", response_model=PlatformEmpty)
async def asp_sites_delete(
    platform_id: str,
    account_id: str,
    site_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    _require_write()
    try:
        return await platform_sites_delete(platform_id, account_id, site_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- accounts/{account}/platforms (Transparent Platform) ---


@router.get("/v1alpha/accounts/{account_id}/platforms", response_model=ListTransparentPlatformsResponse)
async def asp_tp_platforms_list(
    account_id: str,
    page_size: int | None = Query(None, ge=1, le=10000),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await account_platforms_list(account_id, page_size=page_size, page_token=page_token)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/v1alpha/accounts/{account_id}/platforms/{platform_id}", response_model=TransparentPlatform)
async def asp_tp_platforms_get(
    account_id: str,
    platform_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await account_platforms_get(account_id, platform_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get(
    "/v1alpha/accounts/{account_id}/platforms/{platform_id}/groups",
    response_model=ListTransparentPlatformGroupsResponse,
)
async def asp_tp_groups_list(
    account_id: str,
    platform_id: str,
    page_size: int | None = Query(None, ge=1, le=10000),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await account_platform_groups_list(
            account_id, platform_id, page_size=page_size, page_token=page_token
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get(
    "/v1alpha/accounts/{account_id}/platforms/{platform_id}/groups/{group_id}",
    response_model=TransparentPlatformGroup,
)
async def asp_tp_groups_get(
    account_id: str,
    platform_id: str,
    group_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await account_platform_groups_get(account_id, platform_id, group_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.patch(
    "/v1alpha/accounts/{account_id}/platforms/{platform_id}/groups/{group_id}",
    response_model=TransparentPlatformGroup,
)
async def asp_tp_groups_patch(
    account_id: str,
    platform_id: str,
    group_id: str,
    body: dict[str, Any],
    update_mask: str | None = Query(None, description="Field mask, e.g. description"),
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    _require_write()
    try:
        return await account_platform_groups_patch(
            account_id, platform_id, group_id, body, update_mask=update_mask
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get(
    "/v1alpha/accounts/{account_id}/platforms/{platform_id}/childAccounts/{child_account_id}/sites",
    response_model=ListTransparentPlatformChildSitesResponse,
)
async def asp_tp_child_sites_list(
    account_id: str,
    platform_id: str,
    child_account_id: str,
    page_size: int | None = Query(None, ge=1, le=10000),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await account_platform_child_sites_list(
            account_id, platform_id, child_account_id, page_size=page_size, page_token=page_token
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get(
    "/v1alpha/accounts/{account_id}/platforms/{platform_id}/childAccounts/{child_account_id}/sites/{site_id}",
    response_model=TransparentPlatformChildSite,
)
async def asp_tp_child_sites_get(
    account_id: str,
    platform_id: str,
    child_account_id: str,
    site_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await account_platform_child_sites_get(
            account_id, platform_id, child_account_id, site_id
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.patch(
    "/v1alpha/accounts/{account_id}/platforms/{platform_id}/childAccounts/{child_account_id}/sites/{site_id}",
    response_model=TransparentPlatformChildSite,
)
async def asp_tp_child_sites_patch(
    account_id: str,
    platform_id: str,
    child_account_id: str,
    site_id: str,
    body: dict[str, Any],
    update_mask: str | None = Query(None, description="Field mask, e.g. platformGroup"),
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    _require_write()
    try:
        return await account_platform_child_sites_patch(
            account_id, platform_id, child_account_id, site_id, body, update_mask=update_mask
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
