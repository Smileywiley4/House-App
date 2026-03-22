"""
Analytics Hub API proxy — service account on server, Supabase JWT + admin plan.

https://cloud.google.com/bigquery/docs/analytics-hub-introduction

Path segment `{api_version}` is `v1` or `v1beta1` and is forwarded to
`https://analyticshub.googleapis.com/{api_version}/...`.

v1-only routes (404 when `api_version=v1beta1`): data-exchange subscribe & listSubscriptions,
listing listSubscriptions, all queryTemplates, location subscriptions.

Query params use snake_case in FastAPI; forwarded to Google as camelCase where required.
"""
from typing import Any, Literal

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.config import get_settings
from app.dependencies import require_admin_plan
from app.google_analytics_hub_v1 import analytics_hub_configured, analytics_hub_request

router = APIRouter(prefix="/google/analytics-hub", tags=["google-analytics-hub"])


def _require_hub() -> None:
    if not analytics_hub_configured():
        raise HTTPException(
            status_code=503,
            detail="Analytics Hub not configured (GOOGLE_ANALYTICS_HUB_SA_JSON_PATH).",
        )


def _require_write() -> None:
    acc = (get_settings().google_analytics_hub_access or "").lower().strip().replace("-", "_")
    if acc == "readonly":
        raise HTTPException(
            status_code=403,
            detail="This operation requires GOOGLE_ANALYTICS_HUB_ACCESS=readwrite or cloud_platform (not readonly).",
        )


def _require_analytics_hub_v1_only(api_version: Literal["v1", "v1beta1"]) -> None:
    """Google's v1beta1 discovery omits exchange subscribe/listSubscriptions, listing listSubscriptions, queryTemplates, and project subscriptions."""
    if api_version != "v1":
        raise HTTPException(
            status_code=404,
            detail="This operation is only available with path segment v1 (not in Analytics Hub v1beta1 for this proxy).",
        )


def _pg(project_id: str, location_id: str) -> str:
    return f"projects/{project_id}/locations/{location_id}"


# --- Data exchanges (project) ---


