"""
Google Analytics Hub API (discovery: analyticshub:v1 and v1beta1).

https://analyticshub.googleapis.com/v1/
https://analyticshub.googleapis.com/v1beta1/
https://cloud.google.com/bigquery/docs/analytics-hub-introduction

Uses a **service account JSON** key (same pattern as Workspace APIs, but **no** domain-wide delegation).
Enable "Analytics Hub API" on the GCP project; grant the SA roles (e.g. Analytics Hub Admin / Viewer) as needed.

Env:
  GOOGLE_ANALYTICS_HUB_SA_JSON_PATH — path to service account JSON
  GOOGLE_ANALYTICS_HUB_ACCESS — OAuth scope mode (must match discovery analyticshub:v1):
    - readonly  → https://www.googleapis.com/auth/bigquery.readonly
    - readwrite → https://www.googleapis.com/auth/bigquery (default; listing in discovery)
    - cloud_platform → https://www.googleapis.com/auth/cloud-platform (broader GCP access)
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

GOOGLE_ANALYTICS_HUB_ROOT = "https://analyticshub.googleapis.com"

# Back-compat for imports expecting a v1 base URL
API_BASE = f"{GOOGLE_ANALYTICS_HUB_ROOT}/v1"


def _normalize_analytics_hub_api_version(api_version: str) -> str:
    v = (api_version or "v1").strip().lower()
    if v in ("v1", "1"):
        return "v1"
    if v in ("v1beta1", "beta", "v1beta"):
        return "v1beta1"
    raise ValueError(f"Unsupported Analytics Hub API version: {api_version!r} (use v1 or v1beta1)")


def analytics_hub_configured() -> bool:
    return bool(get_settings().google_analytics_hub_sa_json_path.strip())


def _scopes() -> list[str]:
    acc = (get_settings().google_analytics_hub_access or "readwrite").lower().strip().replace("-", "_")
    if acc == "readonly":
        return ["https://www.googleapis.com/auth/bigquery.readonly"]
    if acc in ("cloud_platform", "cloudplatform"):
        return ["https://www.googleapis.com/auth/cloud-platform"]
    # readwrite (default): discovery lists bigquery before cloud-platform
    return ["https://www.googleapis.com/auth/bigquery"]


def get_analytics_hub_access_token() -> str:
    st = get_settings()
    path = st.google_analytics_hub_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_ANALYTICS_HUB_SA_JSON_PATH for Analytics Hub API")
    creds = service_account.Credentials.from_service_account_file(path, scopes=_scopes())
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Analytics Hub service account token")
    return creds.token


def _query_params(params: dict[str, Any] | None) -> dict[str, Any]:
    if not params:
        return {}
    out: dict[str, Any] = {}
    for k, v in params.items():
        if v is None:
            continue
        if isinstance(v, bool):
            out[k] = "true" if v else "false"
        else:
            out[k] = v
    return out


async def analytics_hub_request(
    method: str,
    resource_path: str,
    *,
    api_version: str = "v1",
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
) -> Any:
    """
    Call Analytics Hub. `resource_path` is the path after the version segment (no leading slash),
    e.g. `projects/my-p/locations/us/dataExchanges`.
    `api_version` is `v1` or `v1beta1` (matches Google's REST path).
    """
    ver = _normalize_analytics_hub_api_version(api_version)
    token = get_analytics_hub_access_token()
    path = resource_path.lstrip("/")
    url = f"{GOOGLE_ANALYTICS_HUB_ROOT}/{ver}/{path}"
    headers: dict[str, str] = {"Authorization": f"Bearer {token}"}
    kw: dict[str, Any] = {"method": method, "url": url, "params": _query_params(params), "headers": headers}
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
        data = {} if method != "DELETE" else {}
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else resp.text
        logger.warning("Analytics Hub %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


__all__ = [
    "API_BASE",
    "GOOGLE_ANALYTICS_HUB_ROOT",
    "analytics_hub_configured",
    "get_analytics_hub_access_token",
    "analytics_hub_request",
]
