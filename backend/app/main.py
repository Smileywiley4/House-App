"""
PropertyPulse Python backend — FastAPI.
Runs with: uvicorn app.main:app --reload
Compatible with Cursor, Supabase, Stripe, and standard Python tooling.
"""
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import stripe

from app.config import get_settings
from app.stripe_billing import plan_from_subscription_price_ids, stripe_customer_id
from app.referral_credits import (
    forfeit_unused_referral_balance_on_cancel,
    handle_paid_subscription_for_referrals,
)
from app.dependencies import get_supabase_admin
from app.routers import auth, property_scores, clients, private_listings, presets, property, llm, subscription, analytics, user_library, invitations, realtor_assignments, revenue, preferences, google_amp, google_workspace_datatransfer, google_adsense, google_adsense_platform, google_analytics_hub, google_android_management, google_chat, google_chrome_webstore, google_data_fusion, google_datamanager, google_doubleclicksearch, google_drive, google_filestore, google_oslogin, google_policyanalyzer, google_policysimulator, google_saasservicemgmt, google_servicenetworking, google_translate, revenuecat_webhook, marketing, promo, cron, notifications, projects, geo, contacts, property_shares, referrals, preference_cards


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="PropertyPulse API", version="1.0", lifespan=lifespan)

s = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=s.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})

