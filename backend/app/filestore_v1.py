"""
Google Cloud Filestore API v1 / v1beta1 (discovery: file:v1, file:v1beta1).

https://file.googleapis.com/v1/ or .../v1beta1/
https://cloud.google.com/filestore/

Service account JSON with **cloud-platform** scope. Enable **Filestore API** on the GCP project.

Optional override: `GOOGLE_FILESTORE_BASE_URL` (default https://file.googleapis.com).

Env:
  GOOGLE_FILESTORE_SA_JSON_PATH
  GOOGLE_FILESTORE_BASE_URL
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_FILESTORE_BASE = "https://file.googleapis.com"
SCOPE_FILESTORE = "https://www.googleapis.com/auth/cloud-platform"


def filestore_configured() -> bool:
    return bool(get_settings().google_filestore_sa_json_path.strip())


def _api_base() -> str:
    raw = get_settings().google_filestore_base_url.strip()
    base = (raw or DEFAULT_FILESTORE_BASE).rstrip("/")
    return base


def get_filestore_access_token() -> str:
    st = get_settings()
    path = st.google_filestore_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_FILESTORE_SA_JSON_PATH for Filestore API")
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=[SCOPE_FILESTORE],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Filestore service account token")
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


async def filestore_request(
    method: str,
    resource_path: str,
    *,
    api_version: str = "v1",
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    timeout: float = 300.0,
) -> Any:
    """
    JSON Filestore API call. `resource_path` is after the version segment (no leading slash).
    `api_version` is `v1` or `v1beta1`.
    """
    token = get_filestore_access_token()
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
        logger.warning("Filestore %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


__all__ = [
    "DEFAULT_FILESTORE_BASE",
    "SCOPE_FILESTORE",
    "filestore_configured",
    "filestore_request",
    "get_filestore_access_token",
]
