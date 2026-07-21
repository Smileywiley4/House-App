"""Project-level weighted scoring from auto-scores + preference weights."""
from __future__ import annotations

from typing import Any

from app.browse_scores import ALL_BROWSE_SCORE_IDS, card_address, compute_fact_scores


DEFAULT_WEIGHT = 5


def default_scoring_presets() -> dict[str, Any]:
    return {"weights": {cid: DEFAULT_WEIGHT for cid in ALL_BROWSE_SCORE_IDS}}


def normalize_presets(raw: dict | None) -> dict[str, Any]:
    """Return {weights: {category_id: 1-10}}."""
    base = default_scoring_presets()
    if not isinstance(raw, dict):
        return base
    weights_in = raw.get("weights") if isinstance(raw.get("weights"), dict) else raw
    out: dict[str, int] = {}
    for cid in ALL_BROWSE_SCORE_IDS:
        try:
            n = int((weights_in or {}).get(cid, DEFAULT_WEIGHT))
        except (TypeError, ValueError):
            n = DEFAULT_WEIGHT
        out[cid] = max(0, min(10, n))
    return {"weights": out}


def property_key_from_card(card: dict) -> str:
    pid = card.get("id") or card.get("listing_id") or card.get("property_id")
    if pid:
        return str(pid)
    addr = card_address(card)
    lat, lng = card.get("lat"), card.get("lng")
    if addr:
        return f"addr:{addr.lower()}"
    if lat is not None and lng is not None:
        return f"geo:{lat},{lng}"
    return f"anon:{hash(str(card))}"


def weighted_percentage(scores: dict[str, Any] | None, weights: dict[str, int] | None) -> int:
    """Overall match % from category scores (1-10) and importance weights (0-10)."""
    scores = scores or {}
    weights = weights or {}
    total = 0
    max_possible = 0
    for cid, score in scores.items():
        try:
            s = int(score)
            w = int(weights.get(cid, DEFAULT_WEIGHT) or 0)
        except (TypeError, ValueError):
            continue
        if w <= 0 or s < 1:
            continue
        total += w * s
        max_possible += w * 10
    if max_possible <= 0:
        # Fall back to equal-weight average of available scores
        vals = []
        for v in scores.values():
            try:
                vals.append(int(v))
            except (TypeError, ValueError):
                continue
        if not vals:
            return 0
        return max(0, min(100, round(sum(vals) / (len(vals) * 10) * 100)))
    return max(0, min(100, round((total / max_possible) * 100)))


def merge_card_scores(card: dict, location_scores: dict[str, int] | None = None) -> dict[str, int]:
    scores = compute_fact_scores(card)
    existing = card.get("auto_scores") if isinstance(card.get("auto_scores"), dict) else {}
    for k, v in existing.items():
        try:
            scores[str(k)] = int(v)
        except (TypeError, ValueError):
            continue
    if location_scores:
        scores.update({k: int(v) for k, v in location_scores.items() if isinstance(v, (int, float))})
    return scores


def score_card_for_project(card: dict, presets: dict | None) -> tuple[dict[str, int], int]:
    norm = normalize_presets(presets)
    scores = merge_card_scores(card)
    pct = weighted_percentage(scores, norm["weights"])
    return scores, pct
