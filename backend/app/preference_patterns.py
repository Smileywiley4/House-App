"""Aggregate historical category importance into a shareable preference pattern summary."""
from __future__ import annotations

from typing import Any


def _first_name(full_name: str | None) -> str | None:
    if not full_name or not isinstance(full_name, str):
        return None
    part = full_name.strip().split()[0] if full_name.strip() else ""
    if not part or len(part) > 40:
        return None
    return part


def _as_importance(raw: Any) -> float | None:
    if raw is None:
        return None
    try:
        v = float(raw)
    except (TypeError, ValueError):
        return None
    if v < 0 or v > 10:
        return None
    return v


def aggregate_from_scores(
    score_rows: list[dict[str, Any]],
    *,
    top_n: int = 3,
) -> dict[str, Any]:
    """
    Average importance per category across scored homes.
    Ignores addresses, prices, photos, and score ratings — importance only.
    """
    totals: dict[str, dict[str, Any]] = {}
    homes = 0
    for row in score_rows or []:
        items = row.get("scores") or []
        if not isinstance(items, list) or not items:
            continue
        homes += 1
        seen_in_home: set[str] = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            cid = item.get("category_id") or item.get("id")
            if not cid or not isinstance(cid, str):
                continue
            # One contribution per category per home
            if cid in seen_in_home:
                continue
            imp = _as_importance(item.get("importance"))
            if imp is None:
                continue
            seen_in_home.add(cid)
            label = item.get("category_label") or item.get("label") or cid
            if not isinstance(label, str) or not label.strip():
                label = cid
            bucket = totals.setdefault(cid, {"sum": 0.0, "count": 0, "label": label.strip()})
            bucket["sum"] += imp
            bucket["count"] += 1
            bucket["label"] = label.strip()

    ranked = []
    for cid, bucket in totals.items():
        if bucket["count"] <= 0:
            continue
        avg = bucket["sum"] / bucket["count"]
        ranked.append(
            {
                "category_id": cid,
                "label": bucket["label"],
                "avg_importance": round(avg, 1),
                "appearances": bucket["count"],
            }
        )
    ranked.sort(key=lambda x: (-x["avg_importance"], -x["appearances"], x["label"].lower()))
    top = ranked[: max(1, min(top_n, 10))]
    return {
        "homes_scored": homes,
        "source": "scores" if homes else "none",
        "top_priorities": top if homes else [],
        "all_ranked": ranked if homes else [],
    }


def aggregate_from_weights(
    weights: dict[str, Any] | None,
    label_map: dict[str, str] | None = None,
    *,
    top_n: int = 3,
) -> dict[str, Any]:
    """Fallback when the user has no scored homes — use profile default_weights or a preset."""
    label_map = label_map or {}
    ranked = []
    for cid, raw in (weights or {}).items():
        if not isinstance(cid, str):
            continue
        imp = _as_importance(raw)
        if imp is None:
            continue
        ranked.append(
            {
                "category_id": cid,
                "label": label_map.get(cid) or cid.replace("_", " ").title(),
                "avg_importance": round(imp, 1),
                "appearances": 1,
            }
        )
    ranked.sort(key=lambda x: (-x["avg_importance"], x["label"].lower()))
    top = ranked[: max(1, min(top_n, 10))]
    return {
        "homes_scored": 0,
        "source": "weights" if top else "none",
        "top_priorities": top,
        "all_ranked": ranked,
    }


def build_summary_line(homes_scored: int, top_priorities: list[dict[str, Any]], *, first_name: str | None = None) -> str:
    labels = [p["label"] for p in (top_priorities or []) if p.get("label")]
    n = len(labels)
    if not labels:
        return "Not enough scoring history yet to spot a clear preference pattern."
    joined = ", ".join(labels)
    if homes_scored > 0:
        who = f"{first_name}'s" if first_name else "your"
        return f"Based on {homes_scored} home{'s' if homes_scored != 1 else ''} scored, {who} top {n} priorit{'ies' if n != 1 else 'y'} {'are' if n != 1 else 'is'}: {joined}."
    who = f"{first_name}'s" if first_name else "Your"
    return f"{who} top {n} scoring priorit{'ies' if n != 1 else 'y'} {'are' if n != 1 else 'is'}: {joined}."


def public_card_payload(
    pattern: dict[str, Any],
    *,
    include_first_name: bool = False,
    full_name: str | None = None,
    regenerated_at: str | None = None,
) -> dict[str, Any]:
    """Strip anything that could leak addresses, prices, photos, or contact PII."""
    first = _first_name(full_name) if include_first_name else None
    top = [
        {
            "label": p.get("label"),
            "avg_importance": p.get("avg_importance"),
        }
        for p in (pattern.get("top_priorities") or [])
        if p.get("label")
    ]
    homes = int(pattern.get("homes_scored") or 0)
    return {
        "homes_scored": homes,
        "source": pattern.get("source") or "none",
        "top_priorities": top,
        "summary_line": build_summary_line(homes, pattern.get("top_priorities") or [], first_name=first),
        "display_name": first,
        "regenerated_at": regenerated_at,
        # Explicit privacy contract for clients / crawlers
        "privacy": {
            "includes_address": False,
            "includes_price": False,
            "includes_photo": False,
            "includes_email": False,
        },
    }
