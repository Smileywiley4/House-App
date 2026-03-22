"""
Google Drive API v3 (discovery: drive:v3).

https://www.googleapis.com/drive/v3/
https://developers.google.com/workspace/drive/

Service account JSON + OAuth scopes (default full **drive** scope).
Optional **domain-wide delegation** via `GOOGLE_DRIVE_IMPERSONATE_EMAIL` (Workspace user).

Upload endpoints (same API version):
  https://www.googleapis.com/upload/drive/v3/...
  https://www.googleapis.com/resumable/upload/drive/v3/...

Env:
  GOOGLE_DRIVE_SA_JSON_PATH
  GOOGLE_DRIVE_IMPERSONATE_EMAIL — optional
  GOOGLE_DRIVE_SCOPES — comma-separated (default: https://www.googleapis.com/auth/drive)
  GOOGLE_DRIVE_BASE_URL — optional; default https://www.googleapis.com
"""
from __future__ import annotations

import logging
import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_DRIVE_API_ROOT = "https://www.googleapis.com"
DEFAULT_DRIVE_SCOPES = ("https://www.googleapis.com/auth/drive",)


def drive_configured() -> bool:
    return bool(get_settings().google_drive_sa_json_path.strip())


def _api_root() -> str:
    return (get_settings().google_drive_base_url.strip() or DEFAULT_DRIVE_API_ROOT).rstrip("/")


def _scopes_list() -> list[str]:
    raw = get_settings().google_drive_scopes.strip()
    if not raw:
        return list(DEFAULT_DRIVE_SCOPES)
    return [s.strip() for s in raw.split(",") if s.strip()]


def get_drive_access_token() -> str:
    st = get_settings()
    path = st.google_drive_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_DRIVE_SA_JSON_PATH for Google Drive API")
    scopes = _scopes_list()
    creds = service_account.Credentials.from_service_account_file(path, scopes=scopes)
    subj = st.google_drive_impersonate_email.strip()
    if subj:
        creds = creds.with_subject(subj)
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Google Drive service account token")
    return creds.token


def drive_json_url(resource_path: str) -> str:
    p = resource_path.lstrip("/")
    return f"{_api_root()}/drive/v3/{p}"


def drive_upload_url(resource_path: str) -> str:
    p = resource_path.lstrip("/")
    return f"{_api_root()}/upload/drive/v3/{p}"


def drive_resumable_url(resource_path: str) -> str:
    p = resource_path.lstrip("/")
    return f"{_api_root()}/resumable/upload/drive/v3/{p}"


async def drive_http_request(
    method: str,
    url: str,
    *,
    query_items: list[tuple[str, str]] | None = None,
    content: bytes | None = None,
    content_type: str | None = None,
    forward_headers: dict[str, str] | None = None,
    timeout: float = 300.0,
) -> httpx.Response:
    """Authorized HTTP call; returns raw httpx response."""
    token = get_drive_access_token()
    headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    if forward_headers:
        for k, v in forward_headers.items():
            if k.lower() == "authorization":
                continue
            headers[k] = v
    if content is not None and content_type and not any(h.lower() == "content-type" for h in headers):
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
    "DEFAULT_DRIVE_API_ROOT",
    "drive_configured",
    "drive_http_request",
    "drive_json_url",
    "drive_resumable_url",
    "drive_upload_url",
    "get_drive_access_token",
]