@router.get("/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges")
async def ah_data_exchanges_list(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    page_size: int | None = Query(None),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    parent = _pg(project_id, location_id)
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await analytics_hub_request("GET", f"{parent}/dataExchanges", params=params or None, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}")
async def ah_data_exchanges_get(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    name = f"{_pg(project_id, location_id)}/dataExchanges/{data_exchange_id}"
    try:
        return await analytics_hub_request("GET", name, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges")
async def ah_data_exchanges_create(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str = Query(..., description="ID for the new data exchange"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_write()
    parent = _pg(project_id, location_id)
    try:
        return await analytics_hub_request(
            "POST",
            f"{parent}/dataExchanges",
            params={"dataExchangeId": data_exchange_id},
            json_body=body,
            api_version=api_version,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.patch("/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}")
async def ah_data_exchanges_patch(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    update_mask: str = Query(..., description="Required by Google (e.g. displayName,description)"),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_write()
    name = f"{_pg(project_id, location_id)}/dataExchanges/{data_exchange_id}"
    try:
        return await analytics_hub_request(
            "PATCH",
            name,
            params={"updateMask": update_mask},
            json_body=body,
            api_version=api_version,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete("/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}")
async def ah_data_exchanges_delete(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_write()
    name = f"{_pg(project_id, location_id)}/dataExchanges/{data_exchange_id}"
    try:
        return await analytics_hub_request("DELETE", name, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}:subscribe")
async def ah_data_exchanges_subscribe(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    _require_write()
    name = f"{_pg(project_id, location_id)}/dataExchanges/{data_exchange_id}:subscribe"
    try:
        return await analytics_hub_request("POST", name, json_body=body, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}:listSubscriptions",
)
async def ah_data_exchanges_list_subscriptions(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    include_deleted_subscriptions: bool | None = None,
    page_size: int | None = None,
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    resource = f"{_pg(project_id, location_id)}/dataExchanges/{data_exchange_id}"
    params: dict[str, Any] = {}
    if include_deleted_subscriptions is not None:
        params["includeDeletedSubscriptions"] = include_deleted_subscriptions
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await analytics_hub_request("GET", f"{resource}:listSubscriptions", params=params or None, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}:getIamPolicy",
)
async def ah_data_exchanges_get_iam(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    body: dict[str, Any] | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    resource = f"{_pg(project_id, location_id)}/dataExchanges/{data_exchange_id}"
    try:
        return await analytics_hub_request("POST", f"{resource}:getIamPolicy", json_body=body or {}, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}:setIamPolicy",
)
async def ah_data_exchanges_set_iam(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_write()
    resource = f"{_pg(project_id, location_id)}/dataExchanges/{data_exchange_id}"
    try:
        return await analytics_hub_request("POST", f"{resource}:setIamPolicy", json_body=body, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}:testIamPermissions",
)
async def ah_data_exchanges_test_iam(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    resource = f"{_pg(project_id, location_id)}/dataExchanges/{data_exchange_id}"
    try:
        return await analytics_hub_request("POST", f"{resource}:testIamPermissions", json_body=body, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- Listings ---


def _de(project_id: str, location_id: str, data_exchange_id: str) -> str:
    return f"{_pg(project_id, location_id)}/dataExchanges/{data_exchange_id}"


@router.get("/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/listings")
async def ah_listings_list(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    page_size: int | None = None,
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    parent = _de(project_id, location_id, data_exchange_id)
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await analytics_hub_request("GET", f"{parent}/listings", params=params or None, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/listings/{listing_id}",
)
async def ah_listings_get(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    listing_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    name = f"{_de(project_id, location_id, data_exchange_id)}/listings/{listing_id}"
    try:
        return await analytics_hub_request("GET", name, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/listings")
async def ah_listings_create(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    listing_id: str = Query(...),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_write()
    parent = _de(project_id, location_id, data_exchange_id)
    try:
        return await analytics_hub_request(
            "POST",
            f"{parent}/listings",
            params={"listingId": listing_id},
            json_body=body,
            api_version=api_version,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.patch(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/listings/{listing_id}",
)
async def ah_listings_patch(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    listing_id: str,
    update_mask: str = Query(...),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_write()
    name = f"{_de(project_id, location_id, data_exchange_id)}/listings/{listing_id}"
    try:
        return await analytics_hub_request(
            "PATCH",
            name,
            params={"updateMask": update_mask},
            json_body=body,
            api_version=api_version,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/listings/{listing_id}",
)
async def ah_listings_delete(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    listing_id: str,
    delete_commercial: bool | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_write()
    name = f"{_de(project_id, location_id, data_exchange_id)}/listings/{listing_id}"
    params: dict[str, Any] = {}
    if delete_commercial is not None:
        params["deleteCommercial"] = delete_commercial
    try:
        return await analytics_hub_request("DELETE", name, params=params or None, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/listings/{listing_id}:subscribe",
)
async def ah_listings_subscribe(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    listing_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_write()
    name = f"{_de(project_id, location_id, data_exchange_id)}/listings/{listing_id}:subscribe"
    try:
        return await analytics_hub_request("POST", name, json_body=body, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/listings/{listing_id}:listSubscriptions",
)
async def ah_listings_list_subscriptions(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    listing_id: str,
    include_deleted_subscriptions: bool | None = None,
    page_size: int | None = None,
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    resource = f"{_de(project_id, location_id, data_exchange_id)}/listings/{listing_id}"
    params: dict[str, Any] = {}
    if include_deleted_subscriptions is not None:
        params["includeDeletedSubscriptions"] = include_deleted_subscriptions
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await analytics_hub_request("GET", f"{resource}:listSubscriptions", params=params or None, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/listings/{listing_id}:getIamPolicy",
)
async def ah_listings_get_iam(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    listing_id: str,
    body: dict[str, Any] | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    resource = f"{_de(project_id, location_id, data_exchange_id)}/listings/{listing_id}"
    try:
        return await analytics_hub_request("POST", f"{resource}:getIamPolicy", json_body=body or {}, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/listings/{listing_id}:setIamPolicy",
)
async def ah_listings_set_iam(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    listing_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_write()
    resource = f"{_de(project_id, location_id, data_exchange_id)}/listings/{listing_id}"
    try:
        return await analytics_hub_request("POST", f"{resource}:setIamPolicy", json_body=body, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/listings/{listing_id}:testIamPermissions",
)
async def ah_listings_test_iam(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    listing_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    resource = f"{_de(project_id, location_id, data_exchange_id)}/listings/{listing_id}"
    try:
        return await analytics_hub_request("POST", f"{resource}:testIamPermissions", json_body=body, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- Query templates ---


@router.get(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/queryTemplates",
)
async def ah_query_templates_list(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    page_size: int | None = None,
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    parent = _de(project_id, location_id, data_exchange_id)
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await analytics_hub_request("GET", f"{parent}/queryTemplates", params=params or None, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/queryTemplates/{template_id}",
)
async def ah_query_templates_get(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    template_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    name = f"{_de(project_id, location_id, data_exchange_id)}/queryTemplates/{template_id}"
    try:
        return await analytics_hub_request("GET", name, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/queryTemplates",
)
async def ah_query_templates_create(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    query_template_id: str = Query(...),
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    _require_write()
    parent = _de(project_id, location_id, data_exchange_id)
    try:
        return await analytics_hub_request(
            "POST",
            f"{parent}/queryTemplates",
            params={"queryTemplateId": query_template_id},
            json_body=body,
            api_version=api_version,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.patch(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/queryTemplates/{template_id}",
)
async def ah_query_templates_patch(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    template_id: str,
    update_mask: str | None = None,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    _require_write()
    name = f"{_de(project_id, location_id, data_exchange_id)}/queryTemplates/{template_id}"
    params = {"updateMask": update_mask} if update_mask else None
    try:
        return await analytics_hub_request("PATCH", name, params=params, json_body=body, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/queryTemplates/{template_id}",
)
async def ah_query_templates_delete(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    template_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    _require_write()
    name = f"{_de(project_id, location_id, data_exchange_id)}/queryTemplates/{template_id}"
    try:
        return await analytics_hub_request("DELETE", name, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/queryTemplates/{template_id}:submit",
)
async def ah_query_templates_submit(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    template_id: str,
    body: dict[str, Any] | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    _require_write()
    name = f"{_de(project_id, location_id, data_exchange_id)}/queryTemplates/{template_id}:submit"
    try:
        return await analytics_hub_request("POST", name, json_body=body or {}, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/dataExchanges/{data_exchange_id}/queryTemplates/{template_id}:approve",
)
async def ah_query_templates_approve(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    data_exchange_id: str,
    template_id: str,
    body: dict[str, Any] | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    _require_write()
    name = f"{_de(project_id, location_id, data_exchange_id)}/queryTemplates/{template_id}:approve"
    try:
        return await analytics_hub_request("POST", name, json_body=body or {}, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- Subscriptions (location) ---


@router.get("/{api_version}/projects/{project_id}/locations/{location_id}/subscriptions")
async def ah_subscriptions_list(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    filter_expr: str | None = Query(None, alias="filter"),
    page_size: int | None = None,
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    parent = _pg(project_id, location_id)
    params: dict[str, Any] = {}
    if filter_expr:
        params["filter"] = filter_expr
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await analytics_hub_request("GET", f"{parent}/subscriptions", params=params or None, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/{api_version}/projects/{project_id}/locations/{location_id}/subscriptions/{subscription_id}")
async def ah_subscriptions_get(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    subscription_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    name = f"{_pg(project_id, location_id)}/subscriptions/{subscription_id}"
    try:
        return await analytics_hub_request("GET", name, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/{api_version}/projects/{project_id}/locations/{location_id}/subscriptions/{subscription_id}:refresh")
async def ah_subscriptions_refresh(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    subscription_id: str,
    body: dict[str, Any] | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    _require_write()
    name = f"{_pg(project_id, location_id)}/subscriptions/{subscription_id}:refresh"
    try:
        return await analytics_hub_request("POST", name, json_body=body or {}, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/{api_version}/projects/{project_id}/locations/{location_id}/subscriptions/{subscription_id}:revoke")
async def ah_subscriptions_revoke(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    subscription_id: str,
    body: dict[str, Any] | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    _require_write()
    name = f"{_pg(project_id, location_id)}/subscriptions/{subscription_id}:revoke"
    try:
        return await analytics_hub_request("POST", name, json_body=body or {}, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.delete("/{api_version}/projects/{project_id}/locations/{location_id}/subscriptions/{subscription_id}")
async def ah_subscriptions_delete(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    subscription_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    _require_write()
    name = f"{_pg(project_id, location_id)}/subscriptions/{subscription_id}"
    try:
        return await analytics_hub_request("DELETE", name, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/subscriptions/{subscription_id}:getIamPolicy",
)
async def ah_subscriptions_get_iam(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    subscription_id: str,
    body: dict[str, Any] | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    resource = f"{_pg(project_id, location_id)}/subscriptions/{subscription_id}"
    try:
        return await analytics_hub_request("POST", f"{resource}:getIamPolicy", json_body=body or {}, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post(
    "/{api_version}/projects/{project_id}/locations/{location_id}/subscriptions/{subscription_id}:setIamPolicy",
)
async def ah_subscriptions_set_iam(
    api_version: Literal["v1", "v1beta1"],
    project_id: str,
    location_id: str,
    subscription_id: str,
    body: dict[str, Any] = Body(...),
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    _require_analytics_hub_v1_only(api_version)
    _require_write()
    resource = f"{_pg(project_id, location_id)}/subscriptions/{subscription_id}"
    try:
        return await analytics_hub_request("POST", f"{resource}:setIamPolicy", json_body=body, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# --- Organization-scoped data exchanges ---


@router.get("/{api_version}/organizations/{organization_id}/locations/{location_id}/dataExchanges")
async def ah_org_data_exchanges_list(
    api_version: Literal["v1", "v1beta1"],
    organization_id: str,
    location_id: str,
    page_size: int | None = None,
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_hub()
    org = f"organizations/{organization_id}/locations/{location_id}"
    params: dict[str, Any] = {}
    if page_size is not None:
        params["pageSize"] = page_size
    if page_token:
        params["pageToken"] = page_token
    try:
        return await analytics_hub_request("GET", f"{org}/dataExchanges", params=params or None, api_version=api_version)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
