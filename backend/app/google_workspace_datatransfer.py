"""
Google Workspace Admin SDK — Data Transfer API.

Discovery: admin:datatransfer_v1 — paths under https://admin.googleapis.com/admin/datatransfer/v1/

Requires OAuth 2.0 (service account + domain-wide delegation to a super admin).
NOT usable with a browser API key.

Setup:
  1. Create a service account in GCP, enable Admin SDK API.
  2. Domain-wide delegation: authorize the SA client ID with scopes
     https://www.googleapis.com/auth/admin.datatransfer.readonly and/or
     https://www.googleapis.com/auth/admin.datatransfer
  3. Set GOOGLE_WORKSPACE_SA_JSON_PATH, GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL
"""
from __future__ import annotations

import logging
from typing import Any

import httpx
from google.oauth2 import service_account
from google.auth.transport.requests import Request as GoogleAuthRequest
from pydantic import BaseModel, Field

from app.config import get_settings

logger = logging.getLogger(__name__)

API_BASE = "https://admin.googleapis.com/admin/datatransfer/v1"


def _scopes() -> list[str]:
    s = get_settings()
    if (s.google_workspace_datatransfer_access or "readonly").lower().strip() == "readwrite":
        return ["https://www.googleapis.com/auth/admin.datatransfer"]
    return ["https://www.googleapis.com/auth/admin.datatransfer.readonly"]


def workspace_datatransfer_configured() -> bool:
    st = get_settings()
    return bool(
        st.google_workspace_sa_json_path.strip()
        and st.google_workspace_delegated_admin_email.strip()
    )


def _access_token() -> str:
    st = get_settings()
    path = st.google_workspace_sa_json_path.strip()
    admin_email = st.google_workspace_delegated_admin_email.strip()
    if not path or not admin_email:
        raise ValueError(
            "Workspace Data Transfer: set GOOGLE_WORKSPACE_SA_JSON_PATH and "
            "GOOGLE_WORKSPACE_DELEGATED_ADMIN_EMAIL"
        )
    creds = service_account.Credentials.from_service_account_file(
        path,
        scopes=_scopes(),
    )
    delegated = creds.with_subject(admin_email)
    delegated.refresh(GoogleAuthRequest())
    if not delegated.token:
        raise RuntimeError("Failed to obtain OAuth access token for Workspace API")
    return delegated.token


async def _request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json_body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    token = _access_token()
    url = f"{API_BASE}{path}"
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.request(
            method,
            url,
            params=params or {},
            json=json_body,
            headers=headers,
        )
    data = resp.json() if resp.content else {}
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else resp.text
        logger.warning("Workspace Data Transfer %s %s -> %s: %s", method, path, resp.status_code, msg)
        raise RuntimeError(msg or f"HTTP {resp.status_code}")
    return data if isinstance(data, dict) else {}


# --- Discovery schema models (camelCase matches JSON) ---


class ApplicationTransferParam(BaseModel):
    model_config = {"extra": "allow"}

    key: str = ""
    value: list[str] = Field(default_factory=list)


class Application(BaseModel):
    model_config = {"extra": "allow"}

    id: str = ""
    name: str = ""
    transferParams: list[ApplicationTransferParam] = Field(default_factory=list)
    kind: str = ""
    etag: str = ""


class ApplicationsListResponse(BaseModel):
    model_config = {"extra": "allow"}

    kind: str = ""
    etag: str = ""
    applications: list[Application] = Field(default_factory=list)
    nextPageToken: str = ""


class ApplicationDataTransfer(BaseModel):
    model_config = {"extra": "allow"}

    applicationId: str = ""
    applicationTransferParams: list[ApplicationTransferParam] = Field(default_factory=list)
    applicationTransferStatus: str = ""


class DataTransfer(BaseModel):
    model_config = {"extra": "allow"}

    id: str = ""
    oldOwnerUserId: str = ""
    newOwnerUserId: str = ""
    applicationDataTransfers: list[ApplicationDataTransfer] = Field(default_factory=list)
    overallTransferStatusCode: str = ""
    kind: str = ""
    etag: str = ""
    requestTime: str = ""


class DataTransfersListResponse(BaseModel):
    model_config = {"extra": "allow"}

    kind: str = ""
    etag: str = ""
    dataTransfers: list[DataTransfer] = Field(default_factory=list)
    nextPageToken: str = ""


# --- API operations ---


async def applications_list(
    *,
    customer_id: str | None = None,
    max_results: int | None = None,
    page_token: str | None = None,
) -> ApplicationsListResponse:
    params: dict[str, Any] = {}
    cid = (customer_id or get_settings().google_workspace_customer_id or "").strip()
    if cid:
        params["customerId"] = cid
    if max_results is not None:
        params["maxResults"] = max_results
    if page_token:
        params["pageToken"] = page_token
    data = await _request("GET", "/applications", params=params)
    return ApplicationsListResponse.model_validate(data)


async def applications_get(application_id: str) -> Application:
    data = await _request("GET", f"/applications/{application_id}")
    return Application.model_validate(data)


async def transfers_list(
    *,
    customer_id: str | None = None,
    max_results: int | None = None,
    page_token: str | None = None,
    new_owner_user_id: str | None = None,
    old_owner_user_id: str | None = None,
    status: str | None = None,
) -> DataTransfersListResponse:
    params: dict[str, Any] = {}
    cid = (customer_id or get_settings().google_workspace_customer_id or "").strip()
    if cid:
        params["customerId"] = cid
    if max_results is not None:
        params["maxResults"] = max_results
    if page_token:
        params["pageToken"] = page_token
    if new_owner_user_id:
        params["newOwnerUserId"] = new_owner_user_id
    if old_owner_user_id:
        params["oldOwnerUserId"] = old_owner_user_id
    if status:
        params["status"] = status
    data = await _request("GET", "/transfers", params=params)
    return DataTransfersListResponse.model_validate(data)


async def transfers_get(data_transfer_id: str) -> DataTransfer:
    data = await _request("GET", f"/transfers/{data_transfer_id}")
    return DataTransfer.model_validate(data)


async def transfers_insert(body: dict[str, Any]) -> DataTransfer:
    """POST /transfers — body must match Google's DataTransfer resource (camelCase keys)."""
    access = (get_settings().google_workspace_datatransfer_access or "").lower()
    if access != "readwrite":
        raise ValueError("transfers.insert requires GOOGLE_WORKSPACE_DATATRANSFER_ACCESS=readwrite")
    if not body:
        raise ValueError("Request body is required")
    data = await _request("POST", "/transfers", json_body=body)
    return DataTransfer.model_validate(data)
