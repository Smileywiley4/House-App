"""
AdSense estimated earnings → Supabase `publisher_revenue_snapshots`.

Uses AdSense Management API v2 reports:generate (same OAuth as google_adsense_v2).
See docs/PUBLISHER_REVENUE_ADSENSE_STRIPE.md — AdSense payouts do not deposit into Stripe.
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from app.config import get_settings
from app.google_adsense_v2 import ReportResult, accounts_list, adsense_configured, reports_generate

logger = logging.getLogger(__name__)


def _parse_estimated_earnings(report: ReportResult) -> tuple[Decimal | None, str]:
    headers = report.headers or []
    idx: int | None = None
    currency = "USD"
    for i, h in enumerate(headers):
        name = (h.name or "").upper()
        if name == "ESTIMATED_EARNINGS":
            idx = i
            if getattr(h, "currencyCode", None):
                currency = str(h.currencyCode)
            break
    if idx is None:
        return None, currency
    total = Decimal("0")
    for row in report.rows or []:
        cells = row.cells or []
        if idx >= len(cells):
            continue
        raw = (cells[idx].value or "").strip()
        if not raw:
            continue
        try:
            total += Decimal(raw)
        except Exception:
            logger.debug("Skip non-numeric earnings cell: %s", raw)
    if total == 0 and not (report.rows or []):
        return None, currency
    return total, currency


def _report_to_jsonable(report: ReportResult) -> dict[str, Any]:
    try:
        return report.model_dump(mode="json")
    except Exception:
        return {"_error": "could not serialize report"}


async def resolve_publisher_account() -> str:
    s = get_settings()
    configured = (s.google_adsense_publisher_account or "").strip()
    if configured:
        return configured if configured.startswith("accounts/") else f"accounts/{configured.replace('accounts/', '')}"
    lst = await accounts_list(page_size=5)
    if not lst.accounts:
        raise ValueError("No AdSense accounts returned; set GOOGLE_ADSENSE_PUBLISHER_ACCOUNT or link an AdSense account to OAuth.")
    return lst.accounts[0].name or ""


async def sync_yesterday_snapshot() -> dict[str, Any]:
    """
    Fetch YESTERDAY ESTIMATED_EARNINGS (DATE dimension) and return payload for DB upsert.
    Does not write to DB — caller uses Supabase.
    """
    if not adsense_configured():
        raise ValueError("AdSense OAuth not configured")

    account = await resolve_publisher_account()
    query: dict[str, Any] = {
        "metrics": ["ESTIMATED_EARNINGS"],
        "dimensions": ["DATE"],
        "dateRange": "YESTERDAY",
    }
    report = await reports_generate(account, query)
    amount, currency = _parse_estimated_earnings(report)
    report_day = date.today() - timedelta(days=1)

    return {
        "source": "adsense_estimate",
        "report_date": report_day.isoformat(),
        "estimated_earnings": float(amount) if amount is not None else None,
        "currency_code": currency,
        "adsense_account": account,
        "raw_report": _report_to_jsonable(report),
    }
