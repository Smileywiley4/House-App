"""Incremental preference learning from gamified questionnaire responses (EMA)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Maps gamified swipe to 1–10 signal for category importance
RESPONSE_SIGNAL = {
    "love": 9.5,
    "like": 7.5,
    "neutral": 5.0,
    "dislike": 3.0,
    "hate": 1.5,
}

# EMA smoothing — lower alpha = slower drift, more stable over many homes
DEFAULT_ALPHA = 0.22
CONFIDENCE_CAP = 1.0

# Core walk-through questions (category_id, label, question)
GAMIFIED_QUESTIONS = [
    ("schools", "Schools", "How important are schools and kid-friendly amenities here?"),
    ("neighborhood_safety", "Neighborhood Safety", "Does this area feel safe to you?"),
    ("location_lifestyle", "Location for Lifestyle", "Does the vibe match your day-to-day lifestyle?"),
    ("public_transportation", "Public Transportation", "Is commute / transit access working for you?"),
    ("living_room_space", "Living Room Space", "Does the main living space feel right?"),
    ("livable_layout", "Livable Layout", "Is the floor plan easy to live in?"),
    ("back_yard", "Back Yard", "How do you feel about the outdoor / backyard space?"),
    ("kitchen", "Kitchen", "Would you enjoy cooking and gathering in this kitchen?"),
    ("natural_light", "Natural Light", "Does the home have the light you want?"),
    ("noise_level", "Noise Level", "Is noise level acceptable inside and outside?"),
    ("parking", "Parking", "Does parking work for your household?"),
    ("renovation_potential", "Renovation Potential", "Could you see yourself improving this place over time?"),
]


def signal_from_response(response_value: str) -> float:
    return RESPONSE_SIGNAL.get((response_value or "").lower(), 5.0)


def ema_update(current_weight: float, signal: float, response_count: int, alpha: float = DEFAULT_ALPHA) -> tuple[float, float]:
    """Return (new_weight, new_confidence)."""
    if response_count <= 0:
        new_weight = signal
    else:
        new_weight = alpha * signal + (1.0 - alpha) * current_weight
    new_weight = max(1.0, min(10.0, round(new_weight, 2)))
    confidence = min(CONFIDENCE_CAP, round(0.08 + response_count * 0.04, 4))
    return new_weight, confidence


def apply_response_to_preferences(supabase, user_id: str, category_id: str, response_value: str) -> dict:
    signal = signal_from_response(response_value)
    r = (
        supabase.table("user_learned_preferences")
        .select("*")
        .eq("user_id", user_id)
        .eq("category_id", category_id)
        .execute()
    )
    row = r.data[0] if r.data else None
    prev_weight = float(row["weight"]) if row else 5.0
    prev_count = int(row["response_count"]) if row else 0
    new_weight, confidence = ema_update(prev_weight, signal, prev_count + 1)
    payload = {
        "user_id": user_id,
        "category_id": category_id,
        "weight": new_weight,
        "confidence": confidence,
        "response_count": prev_count + 1,
        "last_signal": signal,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    supabase.table("user_learned_preferences").upsert(payload, on_conflict="user_id,category_id").execute()
    return payload


def get_learned_weights(supabase, user_id: str) -> dict[str, float]:
    r = supabase.table("user_learned_preferences").select("category_id, weight, confidence, response_count").eq("user_id", user_id).execute()
    return {
        row["category_id"]: float(row["weight"])
        for row in (r.data or [])
    }


def get_learned_profile(supabase, user_id: str) -> list[dict]:
    r = (
        supabase.table("user_learned_preferences")
        .select("category_id, weight, confidence, response_count, last_signal, updated_at")
        .eq("user_id", user_id)
        .order("weight", desc=True)
        .execute()
    )
    return r.data or []


def top_hidden_preferences(learned: list[dict], min_responses: int = 3) -> list[dict]:
    """Categories user rates highly that they may not consciously prioritize."""
    strong = [x for x in learned if float(x.get("weight", 0)) >= 7.5 and int(x.get("response_count", 0)) >= min_responses]
    return sorted(strong, key=lambda x: float(x["weight"]) * float(x.get("confidence", 0)), reverse=True)[:5]
