"""Stripe checkout, in-place plan upgrades, and customer portal."""
from __future__ import annotations

import logging
from urllib.parse import urlparse

import stripe
from fastapi import APIRouter, Depends, HTTPException
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.config import get_settings
from app.dependencies import get_current_user_id, get_supabase_admin
from app.stripe_billing import plan_from_subscription_price_ids

router = APIRouter(prefix="/subscription", tags=["subscription"])
logger = logging.getLogger(__name__)

DEFAULT_TERMS_VERSION = "2026-07"
PLAN_RANK = {"free": 0, "premium": 1, "realtor": 2, "admin": 3}


def same_origin_url(candidate: str | None, base: str, fallback: str) -> str:
    """Accept client return URLs only when they stay on the configured web origin."""
    if not candidate:
        return fallback
    parsed = urlparse(candidate)
    if parsed.scheme in {"http", "https"} and parsed.netloc == urlparse(base).netloc:
        return candidate
    raise HTTPException(status_code=400, detail="Checkout return URLs must use the application origin.")


def _normalize_interval(raw: str | None) -> str:
    interval_raw = (raw or "monthly").lower()
    if interval_raw not in {"monthly", "annual", "yearly", "year"}:
        raise HTTPException(status_code=400, detail="Invalid billing interval.")
    return "annual" if interval_raw in {"annual", "yearly", "year"} else "monthly"


def _price_id_for(plan_id: str, interval: str, s) -> str:
    is_annual = interval == "annual"
    if plan_id == "realtor":
        price_id = (
            (s.stripe_realtor_annual_price_id if is_annual else s.stripe_realtor_monthly_price_id)
            or s.stripe_realtor_price_id
        )
    else:
        price_id = (
            (s.stripe_premium_annual_price_id if is_annual else s.stripe_premium_monthly_price_id)
            or s.stripe_premium_price_id
        )
    if not price_id:
        raise HTTPException(status_code=503, detail="Billing is not configured for this plan/interval.")
    return price_id


def _find_active_subscription(customer_id: str):
    """Return the first active/trialing subscription for a Stripe customer, if any."""
    for status in ("active", "trialing"):
        result = stripe.Subscription.list(customer=customer_id, status=status, limit=5)
        data = getattr(result, "data", None) or []
        if data:
            return data[0]
    return None


def _subscription_item_id(subscription) -> str | None:
    items = getattr(subscription, "items", None)
    data = getattr(items, "data", None) if items is not None else None
    if not data and isinstance(subscription, dict):
        data = ((subscription.get("items") or {}).get("data")) or []
    if not data:
        return None
    first = data[0]
    return getattr(first, "id", None) or (first.get("id") if isinstance(first, dict) else None)


def _current_price_id(subscription) -> str | None:
    items = getattr(subscription, "items", None)
    data = getattr(items, "data", None) if items is not None else None
    if not data and isinstance(subscription, dict):
        data = ((subscription.get("items") or {}).get("data")) or []
    if not data:
        return None
    first = data[0]
    price = getattr(first, "price", None)
    if price is not None:
        return getattr(price, "id", None)
    if isinstance(first, dict):
        return (first.get("price") or {}).get("id")
    return None


class CreateCheckoutBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    plan_id: str = Field(validation_alias=AliasChoices("planId", "plan_id"))
    interval: str = Field(
        default="monthly",
        validation_alias=AliasChoices("interval", "billingInterval"),
    )  # "monthly" | "annual"
    terms_version: str = Field(
        default=DEFAULT_TERMS_VERSION,
        validation_alias=AliasChoices("terms_version", "termsVersion"),
    )

    success_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("successUrl", "success_url"),
    )
    cancel_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("cancelUrl", "cancel_url"),
    )


