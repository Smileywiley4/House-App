"""
Weekly preset digest for opted-in users.

Reuses listing-alert match helpers (_basic_criteria_match, browse_rentcast /
browse_region_cache) — does not invent parallel filter logic.

Note: RentCast daily metro refresh GHA is paused (quota). This job prefers
browse_region_cache (long TTL) and only falls back to a live RentCast query
when cache misses. Listing freshness depends on cache until daily refresh returns.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from app.browse_scores import strip_score_filters
from app.dependencies import get_supabase_admin
from app.listing_alerts import (
    _basic_criteria_match,
    _listing_key,
    _send_match_email,
    format_filter_summary,
)
from app.rentcast import browse_rentcast
from app.rentcast_refresh import get_cached_browse

logger = logging.getLogger(__name__)

# Cap work per weekly cron run.
MAX_USERS = 200
MAX_PRESETS_PER_USER = 8
MAX_MATCHES_PER_PRESET = 8
# Daily RentCast refresh is paused — accept older cache for digest matching.
CACHE_MAX_AGE_HOURS = 90 * 24  # daily refresh paused — use oldest useful cache
DIGEST_COOLDOWN_HOURS = 5 * 24  # skip if already sent within ~5 days


def _criteria_from_alert(sub: dict) -> dict:
    return dict(sub.get("criteria") or {})


def _criteria_from_preset(preset: dict, profile: dict | None = None) -> dict:
    """Map user_presets row into the same criteria shape listing alerts use."""
    filters = preset.get("filters") or {}
    if not isinstance(filters, dict):
        filters = {}
    criteria: dict[str, Any] = {
        "mode": "for_sale",
        "filters": filters,
        "radius": 8,
    }
    # Geo may live on filters or profile.state
    for key in ("city", "state", "zip", "latitude", "longitude", "radius", "mode"):
        if filters.get(key) not in (None, ""):
            criteria[key] = filters.get(key)
    if not criteria.get("state") and profile and profile.get("state"):
        criteria["state"] = str(profile.get("state")).strip()[:2].upper() or None
    return criteria


def _preset_label(name: str | None, filters: dict | None) -> str:
    label = (name or "").strip()
    if label:
        return label
    summary = format_filter_summary(filters)
    return summary or "saved preset"


async def _fetch_candidate_listings(criteria: dict) -> tuple[list[dict], str]:
    """
    Prefer browse_region_cache; fall back to live browse_rentcast (quota-aware).
    Returns (properties, source).
    """
    mode = (criteria.get("mode") or "for_sale").strip().lower()
    filters = criteria.get("filters") or {}
    rentcast_filters = strip_score_filters(filters)
    city = (criteria.get("city") or "").strip() or None
    state = (criteria.get("state") or "").strip() or None
    zip_code = (criteria.get("zip") or "").strip() or None
    lat = criteria.get("latitude")
    lng = criteria.get("longitude")

    # Cache is unfiltered metro snapshots — still useful as a candidate pool;
    # apply the same post-filters as alerts.
    cached = get_cached_browse(
        mode=mode,
        latitude=float(lat) if lat is not None else None,
        longitude=float(lng) if lng is not None else None,
        city=city,
        state=state,
        max_age_hours=CACHE_MAX_AGE_HOURS,
    )
    if cached and (cached.get("properties") or []):
        return list(cached.get("properties") or []), "browse_region_cache"

    # Live query within RentCast quota (same path as SearchByPreset / alerts).
    if not any([city, state, zip_code, lat is not None and lng is not None]):
        return [], "no_geo"

    result = await browse_rentcast(
        mode=mode,
        latitude=lat,
        longitude=lng,
        radius=criteria.get("radius") or 8,
        city=city,
        state=state,
        zip_code=zip_code,
        filters=rentcast_filters,
        limit=40,
        offset=0,
    )
    if result.get("error"):
        logger.info("digest live browse skipped: %s", result.get("error"))
        return [], "rentcast_error"
    return list(result.get("properties") or []), "rentcast_live"


def _beds_baths_ok(prop: dict, filters: dict) -> bool:
    """Apply beds/baths mins when matching against unfiltered metro cache."""
    def _min_from_filter(raw) -> float | None:
        if raw is None or raw == "":
            return None
        items = raw if isinstance(raw, list) else [raw]
        nums: list[float] = []
        for v in items:
            s = str(v).strip().replace("+", "")
            try:
                nums.append(float(s))
            except (TypeError, ValueError):
                continue
        return min(nums) if nums else None

    beds_min = _min_from_filter(
        filters.get("beds") or filters.get("beds_min") or filters.get("bedrooms")
    )
    baths_min = _min_from_filter(
        filters.get("baths") or filters.get("baths_min") or filters.get("bathrooms")
    )
    try:
        if beds_min is not None:
            beds = prop.get("bedrooms") or prop.get("beds")
            if beds is not None and float(beds) < beds_min:
                return False
        if baths_min is not None:
            baths = prop.get("bathrooms") or prop.get("baths")
            if baths is not None and float(baths) < baths_min:
                return False
    except (TypeError, ValueError):
        pass
    return True


def _filter_matches(props: list[dict], filters: dict) -> list[dict]:
    matches = [
        p
        for p in props
        if _beds_baths_ok(p, filters) and _basic_criteria_match(p, filters)
    ]
    return matches[:MAX_MATCHES_PER_PRESET]


async def process_weekly_preset_digests() -> dict[str, Any]:
    """
    For each opted-in user, match enabled listing alerts (and saved presets as
    fallback) and send one weekly in-app + email digest when there are fresh matches.
    """
    supabase = get_supabase_admin()
    summary: dict[str, Any] = {
        "users_checked": 0,
        "digests_sent": 0,
        "emails_sent": 0,
        "notifications_created": 0,
        "skipped_cooldown": 0,
        "skipped_no_matches": 0,
        "errors": 0,
        "cache_hits": 0,
        "live_queries": 0,
        "note": (
            "RentCast daily refresh is paused; digest prefers browse_region_cache "
            f"(max_age={CACHE_MAX_AGE_HOURS}h) then live query. Freshness depends on cache."
        ),
    }

    try:
        opted = (
            supabase.table("profiles")
            .select("id, email, state, preset_digest_opt_in, preset_digest_last_sent_at")
            .eq("preset_digest_opt_in", True)
            .limit(MAX_USERS)
            .execute()
        )
    except Exception:
        logger.exception("failed to load digest opted-in profiles")
        return {**summary, "error": "profiles_unavailable"}

    now = datetime.now(timezone.utc)
    cooldown = now - timedelta(hours=DIGEST_COOLDOWN_HOURS)

    for profile in opted.data or []:
        summary["users_checked"] += 1
        user_id = profile["id"]
        try:
            last = profile.get("preset_digest_last_sent_at")
            if last:
                try:
                    last_dt = datetime.fromisoformat(str(last).replace("Z", "+00:00"))
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                    if last_dt > cooldown:
                        summary["skipped_cooldown"] += 1
                        continue
                except (TypeError, ValueError):
                    pass

            # Prefer explicit alert subscriptions (same criteria as browse "Alert me").
            subs = (
                supabase.table("listing_alert_subscriptions")
                .select("*")
                .eq("user_id", user_id)
                .eq("enabled", True)
                .limit(MAX_PRESETS_PER_USER)
                .execute()
            )
            sources: list[tuple[str, str, dict]] = []
            for sub in subs.data or []:
                sources.append(
                    (
                        str(sub.get("id")),
                        _preset_label(sub.get("name"), (sub.get("criteria") or {}).get("filters")),
                        _criteria_from_alert(sub),
                    )
                )

            if not sources:
                presets = (
                    supabase.table("user_presets")
                    .select("id, name, filters")
                    .eq("user_id", user_id)
                    .limit(MAX_PRESETS_PER_USER)
                    .execute()
                )
                for p in presets.data or []:
                    criteria = _criteria_from_preset(p, profile)
                    filters = criteria.get("filters") or {}
                    if not filters:
                        continue
                    sources.append(
                        (
                            str(p.get("id")),
                            _preset_label(p.get("name"), filters),
                            criteria,
                        )
                    )

            if not sources:
                summary["skipped_no_matches"] += 1
                continue

            # Recent digest listing ids for dedupe
            existing = (
                supabase.table("user_notifications")
                .select("payload")
                .eq("user_id", user_id)
                .eq("kind", "weekly_digest")
                .order("created_at", desc=True)
                .limit(8)
                .execute()
            )
            seen_ids: set[str] = set()
            for n in existing.data or []:
                payload = n.get("payload") or {}
                for lid in payload.get("listing_ids") or []:
                    seen_ids.add(str(lid))
                for block in payload.get("presets") or []:
                    for lid in block.get("listing_ids") or []:
                        seen_ids.add(str(lid))

            preset_blocks: list[dict] = []
            all_fresh_ids: list[str] = []

            for source_id, label, criteria in sources:
                filters = criteria.get("filters") or {}
                props, src = await _fetch_candidate_listings(criteria)
                if src == "browse_region_cache":
                    summary["cache_hits"] += 1
                elif src == "rentcast_live":
                    summary["live_queries"] += 1
                matches = _filter_matches(props, filters)
                fresh = [
                    p for p in matches if _listing_key(p) and _listing_key(p) not in seen_ids
                ]
                if not fresh:
                    continue
                listing_ids = [_listing_key(p) for p in fresh]
                all_fresh_ids.extend(listing_ids)
                for lid in listing_ids:
                    seen_ids.add(lid)
                addresses = [
                    (p.get("formatted_address") or p.get("address") or "Listing")
                    for p in fresh[:5]
                ]
                preset_blocks.append(
                    {
                        "source_id": source_id,
                        "name": label,
                        "count": len(fresh),
                        "listing_ids": listing_ids,
                        "addresses": addresses,
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
                    }
                )

            if not preset_blocks:
                summary["skipped_no_matches"] += 1
                continue

            # Build digest copy: "3 new listings match your '…' preset this week."
            lines: list[str] = []
            total_new = sum(b["count"] for b in preset_blocks)
            for block in preset_blocks:
                n = block["count"]
                lines.append(
                    f"{n} new listing{'s' if n != 1 else ''} match your '{block['name']}' preset this week."
                )
                for addr in block["addresses"][:3]:
                    lines.append(f"  • {addr}")

            if len(preset_blocks) == 1:
                title = lines[0]
            else:
                title = (
                    f"{total_new} new listing{'s' if total_new != 1 else ''} match "
                    f"{len(preset_blocks)} of your presets this week."
                )
            body = "\n".join(lines)

            payload = {
                "path": "/BrowseProperties",
                "listing_ids": all_fresh_ids,
                "presets": preset_blocks,
                "total_new": total_new,
            }
            supabase.table("user_notifications").insert(
                {
                    "user_id": user_id,
                    "kind": "weekly_digest",
                    "title": title,
                    "body": body,
                    "payload": payload,
                }
            ).execute()
            summary["notifications_created"] += 1

            email = (profile.get("email") or "").strip()
            if email:
                email_body = (
                    body
                    + "\n\nOpen Property Pocket → Search Properties to review."
                    + "\n\nTurn off weekly digests anytime in Profile → Settings → Notifications."
                )
                if await _send_match_email(email, title, email_body):
                    summary["emails_sent"] += 1

            now_iso = now.isoformat()
            supabase.table("profiles").update(
                {"preset_digest_last_sent_at": now_iso}
            ).eq("id", user_id).execute()
            summary["digests_sent"] += 1
        except Exception:
            summary["errors"] += 1
            logger.warning("weekly digest failed for user %s", user_id, exc_info=True)

    return summary
