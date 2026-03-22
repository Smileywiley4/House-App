"""
Google Cloud Data Fusion API (discovery: datafusion:v1 and datafusion:v1beta1).

https://datafusion.googleapis.com/v1/ or .../v1beta1/
https://cloud.google.com/data-fusion/docs

Service account JSON with **cloud-platform** scope. Enable **Data Fusion API** on the GCP project.

Optional **regional** API host (discovery `endpoints`), e.g.:
  https://datafusion.us-central1.rep.googleapis.com
Set `GOOGLE_DATA_FUSION_BASE_URL` to override the default global host.

Env:
  GOOGLE_DATA_FUSION_SA_JSON_PATH
  GOOGLE_DATA_FUSION_BASE_URL — optional; default https://datafusion.googleapis.com
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

DEFAULT_DATA_FUSION_BASE = "https://datafusion.googleapis.com"
SCOPE_DATA_FUSION = "https://www.googleapis.com/auth/cloud-platform"


def data_fusion_configured() -> bool:
    return bool(get_settings().google_data_fusion_sa_json_path.strip())


def _api_base() -> str:
    raw = get_settings().google_data_fusion_base_url.strip()
    base = (raw or DEFAULT_DATA_FUSION_BASE).rstrip("/")
    return base


def get_data_fusion_access_token() -> str:
    st = get_settings()
    path = st.google_data_fusion_sa_json_path.strip()
    if not path:
        raise ValueError("Set GOOGLE_DATA_FUSION_SA_JSON_PATH for Data Fusion API")
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=[SCOPE_DATA_FUSION],
    )
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Data Fusion service account token")
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


async def data_fusion_request(
    method: str,
    resource_path: str,
    *,
    api_version: str = "v1",
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
    timeout: float = 300.0,
) -> Any:
    """
    JSON Data Fusion API call. `resource_path` is after the version segment (no leading slash),
    e.g. `projects/my-proj/locations/us-central1/instances`.
    `api_version` is `v1` or `v1beta1`.
    """
    token = get_data_fusion_access_token()
    path = resource_path.lstrip("/")
    ver = api_version.strip().lstrip("/") or "v1"
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
        logger.warning("Data Fusion %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data


__all__ = [
    "DEFAULT_DATA_FUSION_BASE",
    "SCOPE_DATA_FUSION",
    "data_fusion_configured",
    "data_fusion_request",
    "get_data_fusion_access_token",
]
