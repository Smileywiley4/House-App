"""
Publisher revenue helpers: AdSense daily estimates → Supabase (admin).

Stripe handles subscription payments separately; AdSense pays via Google.
See docs/PUBLISHER_REVENUE_ADSENSE_STRIPE.md
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, Query

from app.dependencies import get_supabase_admin, require_platform_admin
from app.google_adsense_v2 import adsense_configured
from app.revenue_adsense import sync_yesterday_snapshot

router = APIRouter(prefix="/revenue", tags=["revenue"])
logger = logging.getLogger(__name__)


@router.post("/adsense-daily-snapshot")
async def adsense_daily_snapshot(_admin: str = Depends(require_platform_admin)):
    """
    Pull AdSense **estimated earnings** for **YESTERDAY** (Management API) and upsert into
    `publisher_revenue_snapshots`. Schedule this daily (cron + admin JWT, or service account pattern).

    Does **not** move money to Stripe — see docs/PUBLISHER_REVENUE_ADSENSE_STRIPE.md.
    """
    if not adsense_configured():
        raise HTTPException(
            status_code=503,
            detail="AdSense API not configured (GOOGLE_ADSENSE_CLIENT_ID/SECRET/REFRESH_TOKEN).",
        )
    try:
        row = await sync_yesterday_snapshot()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.exception("AdSense snapshot failed")
        raise HTTPException(status_code=502, detail=str(e)) from e

    try:
        supabase = get_supabase_admin()
        supabase.table("publisher_revenue_snapshots").upsert(
            row,
            on_conflict="source,report_date",
        ).execute()
    except Exception as e:
        logger.exception("publisher_revenue_snapshots upsert failed — run migration 20260222000000_publisher_revenue_snapshots.sql")
        raise HTTPException(
            status_code=500,
            detail=f"Database write failed: {e}. Ensure migration is applied.",
        ) from e

    return {"ok": True, "snapshot": row}


@router.get("/snapshots")
async def list_revenue_snapshots(
    limit: int = Query(90, ge=1, le=500),
    _admin: str = Depends(require_platform_admin),
):
    """Last N rows from publisher_revenue_snapshots (AdSense estimates)."""
    try:
        supabase = get_supabase_admin()
        r = (
            supabase.table("publisher_revenue_snapshots")
            .select("*")
            .order("report_date", desc=True)
            .limit(limit)
            .execute()
        )
        return {"snapshots": r.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
