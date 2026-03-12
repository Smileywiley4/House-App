"""Stripe checkout and portal. Webhook updates profile.plan (see main.py)."""
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel
import stripe
from app.config import get_settings
from app.dependencies import get_supabase_admin, get_current_user_id

router = APIRouter(prefix="/subscription", tags=["subscription"])


class CreateCheckoutBody(BaseModel):
    plan_id: str
    success_url: str | None = None
    cancel_url: str | None = None


@router.post("/create-checkout-session")
async def create_checkout_session(body: CreateCheckoutBody, user_id: str = Depends(get_current_user_id)):
    s = get_settings()
    if not s.stripe_secret_key or not s.stripe_premium_price_id:
        return {"url": None}
    stripe.api_key = s.stripe_secret_key
    price_id = s.stripe_realtor_price_id if body.plan_id == "realtor" else s.stripe_premium_price_id
    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=body.success_url or "http://localhost:5173/Profile",
            cancel_url=body.cancel_url or "http://localhost:5173/Pricing",
            client_reference_id=user_id,
            subscription_data={"metadata": {"user_id": user_id, "plan_id": body.plan_id}},
        )
        return {"url": session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
