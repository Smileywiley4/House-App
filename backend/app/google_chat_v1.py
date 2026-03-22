"""
Google Chat API v1 (discovery: chat:v1).

https://chat.googleapis.com/v1/
https://developers.google.com/workspace/chat

Service account JSON. Many methods require **domain-wide delegation** to a Workspace user
(`GOOGLE_CHAT_IMPERSONATE_EMAIL`) and OAuth scopes appropriate to the operation
(`GOOGLE_CHAT_SCOPES`, comma-separated). Chat **app** calls often use `https://www.googleapis.com/auth/chat.bot`.

Media upload uses the separate upload endpoint:
https://www.googleapis.com/upload/chat/v1/...

Env:
  GOOGLE_CHAT_SA_JSON_PATH — path to service account JSON
  GOOGLE_CHAT_IMPERSONATE_EMAIL — optional; Workspace user to impersonate (domain-wide delegation)
  GOOGLE_CHAT_SCOPES — comma-separated OAuth scopes (default: chat.bot)
"""
from __future__ import annotations

import json
import logging
import uuid
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

GOOGLE_CHAT_ROOT = "https://chat.googleapis.com"
GOOGLE_CHAT_UPLOAD_ROOT = "https://www.googleapis.com/upload/chat"
DEFAULT_CHAT_SCOPES = ("https://www.googleapis.com/auth/chat.bot",)


def chat_configured() -> bool:
    return bool(get_settings().google_chat_sa_json_path.strip())


def _scopes_list() -> list[str]:
    raw = get_settings().google_chat_scopes.strip()
    if not raw:
        return list(DEFAULT_CHAT_SCOPES)
    return [s.strip() for s in raw.split(",") if s.strip()]


def get_chat_access_token() -> str:
    st = get_settings()
    path = st.google_chat_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_CHAT_SA_JSON_PATH for Google Chat API")
    scopes = _scopes_list()
    creds = service_account.Credentials.from_service_account_file(path, scopes=scopes)
    subj = st.google_chat_impersonate_email.strip()
    if subj:
        creds = creds.with_subject(subj)
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Google Chat service account token")
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


async def chat_request(
    method: str,
    resource_path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
) -> Any:
    """JSON Chat API call. `resource_path` is after `v1/` (no leading slash)."""
    token = get_chat_access_token()
    path = resource_path.lstrip("/")
    url = f"{GOOGLE_CHAT_ROOT}/v1/{path}"
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
        data = {}
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else resp.text
        logger.warning("Google Chat %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


async def chat_request_bytes(
    method: str,
    resource_path: str,
    *,
    params: dict[str, Any] | None = None,
) -> tuple[bytes, str | None]:
    """Binary response (e.g. media download with alt=media). Returns (body, content_type)."""
    token = get_chat_access_token()
    path = resource_path.lstrip("/")
    url = f"{GOOGLE_CHAT_ROOT}/v1/{path}"
    headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    qp = _flatten_query_params(params)
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.request(method, url, params=qp, headers=headers)
    ct = resp.headers.get("content-type")
    if resp.status_code >= 400:
        try:
            data = resp.json()
            msg = data.get("error", {}).get("message") if isinstance(data, dict) else resp.text
        except Exception:
            msg = resp.text[:2000]
        logger.warning("Google Chat bytes %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return resp.content, ct


async def chat_upload_attachment(
    parent_spaces_path: str,
    *,
    filename: str,
    file_bytes: bytes,
    content_type: str = "application/octet-stream",
) -> Any:
    """
    POST .../upload/chat/v1/spaces/{space}/attachments:upload (multipart/related).
    `parent_spaces_path` is e.g. `spaces/SPACE_ID` (no leading slash).
    """
    token = get_chat_access_token()
    parent = parent_spaces_path.lstrip("/")
    url = f"{GOOGLE_CHAT_UPLOAD_ROOT}/v1/{parent}/attachments:upload"
    boundary = f"batch_{uuid.uuid4().hex}"
    meta = json.dumps({"filename": filename})
    crlf = b"\r\n"
    body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{meta}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8")
    body += file_bytes
    body += f"\r\n--{boundary}--\r\n".encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": f"multipart/related; boundary={boundary}",
    }
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(url, content=body, headers=headers)
    if resp.content:
        try:
            data = resp.json()
        except Exception:
            data = {"_raw": resp.text[:4000]}
    else:
        data = {}
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else resp.text
        logger.warning("Google Chat upload %s -> %s: %s", parent, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


__all__ = [
    "GOOGLE_CHAT_ROOT",
    "GOOGLE_CHAT_UPLOAD_ROOT",
    "chat_configured",
    "chat_request",
    "chat_request_bytes",
    "chat_upload_attachment",
    "get_chat_access_token",
]
