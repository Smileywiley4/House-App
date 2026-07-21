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
        "basement",
        "basementType",
        "waterfront",
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
        "parking_spaces": _coalesce(
            (record.get("features") or {}).get("garageSpaces"),
            (listing.get("features") or {}).get("garageSpaces"),
        ),
        "stories": _coalesce(
            (record.get("features") or {}).get("floorCount"),
            (listing.get("features") or {}).get("floorCount"),
        ),
        "cover_photo": _coalesce(
            listing.get("primaryPhotoUrl"),
            (listing.get("photos") or [None])[0] if isinstance(listing.get("photos"), list) else None,
        ),
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


PROPERTY_TYPE_MAP = {
    "house": "Single Family",
    "houses": "Single Family",
    "single_family": "Single Family",
    "townhome": "Townhouse",
    "townhomes": "Townhouse",
    "townhouse": "Townhouse",
    "apartment": "Apartment",
    "apartments": "Apartment",
    "condo": "Condo",
    "condos": "Condo",
    "multi_family": "Multi-Family",
    "multifamily": "Multi-Family",
    "lot": "Land",
    "lots": "Land",
    "land": "Land",
}


def _range_param(min_v: Any, max_v: Any) -> str | None:
    """RentCast range syntax: min:max, *:max, min:*, or single max."""
    has_min = min_v is not None and str(min_v).strip() != ""
    has_max = max_v is not None and str(max_v).strip() != ""
    if not has_min and not has_max:
        return None
    lo = str(int(float(min_v))) if has_min else "*"
    hi = str(int(float(max_v))) if has_max else "*"
    if lo == "*" and hi != "*":
        return f"*:{hi}"
    if hi == "*" and lo != "*":
        return f"{lo}:*"
    if lo == hi:
        return lo
    return f"{lo}:{hi}"


def _beds_baths_param(value: Any) -> str | None:
    """Map UI 1|2|3|4|5+ into RentCast multi / range values."""
    if value is None or value == "":
        return None
    if isinstance(value, (list, tuple, set)):
        parts = []
        for item in value:
            text = str(item).strip().lower()
            if not text:
                continue
            if text.endswith("+") or text == "5+":
                parts.append("5:*")
            else:
                try:
                    parts.append(str(int(float(text))))
                except (TypeError, ValueError):
                    continue
        return "|".join(parts) if parts else None
    text = str(value).strip().lower()
    if text.endswith("+") or text == "5+":
        return "5:*"
    try:
        return str(int(float(text)))
    except (TypeError, ValueError):
        return None


def _truthy_feature(features: dict | None, *keys: str) -> bool:
    feats = features or {}
    for key in keys:
        val = feats.get(key)
        if val is True:
            return True
        if isinstance(val, (int, float)) and val > 0:
            return True
        if isinstance(val, str) and val.strip() and val.strip().lower() not in {"false", "no", "none", "0"}:
            return True
    return False


def _passes_amenity_filters(row: dict, filters: dict) -> bool:
    feats = row.get("features") or {}
    if filters.get("must_have_ac") and not _truthy_feature(feats, "cooling", "coolingType"):
        return False
    if filters.get("must_have_pool") and not _truthy_feature(feats, "pool", "poolType"):
        return False
    if filters.get("waterfront"):
        if not _truthy_feature(feats, "waterfront"):
            view = str(feats.get("viewType") or "").lower()
            if not any(token in view for token in ("water", "lake", "ocean", "bay", "river")):
                return False
    if filters.get("must_have_garage") and not _truthy_feature(feats, "garage", "garageSpaces", "garageType"):
        return False
    if filters.get("has_basement") and not _truthy_feature(feats, "basement", "basementType"):
        return False
    if filters.get("single_story_only"):
        stories = row.get("stories")
        if stories is None:
            stories = feats.get("floorCount")
        try:
            if stories is not None and float(stories) > 1:
                return False
            if stories is None:
                return False
        except (TypeError, ValueError):
            return False
    parking_min = filters.get("parking_min")
    if parking_min is not None and str(parking_min).strip() != "":
        try:
            need = int(float(str(parking_min).replace("+", "")))
            spaces = row.get("parking_spaces")
            if spaces is None:
                spaces = feats.get("garageSpaces")
            if spaces is None or float(spaces) < need:
                return False
        except (TypeError, ValueError):
            return False
    if filters.get("no_hoa"):
        fee = row.get("hoa_fee")
        if fee is not None:
            try:
                if float(fee) > 0:
                    return False
            except (TypeError, ValueError):
                return False
    return True


