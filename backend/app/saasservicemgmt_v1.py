"""
Google SaaS Runtime API — v1 and v1beta1 (discovery: saasservicemgmt:v1, saasservicemgmt:v1beta1).

- https://saasservicemgmt.googleapis.com/v1/
- https://saasservicemgmt.googleapis.com/v1beta1/

https://cloud.google.com/saas-runtime/docs

Service account JSON with **https://www.googleapis.com/auth/cloud-platform**.

Env:
  GOOGLE_SAASSERVICEMGMT_SA_JSON_PATH
  GOOGLE_SAASSERVICEMGMT_BASE_URL — optional; default https://saasservicemgmt.googleapis.com
"""
from __future__ import annotations

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

DEFAULT_SAASSERVICEMGMT_BASE = "https://saasservicemgmt.googleapis.com"
SCOPE_SAASSERVICEMGMT = "https://www.googleapis.com/auth/cloud-platform"


def saasservicemgmt_configured() -> bool:
    return bool(get_settings().google_saasservicemgmt_sa_json_path.strip())


def _api_root() -> str:
    return (
        get_settings().google_saasservicemgmt_base_url.strip() or DEFAULT_SAASSERVICEMGMT_BASE
    ).rstrip("/")


def get_saasservicemgmt_access_token() -> str:
    st = get_settings()
    path = st.google_saasservicemgmt_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_SAASSERVICEMGMT_SA_JSON_PATH for SaaS Runtime API")
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=[SCOPE_SAASSERVICEMGMT],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh SaaS Runtime service account token")
    return creds.token


def saasservicemgmt_api_url(api_version: str, resource_path: str) -> str:
    """Build upstream URL for `v1` or `v1beta1` REST prefix."""
    ver = api_version.strip().lstrip("/")
    if ver not in ("v1", "v1beta1"):
        raise ValueError("api_version must be 'v1' or 'v1beta1'")
    p = resource_path.lstrip("/")
    return f"{_api_root()}/{ver}/{p}"


def saasservicemgmt_v1_url(resource_path: str) -> str:
    return saasservicemgmt_api_url("v1", resource_path)


def saasservicemgmt_v1beta1_url(resource_path: str) -> str:
    return saasservicemgmt_api_url("v1beta1", resource_path)


async def saasservicemgmt_http_request(
    method: str,
    url: str,
    *,
    query_items: list[tuple[str, str]] | None = None,
    content: bytes | None = None,
    content_type: str | None = None,
    timeout: float = 300.0,
) -> httpx.Response:
    token = get_saasservicemgmt_access_token()
    headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    if content is not None and content_type:
        headers["Content-Type"] = content_type
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.request(
            method,
            url,
            params=query_items or None,
            content=content,
            headers=headers,
        )


__all__ = [
    "DEFAULT_SAASSERVICEMGMT_BASE",
    "SCOPE_SAASSERVICEMGMT",
    "get_saasservicemgmt_access_token",
    "saasservicemgmt_api_url",
    "saasservicemgmt_configured",
    "saasservicemgmt_http_request",
    "saasservicemgmt_v1_url",
    "saasservicemgmt_v1beta1_url",
]
