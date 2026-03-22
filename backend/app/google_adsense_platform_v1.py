"""
Google AdSense Platform API (discovery: adsenseplatform:v1alpha).

Base: https://adsenseplatform.googleapis.com/v1alpha/

Includes:
- `platforms/.../accounts` — sub-accounts, sites, events (classic A4P).
- `accounts/.../platforms` — Transparent Platform, groups, child-account sites.

Uses the **same OAuth env** as AdSense Management (`get_adsense_oauth_token` / `adsense_configured`).
Write methods require `GOOGLE_ADSENSE_ACCESS=readwrite`.

Docs: https://developers.google.com/adsense/platforms/
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.google_adsense_v2 import adsense_configured, get_adsense_oauth_token

logger = logging.getLogger(__name__)

API_ROOT = "https://adsenseplatform.googleapis.com"
API_VERSION = "v1alpha"


def _platform_parent(platform_id: str) -> str:
    p = platform_id.strip()
    if p.startswith("platforms/"):
        return p
    return f"platforms/{p}"


def _account_resource_name(platform_id: str, account_id: str) -> str:
    a = account_id.strip()
    if a.startswith("platforms/") and "/accounts/" in a:
        return a
    pp = _platform_parent(platform_id)
    if a.startswith("accounts/"):
        a = a.split("/", 1)[-1]
    return f"{pp}/accounts/{a}"


def _site_resource_name(platform_id: str, account_id: str, site_id: str) -> str:
    s = site_id.strip()
    if s.startswith("platforms/") and "/sites/" in s:
        return s
    base = _account_resource_name(platform_id, account_id)
    if s.startswith("sites/"):
        s = s.split("/", 1)[-1]
    return f"{base}/sites/{s}"


def _adsense_account_parent(account_id: str) -> str:
    """Parent for list platforms: `accounts/{account}` (single account segment)."""
    a = account_id.strip()
    if a.startswith("accounts/"):
        parts = a.split("/")
        return f"{parts[0]}/{parts[1]}"
    return f"accounts/{a}"


def _transparent_platform_name(account_id: str, platform_id: str) -> str:
    """Full name: accounts/{account}/platforms/{platform}."""
    pl = platform_id.strip()
    if pl.startswith("accounts/") and "/platforms/" in pl and pl.count("/") >= 3:
        return pl
    ap = _adsense_account_parent(account_id)
    if pl.startswith("platforms/"):
        pl = pl.split("/", 1)[-1]
    return f"{ap}/platforms/{pl}"


def _platform_group_name(account_id: str, platform_id: str, group_id: str) -> str:
    g = group_id.strip()
    if g.startswith("accounts/") and "/groups/" in g:
        return g
    base = _transparent_platform_name(account_id, platform_id)
    if g.startswith("groups/"):
        g = g.split("/", 1)[-1]
    return f"{base}/groups/{g}"


def _child_account_parent(account_id: str, platform_id: str, child_account_id: str) -> str:
    """Parent for list child sites: .../childAccounts/{child}."""
    c = child_account_id.strip()
    if c.startswith("accounts/") and "/childAccounts/" in c:
        idx = c.find("/sites/")
        if idx != -1:
            return c[:idx]
        return c
    base = _transparent_platform_name(account_id, platform_id)
    if c.startswith("childAccounts/"):
        c = c.split("/", 1)[-1]
    return f"{base}/childAccounts/{c}"


def _platform_child_site_name(
    account_id: str,
    platform_id: str,
    child_account_id: str,
    site_id: str,
) -> str:
    s = site_id.strip()
    if s.startswith("accounts/") and "/sites/" in s and "/childAccounts/" in s:
        return s
    parent = _child_account_parent(account_id, platform_id, child_account_id)
    if s.startswith("sites/"):
        s = s.split("/", 1)[-1]
    return f"{parent}/sites/{s}"


async def _request_json(
    method: str,
    path: str,
    *,
    params: list[tuple[str, str]] | None = None,
    json_body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    token = get_adsense_oauth_token()
    headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    kw: dict[str, Any] = {"method": method, "url": f"{API_ROOT}{path}", "params": params or [], "headers": headers}
    if json_body is not None:
        kw["json"] = json_body
        headers["Content-Type"] = "application/json"
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.request(**kw)
    if resp.content:
        try:
            data = resp.json()
        except Exception:
            data = {"_raw": resp.text[:2000]}
    else:
        data = {}
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else resp.text
        logger.warning("AdSense Platform %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data if isinstance(data, dict) else {}


# --- Schemas (discovery subset; camelCase) ---


class PlatformTimeZone(BaseModel):
    model_config = {"extra": "allow"}

    id: str = ""
    version: str = ""


class PlatformAccount(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    displayName: str = ""
    state: str = ""
    timeZone: PlatformTimeZone | None = None
    createTime: str = ""
    regionCode: str = ""
    creationRequestId: str = ""


class PlatformLookupAccountResponse(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""


class PlatformListAccountsResponse(BaseModel):
    model_config = {"extra": "allow"}

    accounts: list[PlatformAccount] = Field(default_factory=list)
    nextPageToken: str = ""


class PlatformCloseAccountResponse(BaseModel):
    model_config = {"extra": "allow"}


class Address(BaseModel):
    model_config = {"extra": "allow"}

    address1: str = ""
    address2: str = ""
    city: str = ""
    state: str = ""
    zip: str = ""
    company: str = ""
    contact: str = ""
    phone: str = ""
    fax: str = ""
    regionCode: str = ""


class EventInfo(BaseModel):
    model_config = {"extra": "allow"}

    email: str = ""
    billingAddress: Address | None = None


class PlatformEvent(BaseModel):
    model_config = {"extra": "allow"}

    eventType: str = ""
    eventInfo: EventInfo | None = None
    eventTime: str = ""


class PlatformSite(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    domain: str = ""
    state: str = ""


class PlatformListSitesResponse(BaseModel):
    model_config = {"extra": "allow"}

    sites: list[PlatformSite] = Field(default_factory=list)
    nextPageToken: str = ""


class PlatformRequestSiteReviewResponse(BaseModel):
    model_config = {"extra": "allow"}


class PlatformEmpty(BaseModel):
    model_config = {"extra": "allow"}


class GoogleDecimal(BaseModel):
    model_config = {"extra": "allow"}

    value: str = ""


class TransparentPlatform(BaseModel):
    """Discovery `Platform` — transparent platform under an AdSense account."""

    model_config = {"extra": "allow"}

    name: str = ""
    description: str = ""
    defaultPlatformGroup: str = ""


class ListTransparentPlatformsResponse(BaseModel):
    model_config = {"extra": "allow"}

    platforms: list[TransparentPlatform] = Field(default_factory=list)
    nextPageToken: str = ""


class TransparentPlatformGroup(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    description: str = ""
    revshareMillipercent: GoogleDecimal | None = None


class ListTransparentPlatformGroupsResponse(BaseModel):
    model_config = {"extra": "allow"}

    platformGroups: list[TransparentPlatformGroup] = Field(default_factory=list)
    nextPageToken: str = ""


class TransparentPlatformChildSite(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    domain: str = ""
    platformGroup: str = ""


class ListTransparentPlatformChildSitesResponse(BaseModel):
    model_config = {"extra": "allow"}

    platformChildSites: list[TransparentPlatformChildSite] = Field(default_factory=list)
    nextPageToken: str = ""


# --- API ---


async def platform_accounts_list(
    platform_id: str,
    *,
    page_size: int | None = None,
    page_token: str | None = None,
) -> PlatformListAccountsResponse:
    parent = _platform_parent(platform_id)
    q: list[tuple[str, str]] = []
    if page_size is not None:
        q.append(("pageSize", str(page_size)))
    if page_token:
        q.append(("pageToken", page_token))
    data = await _request_json("GET", f"/{API_VERSION}/{parent}/accounts", params=q)
    return PlatformListAccountsResponse.model_validate(data)


async def platform_accounts_lookup(
    platform_id: str,
    *,
    creation_request_id: str | None = None,
) -> PlatformLookupAccountResponse:
    parent = _platform_parent(platform_id)
    q: list[tuple[str, str]] = []
    if creation_request_id:
        q.append(("creationRequestId", creation_request_id))
    data = await _request_json("GET", f"/{API_VERSION}/{parent}/accounts:lookup", params=q)
    return PlatformLookupAccountResponse.model_validate(data)


async def platform_accounts_get(platform_id: str, account_id: str) -> PlatformAccount:
    name = _account_resource_name(platform_id, account_id)
    data = await _request_json("GET", f"/{API_VERSION}/{name}")
    return PlatformAccount.model_validate(data)


async def platform_accounts_create(platform_id: str, body: dict[str, Any]) -> PlatformAccount:
    parent = _platform_parent(platform_id)
    data = await _request_json("POST", f"/{API_VERSION}/{parent}/accounts", json_body=body)
    return PlatformAccount.model_validate(data)


async def platform_accounts_close(platform_id: str, account_id: str, body: dict[str, Any] | None = None) -> PlatformCloseAccountResponse:
    name = _account_resource_name(platform_id, account_id)
    data = await _request_json("POST", f"/{API_VERSION}/{name}:close", json_body=body or {})
    return PlatformCloseAccountResponse.model_validate(data)


async def platform_events_create(platform_id: str, account_id: str, body: dict[str, Any]) -> PlatformEvent:
    parent = _account_resource_name(platform_id, account_id)
    data = await _request_json("POST", f"/{API_VERSION}/{parent}/events", json_body=body)
    return PlatformEvent.model_validate(data)


async def platform_sites_list(
    platform_id: str,
    account_id: str,
    *,
    page_size: int | None = None,
    page_token: str | None = None,
) -> PlatformListSitesResponse:
    parent = _account_resource_name(platform_id, account_id)
    q: list[tuple[str, str]] = []
    if page_size is not None:
        q.append(("pageSize", str(page_size)))
    if page_token:
        q.append(("pageToken", page_token))
    data = await _request_json("GET", f"/{API_VERSION}/{parent}/sites", params=q)
    return PlatformListSitesResponse.model_validate(data)


async def platform_sites_get(platform_id: str, account_id: str, site_id: str) -> PlatformSite:
    name = _site_resource_name(platform_id, account_id, site_id)
    data = await _request_json("GET", f"/{API_VERSION}/{name}")
    return PlatformSite.model_validate(data)


async def platform_sites_create(platform_id: str, account_id: str, body: dict[str, Any]) -> PlatformSite:
    parent = _account_resource_name(platform_id, account_id)
    data = await _request_json("POST", f"/{API_VERSION}/{parent}/sites", json_body=body)
    return PlatformSite.model_validate(data)


async def platform_sites_request_review(platform_id: str, account_id: str, site_id: str) -> PlatformRequestSiteReviewResponse:
    name = _site_resource_name(platform_id, account_id, site_id)
    data = await _request_json("POST", f"/{API_VERSION}/{name}:requestReview", json_body={})
    return PlatformRequestSiteReviewResponse.model_validate(data)


async def platform_sites_delete(platform_id: str, account_id: str, site_id: str) -> PlatformEmpty:
    name = _site_resource_name(platform_id, account_id, site_id)
    data = await _request_json("DELETE", f"/{API_VERSION}/{name}")
    return PlatformEmpty.model_validate(data)


# --- Transparent Platform (accounts/.../platforms) — v1alpha ---


async def account_platforms_list(
    adsense_account_id: str,
    *,
    page_size: int | None = None,
    page_token: str | None = None,
) -> ListTransparentPlatformsResponse:
    parent = _adsense_account_parent(adsense_account_id)
    q: list[tuple[str, str]] = []
    if page_size is not None:
        q.append(("pageSize", str(page_size)))
    if page_token:
        q.append(("pageToken", page_token))
    data = await _request_json("GET", f"/{API_VERSION}/{parent}/platforms", params=q)
    return ListTransparentPlatformsResponse.model_validate(data)


async def account_platforms_get(adsense_account_id: str, platform_id: str) -> TransparentPlatform:
    name = _transparent_platform_name(adsense_account_id, platform_id)
    data = await _request_json("GET", f"/{API_VERSION}/{name}")
    return TransparentPlatform.model_validate(data)


async def account_platform_groups_list(
    adsense_account_id: str,
    platform_id: str,
    *,
    page_size: int | None = None,
    page_token: str | None = None,
) -> ListTransparentPlatformGroupsResponse:
    parent = _transparent_platform_name(adsense_account_id, platform_id)
    q: list[tuple[str, str]] = []
    if page_size is not None:
        q.append(("pageSize", str(page_size)))
    if page_token:
        q.append(("pageToken", page_token))
    data = await _request_json("GET", f"/{API_VERSION}/{parent}/groups", params=q)
    return ListTransparentPlatformGroupsResponse.model_validate(data)


async def account_platform_groups_get(
    adsense_account_id: str,
    platform_id: str,
    group_id: str,
) -> TransparentPlatformGroup:
    name = _platform_group_name(adsense_account_id, platform_id, group_id)
    data = await _request_json("GET", f"/{API_VERSION}/{name}")
    return TransparentPlatformGroup.model_validate(data)


async def account_platform_groups_patch(
    adsense_account_id: str,
    platform_id: str,
    group_id: str,
    body: dict[str, Any],
    *,
    update_mask: str | None = None,
) -> TransparentPlatformGroup:
    name = _platform_group_name(adsense_account_id, platform_id, group_id)
    q: list[tuple[str, str]] = []
    if update_mask:
        q.append(("updateMask", update_mask))
    data = await _request_json("PATCH", f"/{API_VERSION}/{name}", params=q, json_body=body)
    return TransparentPlatformGroup.model_validate(data)


async def account_platform_child_sites_list(
    adsense_account_id: str,
    platform_id: str,
    child_account_id: str,
    *,
    page_size: int | None = None,
    page_token: str | None = None,
) -> ListTransparentPlatformChildSitesResponse:
    parent = _child_account_parent(adsense_account_id, platform_id, child_account_id)
    q: list[tuple[str, str]] = []
    if page_size is not None:
        q.append(("pageSize", str(page_size)))
    if page_token:
        q.append(("pageToken", page_token))
    data = await _request_json("GET", f"/{API_VERSION}/{parent}/sites", params=q)
    return ListTransparentPlatformChildSitesResponse.model_validate(data)


async def account_platform_child_sites_get(
    adsense_account_id: str,
    platform_id: str,
    child_account_id: str,
    site_id: str,
) -> TransparentPlatformChildSite:
    name = _platform_child_site_name(adsense_account_id, platform_id, child_account_id, site_id)
    data = await _request_json("GET", f"/{API_VERSION}/{name}")
    return TransparentPlatformChildSite.model_validate(data)


async def account_platform_child_sites_patch(
    adsense_account_id: str,
    platform_id: str,
    child_account_id: str,
    site_id: str,
    body: dict[str, Any],
    *,
    update_mask: str | None = None,
) -> TransparentPlatformChildSite:
    name = _platform_child_site_name(adsense_account_id, platform_id, child_account_id, site_id)
    q: list[tuple[str, str]] = []
    if update_mask:
        q.append(("updateMask", update_mask))
    data = await _request_json("PATCH", f"/{API_VERSION}/{name}", params=q, json_body=body)
    return TransparentPlatformChildSite.model_validate(data)


__all__ = [
    "PlatformAccount",
    "PlatformListAccountsResponse",
    "PlatformLookupAccountResponse",
    "PlatformCloseAccountResponse",
    "PlatformEvent",
    "PlatformSite",
    "PlatformListSitesResponse",
    "PlatformRequestSiteReviewResponse",
    "PlatformEmpty",
    "platform_accounts_list",
    "platform_accounts_lookup",
    "platform_accounts_get",
    "platform_accounts_create",
    "platform_accounts_close",
    "platform_events_create",
    "platform_sites_list",
    "platform_sites_get",
    "platform_sites_create",
    "platform_sites_request_review",
    "platform_sites_delete",
    "API_VERSION",
    "GoogleDecimal",
    "TransparentPlatform",
    "ListTransparentPlatformsResponse",
    "TransparentPlatformGroup",
    "ListTransparentPlatformGroupsResponse",
    "TransparentPlatformChildSite",
    "ListTransparentPlatformChildSitesResponse",
    "account_platforms_list",
    "account_platforms_get",
    "account_platform_groups_list",
    "account_platform_groups_get",
    "account_platform_groups_patch",
    "account_platform_child_sites_list",
    "account_platform_child_sites_get",
    "account_platform_child_sites_patch",
]