def _card_from_normalized(row: dict, *, mode: str) -> dict:
    on_market = bool(row.get("on_market"))
    display_price = row.get("price") if on_market else (row.get("estimated_value") or row.get("last_list_price") or row.get("tax_assessment"))
    return {
        "id": row.get("rentcast_id"),
        "formatted_address": row.get("formatted_address"),
        "address": row.get("address"),
        "city": row.get("city"),
        "state": row.get("state"),
        "zip": row.get("zip"),
        "lat": row.get("lat"),
        "lng": row.get("lng"),
        "price": display_price,
        "list_price": row.get("price"),
        "estimated_value": row.get("estimated_value"),
        "bedrooms": row.get("bedrooms"),
        "bathrooms": row.get("bathrooms"),
        "sqft": row.get("sqft"),
        "lot_size": row.get("lot_size"),
        "year_built": row.get("year_built"),
        "property_type": row.get("property_type"),
        "hoa_fee": row.get("hoa_fee"),
        "parking_spaces": row.get("parking_spaces"),
        "stories": row.get("stories"),
        "days_on_market": row.get("days_on_market"),
        "listing_status": row.get("listing_status"),
        "on_market": on_market,
        "mode": mode,
        "cover_photo": row.get("cover_photo"),
        "mls_name": row.get("mls_name"),
        "features": row.get("features") or {},
        "data_source": "rentcast",
    }


async def _get_search(client: httpx.AsyncClient, path: str, params: dict) -> tuple[list[dict], dict]:
    response = await client.get(path, params=params)
    headers = {k: v for k, v in response.headers.items()}
    if response.status_code in (401, 403):
        logger.error("RentCast rejected the configured API key for %s", path)
        return [], headers
    if response.status_code == 429:
        logger.warning("RentCast request quota reached for %s", path)
        return [], headers
    if response.status_code == 404:
        return [], headers
    if response.status_code >= 400:
        logger.warning("RentCast %s failed with HTTP %s: %s", path, response.status_code, response.text[:200])
        return [], headers
    data = response.json()
    return (data if isinstance(data, list) else []), headers


async def _enrich_with_property_features(client: httpx.AsyncClient, cards: list[dict]) -> list[dict]:
    """Attach property-record features (garage, pool, etc.) for amenity filtering."""

    async def one(card: dict) -> dict:
        address = card.get("formatted_address") or card.get("address")
        if not address:
            return card
        rows, _ = await _get_search(client, "/properties", {"address": address, "limit": 1})
        if not rows:
            return card
        record = rows[0]
        feats = _safe_features(record.get("features"))
        hoa_fee = _coalesce((record.get("hoa") or {}).get("fee"), card.get("hoa_fee"))
        return {
            **card,
            "features": {**(card.get("features") or {}), **feats},
            "hoa_fee": hoa_fee,
            "parking_spaces": _coalesce(card.get("parking_spaces"), feats.get("garageSpaces")),
            "stories": _coalesce(card.get("stories"), feats.get("floorCount")),
            "lot_size": _coalesce(card.get("lot_size"), record.get("lotSize")),
            "year_built": _coalesce(card.get("year_built"), record.get("yearBuilt")),
            "tax_assessment": _latest_year_value(record.get("taxAssessments"), "value"),
        }

    # Cap enrichment cost for map browse.
    subset = cards[:40]
    enriched = await asyncio.gather(*(one(c) for c in subset))
    return list(enriched) + cards[len(subset) :]


