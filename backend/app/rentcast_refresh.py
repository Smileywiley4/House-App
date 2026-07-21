"""Daily RentCast refresh for Search Properties (all 50 US states metros)."""
from __future__ import annotations

import logging
import math
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from app.rentcast import browse_rentcast
from app.supabase_client import get_supabase_admin

logger = logging.getLogger(__name__)

# One primary metro (or capital) per state + DC — covers all 50 states for morning refresh.
US_METROS: list[dict[str, Any]] = [
    {"city": "Birmingham", "state": "AL", "lat": 33.5207, "lng": -86.8025},
    {"city": "Anchorage", "state": "AK", "lat": 61.2181, "lng": -149.9003},
    {"city": "Phoenix", "state": "AZ", "lat": 33.4484, "lng": -112.0740},
    {"city": "Little Rock", "state": "AR", "lat": 34.7465, "lng": -92.2896},
    {"city": "Los Angeles", "state": "CA", "lat": 34.0522, "lng": -118.2437},
    {"city": "Denver", "state": "CO", "lat": 39.7392, "lng": -104.9903},
    {"city": "Hartford", "state": "CT", "lat": 41.7658, "lng": -72.6734},
    {"city": "Wilmington", "state": "DE", "lat": 39.7391, "lng": -75.5398},
    {"city": "Washington", "state": "DC", "lat": 38.9072, "lng": -77.0369},
    {"city": "Miami", "state": "FL", "lat": 25.7617, "lng": -80.1918},
    {"city": "Atlanta", "state": "GA", "lat": 33.7490, "lng": -84.3880},
    {"city": "Honolulu", "state": "HI", "lat": 21.3069, "lng": -157.8583},
    {"city": "Boise", "state": "ID", "lat": 43.6150, "lng": -116.2023},
    {"city": "Chicago", "state": "IL", "lat": 41.8781, "lng": -87.6298},
    {"city": "Indianapolis", "state": "IN", "lat": 39.7684, "lng": -86.1581},
    {"city": "Des Moines", "state": "IA", "lat": 41.5868, "lng": -93.6250},
    {"city": "Wichita", "state": "KS", "lat": 37.6872, "lng": -97.3301},
    {"city": "Louisville", "state": "KY", "lat": 38.2527, "lng": -85.7585},
    {"city": "New Orleans", "state": "LA", "lat": 29.9511, "lng": -90.0715},
    {"city": "Portland", "state": "ME", "lat": 43.6591, "lng": -70.2568},
    {"city": "Baltimore", "state": "MD", "lat": 39.2904, "lng": -76.6122},
    {"city": "Boston", "state": "MA", "lat": 42.3601, "lng": -71.0589},
    {"city": "Detroit", "state": "MI", "lat": 42.3314, "lng": -83.0458},
    {"city": "Minneapolis", "state": "MN", "lat": 44.9778, "lng": -93.2650},
    {"city": "Jackson", "state": "MS", "lat": 32.2988, "lng": -90.1848},
    {"city": "Kansas City", "state": "MO", "lat": 39.0997, "lng": -94.5786},
    {"city": "Billings", "state": "MT", "lat": 45.7833, "lng": -108.5007},
    {"city": "Omaha", "state": "NE", "lat": 41.2565, "lng": -95.9345},
    {"city": "Las Vegas", "state": "NV", "lat": 36.1699, "lng": -115.1398},
    {"city": "Manchester", "state": "NH", "lat": 42.9956, "lng": -71.4548},
    {"city": "Newark", "state": "NJ", "lat": 40.7357, "lng": -74.1724},
    {"city": "Albuquerque", "state": "NM", "lat": 35.0844, "lng": -106.6504},
    {"city": "New York", "state": "NY", "lat": 40.7128, "lng": -74.0060},
    {"city": "Charlotte", "state": "NC", "lat": 35.2271, "lng": -80.8431},
    {"city": "Fargo", "state": "ND", "lat": 46.8772, "lng": -96.7898},
    {"city": "Columbus", "state": "OH", "lat": 39.9612, "lng": -82.9988},
    {"city": "Oklahoma City", "state": "OK", "lat": 35.4676, "lng": -97.5164},
    {"city": "Portland", "state": "OR", "lat": 45.5152, "lng": -122.6784},
    {"city": "Philadelphia", "state": "PA", "lat": 39.9526, "lng": -75.1652},
    {"city": "Providence", "state": "RI", "lat": 41.8240, "lng": -71.4128},
    {"city": "Charleston", "state": "SC", "lat": 32.7765, "lng": -79.9311},
    {"city": "Sioux Falls", "state": "SD", "lat": 43.5446, "lng": -96.7311},
    {"city": "Nashville", "state": "TN", "lat": 36.1627, "lng": -86.7816},
    {"city": "Houston", "state": "TX", "lat": 29.7604, "lng": -95.3698},
    {"city": "Salt Lake City", "state": "UT", "lat": 40.7608, "lng": -111.8910},
    {"city": "Burlington", "state": "VT", "lat": 44.4759, "lng": -73.2121},
    {"city": "Virginia Beach", "state": "VA", "lat": 36.8529, "lng": -75.9780},
    {"city": "Seattle", "state": "WA", "lat": 47.6062, "lng": -122.3321},
    {"city": "Charleston", "state": "WV", "lat": 38.3498, "lng": -81.6326},
    {"city": "Milwaukee", "state": "WI", "lat": 43.0389, "lng": -87.9065},
    {"city": "Cheyenne", "state": "WY", "lat": 41.1400, "lng": -104.8202},
]

CACHE_TTL_HOURS = 26  # cover DST edges until next 7am ET run
DEFAULT_RADIUS_MILES = 8
REFRESH_LIMIT = 50


