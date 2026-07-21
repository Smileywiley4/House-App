"""
Browse auto-score enrichment + filtering.

Reuses deterministic Google Auto-Score formulas from property router.
Caches location scores in property_cache (autoscore_<hash>) by address.

Tradeoff: Places API calls are expensive. We only enrich when score_mins are set,
prefer cache hits, and cap concurrent live lookups (MAX_LIVE_AUTOSCORES).
Property-fact scores (beds/baths/sqft/hoa/garage) are free from card fields.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from typing import Any

from app.dependencies import get_supabase_admin
from app.google_places import get_autoscore_data

logger = logging.getLogger(__name__)

# Location factors that need Google Places (or cache).
LOCATION_SCORE_IDS = (
    "hospital_distance",
    "highway_access",
    "schools",
    "neighborhood_safety",
    "public_transportation",
    "location_lifestyle",
)

# Factors computable from browse card / property record without Places.
FACT_SCORE_IDS = (
    "bedroom_count",
    "bathroom_count",
    "overall_living_space",
    "hoa_cost",
    "garage_storage",
)

ALL_BROWSE_SCORE_IDS = LOCATION_SCORE_IDS + FACT_SCORE_IDS

MAX_LIVE_AUTOSCORES = 12
LIVE_CONCURRENCY = 4


def _normalize_address(addr: str) -> str:
    return " ".join((addr or "").lower().split())


def _cache_key(addr: str) -> str:
    return hashlib.sha256(_normalize_address(addr).encode()).hexdigest()


def extract_score_mins(filters: dict | None) -> dict[str, int]:
    """
    Accept either:
      filters.score_mins = { hospital_distance: 9, ... }
      or flat score_min_hospital_distance: 9
    Returns category_id -> min int 1-10.
    """
    f = filters or {}
    out: dict[str, int] = {}
    nested = f.get("score_mins")
    if isinstance(nested, dict):
        for k, v in nested.items():
            try:
                n = int(v)
            except (TypeError, ValueError):
                continue
            if 1 <= n <= 10 and k in ALL_BROWSE_SCORE_IDS:
                out[str(k)] = n
    for k, v in f.items():
        if not str(k).startswith("score_min_"):
            continue
        cat = str(k)[len("score_min_") :]
        try:
            n = int(v)
        except (TypeError, ValueError):
            continue
        if 1 <= n <= 10 and cat in ALL_BROWSE_SCORE_IDS:
            out[cat] = n
    return out


def strip_score_filters(filters: dict | None) -> dict:
    """Remove score filter keys before passing to RentCast."""
    f = dict(filters or {})
    f.pop("score_mins", None)
    for k in list(f.keys()):
        if str(k).startswith("score_min_"):
            f.pop(k, None)
    return f


def has_score_filters(filters: dict | None) -> bool:
    return bool(extract_score_mins(filters))


def _distance_score(miles: float | None, best: float = 0.5, worst: float = 10.0) -> int:
    if miles is None:
        return 5
    if miles <= best:
        return 10
    if miles >= worst:
        return 1
    ratio = (miles - best) / (worst - best)
    return max(1, min(10, round(10 - ratio * 9)))


def _count_score(count: int, good: int = 10, great: int = 20) -> int:
    if count >= great:
        return 10
    if count <= 0:
        return 2
    ratio = count / great
    return max(2, min(10, round(2 + ratio * 8)))


def compute_location_autoscores(raw: dict) -> dict[str, int]:
    """Same formulas as property._compute_autoscores (kept local to avoid circular imports)."""
    scores: dict[str, int] = {}
    scores["hospital_distance"] = _distance_score(raw.get("hospital_mi"), best=0.5, worst=8.0)
    scores["schools"] = _distance_score(raw.get("school_mi"), best=0.3, worst=5.0)
    scores["public_transportation"] = _distance_score(raw.get("transit_mi"), best=0.2, worst=5.0)
    scores["neighborhood_safety"] = _distance_score(raw.get("police_mi"), best=0.5, worst=8.0)

    grocery_mi = raw.get("grocery_mi")
    park_mi = raw.get("park_mi")
    restaurants = raw.get("restaurants_count", 0) or raw.get("restaurants_nearby", 0) or 0
    stores = raw.get("stores_count", 0) or raw.get("stores_nearby", 0) or 0

    walkability_parts = []
    if grocery_mi is not None:
        walkability_parts.append(_distance_score(grocery_mi, best=0.3, worst=3.0))
    if park_mi is not None:
        walkability_parts.append(_distance_score(park_mi, best=0.2, worst=2.0))
    walkability_parts.append(_count_score(int(restaurants), good=5, great=15))
    walkability_parts.append(_count_score(int(stores), good=5, great=15))
    scores["location_lifestyle"] = max(1, min(10, round(sum(walkability_parts) / len(walkability_parts))))

    fire_mi = raw.get("fire_mi")
    safety_parts = [scores["neighborhood_safety"]]
    if fire_mi is not None:
        safety_parts.append(_distance_score(fire_mi, best=0.5, worst=8.0))
    scores["neighborhood_safety"] = max(1, min(10, round(sum(safety_parts) / len(safety_parts))))

    highway_score = 5
    transit_mi = raw.get("transit_mi")
    if grocery_mi is not None and transit_mi is not None:
        avg_infra = (grocery_mi + transit_mi) / 2
        highway_score = _distance_score(avg_infra, best=0.5, worst=6.0)
    scores["highway_access"] = highway_score
    return scores


def compute_fact_scores(card: dict) -> dict[str, int]:
    """Cheap scores from browse card fields (subset of _property_fact_scores)."""
    scores: dict[str, int] = {}
    bedrooms = card.get("bedrooms")
    if isinstance(bedrooms, (int, float)):
        scores["bedroom_count"] = (
            10 if bedrooms >= 5 else 9 if bedrooms >= 4 else 8 if bedrooms >= 3 else 6 if bedrooms >= 2 else 3
        )
    bathrooms = card.get("bathrooms")
    if isinstance(bathrooms, (int, float)):
        scores["bathroom_count"] = (
            10 if bathrooms >= 3 else 9 if bathrooms >= 2.5 else 8 if bathrooms >= 2 else 6 if bathrooms >= 1.5 else 4
        )
    sqft = card.get("sqft")
    if isinstance(sqft, (int, float)) and sqft > 0:
        scores["overall_living_space"] = (
            10 if sqft >= 3000 else 9 if sqft >= 2400 else 8 if sqft >= 1800 else 7 if sqft >= 1400 else 5 if sqft >= 1000 else 3
        )
    hoa_fee = card.get("hoa_fee")
    if isinstance(hoa_fee, (int, float)) and hoa_fee >= 0:
        scores["hoa_cost"] = (
            10 if hoa_fee == 0 else 9 if hoa_fee <= 75 else 8 if hoa_fee <= 150 else 6 if hoa_fee <= 300 else 4 if hoa_fee <= 500 else 2
        )
    features = card.get("features") if isinstance(card.get("features"), dict) else {}
    if "garage" in features or card.get("parking_spaces") is not None:
        garage = bool(features.get("garage")) if "garage" in features else (card.get("parking_spaces") or 0) > 0
        spaces = features.get("garageSpaces") or card.get("parking_spaces")
        scores["garage_storage"] = min(10, 7 + int(spaces or 0)) if garage else 3
    return scores


def card_address(card: dict) -> str:
    return (
        card.get("formatted_address")
        or ", ".join(
            str(x)
            for x in [card.get("address"), card.get("city"), card.get("state"), card.get("zip")]
            if x
        )
    ).strip()


def _get_cached_location_scores(address: str) -> dict[str, int] | None:
    if not address:
        return None
    cache_key = "autoscore_" + _cache_key(address)
    try:
        supabase = get_supabase_admin()
        r = supabase.table("property_cache").select("data").eq("address_hash", cache_key).limit(1).execute()
        if r.data and r.data[0].get("data"):
            data = r.data[0]["data"]
            scores = data.get("scores")
            if isinstance(scores, dict) and scores:
                return {k: int(v) for k, v in scores.items() if k in LOCATION_SCORE_IDS and isinstance(v, (int, float))}
            raw = data.get("raw")
            if isinstance(raw, dict):
                # Older cache shape may only have raw distances.
                raw_norm = {
                    "hospital_mi": raw.get("hospital_mi"),
                    "school_mi": raw.get("school_mi"),
                    "transit_mi": raw.get("transit_mi"),
                    "grocery_mi": raw.get("grocery_mi"),
                    "park_mi": raw.get("park_mi"),
                    "police_mi": raw.get("police_mi"),
                    "fire_mi": raw.get("fire_mi"),
                    "restaurants_count": raw.get("restaurants_nearby") or raw.get("restaurants_count"),
                    "stores_count": raw.get("stores_nearby") or raw.get("stores_count"),
                }
                return compute_location_autoscores(raw_norm)
    except Exception:
        logger.debug("autoscore cache read failed", exc_info=True)
    return None


def _store_location_scores(address: str, raw: dict, scores: dict[str, int]) -> None:
    cache_key = "autoscore_" + _cache_key(address)
    payload = {
        "address": address,
        "scores": scores,
        "raw": {
            "hospital_mi": raw.get("hospital_mi"),
            "school_mi": raw.get("school_mi"),
            "transit_mi": raw.get("transit_mi"),
            "grocery_mi": raw.get("grocery_mi"),
            "park_mi": raw.get("park_mi"),
            "police_mi": raw.get("police_mi"),
            "fire_mi": raw.get("fire_mi"),
            "restaurants_nearby": raw.get("restaurants_count"),
            "stores_nearby": raw.get("stores_count"),
        },
    }
    try:
        supabase = get_supabase_admin()
        supabase.table("property_cache").upsert(
            [{"address_hash": cache_key, "data": payload}],
            on_conflict="address_hash",
        ).execute()
    except Exception:
        logger.debug("autoscore cache write failed", exc_info=True)


async def _live_location_scores(address: str) -> dict[str, int] | None:
    try:
        raw = await get_autoscore_data(address)
        if not raw:
            return None
        scores = compute_location_autoscores(raw)
        _store_location_scores(address, raw, scores)
        return scores
    except Exception:
        logger.warning("live autoscore failed for %s", address[:80], exc_info=True)
        return None


def passes_score_mins(scores: dict[str, int], score_mins: dict[str, int]) -> bool:
    """
    Require every requested min. Missing score for a required factor → fail
    (strict match). Callers should only filter when enrichment was attempted.
    """
    for cat, minimum in score_mins.items():
        val = scores.get(cat)
        if val is None or int(val) < int(minimum):
            return False
    return True


async def enrich_and_filter_by_scores(
    properties: list[dict],
    filters: dict | None,
    *,
    max_live: int = MAX_LIVE_AUTOSCORES,
) -> tuple[list[dict], dict[str, Any]]:
    """
    Attach auto_scores to cards and filter by score_mins.
    Returns (filtered_or_enriched_list, meta).
    """
    score_mins = extract_score_mins(filters)
    if not score_mins:
        # Still attach cheap fact scores for UI when present on cards? Skip to keep browse fast.
        return properties, {"score_filter_applied": False}

    need_location = any(k in LOCATION_SCORE_IDS for k in score_mins)
    meta: dict[str, Any] = {
        "score_filter_applied": True,
        "score_mins": score_mins,
        "cache_hits": 0,
        "live_lookups": 0,
        "skipped_unscored": 0,
        "scores_unavailable": False,
    }

    # Phase 1: fact scores + cache for all
    enriched: list[dict] = []
    need_live: list[tuple[int, str]] = []  # index into enriched pending

    for card in properties:
        scores = compute_fact_scores(card)
        addr = card_address(card)
        if need_location and addr:
            cached = _get_cached_location_scores(addr)
            if cached:
                scores.update(cached)
                meta["cache_hits"] += 1
            else:
                need_live.append((len(enriched), addr))
        row = {**card, "auto_scores": scores}
        enriched.append(row)

    # Phase 2: limited live Places lookups
    if need_location and need_live:
        to_fetch = need_live[: max(0, int(max_live))]
        sem = asyncio.Semaphore(LIVE_CONCURRENCY)

        async def fetch_one(idx: int, addr: str) -> None:
            async with sem:
                live = await _live_location_scores(addr)
                meta["live_lookups"] += 1
                if live:
                    enriched[idx]["auto_scores"] = {**enriched[idx].get("auto_scores", {}), **live}

        await asyncio.gather(*(fetch_one(i, a) for i, a in to_fetch))

    # Phase 3: filter
    kept: list[dict] = []
    for row in enriched:
        scores = row.get("auto_scores") or {}
        if passes_score_mins(scores, score_mins):
            kept.append(row)
        else:
            # Distinguish missing vs low score for metrics
            missing = any(scores.get(c) is None for c in score_mins)
            if missing:
                meta["skipped_unscored"] += 1

    if need_location and meta["live_lookups"] == 0 and meta["cache_hits"] == 0 and not kept:
        meta["scores_unavailable"] = True

    return kept, meta
