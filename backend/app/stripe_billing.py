"""Map Stripe subscription payloads → PropertyPulse `profiles.plan` values."""
from __future__ import annotations

from typing import Any

from app.config import Settings


def stripe_customer_id(value: Any) -> str | None:
    """Stripe objects may send `customer` as an id string or an expanded object."""
    if value is None:
        return None
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, dict):
        cid = value.get("id")
        if isinstance(cid, str) and cid.strip():
            return cid.strip()
    return None


def plan_from_subscription_price_ids(subscription: dict, s: Settings) -> str | None:
    """
    Inspect subscription.items[].price.id and match against configured Stripe Price IDs.
    Realtor prices take precedence if both matched (should not happen).
    """
    price_ids: set[str] = set()
    for item in (subscription.get("items") or {}).get("data") or []:
        pid = (item.get("price") or {}).get("id")
        if isinstance(pid, str) and pid.strip():
            price_ids.add(pid.strip())

    realtor_ids = {
        x.strip()
        for x in (
            s.stripe_realtor_price_id,
            s.stripe_realtor_monthly_price_id,
            s.stripe_realtor_annual_price_id,
        )
        if x and str(x).strip()
    }
    premium_ids = {
        x.strip()
        for x in (
            s.stripe_premium_price_id,
            s.stripe_premium_monthly_price_id,
            s.stripe_premium_annual_price_id,
        )
        if x and str(x).strip()
    }

    if price_ids & realtor_ids:
        return "realtor"
    if price_ids & premium_ids:
        return "premium"
    return None
