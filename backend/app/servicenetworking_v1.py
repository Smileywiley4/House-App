"""
Google Service Networking API v1 (discovery: servicenetworking:v1).

- https://servicenetworking.googleapis.com/v1/

Private Service Connect / VPC peering / allocated ranges, etc.

https://cloud.google.com/service-infrastructure/docs/service-networking/getting-started

Service account JSON with **https://www.googleapis.com/auth/cloud-platform**
(alternatively service.management is documented; cloud-platform is sufficient for typical calls).

Env:
  GOOGLE_SERVICENETWORKING_SA_JSON_PATH
  GOOGLE_SERVICENETWORKING_BASE_URL — optional; default https://servicenetworking.googleapis.com
"""
from __future__ import annotations

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

DEFAULT_SERVICENETWORKING_BASE = "https://servicenetworking.googleapis.com"
SCOPE_SERVICENETWORKING = "https://www.googleapis.com/auth/cloud-platform"


def servicenetworking_configured() -> bool:
    return bool(get_settings().google_servicenetworking_sa_json_path.strip())


def _api_root() -> str:
    return (
        get_settings().google_servicenetworking_base_url.strip() or DEFAULT_SERVICENETWORKING_BASE
    ).rstrip("/")


def get_servicenetworking_access_token() -> str:
    st = get_settings()
    path = st.google_servicenetworking_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_SERVICENETWORKING_SA_JSON_PATH for Service Networking API")
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=[SCOPE_SERVICENETWORKING],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Service Networking service account token")
    return creds.token


def servicenetworking_v1_url(resource_path: str) -> str:
    """Full URL under /v1/{path} (path without leading slash)."""
    p = resource_path.lstrip("/")
    return f"{_api_root()}/v1/{p}"


async def servicenetworking_http_request(
    method: str,
    url: str,
    *,
    query_items: list[tuple[str, str]] | None = None,
    content: bytes | None = None,
    content_type: str | None = None,
    timeout: float = 300.0,
) -> httpx.Response:
    token = get_servicenetworking_access_token()
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
    "DEFAULT_SERVICENETWORKING_BASE",
    "SCOPE_SERVICENETWORKING",
    "get_servicenetworking_access_token",
    "servicenetworking_configured",
    "servicenetworking_http_request",
    "servicenetworking_v1_url",
]
