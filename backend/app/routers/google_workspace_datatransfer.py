"""
Proxy for Google Workspace Admin SDK — Data Transfer API.

Secured: Supabase JWT + profile plan `admin` + server-side service account.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import require_admin_plan
from app.google_workspace_datatransfer import (
    Application,
    ApplicationsListResponse,
    DataTransfer,
    DataTransfersListResponse,
    applications_get,
    applications_list,
    transfers_get,
    transfers_insert,
    transfers_list,
    workspace_datatransfer_configured,
)

router = APIRouter(prefix="/google/workspace/datatransfer", tags=["google-workspace"])


def _require_workspace() -> None:
    if not workspace_datatransfer_configured():
        raise HTTPException(
            status_code=503,
            detail="Google Workspace Data Transfer proxy is not configured on the server",
        )


@router.get("/applications", response_model=ApplicationsListResponse)
async def list_applications(
    customer_id: str | None = Query(None, description="Immutable ID of the Workspace account"),
    max_results: int | None = Query(None, ge=1, le=500),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_workspace()
    try:
        return await applications_list(
            customer_id=customer_id,
            max_results=max_results,
            page_token=page_token,
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/applications/{application_id}", response_model=Application)
async def get_application(
    application_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_workspace()
    try:
        return await applications_get(application_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/transfers", response_model=DataTransfersListResponse)
async def list_transfers(
    customer_id: str | None = Query(None),
    max_results: int | None = Query(None, ge=1, le=500),
    page_token: str | None = None,
    new_owner_user_id: str | None = Query(None),
    old_owner_user_id: str | None = Query(None),
    status: str | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_workspace()
    try:
        return await transfers_list(
            customer_id=customer_id,
            max_results=max_results,
            page_token=page_token,
            new_owner_user_id=new_owner_user_id,
            old_owner_user_id=old_owner_user_id,
            status=status,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/transfers/{data_transfer_id}", response_model=DataTransfer)
async def get_transfer(
    data_transfer_id: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_workspace()
    try:
        return await transfers_get(data_transfer_id)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/transfers", response_model=DataTransfer)
async def create_transfer(
    body: dict[str, Any],
    _admin: str = Depends(require_admin_plan),
):
    _require_workspace()
    try:
        return await transfers_insert(body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
