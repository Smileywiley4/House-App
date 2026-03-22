"""
Google Android Management API v1 (discovery: androidmanagement:v1).

https://androidmanagement.googleapis.com/v1/
https://developers.google.com/android/management

Service account JSON (no domain-wide delegation). Enable **Android Management API** on the GCP
project and grant the service account an appropriate role (e.g. Android Management User).

OAuth scope (discovery): https://www.googleapis.com/auth/androidmanagement

Env:
  GOOGLE_ANDROID_MANAGEMENT_SA_JSON_PATH — path to service account JSON
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

GOOGLE_ANDROID_MANAGEMENT_ROOT = "https://androidmanagement.googleapis.com"
SCOPE_ANDROID_MANAGEMENT = "https://www.googleapis.com/auth/androidmanagement"
API_BASE = f"{GOOGLE_ANDROID_MANAGEMENT_ROOT}/v1"


def android_management_configured() -> bool:
    return bool(get_settings().google_android_management_sa_json_path.strip())


def get_android_management_access_token() -> str:
    st = get_settings()
    path = st.google_android_management_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_ANDROID_MANAGEMENT_SA_JSON_PATH for Android Management API")
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=[SCOPE_ANDROID_MANAGEMENT],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Android Management service account token")
    return creds.token


def _flatten_query_params(params: dict[str, Any] | None) -> list[tuple[str, str]]:
    """Build query pairs; list values become repeated keys (Google REST style)."""
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


async def android_management_request(
    method: str,
    resource_path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
) -> Any:
    """
    Call Android Management API. `resource_path` is after `v1/` (no leading slash),
    e.g. `enterprises/LC.../devices`.
    """
    token = get_android_management_access_token()
    path = resource_path.lstrip("/")
    url = f"{GOOGLE_ANDROID_MANAGEMENT_ROOT}/v1/{path}"
    headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    qp = _flatten_query_params(params)
    kw: dict[str, Any] = {"method": method, "url": url, "params": qp, "headers": headers}
    if json_body is not None:
        kw["json"] = json_body
        headers["Content-Type"] = "application/json"
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.request(**kw)
    if resp.content:
        try:
            data = resp.json()
        except Exception:
            data = {"_raw": resp.text[:4000]}
    else:
        data = {} if method != "DELETE" else {}
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else resp.text
        logger.warning("Android Management %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


__all__ = [
    "API_BASE",
    "GOOGLE_ANDROID_MANAGEMENT_ROOT",
    "SCOPE_ANDROID_MANAGEMENT",
    "android_management_configured",
    "get_android_management_access_token",
    "android_management_request",
]
