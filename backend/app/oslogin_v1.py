"""
Google Cloud OS Login API v1 / v1beta (discovery: oslogin:v1, oslogin:v1beta).

https://oslogin.googleapis.com/v1/ or .../v1beta/
https://cloud.google.com/compute/docs/oslogin/

Service account JSON with **cloud-platform** scope (covers all OS Login methods in discovery).

Env:
  GOOGLE_OSLOGIN_SA_JSON_PATH
  GOOGLE_OSLOGIN_BASE_URL — optional; default https://oslogin.googleapis.com
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_OSLOGIN_BASE = "https://oslogin.googleapis.com"
SCOPE_OSLOGIN = "https://www.googleapis.com/auth/cloud-platform"


def oslogin_configured() -> bool:
    return bool(get_settings().google_oslogin_sa_json_path.strip())


def _api_base() -> str:
    raw = get_settings().google_oslogin_base_url.strip()
    return (raw or DEFAULT_OSLOGIN_BASE).rstrip("/")


def get_oslogin_access_token() -> str:
    st = get_settings()
    path = st.google_oslogin_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_OSLOGIN_SA_JSON_PATH for OS Login API")
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=[SCOPE_OSLOGIN],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh OS Login service account token")
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


async def oslogin_request(
    method: str,
    resource_path: str,
    *,
    api_version: str = "v1",
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    timeout: float = 120.0,
) -> Any:
    """JSON OS Login API call. Path is after the version segment (no leading slash). `api_version`: `v1` or `v1beta`."""
    token = get_oslogin_access_token()
    path = resource_path.lstrip("/")
    ver = api_version.strip().lstrip("/") or "v1"
    url = f"{_api_base()}/{ver}/{path}"
    headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    qp = _flatten_query_params(params)
    kw: dict[str, Any] = {"method": method, "url": url, "params": qp, "headers": headers}
    if json_body is not None:
        kw["json"] = json_body
        headers["Content-Type"] = "application/json"
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
        logger.warning("OS Login %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


__all__ = [
    "DEFAULT_OSLOGIN_BASE",
    "SCOPE_OSLOGIN",
    "get_oslogin_access_token",
    "oslogin_configured",
    "oslogin_request",
]