app.include_router(auth.router, prefix="/api")
app.include_router(marketing.router, prefix="/api")
app.include_router(promo.router, prefix="/api")
app.include_router(cron.router, prefix="/api")
app.include_router(property_scores.router, prefix="/api/entities")
app.include_router(clients.router, prefix="/api/entities")
app.include_router(private_listings.router, prefix="/api/entities")
app.include_router(presets.router, prefix="/api/entities")
app.include_router(property.router, prefix="/api")
app.include_router(geo.router, prefix="/api")
app.include_router(llm.router, prefix="/api/integrations")
app.include_router(preferences.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(google_amp.router, prefix="/api/integrations")
app.include_router(google_workspace_datatransfer.router, prefix="/api/integrations")
app.include_router(google_adsense.router, prefix="/api/integrations")
app.include_router(google_adsense_platform.router, prefix="/api/integrations")
app.include_router(google_analytics_hub.router, prefix="/api/integrations")
app.include_router(google_android_management.router, prefix="/api/integrations")
app.include_router(google_chat.router, prefix="/api/integrations")
app.include_router(google_chrome_webstore.router, prefix="/api/integrations")
app.include_router(google_data_fusion.router, prefix="/api/integrations")
app.include_router(google_datamanager.router, prefix="/api/integrations")
app.include_router(google_doubleclicksearch.router, prefix="/api/integrations")
app.include_router(google_drive.router, prefix="/api/integrations")
app.include_router(google_policyanalyzer.router, prefix="/api/integrations")
app.include_router(google_policysimulator.router, prefix="/api/integrations")
app.include_router(google_saasservicemgmt.router, prefix="/api/integrations")
app.include_router(google_servicenetworking.router, prefix="/api/integrations")
app.include_router(google_filestore.router, prefix="/api/integrations")
app.include_router(google_oslogin.router, prefix="/api/integrations")
app.include_router(google_translate.router, prefix="/api/integrations")
app.include_router(revenue.router, prefix="/api/integrations")
app.include_router(subscription.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(user_library.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(contacts.router, prefix="/api")
app.include_router(property_shares.router, prefix="/api")
app.include_router(invitations.router, prefix="/api")
app.include_router(referrals.router, prefix="/api")
app.include_router(preference_cards.router, prefix="/api")
app.include_router(realtor_assignments.router, prefix="/api")
app.include_router(revenuecat_webhook.router, prefix="/api")


def _profile_has_admin_comp(supabase, *, user_id: str | None = None, customer_id: str | None = None) -> bool:
    """True when the profile was granted perpetual testing access (e.g. ADMIN)."""
    try:
        q = supabase.table("profiles").select("admin_comp")
        if user_id:
            q = q.eq("id", user_id)
        elif customer_id:
            q = q.eq("stripe_customer_id", customer_id)
        else:
            return False
        row = (q.limit(1).execute().data or [None])[0]
        return bool(row and row.get("admin_comp"))
    except Exception:
        return False


def _checkout_is_forever_full_comp(session: dict) -> bool:
    """Detect Stripe ADMIN-style forever 100% off on a completed Checkout session."""
    try:
        discounts = session.get("discounts") or []
        for entry in discounts:
            coupon = None
            if isinstance(entry, dict):
                coupon = entry.get("coupon")
                if isinstance(coupon, str) and coupon:
                    try:
                        coupon = stripe.Coupon.retrieve(coupon)
                    except Exception:
                        coupon = None
            if coupon is None:
                continue
            if not isinstance(coupon, dict):
                coupon = {
                    "percent_off": getattr(coupon, "percent_off", None),
                    "duration": getattr(coupon, "duration", None),
                    "id": getattr(coupon, "id", None),
                }
            percent = coupon.get("percent_off")
            duration = (coupon.get("duration") or "").lower()
            coupon_id = (coupon.get("id") or "").lower()
            if coupon_id == "admin_100_off":
                return True
            if percent is not None and float(percent) >= 100 and duration == "forever":
                return True
        # $0 Checkout with a discount present (promotion code applied) → perpetual testing comp.
        if session.get("amount_total") == 0 and discounts:
            return True
        meta = session.get("metadata") or {}
        if str(meta.get("promo_code") or "").strip().upper() == "ADMIN":
            return True
    except Exception:
        return False
    return False


@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Stripe webhook: subscription created/updated → set profile.plan and stripe_customer_id."""
    s = get_settings()
    if not s.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe billing is not configured")
    stripe.api_key = s.stripe_secret_key
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    secret = s.stripe_webhook_secret
    if not secret:
        raise HTTPException(status_code=503, detail="Stripe webhook is not configured")
    try:
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        meta = session.get("metadata") or {}
        user_id = meta.get("user_id") or session.get("client_reference_id") or (session.get("subscription_data", {}) or {}).get("metadata", {}).get("user_id")
        plan_id = meta.get("plan_id") or (session.get("subscription_data") or {}).get("metadata", {}).get("plan_id", "premium")
        # Defensive mapping: only allow expected plan values.
        if plan_id not in ["premium", "realtor"]:
            plan_id = "premium"
        customer_id = stripe_customer_id(session.get("customer"))
        if user_id:
            supabase = get_supabase_admin()
            updates = {
                "plan": plan_id,
                "stripe_customer_id": customer_id,
            }
            if _checkout_is_forever_full_comp(session):
                updates["admin_comp"] = True
                updates["promo_code"] = "ADMIN"
            try:
                supabase.table("profiles").update(updates).eq("id", user_id).execute()
            except Exception:
                updates.pop("admin_comp", None)
                updates.pop("promo_code", None)
                supabase.table("profiles").update(updates).eq("id", user_id).execute()
            handle_paid_subscription_for_referrals(
                supabase,
                user_id=user_id,
                plan_id=plan_id,
                customer_id=customer_id,
            )

    if event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        customer_id = stripe_customer_id(sub.get("customer"))
        sub_status = (sub.get("status") or "").lower()
        if customer_id and sub_status in ("active", "trialing", "past_due"):
            plan_id = plan_from_subscription_price_ids(sub, s)
            if plan_id:
                supabase = get_supabase_admin()
                supabase.table("profiles").update({"plan": plan_id}).eq("stripe_customer_id", customer_id).execute()
                meta = sub.get("metadata") or {}
                handle_paid_subscription_for_referrals(
                    supabase,
                    user_id=meta.get("user_id"),
                    plan_id=plan_id,
                    customer_id=customer_id,
                )
        elif customer_id:
            # A subscription can become incomplete, unpaid, or incomplete_expired
            # without emitting customer.subscription.deleted. Do not retain paid
            # access after Stripe has made it non-entitled — unless admin_comp.
            supabase = get_supabase_admin()
            if _profile_has_admin_comp(supabase, customer_id=customer_id):
                return {"received": True, "admin_comp_preserved": True}
            forfeit_unused_referral_balance_on_cancel(supabase, customer_id)
            supabase.table("profiles").update({"plan": "free"}).eq("stripe_customer_id", customer_id).execute()

    if event["type"] == "invoice.paid":
        # First paid invoice / renewals: apply referral credit if checkout race missed it.
        invoice = event["data"]["object"]
        customer_id = stripe_customer_id(invoice.get("customer"))
        billing_reason = (invoice.get("billing_reason") or "").lower()
        if customer_id and billing_reason in ("subscription_create", "subscription_update", ""):
            supabase = get_supabase_admin()
            handle_paid_subscription_for_referrals(
                supabase,
                user_id=None,
                plan_id=None,
                customer_id=customer_id,
            )

    if event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = stripe_customer_id(sub.get("customer"))
        if customer_id:
            supabase = get_supabase_admin()
            if _profile_has_admin_comp(supabase, customer_id=customer_id):
                # Keep perpetual testing plan; clear Stripe link only.
                supabase.table("profiles").update({"stripe_customer_id": None}).eq(
                    "stripe_customer_id", customer_id
                ).execute()
                return {"received": True, "admin_comp_preserved": True}
            forfeit_unused_referral_balance_on_cancel(supabase, customer_id)
            supabase.table("profiles").update({"plan": "free", "stripe_customer_id": None}).eq("stripe_customer_id", customer_id).execute()

    return {"received": True}


@app.get("/health")
def health():
    """Public liveness probe; operational configuration stays private."""
    return {"status": "ok"}
