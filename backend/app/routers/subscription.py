"""Stripe checkout and portal. Webhook updates profile.plan (see main.py)."""
import logging
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field, ConfigDict
import stripe
from app.config import get_settings
from app.dependencies import get_supabase_admin, get_current_user_id

router = APIRouter(prefix="/subscription", tags=["subscription"])
logger = logging.getLogger(__name__)


class CreateCheckoutBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    plan_id: str = Field(alias="planId")
    interval: str = "monthly"  # "monthly" | "annual"
    terms_accepted: bool = False
    terms_version: str = "default"

    success_url: str | None = Field(default=None, alias="successUrl")
    cancel_url: str | None = Field(default=None, alias="cancelUrl")


@router.post("/create-checkout-session")
async def create_checkout_session(body: CreateCheckoutBody, user_id: str = Depends(get_current_user_id)):
    s = get_settings()
    if not s.stripe_secret_key:
        return {"url": None}
    stripe.api_key = s.stripe_secret_key
    if not body.terms_accepted:
        raise HTTPException(status_code=400, detail="You must accept the Terms & Conditions to continue.")

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
        raise HTTPException(status_code=500, detail="Stripe price id is not configured for this plan/interval.")
    try:
        supabase = get_supabase_admin()
        r = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).execute()
        existing_customer_id = (r.data[0].get("stripe_customer_id") if r.data else None) or None

        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=body.success_url or "http://localhost:5173/Profile",
            cancel_url=body.cancel_url or "http://localhost:5173/Pricing",
            client_reference_id=user_id,
            customer=existing_customer_id,
            metadata={
                "user_id": user_id,
                "plan_id": body.plan_id,
                "interval": interval,
                "terms_version": body.terms_version,
                "terms_accepted": str(bool(body.terms_accepted)).lower(),
            },
            subscription_data={"metadata": {"user_id": user_id, "plan_id": body.plan_id, "interval": interval}},
        )
        return {"url": session.url}
    except Exception as e:
        logger.exception("Stripe checkout failed")
        raise HTTPException(status_code=500, detail="Stripe checkout failed. Please try again.")


@router.get("/portal")
async def get_portal_url(user_id: str = Depends(get_current_user_id)):
    s = get_settings()
    if not s.stripe_secret_key:
        return {"url": None}
    stripe.api_key = s.stripe_secret_key
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).execute()
    customer_id = (r.data[0].get("stripe_customer_id") if r.data else None) or None
    if not customer_id:
        return {"url": None}
    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url="http://localhost:5173/Profile",
        )
        return {"url": session.url}
    except Exception:
        return {"url": None}
