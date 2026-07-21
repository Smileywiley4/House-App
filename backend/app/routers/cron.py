"""Internal cron endpoints (GitHub Actions / scheduled jobs)."""
from __future__ import annotations

import hmac
import logging

from fastapi import APIRouter, Header, HTTPException

from app.config import get_settings
from app.rentcast_refresh import refresh_all_metros

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
    7am America/New_York job: refresh RentCast browse cache for all 50 states
    and clear stale address property_cache so the site picks up updates.
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
    return summary
