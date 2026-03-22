"""
Google Policy Analyzer API v1 (discovery: policyanalyzer:v1).

https://policyanalyzer.googleapis.com/v1/
Service account JSON with **https://www.googleapis.com/auth/cloud-platform**.

Env:
  GOOGLE_POLICYANALYZER_SA_JSON_PATH
  GOOGLE_POLICYANALYZER_BASE_URL — optional; default https://policyanalyzer.googleapis.com
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_POLICYANALYZER_BASE = "https://policyanalyzer.googleapis.com"
SCOPE_POLICYANALYZER = "https://www.googleapis.com/auth/cloud-platform"


def policyanalyzer_configured() -> bool:
    return bool(get_settings().google_policyanalyzer_sa_json_path.strip())


def _api_base() -> str:
    raw = get_settings().google_policyanalyzer_base_url.strip()
    return (raw or DEFAULT_POLICYANALYZER_BASE).rstrip("/")


def get_policyanalyzer_access_token() -> str:
    st = get_settings()
    path = st.google_policyanalyzer_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_POLICYANALYZER_SA_JSON_PATH for Policy Analyzer API")
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=[SCOPE_POLICYANALYZER],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Policy Analyzer service account token")
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
                out.append((k, "true" if item is True else "false" if item is False else str(item)))
        elif isinstance(v, bool):
            out.append((k, "true" if v else "false"))
        else:
            out.append((k, str(v)))
    return out


async def policyanalyzer_request(
    method: str,
    resource_path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    timeout: float = 120.0,
) -> Any:
    """JSON Policy Analyzer v1 call. `resource_path` is after `v1/` (no leading slash)."""
    token = get_policyanalyzer_access_token()
    path = resource_path.lstrip("/")
    url = f"{_api_base()}/v1/{path}"
    headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    qp = _flatten_query_params(params)
    kw: dict[str, Any] = {"method": method, "url": url, "params": qp, "headers": headers}
    if json_body is not None:
        kw["json"] = json_body
        headers.setdefault("Content-Type", "application/json")
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
        logger.warning("PolicyAnalyzer %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


__all__ = [
    "DEFAULT_POLICYANALYZER_BASE",
    "SCOPE_POLICYANALYZER",
    "policyanalyzer_configured",
    "policyanalyzer_request",
    "get_policyanalyzer_access_token",
]
