"""
Google Data Manager API v1 (discovery: datamanager:v1).

https://datamanager.googleapis.com/v1/
https://developers.google.com/data-manager

Service account JSON with **https://www.googleapis.com/auth/datamanager** scope.

Env:
  GOOGLE_DATAMANAGER_SA_JSON_PATH
  GOOGLE_DATAMANAGER_BASE_URL — optional; default https://datamanager.googleapis.com
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_DATAMANAGER_BASE = "https://datamanager.googleapis.com"
SCOPE_DATAMANAGER = "https://www.googleapis.com/auth/datamanager"


def datamanager_configured() -> bool:
    return bool(get_settings().google_datamanager_sa_json_path.strip())


def _api_base() -> str:
    raw = get_settings().google_datamanager_base_url.strip()
    return (raw or DEFAULT_DATAMANAGER_BASE).rstrip("/")


def get_datamanager_access_token() -> str:
    st = get_settings()
    path = st.google_datamanager_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_DATAMANAGER_SA_JSON_PATH for Data Manager API")
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=[SCOPE_DATAMANAGER],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Data Manager service account token")
    return creds.token


def _flatten_query_params(params: dict[str, Any] | None) -> list[tuple[str, str]]:
    if not params:
        return []
    out: list[tuple[str, str]] = []
    for k, v in params.items():
        if v is None:
            continue
        if isinstance(v, list):
            for item in v:
                if item is None:
                    continue
                if isinstance(item, bool):
                    out.append((k, "true" if item else "false"))
                else:
                    out.append((k, str(item)))
        elif isinstance(v, bool):
            out.append((k, "true" if v else "false"))
        else:
            out.append((k, str(v)))
    return out


async def datamanager_request(
    method: str,
    resource_path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    extra_headers: dict[str, str] | None = None,
    timeout: float = 120.0,
) -> Any:
    """JSON Data Manager v1 call. `resource_path` is after `v1/` (no leading slash)."""
    token = get_datamanager_access_token()
    path = resource_path.lstrip("/")
    url = f"{_api_base()}/v1/{path}"
    headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    if extra_headers:
        headers.update(extra_headers)
    qp = _flatten_query_params(params)
    kw: dict[str, Any] = {"method": method, "url": url, "params": qp, "headers": headers}
    if json_body is not None:
        kw["json"] = json_body
        headers.setdefault("Content-Type", "application/json")
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.request(**kw)
    if resp.content:
        try:
            data = resp.json()
        except Exception:
            data = {"_raw": resp.text[:4000]}
    else:
        data = {}
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else resp.text
        logger.warning("DataManager %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


__all__ = [
    "DEFAULT_DATAMANAGER_BASE",
    "SCOPE_DATAMANAGER",
    "datamanager_configured",
    "datamanager_request",
    "get_datamanager_access_token",
]