async def browse_rentcast(
    *,
    mode: str = "for_sale",
    latitude: float | None = None,
    longitude: float | None = None,
    radius: float | None = None,
    city: str | None = None,
    state: str | None = None,
    zip_code: str | None = None,
    filters: dict | None = None,
    limit: int = 40,
    offset: int = 0,
) -> dict:
    """
    Geo / city browse via RentCast listings or property records.
    mode: for_sale | off_market
    """
    settings = get_settings()
    if not settings.rentcast_api_key:
        return {"properties": [], "total": 0, "error": "RentCast is not configured"}

    filters = filters or {}
    limit = max(1, min(int(limit or 40), 100))
    offset = max(0, int(offset or 0))
    mode = (mode or "for_sale").strip().lower()
    if mode not in {"for_sale", "off_market"}:
        mode = "for_sale"

    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if city:
        params["city"] = city
    if state:
        params["state"] = state
    if zip_code:
        params["zipCode"] = zip_code
    if latitude is not None and longitude is not None:
        params["latitude"] = latitude
        params["longitude"] = longitude
        params["radius"] = radius if radius is not None else 5

    beds = _beds_baths_param(filters.get("beds") or filters.get("beds_min"))
    baths = _beds_baths_param(filters.get("baths") or filters.get("baths_min"))
    if beds:
        params["bedrooms"] = beds
    if baths:
        params["bathrooms"] = baths

    price = _range_param(filters.get("budget_min") or filters.get("price_min"), filters.get("budget_max") or filters.get("price_max"))
    if price:
        params["price"] = price
    sqft = _range_param(filters.get("sqft_min"), filters.get("sqft_max"))
    if sqft:
        params["squareFootage"] = sqft
    lot = _range_param(filters.get("lot_min") or filters.get("lot_size_min"), filters.get("lot_max") or filters.get("lot_size_max"))
    if lot:
        params["lotSize"] = lot
    year = _range_param(filters.get("year_built_min"), filters.get("year_built_max"))
    if year:
        params["yearBuilt"] = year

    types = filters.get("property_types") or filters.get("property_type")
    if types:
        if isinstance(types, str):
            types = [types]
        mapped = []
        for t in types:
            key = str(t).strip().lower().replace(" ", "_").replace("-", "_")
            mapped.append(PROPERTY_TYPE_MAP.get(key, t))
        # unique preserve order
        seen: set[str] = set()
        ordered = []
        for m in mapped:
            if m and m not in seen:
                seen.add(m)
                ordered.append(m)
        if ordered:
            params["propertyType"] = "|".join(ordered)

    if mode == "for_sale":
        params["status"] = "Active"
        path = "/listings/sale"
    else:
        path = "/properties"

    amenity_keys = (
        "must_have_ac",
        "must_have_pool",
        "waterfront",
        "must_have_garage",
        "has_basement",
        "single_story_only",
        "parking_min",
        "no_hoa",
    )
    needs_enrichment = any(filters.get(k) not in (None, False, "", 0) for k in amenity_keys)

    base_url = settings.rentcast_base_url.rstrip("/")
    headers = {"Accept": "application/json", "X-Api-Key": settings.rentcast_api_key}
    try:
        async with httpx.AsyncClient(base_url=base_url, headers=headers, timeout=35) as client:
            rows, resp_headers = await _get_search(client, path, params)
            cards: list[dict] = []
            if mode == "for_sale":
                for listing in rows:
                    cards.append(_card_from_normalized(_normalize(None, listing, None), mode=mode))
            else:
                # Off-market: property records; attach AVM for first page only (cost control).
                async def with_avm(record: dict) -> dict:
                    address = record.get("formattedAddress") or record.get("addressLine1")
                    avm = await _get_avm(client, address) if address else None
                    return _card_from_normalized(_normalize(record, None, avm), mode=mode)

                # AVM only for first 15 to keep latency/cost reasonable.
                head = rows[:15]
                tail = rows[15:]
                head_cards = await asyncio.gather(*(with_avm(r) for r in head))
                cards = list(head_cards) + [
                    _card_from_normalized(_normalize(r, None, None), mode=mode) for r in tail
                ]

            if needs_enrichment and cards:
                cards = await _enrich_with_property_features(client, cards)
                cards = [c for c in cards if _passes_amenity_filters(c, filters)]

            total_raw = resp_headers.get("x-total-count") or resp_headers.get("X-Total-Count")
            try:
                total = int(total_raw) if total_raw else len(cards)
            except ValueError:
                total = len(cards)

            return {
                "properties": cards,
                "total": total,
                "limit": limit,
                "offset": offset,
                "mode": mode,
                "source": "rentcast",
            }
    except Exception as exc:
        logger.warning("RentCast browse failed: %s", exc)
        return {"properties": [], "total": 0, "error": "Browse failed", "mode": mode, "source": "rentcast"}
