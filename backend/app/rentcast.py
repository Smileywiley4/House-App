"""Licensed property-record and listing enrichment through RentCast."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


def _coalesce(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        if isinstance(value, (list, dict)) and not value:
            continue
        return value
    return None


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


def _agent_summary(agent: dict | None, office: dict | None) -> dict | None:
    agent = agent or {}
    office = office or {}
    name = _coalesce(agent.get("name"), office.get("name"))
    if not name:
        return None
    return {
        "name": name,
        "phone": _coalesce(agent.get("phone"), office.get("phone")),
        "email": _coalesce(agent.get("email"), office.get("email")),
        "office": office.get("name"),
    }


def _normalize(record: dict | None, listing: dict | None, avm: dict | None = None) -> dict | None:
    record = record or {}
    listing = listing or {}
    avm = avm or {}
    if not record and not listing and not avm:
        return None

    status = listing.get("status")
    status_l = str(status or "").lower()
    active = status_l == "active"
    listing_price = listing.get("price")
    estimated = avm.get("price")

    return {
        "rentcast_id": _coalesce(listing.get("id"), record.get("id"), (avm.get("subjectProperty") or {}).get("id")),
        "formatted_address": _coalesce(
            listing.get("formattedAddress"),
            record.get("formattedAddress"),
            (avm.get("subjectProperty") or {}).get("formattedAddress"),
        ),
        "address": _coalesce(listing.get("addressLine1"), record.get("addressLine1")),
        "city": _coalesce(listing.get("city"), record.get("city")),
        "state": _coalesce(listing.get("state"), record.get("state")),
        "zip": _coalesce(listing.get("zipCode"), record.get("zipCode")),
        "county": _coalesce(listing.get("county"), record.get("county")),
        "lat": _coalesce(listing.get("latitude"), record.get("latitude"), avm.get("latitude")),
        "lng": _coalesce(listing.get("longitude"), record.get("longitude"), avm.get("longitude")),
        "property_type": _coalesce(listing.get("propertyType"), record.get("propertyType")),
        "bedrooms": _coalesce(listing.get("bedrooms"), record.get("bedrooms")),
        "bathrooms": _coalesce(listing.get("bathrooms"), record.get("bathrooms")),
        "sqft": _coalesce(listing.get("squareFootage"), record.get("squareFootage")),
        "lot_size": _coalesce(listing.get("lotSize"), record.get("lotSize")),
        "year_built": _coalesce(listing.get("yearBuilt"), record.get("yearBuilt")),
        "hoa_fee": _coalesce((listing.get("hoa") or {}).get("fee"), (record.get("hoa") or {}).get("fee")),
        # Active listing price first; otherwise keep last known list price separately.
        "price": listing_price if active else None,
        "last_list_price": listing_price if listing_price is not None and not active else None,
        "estimated_value": estimated,
        "estimated_value_low": avm.get("priceRangeLow"),
        "estimated_value_high": avm.get("priceRangeHigh"),
        "listing_status": status or ("Off Market" if record else None),
        "listing_type": listing.get("listingType"),
        "listed_date": listing.get("listedDate"),
        "last_seen_date": listing.get("lastSeenDate"),
        "removed_date": listing.get("removedDate"),
        "days_on_market": listing.get("daysOnMarket"),
        "mls_name": listing.get("mlsName"),
        "mls_number": listing.get("mlsNumber"),
        "listing_agent": _agent_summary(listing.get("listingAgent"), listing.get("listingOffice")),
        "last_sale_date": record.get("lastSaleDate"),
        "last_sale_price": record.get("lastSalePrice"),
        "tax_assessment": _latest_year_value(record.get("taxAssessments"), "value"),
        "annual_taxes": _latest_year_value(record.get("propertyTaxes"), "total"),
        "features": _safe_features(record.get("features") or listing.get("features")),
        "sale_history": _history_rows(record.get("history")),
        "listing_history": _history_rows(listing.get("history")),
        "on_market": active,
        "data_source": "rentcast",
        "data_updated_at": _coalesce(
            listing.get("lastSeenDate"),
            listing.get("listedDate"),
            datetime.now(timezone.utc).isoformat(),
        ),
    }


def is_sparse_property(data: dict | None) -> bool:
    """True when a RentCast hit lacks the core facts needed for a useful preview."""
    if not data:
        return True
    core = ("bedrooms", "bathrooms", "sqft", "year_built", "price", "last_list_price", "estimated_value", "last_sale_price")
    return all(data.get(key) in (None, "") for key in core)


async def _get_list(client: httpx.AsyncClient, path: str, address: str) -> list[dict]:
    response = await client.get(path, params={"address": address, "limit": 1})
    if response.status_code in (401, 403):
        logger.error("RentCast rejected the configured API key")
        return []
    if response.status_code == 429:
        logger.warning("RentCast request quota reached")
        return []
    # 404 means no match for this address — normal for listings.
    if response.status_code == 404:
        return []
    if response.status_code >= 400:
        logger.warning("RentCast %s failed with HTTP %s", path, response.status_code)
        return []
    data = response.json()
    return data if isinstance(data, list) else []


async def _get_avm(client: httpx.AsyncClient, address: str) -> dict | None:
    response = await client.get("/avm/value", params={"address": address})
    if response.status_code in (401, 403):
        logger.error("RentCast rejected the configured API key for AVM")
        return None
    if response.status_code in (404, 400):
        return None
    if response.status_code == 429:
        logger.warning("RentCast AVM quota reached")
        return None
    if response.status_code >= 400:
        logger.warning("RentCast AVM failed with HTTP %s", response.status_code)
        return None
    data = response.json()
    return data if isinstance(data, dict) else None


async def _lookup_once(client: httpx.AsyncClient, address: str) -> dict | None:
    records, listings, avm = await asyncio.gather(
        _get_list(client, "/properties", address),
        _get_list(client, "/listings/sale", address),
        _get_avm(client, address),
    )
    active_listing = next(
        (row for row in listings if str(row.get("status") or "").lower() == "active"),
        None,
    )
    listing = active_listing or (listings[0] if listings else None)
    return _normalize(records[0] if records else None, listing, avm)


def _address_variants(address: str, preferred: str | None = None) -> list[str]:
    seen: set[str] = set()
    variants: list[str] = []
    for candidate in (preferred, address):
        text = (candidate or "").strip()
        if not text:
            continue
        # Prefer "Street, City, State Zip" without trailing country labels.
        cleaned = text.replace(", USA", "").replace(", United States", "").strip()
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        variants.append(cleaned)
    return variants


async def get_rentcast_property(address: str, preferred_address: str | None = None) -> dict | None:
    settings = get_settings()
    if not settings.rentcast_api_key:
        return None
    base_url = settings.rentcast_base_url.rstrip("/")
    headers = {"Accept": "application/json", "X-Api-Key": settings.rentcast_api_key}
    best: dict | None = None
    try:
        async with httpx.AsyncClient(base_url=base_url, headers=headers, timeout=20) as client:
            for candidate in _address_variants(address, preferred_address):
                result = await _lookup_once(client, candidate)
                if not result:
                    continue
                best = result
                if not is_sparse_property(result):
                    return result
        return best
    except Exception as exc:
        logger.warning("RentCast property lookup failed: %s", exc)
        return None
