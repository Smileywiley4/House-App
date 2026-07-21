"""Geocoding helpers — Nominatim proxy for place boundaries (cities, ZIPs, neighborhoods)."""
from __future__ import annotations

import asyncio
import logging
import math
from time import monotonic

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from app.routers.property import _enforce_public_search_limit

router = APIRouter(prefix="/geo", tags=["geo"])
logger = logging.getLogger(__name__)

NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "PropertyPocket/1.0 (support@proppocket.com; geo-boundary)"
_last_nominatim_at = 0.0
_nominatim_lock = asyncio.Lock()


def _ring_area(ring: list[list[float]]) -> float:
    """Shoelace area on lat/lng (relative only — for picking largest polygon)."""
    if len(ring) < 3:
        return 0.0
    area = 0.0
    for i in range(len(ring)):
        j = (i + 1) % len(ring)
        area += ring[i][1] * ring[j][0]
        area -= ring[j][1] * ring[i][0]
    return abs(area) * 0.5


def _coords_to_ring(coords: list) -> list[list[float]]:
    """GeoJSON [lng, lat] → Leaflet [lat, lng], drop closing duplicate."""
    ring: list[list[float]] = []
    for pair in coords or []:
        if not isinstance(pair, (list, tuple)) or len(pair) < 2:
            continue
        lng, lat = float(pair[0]), float(pair[1])
        if not math.isfinite(lat) or not math.isfinite(lng):
            continue
        ring.append([lat, lng])
    if len(ring) >= 2 and ring[0][0] == ring[-1][0] and ring[0][1] == ring[-1][1]:
        ring = ring[:-1]
    return ring


def _geojson_largest_ring(geojson: dict | None) -> list[list[float]] | None:
    if not geojson or not isinstance(geojson, dict):
        return None
    gtype = geojson.get("type")
    coords = geojson.get("coordinates")
    candidates: list[list[list[float]]] = []

    if gtype == "Polygon" and coords:
        candidates.append(_coords_to_ring(coords[0]))
    elif gtype == "MultiPolygon" and coords:
        for poly in coords:
            if poly:
                candidates.append(_coords_to_ring(poly[0]))
    elif gtype == "Point":
        return None

    rings = [r for r in candidates if len(r) >= 3]
    if not rings:
        return None
    return max(rings, key=_ring_area)


def _simplify_ring(ring: list[list[float]], max_points: int = 250) -> list[list[float]]:
    if len(ring) <= max_points:
        return ring
    step = max(1, math.ceil(len(ring) / max_points))
    out = ring[::step]
    if out[-1] != ring[-1]:
        out.append(ring[-1])
    return out if len(out) >= 3 else ring


def _bbox_ring(bbox: list | None) -> list[list[float]] | None:
    """Nominatim bbox: [south, north, west, east] → rectangle ring."""
    if not bbox or len(bbox) < 4:
        return None
    try:
        south, north, west, east = (float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3]))
    except (TypeError, ValueError):
        return None
    if not all(math.isfinite(v) for v in (south, north, west, east)):
        return None
    return [
        [south, west],
        [south, east],
        [north, east],
        [north, west],
    ]


async def _nominatim_search(q: str) -> list[dict]:
    global _last_nominatim_at
    async with _nominatim_lock:
        elapsed = monotonic() - _last_nominatim_at
        if elapsed < 1.05:
            await asyncio.sleep(1.05 - elapsed)
        params = {
            "format": "json",
            "limit": "1",
            "polygon_geojson": "1",
            "addressdetails": "0",
            "countrycodes": "us",
            "q": q,
        }
        headers = {
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.get(NOMINATIM_SEARCH, params=params, headers=headers)
        _last_nominatim_at = monotonic()
        if res.status_code >= 400:
            logger.warning("Nominatim boundary failed: %s %s", res.status_code, res.text[:400])
            raise HTTPException(status_code=502, detail="Place boundary lookup failed")
        data = res.json()
        return data if isinstance(data, list) else []


@router.get("/boundary")
async def place_boundary(
    request: Request,
    q: str = Query(..., min_length=2, max_length=120),
):
    """
    Resolve a city / ZIP / neighborhood to a map ring via OpenStreetMap Nominatim.
    Returns { label, lat, lng, ring: [[lat,lng],...], source }.
    """
    _enforce_public_search_limit(request, namespace="geo_boundary", limit=40)
    query = (q or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")

    # Prefer USA context when missing
    search_q = query if "," in query or "USA" in query.upper() else f"{query}, USA"

    try:
        hits = await _nominatim_search(search_q)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Nominatim error: %s", exc)
        raise HTTPException(status_code=502, detail="Place boundary lookup failed") from exc

    if not hits:
        raise HTTPException(status_code=404, detail="Place not found")

    hit = hits[0]
    lat = float(hit.get("lat"))
    lng = float(hit.get("lon"))
    label = hit.get("display_name") or query
    ring = _geojson_largest_ring(hit.get("geojson"))
    source = "polygon"
    if not ring:
        ring = _bbox_ring(hit.get("boundingbox"))
        source = "bbox" if ring else "point"

    if ring:
        ring = _simplify_ring(ring)

    return {
        "label": label,
        "lat": lat,
        "lng": lng,
        "ring": ring,
        "source": source,
        "osm_type": hit.get("osm_type"),
        "osm_id": hit.get("osm_id"),
        "place_class": hit.get("class"),
        "place_type": hit.get("type"),
    }
