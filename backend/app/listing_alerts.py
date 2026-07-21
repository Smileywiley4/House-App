"""
Match listing alert subscriptions against freshly refreshed metro inventory.

Runs after daily RentCast refresh. Creates in-app notifications; optionally
emails via Resend when email_enabled and RESEND_API_KEY are set.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import httpx

from app.browse_scores import (
    compute_fact_scores,
    extract_score_mins,
    passes_score_mins,
    strip_score_filters,
)
from app.dependencies import get_supabase_admin
from app.rentcast import browse_rentcast

logger = logging.getLogger(__name__)

# Cap work per cron run.
MAX_SUBSCRIPTIONS = 80
MAX_MATCHES_PER_SUB = 8


def _filters_fingerprint(filters: dict) -> str:
    """Stable hash for preference memory."""
    canonical = json.dumps(filters or {}, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()[:32]


def _compact_price(value: Any) -> str | None:
    try:
        if value is None or value == "":
            return None
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n >= 1_000_000:
        m = n / 1_000_000
        rounded = round(m) if m >= 10 else round(m * 10) / 10
        text = f"{int(rounded)}" if float(rounded).is_integer() else f"{rounded}"
        return f"${text}M"
    if n >= 1_000:
        k = n / 1_000
        rounded = round(k) if k >= 100 else round(k * 10) / 10
        text = f"{int(rounded)}" if float(rounded).is_integer() else f"{rounded}"
        return f"${text}K"
    return f"${int(round(n)):,}"


def _beds_or_baths_label(value: Any) -> str | None:
    """Normalize beds/baths stored as int, '2', '5+', or ['2','3']."""
    if value is None or value == "":
        return None
    items = value if isinstance(value, list) else [value]
    parts = [str(v).strip() for v in items if v is not None and str(v).strip()]
    if not parts:
        return None
    if len(parts) == 1:
        one = parts[0]
        return one if one.endswith("+") else f"{one}+"
    def _sort_key(p: str):
        try:
            return (0, int("".join(ch for ch in p if ch.isdigit()) or 0))
        except ValueError:
            return (1, p)
    parts = sorted(parts, key=_sort_key)
    return f"{parts[0]}–{parts[-1]}"


def format_filter_summary(filters: dict | None) -> str:
    """Human label for browse filter chips, e.g. '2+ beds, $200K–$400K'."""
    f = filters or {}
    parts: list[str] = []

    beds = (
        _beds_or_baths_label(f.get("beds"))
        or _beds_or_baths_label(f.get("beds_min"))
        or _beds_or_baths_label(f.get("bedrooms"))
    )
    if beds:
        parts.append(f"{beds} beds")

    baths = (
        _beds_or_baths_label(f.get("baths"))
        or _beds_or_baths_label(f.get("baths_min"))
        or _beds_or_baths_label(f.get("bathrooms"))
    )
    if baths:
        parts.append(f"{baths} baths")

    pmin = f.get("price_min") if f.get("price_min") not in (None, "") else f.get("budget_min")
    pmax = f.get("price_max") if f.get("price_max") not in (None, "") else f.get("budget_max")
    lo = _compact_price(pmin)
    hi = _compact_price(pmax)
    if lo and hi:
        parts.append(f"{lo}–{hi}")
    elif lo:
        parts.append(f"{lo}+")
    elif hi:
        parts.append(f"up to {hi}")

    sm = f.get("score_mins") if isinstance(f.get("score_mins"), dict) else {}
    for k, v in list(sm.items())[:2]:
        if v is None or v == "":
            continue
        parts.append(f"{str(k).replace('_', ' ')} ≥{v}")

    if f.get("city"):
        loc = ", ".join(x for x in [f.get("city"), f.get("state")] if x)
        if loc:
            parts.append(loc)
    elif f.get("zip"):
        parts.append(str(f.get("zip")))

    return ", ".join(parts)


def record_browse_preference(user_id: str, filters: dict | None) -> None:
    """Upsert soft-learning memory when a logged-in user applies browse filters."""
    f = filters or {}
    # Ignore empty / default-only filters
    meaningful = {
        k: v
        for k, v in f.items()
        if v not in (None, "", False, [], {}, 0)
        and not (isinstance(v, dict) and not v)
    }
    if not meaningful:
        return
    fp = _filters_fingerprint(meaningful)
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    try:
        existing = (
            supabase.table("user_browse_preference_memory")
            .select("id, use_count")
            .eq("user_id", user_id)
            .eq("filters_hash", fp)
            .limit(1)
            .execute()
        )
        if existing.data:
            row = existing.data[0]
            supabase.table("user_browse_preference_memory").update(
                {"use_count": int(row.get("use_count") or 1) + 1, "last_used_at": now, "filters": meaningful}
            ).eq("id", row["id"]).execute()
        else:
            supabase.table("user_browse_preference_memory").insert(
                {
                    "user_id": user_id,
                    "filters_hash": fp,
                    "filters": meaningful,
                    "use_count": 1,
                    "last_used_at": now,
                }
            ).execute()
    except Exception:
        logger.warning("browse preference memory upsert failed", exc_info=True)


def _listing_key(prop: dict) -> str:
    return str(
        prop.get("id")
        or prop.get("formatted_address")
        or prop.get("address")
        or ""
    )


def _basic_criteria_match(prop: dict, filters: dict) -> bool:
    """Lightweight post-filter for criteria not already applied by RentCast."""
    # Price already handled by API when present; re-check soft bounds
    price = prop.get("price") or prop.get("list_price") or prop.get("estimated_value")
    pmin = filters.get("price_min") or filters.get("budget_min")
    pmax = filters.get("price_max") or filters.get("budget_max")
    try:
        if pmin is not None and price is not None and float(price) < float(pmin):
            return False
        if pmax is not None and price is not None and float(price) > float(pmax):
            return False
    except (TypeError, ValueError):
        pass
    score_mins = extract_score_mins(filters)
    if score_mins:
        scores = compute_fact_scores(prop)
        # Location mins cannot be verified cheaply in alert pass without Places;
        # only enforce fact mins here; location mins rely on cached auto_scores if present.
        cached = prop.get("auto_scores") or {}
        if isinstance(cached, dict):
            scores.update({k: int(v) for k, v in cached.items() if isinstance(v, (int, float))})
        fact_only = {k: v for k, v in score_mins.items() if k in scores or k.startswith("bedroom") or k in (
            "bedroom_count", "bathroom_count", "overall_living_space", "hoa_cost", "garage_storage"
        )}
        location_mins = {k: v for k, v in score_mins.items() if k not in fact_only}
        if fact_only and not passes_score_mins(scores, fact_only):
            return False
        # If location mins are set but we have no location scores, still allow match
        # (graceful degradation) — user gets notified; they can verify in Evaluate.
        if location_mins and all(k in scores for k in location_mins):
            if not passes_score_mins(scores, location_mins):
                return False
    return True


async def _send_match_email(to_email: str, title: str, body: str) -> bool:
    api_key = (os.environ.get("RESEND_API_KEY") or "").strip()
    if not api_key or not to_email:
        return False
    from_addr = (os.environ.get("RESEND_FROM_EMAIL") or "").strip() or "Propurty <onboarding@resend.dev>"
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "from": from_addr,
                    "to": [to_email],
                    "subject": title,
                    "text": body,
                },
            )
            return r.status_code < 300
    except Exception:
        logger.warning("match alert email failed", exc_info=True)
        return False


async def process_listing_alerts() -> dict[str, Any]:
    """
    For each enabled subscription, re-query RentCast with criteria filters and
    create notifications for matching listings not recently notified.
    """
    supabase = get_supabase_admin()
    summary: dict[str, Any] = {
        "subscriptions_checked": 0,
        "notifications_created": 0,
        "emails_sent": 0,
        "errors": 0,
    }

    try:
        subs = (
            supabase.table("listing_alert_subscriptions")
            .select("*")
            .eq("enabled", True)
            .order("last_notified_at", desc=False, nullsfirst=True)
            .limit(MAX_SUBSCRIPTIONS)
            .execute()
        )
    except Exception:
        logger.exception("failed to load listing_alert_subscriptions")
        return {**summary, "error": "table_unavailable"}

    rows = subs.data or []
    for sub in rows:
        summary["subscriptions_checked"] += 1
        try:
            criteria = sub.get("criteria") or {}
            filters = criteria.get("filters") or {}
            rentcast_filters = strip_score_filters(filters)
            result = await browse_rentcast(
                mode=(criteria.get("mode") or "for_sale"),
                latitude=criteria.get("latitude"),
                longitude=criteria.get("longitude"),
                radius=criteria.get("radius") or 8,
                city=(criteria.get("city") or "").strip() or None,
                state=(criteria.get("state") or "").strip() or None,
                zip_code=(criteria.get("zip") or "").strip() or None,
                filters=rentcast_filters,
                limit=40,
                offset=0,
            )
            props = result.get("properties") or []
            matches = [p for p in props if _basic_criteria_match(p, filters)][:MAX_MATCHES_PER_SUB]
            if not matches:
                continue

            # Dedup: skip if we already notified about same listing keys recently
            existing = (
                supabase.table("user_notifications")
                .select("payload")
                .eq("user_id", sub["user_id"])
                .eq("kind", "listing_match")
                .order("created_at", desc=True)
                .limit(40)
                .execute()
            )
            seen_ids: set[str] = set()
            for n in existing.data or []:
                payload = n.get("payload") or {}
                for lid in payload.get("listing_ids") or []:
                    seen_ids.add(str(lid))

            fresh = [p for p in matches if _listing_key(p) and _listing_key(p) not in seen_ids]
            if not fresh:
                continue

            addresses = [
                (p.get("formatted_address") or p.get("address") or "Listing") for p in fresh[:5]
            ]
            title = f"{len(fresh)} new match{'es' if len(fresh) != 1 else ''}: {sub.get('name') or 'Alert'}"
            body = "New listings match your saved search:\n" + "\n".join(f"• {a}" for a in addresses)
            payload = {
                "subscription_id": sub["id"],
                "listing_ids": [_listing_key(p) for p in fresh],
                "listings": [
                    {
                        "id": _listing_key(p),
                        "address": p.get("formatted_address") or p.get("address"),
                        "price": p.get("price") or p.get("list_price"),
                        "city": p.get("city"),
                        "state": p.get("state"),
                    }
                    for p in fresh
                ],
                "criteria": criteria,
            }
            supabase.table("user_notifications").insert(
                {
                    "user_id": sub["user_id"],
                    "kind": "listing_match",
                    "title": title,
                    "body": body,
                    "payload": payload,
                }
            ).execute()
            summary["notifications_created"] += 1

            now = datetime.now(timezone.utc).isoformat()
            supabase.table("listing_alert_subscriptions").update(
                {"last_notified_at": now, "updated_at": now}
            ).eq("id", sub["id"]).execute()

            if sub.get("email_enabled"):
                # Resolve email from auth.users via profiles if available
                email = None
                try:
                    prof = (
                        supabase.table("profiles")
                        .select("email")
                        .eq("id", sub["user_id"])
                        .limit(1)
                        .execute()
                    )
                    if prof.data:
                        email = prof.data[0].get("email")
                except Exception:
                    pass
                if email and await _send_match_email(email, title, body + "\n\nOpen Propurty → Search Properties to review."):
                    summary["emails_sent"] += 1
        except Exception:
            summary["errors"] += 1
            logger.warning("alert sub %s failed", sub.get("id"), exc_info=True)

    return summary