@router.post("/create-checkout-session")
async def create_checkout_session(body: CreateCheckoutBody, user_id: str = Depends(get_current_user_id)):
    """
    Start Stripe Checkout for new subscribers, or upgrade/change an existing
    subscription in place (prorated) when the customer already has an active plan.
    """
    s = get_settings()
    if not s.stripe_secret_key:
        raise HTTPException(
            status_code=503,
            detail="Billing is not configured. Set STRIPE_SECRET_KEY and Stripe price IDs on the server.",
        )
    stripe.api_key = s.stripe_secret_key

    allowed_plans = {"premium", "realtor"}
    if body.plan_id not in allowed_plans:
        raise HTTPException(status_code=400, detail="Invalid plan.")

    interval = _normalize_interval(body.interval)
    price_id = _price_id_for(body.plan_id, interval, s)
    is_annual = interval == "annual"

    try:
        supabase = get_supabase_admin()
        r = (
            supabase.table("profiles")
            .select("stripe_customer_id, email, plan")
            .eq("id", user_id)
            .execute()
        )
        profile_row = r.data[0] if r.data else {}
        existing_customer_id = profile_row.get("stripe_customer_id") or None
        profile_email = profile_row.get("email") or None
        current_plan = (profile_row.get("plan") or "free").strip().lower()

        base = (s.app_public_url or "http://localhost:5173").rstrip("/")
        terms_version = body.terms_version or DEFAULT_TERMS_VERSION
        billing_label = "yearly" if is_annual else "monthly"
        success_url = same_origin_url(
            body.success_url,
            base,
            f"{base}/Profile?upgraded=1&tab=billing",
        )
        cancel_url = same_origin_url(body.cancel_url, base, f"{base}/Pricing")

        # Existing paid Stripe subscription → change price in place (upgrade / interval change).
        if existing_customer_id:
            active_sub = _find_active_subscription(existing_customer_id)
            if active_sub:
                sub_id = getattr(active_sub, "id", None) or active_sub.get("id")
                item_id = _subscription_item_id(active_sub)
                current_price = _current_price_id(active_sub)
                if not sub_id or not item_id:
                    raise HTTPException(
                        status_code=500,
                        detail="Could not read your current subscription. Open the billing portal or contact support.",
                    )

                if current_price == price_id:
                    # Keep profile aligned with Stripe.
                    supabase.table("profiles").update({"plan": body.plan_id}).eq("id", user_id).execute()
                    return {
                        "url": success_url,
                        "already_on_plan": True,
                        "upgraded": False,
                        "plan": body.plan_id,
                        "message": f"You are already on {body.plan_id.title()}.",
                    }

                previous_plan = (
                    plan_from_subscription_price_ids(
                        {"items": {"data": [{"price": {"id": current_price}}]}},
                        s,
                    )
                    or current_plan
                )

                stripe.Subscription.modify(
                    sub_id,
                    items=[{"id": item_id, "price": price_id}],
                    proration_behavior="create_prorations",
                    metadata={
                        "user_id": user_id,
                        "plan_id": body.plan_id,
                        "interval": interval,
                        "terms_version": terms_version,
                        "previous_plan": previous_plan,
                    },
                )
                supabase.table("profiles").update({"plan": body.plan_id}).eq("id", user_id).execute()

                was_upgrade = PLAN_RANK.get(body.plan_id, 0) >= PLAN_RANK.get(previous_plan, 0)
                logger.info(
                    "Subscription %s changed for user %s: %s → %s (%s)",
                    sub_id,
                    user_id,
                    previous_plan,
                    body.plan_id,
                    interval,
                )
                return {
                    "url": success_url,
                    "already_on_plan": False,
                    "upgraded": was_upgrade,
                    "plan": body.plan_id,
                    "previous_plan": previous_plan,
                    "message": (
                        f"Upgraded to {body.plan_id.title()}."
                        if was_upgrade
                        else f"Switched to {body.plan_id.title()}."
                    ),
                }

        checkout_kwargs: dict = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": user_id,
            "consent_collection": {"terms_of_service": "required"},
            # Lets users enter Stripe promotion codes (e.g. ADMIN = 100% off).
            "allow_promotion_codes": True,
        }
        if existing_customer_id:
            checkout_kwargs["customer"] = existing_customer_id
        elif profile_email:
            checkout_kwargs["customer_email"] = profile_email

        # Terms acceptance is collected on Stripe Checkout (after payment details), not on Pricing.
        # Requires a Terms of Service URL in Stripe Dashboard → Settings → Public business information.
        session = stripe.checkout.Session.create(
            **checkout_kwargs,
            custom_text={
                "terms_of_service_acceptance": {
                    "message": (
                        f"I agree to the [Terms of Service]({base}/Terms) and "
                        f"[Privacy Policy]({base}/Privacy). This is a {billing_label} auto-renewing "
                        "subscription; cancel anytime in Profile/billing."
                    ),
                },
            },
            metadata={
                "user_id": user_id,
                "plan_id": body.plan_id,
                "interval": interval,
                "terms_version": terms_version,
            },
            subscription_data={
                "metadata": {"user_id": user_id, "plan_id": body.plan_id, "interval": interval}
            },
        )
        return {"url": session.url, "upgraded": False, "already_on_plan": False, "plan": body.plan_id}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Stripe checkout / plan change failed")
        raise HTTPException(status_code=500, detail="Stripe checkout failed. Please try again.")


@router.get("/portal")
async def get_portal_url(user_id: str = Depends(get_current_user_id)):
    s = get_settings()
    if not s.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Billing is not configured.")
    stripe.api_key = s.stripe_secret_key
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).execute()
    customer_id = (r.data[0].get("stripe_customer_id") if r.data else None) or None
    if not customer_id:
        return {"url": None}
    try:
        base = (s.app_public_url or "http://localhost:5173").rstrip("/")
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{base}/Profile?tab=billing",
        )
        return {"url": session.url}
    except Exception:
        return {"url": None}
