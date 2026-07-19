"""Licensed property-record and listing enrichment through RentCast."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


def _latest_year_value(values: dict | None, field: str) -> int | float | None:
    if not values:
        return None
    rows = [row for row in values.values() if isinstance(row, dict)]
    rows.sort(key=lambda row: int(row.get("year") or 0), reverse=True)
    return rows[0].get(field) if rows else None


def _history_rows(history: dict | None) -> list[dict]:
    if not history:
        return []
    rows = []
    for key, value in history.items():
        if not isinstance(value, dict):
            continue
        rows.append(
            {
                "date": value.get("date") or value.get("listedDate") or key,
                "event": value.get("event"),
                "price": value.get("price"),
                "days_on_market": value.get("daysOnMarket"),
            }
        )
    return sorted(rows, key=lambda row: row.get("date") or "", reverse=True)[:10]


def _safe_features(features: dict | None) -> dict:
    allowed = (
        "architectureType",
        "cooling",
        "coolingType",
        "exteriorType",
        "fireplace",
        "fireplaceType",
        "floorCount",
        "foundationType",
        "garage",
        "garageSpaces",
        "garageType",
        "heating",
        "heatingType",
        "pool",
        "poolType",
        "roofType",
        "roomCount",
        "unitCount",
        "viewType",
    )
    source = features or {}
    return {key: source[key] for key in allowed if source.get(key) not in (None, "")}


def _normalize(record: dict | None, listing: dict | None) -> dict | None:
    record = record or {}
    listing = listing or {}
    if not record and not listing:
        return None
    primary = listing or record
    status = listing.get("status")
    active = str(status or "").lower() == "active"
    return {
        "rentcast_id": primary.get("id") or record.get("id"),
        "formatted_address": primary.get("formattedAddress") or record.get("formattedAddress"),
        "address": primary.get("addressLine1") or record.get("addressLine1"),
        "city": primary.get("city") or record.get("city"),
        "state": primary.get("state") or record.get("state"),
        "zip": primary.get("zipCode") or record.get("zipCode"),
        "county": primary.get("county") or record.get("county"),
        "lat": primary.get("latitude") or record.get("latitude"),
        "lng": primary.get("longitude") or record.get("longitude"),
        "property_type": primary.get("propertyType") or record.get("propertyType"),
        "bedrooms": primary.get("bedrooms") or record.get("bedrooms"),
        "bathrooms": primary.get("bathrooms") or record.get("bathrooms"),
        "sqft": primary.get("squareFootage") or record.get("squareFootage"),
        "lot_size": primary.get("lotSize") or record.get("lotSize"),
        "year_built": primary.get("yearBuilt") or record.get("yearBuilt"),
        "hoa_fee": (primary.get("hoa") or record.get("hoa") or {}).get("fee"),
        "price": listing.get("price") if active else None,
        "listing_status": status or ("Off Market" if record else None),
        "listing_type": listing.get("listingType"),
        "listed_date": listing.get("listedDate"),
        "last_seen_date": listing.get("lastSeenDate"),
        "days_on_market": listing.get("daysOnMarket"),
        "mls_name": listing.get("mlsName"),
        "mls_number": listing.get("mlsNumber"),
        "last_sale_date": record.get("lastSaleDate"),
        "last_sale_price": record.get("lastSalePrice"),
        "tax_assessment": _latest_year_value(record.get("taxAssessments"), "value"),
        "annual_taxes": _latest_year_value(record.get("propertyTaxes"), "total"),
        "features": _safe_features(record.get("features")),
        "sale_history": _history_rows(record.get("history")),
        "listing_history": _history_rows(listing.get("history")),
        "on_market": active,
        "data_source": "rentcast",
        "data_updated_at": listing.get("lastSeenDate") or datetime.now(timezone.utc).isoformat(),
    }


async def _get_list(client: httpx.AsyncClient, path: str, address: str) -> list[dict]:
    response = await client.get(path, params={"address": address, "limit": 1})
    if response.status_code in (401, 403):
        logger.error("RentCast rejected the configured API key")
        return []
    if response.status_code == 429:
        logger.warning("RentCast request quota reached")
        return []
    if response.status_code >= 400:
        logger.warning("RentCast %s failed with HTTP %s", path, response.status_code)
        return []
    data = response.json()
    return data if isinstance(data, list) else []


async def get_rentcast_property(address: str) -> dict | None:
    settings = get_settings()
    if not settings.rentcast_api_key:
        return None
    base_url = settings.rentcast_base_url.rstrip("/")
    headers = {"Accept": "application/json", "X-Api-Key": settings.rentcast_api_key}
    try:
        async with httpx.AsyncClient(base_url=base_url, headers=headers, timeout=20) as client:
            records, listings = await asyncio.gather(
                _get_list(client, "/properties", address),
                _get_list(client, "/listings/sale", address),
            )
        active_listing = next(
            (row for row in listings if str(row.get("status") or "").lower() == "active"),
            listings[0] if listings else None,
        )
        return _normalize(records[0] if records else None, active_listing)
    except Exception as exc:
        logger.warning("RentCast property lookup failed: %s", exc)
        return None
