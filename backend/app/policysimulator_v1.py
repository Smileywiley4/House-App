"""
Google Policy Simulator API — v1 and v1beta (discovery: policysimulator:v1, policysimulator:v1beta).

- https://policysimulator.googleapis.com/v1/
- https://policysimulator.googleapis.com/v1beta/

https://cloud.google.com/iam/docs/simulating-access

Service account JSON with **https://www.googleapis.com/auth/cloud-platform**.

Env:
  GOOGLE_POLICYSIMULATOR_SA_JSON_PATH
  GOOGLE_POLICYSIMULATOR_BASE_URL — optional; default https://policysimulator.googleapis.com
"""
from __future__ import annotations

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

DEFAULT_POLICYSIMULATOR_BASE = "https://policysimulator.googleapis.com"
SCOPE_POLICYSIMULATOR = "https://www.googleapis.com/auth/cloud-platform"


def policysimulator_configured() -> bool:
    return bool(get_settings().google_policysimulator_sa_json_path.strip())


def _api_root() -> str:
    return (get_settings().google_policysimulator_base_url.strip() or DEFAULT_POLICYSIMULATOR_BASE).rstrip(
        "/"
    )


def get_policysimulator_access_token() -> str:
    st = get_settings()
    path = st.google_policysimulator_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_POLICYSIMULATOR_SA_JSON_PATH for Policy Simulator API")
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=[SCOPE_POLICYSIMULATOR],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Policy Simulator service account token")
    return creds.token


def policysimulator_api_url(api_version: str, resource_path: str) -> str:
    """Build upstream URL for `v1` or `v1beta` REST prefix."""
    ver = api_version.strip().lstrip("/")
    if ver not in ("v1", "v1beta"):
        raise ValueError("api_version must be 'v1' or 'v1beta'")
    p = resource_path.lstrip("/")
    return f"{_api_root()}/{ver}/{p}"


def policysimulator_v1_url(resource_path: str) -> str:
    return policysimulator_api_url("v1", resource_path)


def policysimulator_v1beta_url(resource_path: str) -> str:
    return policysimulator_api_url("v1beta", resource_path)


async def policysimulator_http_request(
    method: str,
    url: str,
    *,
    query_items: list[tuple[str, str]] | None = None,
    content: bytes | None = None,
    content_type: str | None = None,
    timeout: float = 300.0,
) -> httpx.Response:
    token = get_policysimulator_access_token()
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
    "DEFAULT_POLICYSIMULATOR_BASE",
    "SCOPE_POLICYSIMULATOR",
    "get_policysimulator_access_token",
    "policysimulator_api_url",
    "policysimulator_configured",
    "policysimulator_http_request",
    "policysimulator_v1_url",
    "policysimulator_v1beta_url",
]
