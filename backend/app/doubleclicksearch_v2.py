"""
Google DoubleClick Search API v2 (Search Ads 360 reporting / legacy REST).

Base: https://www.googleapis.com/doubleclicksearch/v2/

Uses OAuth 2.0 with a **refresh token** (same pattern as AdSense). Scope:
  https://www.googleapis.com/auth/doubleclicksearch

Example:
  GET .../v2/agency/{agencyId}/advertiser/{advertiserId}/idmapping

Docs: https://developers.google.com/search-ads/reporting
"""
from __future__ import annotations

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials

from app.config import get_settings

DEFAULT_DOUBLECLICKSEARCH_HOST = "https://www.googleapis.com"
SCOPE_DOUBLECLICKSEARCH = "https://www.googleapis.com/auth/doubleclicksearch"


def doubleclicksearch_configured() -> bool:
    s = get_settings()
    return bool(
        s.google_doubleclicksearch_client_id.strip()
        and s.google_doubleclicksearch_client_secret.strip()
        and s.google_doubleclicksearch_refresh_token.strip()
    )


def _host() -> str:
    h = get_settings().google_doubleclicksearch_base_url.strip() or DEFAULT_DOUBLECLICKSEARCH_HOST
    return h.rstrip("/")


def get_doubleclicksearch_access_token() -> str:
    s = get_settings()
    if not doubleclicksearch_configured():
        raise ValueError(
            "DoubleClick Search: set GOOGLE_DOUBLECLICKSEARCH_CLIENT_ID, "
            "GOOGLE_DOUBLECLICKSEARCH_CLIENT_SECRET, GOOGLE_DOUBLECLICKSEARCH_REFRESH_TOKEN"
        )
    creds = Credentials(
        token=None,
        refresh_token=s.google_doubleclicksearch_refresh_token.strip(),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=s.google_doubleclicksearch_client_id.strip(),
        client_secret=s.google_doubleclicksearch_client_secret.strip(),
        scopes=[SCOPE_DOUBLECLICKSEARCH],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("DoubleClick Search OAuth refresh failed")
    return creds.token


def doubleclicksearch_v2_url(resource_path: str) -> str:
    """Full URL under /doubleclicksearch/v2/{path}."""
    p = resource_path.lstrip("/")
    return f"{_host()}/doubleclicksearch/v2/{p}"


async def doubleclicksearch_http_request(
    method: str,
    url: str,
    *,
    query_items: list[tuple[str, str]] | None = None,
    content: bytes | None = None,
    content_type: str | None = None,
    timeout: float = 120.0,
) -> httpx.Response:
    token = get_doubleclicksearch_access_token()
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
    "DEFAULT_DOUBLECLICKSEARCH_HOST",
    "SCOPE_DOUBLECLICKSEARCH",
    "doubleclicksearch_configured",
    "doubleclicksearch_http_request",
    "doubleclicksearch_v2_url",
    "get_doubleclicksearch_access_token",
]
