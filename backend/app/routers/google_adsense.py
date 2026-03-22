"""
AdSense Management API v2 proxy — OAuth (refresh token) on server, Supabase admin JWT.

Sensitive publisher data: gated by `profiles.plan == admin`.

`account_ref` is the path after /v2/ for the account resource, e.g. `accounts/pub-1234567890`
(no leading slash; include the `accounts/` prefix).
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field

from app.dependencies import require_admin_plan
from app.google_adsense_v2 import (
    ListAccountsResponse,
    ListAdClientsResponse,
    ListAlertsResponse,
    ListPaymentsResponse,
    ListSitesResponse,
    ReportResult,
    AdsenseAccount,
    accounts_get,
    accounts_list,
    accounts_list_child_accounts,
    adclients_list,
    adsense_configured,
    alerts_list,
    payments_list,
    reports_generate,
    reports_generate_csv,
    sites_list,
)

router = APIRouter(prefix="/google/adsense", tags=["google-adsense"])


def _require_adsense() -> None:
    if not adsense_configured():
        raise HTTPException(
            status_code=503,
            detail="AdSense API is not configured (OAuth client + refresh token).",
        )


class ReportGenerateBody(BaseModel):
    """Body for reports.generate / reports.generateCsv (maps to Google query params)."""

    metrics: list[str] = Field(..., min_length=1)
    dimensions: list[str] = Field(default_factory=list)
    filters: list[str] = Field(default_factory=list)
    order_by: list[str] = Field(default_factory=list)
    date_range: str | None = None
    language_code: str | None = None
    currency_code: str | None = None
    limit: int | None = None
    reporting_time_zone: str | None = None
    start_date_year: int | None = None
    start_date_month: int | None = None
    start_date_day: int | None = None
    end_date_year: int | None = None
    end_date_month: int | None = None
    end_date_day: int | None = None


def _body_to_google_query(body: ReportGenerateBody) -> dict[str, Any]:
    d: dict[str, Any] = {
        "metrics": body.metrics,
        "dimensions": body.dimensions,
        "filters": body.filters,
        "orderBy": body.order_by,
    }
    if body.date_range:
        d["dateRange"] = body.date_range
    if body.language_code:
        d["languageCode"] = body.language_code
    if body.currency_code:
        d["currencyCode"] = body.currency_code
    if body.limit is not None:
        d["limit"] = body.limit
    if body.reporting_time_zone:
        d["reportingTimeZone"] = body.reporting_time_zone
    if body.start_date_year is not None:
        d["startDate.year"] = body.start_date_year
    if body.start_date_month is not None:
        d["startDate.month"] = body.start_date_month
    if body.start_date_day is not None:
        d["startDate.day"] = body.start_date_day
    if body.end_date_year is not None:
        d["endDate.year"] = body.end_date_year
    if body.end_date_month is not None:
        d["endDate.month"] = body.end_date_month
    if body.end_date_day is not None:
        d["endDate.day"] = body.end_date_day
    return d


@router.get("/accounts", response_model=ListAccountsResponse)
async def list_accounts(
    page_size: int | None = Query(None, ge=1, le=10000),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await accounts_list(page_size=page_size, page_token=page_token)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


# Specific sub-routes MUST be registered before GET /accounts/{account_ref:path}


@router.get("/accounts/{account_ref:path}/child-accounts", response_model=ListAccountsResponse)
async def list_child_accounts(
    account_ref: str,
    page_size: int | None = Query(None, ge=1, le=10000),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await accounts_list_child_accounts(account_ref, page_size=page_size, page_token=page_token)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/accounts/{account_ref:path}/adclients", response_model=ListAdClientsResponse)
async def list_adclients(
    account_ref: str,
    page_size: int | None = Query(None, ge=1, le=10000),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await adclients_list(account_ref, page_size=page_size, page_token=page_token)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/accounts/{account_ref:path}/reports:generate", response_model=ReportResult)
async def generate_report(
    account_ref: str,
    body: ReportGenerateBody,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await reports_generate(account_ref, _body_to_google_query(body))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.post("/accounts/{account_ref:path}/reports:generateCsv")
async def generate_report_csv(
    account_ref: str,
    body: ReportGenerateBody,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        raw, ct = await reports_generate_csv(account_ref, _body_to_google_query(body))
        return Response(content=raw, media_type=ct or "text/csv")
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/accounts/{account_ref:path}/sites", response_model=ListSitesResponse)
async def list_sites(
    account_ref: str,
    page_size: int | None = Query(None, ge=1, le=10000),
    page_token: str | None = None,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await sites_list(account_ref, page_size=page_size, page_token=page_token)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/accounts/{account_ref:path}/payments", response_model=ListPaymentsResponse)
async def list_payments(
    account_ref: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await payments_list(account_ref)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/accounts/{account_ref:path}/alerts", response_model=ListAlertsResponse)
async def list_alerts(
    account_ref: str,
    language_code: str | None = Query(None),
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await alerts_list(account_ref, language_code=language_code)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e


@router.get("/accounts/{account_ref:path}", response_model=AdsenseAccount)
async def get_account(
    account_ref: str,
    _admin: str = Depends(require_admin_plan),
):
    _require_adsense()
    try:
        return await accounts_get(account_ref)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
