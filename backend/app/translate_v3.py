"""
Google Cloud Translation API v3 / v3beta1 (discovery: translate:v3, translate:v3beta1).

https://translation.googleapis.com/v3/ or .../v3beta1/
https://cloud.google.com/translate/docs/

Service account with **cloud-platform** or **cloud-translation** scope (cloud-platform covers both).

Env:
  GOOGLE_TRANSLATE_SA_JSON_PATH
  GOOGLE_TRANSLATE_BASE_URL — optional; default https://translation.googleapis.com
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_TRANSLATE_BASE = "https://translation.googleapis.com"
SCOPE_TRANSLATE = "https://www.googleapis.com/auth/cloud-platform"


def translate_configured() -> bool:
    return bool(get_settings().google_translate_sa_json_path.strip())


def _api_base() -> str:
    raw = get_settings().google_translate_base_url.strip()
    return (raw or DEFAULT_TRANSLATE_BASE).rstrip("/")


def get_translate_access_token() -> str:
    st = get_settings()
    path = st.google_translate_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_TRANSLATE_SA_JSON_PATH for Translation API")
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=[SCOPE_TRANSLATE],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Translation service account token")
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


async def translate_request(
    method: str,
    resource_path: str,
    *,
    api_version: str = "v3",
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    timeout: float = 300.0,
) -> Any:
    """JSON Translation API call. `resource_path` is after the version segment (no leading slash). `api_version`: `v3` or `v3beta1`."""
    token = get_translate_access_token()
    path = resource_path.lstrip("/")
    ver = api_version.strip().lstrip("/") or "v3"
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
        logger.warning("Translate %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


__all__ = [
    "DEFAULT_TRANSLATE_BASE",
    "SCOPE_TRANSLATE",
    "get_translate_access_token",
    "translate_configured",
    "translate_request",
]