def region_key(mode: str, city: str, state: str) -> str:
    slug_city = re.sub(r"[^a-z0-9]+", "-", (city or "").strip().lower()).strip("-")
    slug_state = (state or "").strip().lower()
    return f"{mode}:{slug_city}:{slug_state}"


def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 3958.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def upsert_region_cache(
    *,
    mode: str,
    city: str,
    state: str,
    latitude: float,
    longitude: float,
    radius_miles: float,
    properties: list,
    total: int,
) -> None:
    supabase = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "region_key": region_key(mode, city, state),
        "mode": mode,
        "city": city,
        "state": state,
        "latitude": latitude,
        "longitude": longitude,
        "radius_miles": radius_miles,
        "properties": properties,
        "total": total,
        "refreshed_at": now,
    }
    supabase.table("browse_region_cache").upsert(row, on_conflict="region_key").execute()


def get_cached_browse(
    *,
    mode: str,
    latitude: float | None = None,
    longitude: float | None = None,
    city: str | None = None,
    state: str | None = None,
    max_age_hours: float = CACHE_TTL_HOURS,
) -> dict | None:
    """Return a fresh cached snapshot if one matches city/state or nearby metro."""
    try:
        supabase = get_supabase_admin()
    except Exception:
        return None

    cutoff = (datetime.now(timezone.utc) - timedelta(hours=max_age_hours)).isoformat()
    mode = (mode or "for_sale").strip().lower()

    try:
        if city and state:
            key = region_key(mode, city, state)
            r = (
                supabase.table("browse_region_cache")
                .select("*")
                .eq("region_key", key)
                .gte("refreshed_at", cutoff)
                .limit(1)
                .execute()
            )
            if r.data:
                row = r.data[0]
                return {
                    "properties": row.get("properties") or [],
                    "total": row.get("total") or 0,
                    "limit": REFRESH_LIMIT,
                    "offset": 0,
                    "mode": mode,
                    "source": "rentcast_cache",
                    "cached": True,
                    "refreshed_at": row.get("refreshed_at"),
                    "region_key": row.get("region_key"),
                }

        if latitude is None or longitude is None:
            return None

        r = (
            supabase.table("browse_region_cache")
            .select("*")
            .eq("mode", mode)
            .gte("refreshed_at", cutoff)
            .execute()
        )
        best = None
        best_dist = None
        for row in r.data or []:
            lat = row.get("latitude")
            lng = row.get("longitude")
            if lat is None or lng is None:
                continue
            dist = _haversine_miles(float(latitude), float(longitude), float(lat), float(lng))
            radius = float(row.get("radius_miles") or DEFAULT_RADIUS_MILES)
            if dist <= max(radius + 12, 25):
                if best_dist is None or dist < best_dist:
                    best = row
                    best_dist = dist
        if not best:
            return None
        return {
            "properties": best.get("properties") or [],
            "total": best.get("total") or 0,
            "limit": REFRESH_LIMIT,
            "offset": 0,
            "mode": mode,
            "source": "rentcast_cache",
            "cached": True,
            "refreshed_at": best.get("refreshed_at"),
            "region_key": best.get("region_key"),
            "cache_distance_miles": round(best_dist or 0, 1),
        }
    except Exception as exc:
        logger.warning("browse cache lookup failed: %s", exc)
        return None


def clear_stale_property_cache(max_age_hours: float = 24) -> int:
    """Drop address-level property_cache so next lookups hit fresh RentCast."""
    try:
        supabase = get_supabase_admin()
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=max_age_hours)).isoformat()
        # Prefer delete-by-age when created_at exists
        r = supabase.table("property_cache").delete().lt("created_at", cutoff).execute()
        deleted = len(r.data or []) if isinstance(r.data, list) else 0
        return deleted
    except Exception as exc:
        logger.warning("property_cache cleanup failed: %s", exc)
        return 0


async def refresh_all_metros(*, modes: tuple[str, ...] = ("for_sale",)) -> dict:
    """
    Pull latest RentCast listings for every state metro and upsert browse_region_cache.
    Also clears stale address property_cache so detail lookups refresh going forward.
    """
    results = []
    ok = 0
    fail = 0
    for metro in US_METROS:
        city = metro["city"]
        state = metro["state"]
        lat = float(metro["lat"])
        lng = float(metro["lng"])
        for mode in modes:
            try:
                data = await browse_rentcast(
                    mode=mode,
                    city=city,
                    state=state,
                    filters={},
                    limit=REFRESH_LIMIT,
                    offset=0,
                )
                props = data.get("properties") or []
                total = int(data.get("total") or len(props))
                if data.get("error"):
                    fail += 1
                    results.append({"city": city, "state": state, "mode": mode, "ok": False, "error": data["error"]})
                    continue
                upsert_region_cache(
                    mode=mode,
                    city=city,
                    state=state,
                    latitude=lat,
                    longitude=lng,
                    radius_miles=DEFAULT_RADIUS_MILES,
                    properties=props,
                    total=total,
                )
                ok += 1
                results.append(
                    {
                        "city": city,
                        "state": state,
                        "mode": mode,
                        "ok": True,
                        "count": len(props),
                        "total": total,
                    }
                )
            except Exception as exc:
                fail += 1
                logger.exception("RentCast refresh failed for %s, %s", city, state)
                results.append({"city": city, "state": state, "mode": mode, "ok": False, "error": str(exc)})

    cleared = clear_stale_property_cache(24)
    return {
        "ok": True,
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
        "metros": len(US_METROS),
        "succeeded": ok,
        "failed": fail,
        "property_cache_cleared": cleared,
        "results": results,
    }
