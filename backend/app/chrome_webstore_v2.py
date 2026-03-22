"""
Chrome Web Store API v2 (discovery: chromewebstore:v2).

https://chromewebstore.googleapis.com/v2/
https://developer.chrome.com/docs/webstore/api

Service account JSON. Enable **Chrome Web Store API** on the GCP project and grant the account
access to your publisher items as required by Google.

OAuth scopes:
  - https://www.googleapis.com/auth/chromewebstore.readonly — fetchStatus
  - https://www.googleapis.com/auth/chromewebstore — publish, upload, cancel, set deploy %

Env:
  GOOGLE_CHROME_WEBSTORE_SA_JSON_PATH
  GOOGLE_CHROME_WEBSTORE_ACCESS — readonly | readwrite (default readwrite; readonly blocks writes on proxy)
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

GOOGLE_CHROME_WEBSTORE_ROOT = "https://chromewebstore.googleapis.com"
GOOGLE_CHROME_WEBSTORE_UPLOAD_ROOT = "https://www.googleapis.com/upload/chromewebstore"
SCOPE_CHROME_WEBSTORE = "https://www.googleapis.com/auth/chromewebstore"
SCOPE_CHROME_WEBSTORE_READONLY = "https://www.googleapis.com/auth/chromewebstore.readonly"


def chrome_webstore_configured() -> bool:
    return bool(get_settings().google_chrome_webstore_sa_json_path.strip())


def _scope_for_settings() -> str:
    mode = get_settings().google_chrome_webstore_access.strip().lower()
    if mode == "readonly":
        return SCOPE_CHROME_WEBSTORE_READONLY
    return SCOPE_CHROME_WEBSTORE


def get_chrome_webstore_access_token() -> str:
    st = get_settings()
    path = st.google_chrome_webstore_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_CHROME_WEBSTORE_SA_JSON_PATH for Chrome Web Store API")
    scope = _scope_for_settings()
    creds = service_account.Credentials.from_service_account_file(path, scopes=[scope])
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Chrome Web Store service account token")
    return creds.token


def _flatten_query_params(params: dict[str, Any] | None) -> list[tuple[str, str]]:
    if not params:
        return []
    out: list[tuple[str, str]] = []
    for k, v in params.items():
        if v is None:
            continue
        if isinstance(v, bool):
            out.append((k, "true" if v else "false"))
        else:
            out.append((k, str(v)))
    return out


async def chrome_webstore_request(
    method: str,
    resource_path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
) -> Any:
    """JSON API call. `resource_path` is after `v2/` (no leading slash)."""
    token = get_chrome_webstore_access_token()
    path = resource_path.lstrip("/")
    url = f"{GOOGLE_CHROME_WEBSTORE_ROOT}/v2/{path}"
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
        logger.warning("Chrome Web Store %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


async def chrome_webstore_upload_package(
    item_resource_path: str,
    *,
    file_bytes: bytes,
    content_type: str = "application/zip",
) -> Any:
    """
    POST .../upload/chromewebstore/v2/publishers/.../items/...:upload (multipart/related).
    `item_resource_path` is e.g. `publishers/PUB/items/ITEM` (no leading slash).
    """
    token = get_chrome_webstore_access_token()
    rel = item_resource_path.lstrip("/")
    url = f"{GOOGLE_CHROME_WEBSTORE_UPLOAD_ROOT}/v2/{rel}:upload"
    boundary = f"batch_{uuid.uuid4().hex}"
    meta = json.dumps({})
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
    async with httpx.AsyncClient(timeout=600) as client:
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
        logger.warning("Chrome Web Store upload %s -> %s: %s", rel, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


__all__ = [
    "GOOGLE_CHROME_WEBSTORE_ROOT",
    "GOOGLE_CHROME_WEBSTORE_UPLOAD_ROOT",
    "SCOPE_CHROME_WEBSTORE",
    "SCOPE_CHROME_WEBSTORE_READONLY",
    "chrome_webstore_configured",
    "chrome_webstore_request",
    "chrome_webstore_upload_package",
    "get_chrome_webstore_access_token",
]
