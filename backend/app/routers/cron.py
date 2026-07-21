"""Internal cron endpoints (GitHub Actions / scheduled jobs)."""
from __future__ import annotations

import hmac
import logging

from fastapi import APIRouter, Header, HTTPException

from app.config import get_settings
from app.listing_alerts import process_listing_alerts
from app.rentcast_refresh import refresh_all_metros
from app.weekly_digest import process_weekly_preset_digests

router = APIRouter(prefix="/cron", tags=["cron"])
logger = logging.getLogger(__name__)


def _authorize(authorization: str | None, x_cron_secret: str | None) -> None:
    s = get_settings()
    expected = (s.cron_secret or "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="CRON_SECRET is not configured.")
    provided = ""
    if authorization and authorization.lower().startswith("bearer "):
        provided = authorization[7:].strip()
    elif x_cron_secret:
        provided = x_cron_secret.strip()
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/rentcast-daily-refresh")
async def rentcast_daily_refresh(
    authorization: str | None = Header(default=None),
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """
    Refresh RentCast browse cache for all 50 states and clear stale address
    property_cache so the site picks up updates. Then match listing alert
    subscriptions and create in-app notifications.

    Scheduled GHA cron is paused (quota) until public launch; invoke via
    workflow_dispatch or authenticated POST. See rentcast-daily-refresh.yml.
    """
    _authorize(authorization, x_cron_secret)
    logger.info("Starting daily RentCast metro refresh")
    summary = await refresh_all_metros(modes=("for_sale",))
    logger.info(
        "RentCast refresh done: succeeded=%s failed=%s cleared=%s",
        summary.get("succeeded"),
        summary.get("failed"),
        summary.get("property_cache_cleared"),
    )
    try:
        alert_summary = await process_listing_alerts()
        summary["listing_alerts"] = alert_summary
        logger.info("Listing alerts: %s", alert_summary)
    except Exception:
        logger.exception("listing alert matching failed after refresh")
        summary["listing_alerts"] = {"error": "failed"}
    return summary


@router.post("/listing-alerts-match")
async def listing_alerts_match(
    authorization: str | None = Header(default=None),
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """Standalone alert matching (optional separate schedule)."""
    _authorize(authorization, x_cron_secret)
    return await process_listing_alerts()


@router.post("/weekly-preset-digest")
async def weekly_preset_digest(
    authorization: str | None = Header(default=None),
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    """
    Weekly batch digest for users with profiles.preset_digest_opt_in.

    Separate from (paused) RentCast daily metro refresh — matches against
    browse_region_cache first, then live RentCast within quota. Does not
    re-enable or invoke the daily bulk refresh.
    """
    _authorize(authorization, x_cron_secret)
    logger.info("Starting weekly preset digest")
    summary = await process_weekly_preset_digests()
    logger.info("Weekly preset digest done: %s", summary)
    return summary
