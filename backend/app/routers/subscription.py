"""Stripe checkout and portal. Webhook updates profile.plan (see main.py)."""
import logging
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException
from pydantic import AliasChoices, BaseModel, Field, ConfigDict
import stripe
from app.config import get_settings
from app.dependencies import get_supabase_admin, get_current_user_id

router = APIRouter(prefix="/subscription", tags=["subscription"])
logger = logging.getLogger(__name__)

DEFAULT_TERMS_VERSION = "2026-07"

def same_origin_url(candidate: str | None, base: str, fallback: str) -> str:
    """Accept client return URLs only when they stay on the configured web origin."""
    if not candidate:
        return fallback
    parsed = urlparse(candidate)
    if parsed.scheme in {"http", "https"} and parsed.netloc == urlparse(base).netloc:
        return candidate
    raise HTTPException(status_code=400, detail="Checkout return URLs must use the application origin.")


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

    interval_raw = (body.interval or "monthly").lower()
    allowed_intervals = {"monthly", "annual", "yearly", "year"}
    if interval_raw not in allowed_intervals:
        raise HTTPException(status_code=400, detail="Invalid billing interval.")
    interval = "annual" if interval_raw in {"annual", "yearly", "year"} else "monthly"
    is_annual = interval == "annual"

    # Choose the right recurring Price ID (fall back to legacy single Price ID if interval-specific IDs are not set)
    if body.plan_id == "realtor":
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
    try:
        supabase = get_supabase_admin()
        r = supabase.table("profiles").select("stripe_customer_id, email").eq("id", user_id).execute()
        profile_row = r.data[0] if r.data else {}
        existing_customer_id = profile_row.get("stripe_customer_id") or None
        profile_email = profile_row.get("email") or None

        base = (s.app_public_url or "http://localhost:5173").rstrip("/")
        terms_version = body.terms_version or DEFAULT_TERMS_VERSION
        billing_label = "yearly" if is_annual else "monthly"
        success_url = same_origin_url(
            body.success_url,
            base,
            f"{base}/Profile?upgraded=1&tab=billing",
        )
        cancel_url = same_origin_url(body.cancel_url, base, f"{base}/Pricing")

        checkout_kwargs: dict = {
            "mode": "subscription",
            "line_items": [{"price": price_id, "quantity": 1}],
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": user_id,
            "consent_collection": {"terms_of_service": "required"},
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
                        f"[Privacy Policy]({base}/Privacy), and authorize {billing_label} recurring billing "
                        "for this subscription until I cancel."
                    ),
                },
            },
            metadata={
                "user_id": user_id,
                "plan_id": body.plan_id,
                "interval": interval,
                "terms_version": terms_version,
            },
            subscription_data={"metadata": {"user_id": user_id, "plan_id": body.plan_id, "interval": interval}},
        )
        return {"url": session.url}
    except Exception:
        logger.exception("Stripe checkout failed")
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
            return_url=f"{base}/Profile",
        )
        return {"url": session.url}
    except Exception:
        return {"url": None}
