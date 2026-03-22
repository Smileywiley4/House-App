"""
Google AdSense Management API v2 (discovery: adsense:v2).

Base: https://adsense.googleapis.com/v2/

Uses OAuth 2.0 with a **refresh token** for the publisher account (store client id/secret + refresh token in env).
Scopes: https://www.googleapis.com/auth/adsense.readonly or .../auth/adsense

Docs: https://developers.google.com/adsense/management/
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from pydantic import BaseModel, Field

from app.config import get_settings

logger = logging.getLogger(__name__)

API_ROOT = "https://adsense.googleapis.com"


def adsense_configured() -> bool:
    s = get_settings()
    return bool(
        s.google_adsense_client_id.strip()
        and s.google_adsense_client_secret.strip()
        and s.google_adsense_refresh_token.strip()
    )


def _adsense_scope() -> str:
    s = get_settings()
    if (s.google_adsense_access or "readonly").lower().strip() == "readwrite":
        return "https://www.googleapis.com/auth/adsense"
    return "https://www.googleapis.com/auth/adsense.readonly"


def _access_token() -> str:
    s = get_settings()
    if not adsense_configured():
        raise ValueError(
            "AdSense: set GOOGLE_ADSENSE_CLIENT_ID, GOOGLE_ADSENSE_CLIENT_SECRET, "
            "GOOGLE_ADSENSE_REFRESH_TOKEN"
        )
    creds = Credentials(
        token=None,
        refresh_token=s.google_adsense_refresh_token.strip(),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=s.google_adsense_client_id.strip(),
        client_secret=s.google_adsense_client_secret.strip(),
        scopes=[_adsense_scope()],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("AdSense OAuth refresh failed")
    return creds.token


def get_adsense_oauth_token() -> str:
    """OAuth access token for AdSense Management API v2 and AdSense Platform API v1."""
    return _access_token()


def _normalize_account(account: str) -> str:
    a = account.strip()
    if a.startswith("accounts/"):
        return a
    return f"accounts/{a}"


def _params_from_mapping(data: dict[str, Any]) -> list[tuple[str, str]]:
    """Flatten dict to query pairs; lists become repeated keys (AdSense style)."""
    out: list[tuple[str, str]] = []
    for k, v in data.items():
        if v is None:
            continue
        if isinstance(v, list):
            for item in v:
                out.append((k, str(item)))
        elif isinstance(v, bool):
            out.append((k, "true" if v else "false"))
        else:
            out.append((k, str(v)))
    return out


async def _request_json(method: str, path: str, params: list[tuple[str, str]] | None = None) -> dict[str, Any]:
    token = get_adsense_oauth_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{API_ROOT}{path}"
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.request(method, url, params=params or [], headers=headers)
    if resp.content:
        try:
            data = resp.json()
        except Exception:
            data = {"_raw": resp.text[:2000]}
    else:
        data = {}
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else resp.text
        logger.warning("AdSense %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data if isinstance(data, dict) else {}


async def _request_bytes(method: str, path: str, params: list[tuple[str, str]] | None = None) -> tuple[bytes, str]:
    token = get_adsense_oauth_token()
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{API_ROOT}{path}"
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.request(method, url, params=params or [], headers=headers)
    ct = resp.headers.get("content-type", "application/octet-stream")
    if resp.status_code >= 400:
        try:
            data = resp.json()
            msg = data.get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text
        logger.warning("AdSense %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return resp.content, ct


# --- Core schemas (subset of discovery; extra fields preserved via model_validate if needed) ---


class TimeZone(BaseModel):
    model_config = {"extra": "allow"}

    id: str = ""
    version: str = ""


class AdsenseAccount(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    displayName: str = ""
    premium: bool = False
    timeZone: TimeZone | None = None
    createTime: str = ""
    pendingTasks: list[str] = Field(default_factory=list)
    state: str = ""


class ListAccountsResponse(BaseModel):
    model_config = {"extra": "allow"}

    accounts: list[AdsenseAccount] = Field(default_factory=list)
    nextPageToken: str = ""


class AdsenseAdClient(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    reportingDimensionId: str = ""
    productCode: str = ""
    state: str = ""


class ListAdClientsResponse(BaseModel):
    model_config = {"extra": "allow"}

    adClients: list[AdsenseAdClient] = Field(default_factory=list)
    nextPageToken: str = ""


class Header(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    type: str = ""
    currencyCode: str = ""


class Cell(BaseModel):
    model_config = {"extra": "allow"}

    value: str = ""


class Row(BaseModel):
    model_config = {"extra": "allow"}

    cells: list[Cell] = Field(default_factory=list)


class ReportResult(BaseModel):
    model_config = {"extra": "allow"}

    totalMatchedRows: str = ""
    headers: list[Header] = Field(default_factory=list)
    rows: list[Row] = Field(default_factory=list)
    totals: Row | None = None
    averages: Row | None = None
    warnings: list[str] = Field(default_factory=list)


class AdsenseSite(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    reportingDimensionId: str = ""
    domain: str = ""
    state: str = ""
    autoAdsEnabled: bool = False


class ListSitesResponse(BaseModel):
    model_config = {"extra": "allow"}

    sites: list[AdsenseSite] = Field(default_factory=list)
    nextPageToken: str = ""


class AdsenseDate(BaseModel):
    model_config = {"extra": "allow"}

    year: int = 0
    month: int = 0
    day: int = 0


class Payment(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    date: AdsenseDate | None = None
    amount: str = ""


class ListPaymentsResponse(BaseModel):
    model_config = {"extra": "allow"}

    payments: list[Payment] = Field(default_factory=list)


class Alert(BaseModel):
    model_config = {"extra": "allow"}

    name: str = ""
    severity: str = ""
    message: str = ""
    type: str = ""


class ListAlertsResponse(BaseModel):
    model_config = {"extra": "allow"}

    alerts: list[Alert] = Field(default_factory=list)


# --- API calls ---


async def accounts_list(*, page_size: int | None = None, page_token: str | None = None) -> ListAccountsResponse:
    q: list[tuple[str, str]] = []
    if page_size is not None:
        q.append(("pageSize", str(page_size)))
    if page_token:
        q.append(("pageToken", page_token))
    data = await _request_json("GET", "/v2/accounts", q)
    return ListAccountsResponse.model_validate(data)


async def accounts_get(account: str) -> AdsenseAccount:
    acc = _normalize_account(account)
    data = await _request_json("GET", f"/v2/{acc}")
    return AdsenseAccount.model_validate(data)


async def accounts_list_child_accounts(
    account: str,
    *,
    page_size: int | None = None,
    page_token: str | None = None,
) -> ListAccountsResponse:
    parent = _normalize_account(account)
    q: list[tuple[str, str]] = []
    if page_size is not None:
        q.append(("pageSize", str(page_size)))
    if page_token:
        q.append(("pageToken", page_token))
    data = await _request_json("GET", f"/v2/{parent}:listChildAccounts", q)
    return ListAccountsResponse.model_validate(data)


async def adclients_list(
    account: str,
    *,
    page_size: int | None = None,
    page_token: str | None = None,
) -> ListAdClientsResponse:
    parent = _normalize_account(account)
    q: list[tuple[str, str]] = []
    if page_size is not None:
        q.append(("pageSize", str(page_size)))
    if page_token:
        q.append(("pageToken", page_token))
    data = await _request_json("GET", f"/v2/{parent}/adclients", q)
    return ListAdClientsResponse.model_validate(data)


async def reports_generate(account: str, query: dict[str, Any]) -> ReportResult:
    """
    GET .../v2/{account}/reports:generate
    query: dimensions, metrics (lists), dateRange, filters, orderBy, startDate.*, endDate.*, etc.
    """
    acc = _normalize_account(account)
    q = _params_from_mapping(query)
    data = await _request_json("GET", f"/v2/{acc}/reports:generate", q)
    return ReportResult.model_validate(data)


async def reports_generate_csv(account: str, query: dict[str, Any]) -> tuple[bytes, str]:
    acc = _normalize_account(account)
    q = _params_from_mapping(query)
    return await _request_bytes("GET", f"/v2/{acc}/reports:generateCsv", q)


async def sites_list(
    account: str,
    *,
    page_size: int | None = None,
    page_token: str | None = None,
) -> ListSitesResponse:
    parent = _normalize_account(account)
    q: list[tuple[str, str]] = []
    if page_size is not None:
        q.append(("pageSize", str(page_size)))
    if page_token:
        q.append(("pageToken", page_token))
    data = await _request_json("GET", f"/v2/{parent}/sites", q)
    return ListSitesResponse.model_validate(data)


async def payments_list(account: str) -> ListPaymentsResponse:
    parent = _normalize_account(account)
    data = await _request_json("GET", f"/v2/{parent}/payments", [])
    return ListPaymentsResponse.model_validate(data)


async def alerts_list(account: str, *, language_code: str | None = None) -> ListAlertsResponse:
    parent = _normalize_account(account)
    q: list[tuple[str, str]] = []
    if language_code:
        q.append(("languageCode", language_code))
    data = await _request_json("GET", f"/v2/{parent}/alerts", q)
    return ListAlertsResponse.model_validate(data)
