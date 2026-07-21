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
from app.dependencies import get_supabase_admin
from app.routers import auth, property_scores, clients, private_listings, presets, property, llm, subscription, analytics, user_library, invitations, realtor_assignments, revenue, preferences, google_amp, google_workspace_datatransfer, google_adsense, google_adsense_platform, google_analytics_hub, google_android_management, google_chat, google_chrome_webstore, google_data_fusion, google_datamanager, google_doubleclicksearch, google_drive, google_filestore, google_oslogin, google_policyanalyzer, google_policysimulator, google_saasservicemgmt, google_servicenetworking, google_translate, revenuecat_webhook, marketing, promo, cron, notifications, projects, geo


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
app.include_router(invitations.router, prefix="/api")
app.include_router(realtor_assignments.router, prefix="/api")
app.include_router(revenuecat_webhook.router, prefix="/api")


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
            supabase.table("profiles").update({
                "plan": plan_id,
                "stripe_customer_id": customer_id,
            }).eq("id", user_id).execute()

    if event["type"] == "customer.subscription.updated":
        sub = event["data"]["object"]
        customer_id = stripe_customer_id(sub.get("customer"))
        sub_status = (sub.get("status") or "").lower()
        if customer_id and sub_status in ("active", "trialing", "past_due"):
            plan_id = plan_from_subscription_price_ids(sub, s)
            if plan_id:
                supabase = get_supabase_admin()
                supabase.table("profiles").update({"plan": plan_id}).eq("stripe_customer_id", customer_id).execute()
        elif customer_id:
            # A subscription can become incomplete, unpaid, or incomplete_expired
            # without emitting customer.subscription.deleted. Do not retain paid
            # access after Stripe has made it non-entitled.
            supabase = get_supabase_admin()
            supabase.table("profiles").update({"plan": "free"}).eq("stripe_customer_id", customer_id).execute()

    if event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = stripe_customer_id(sub.get("customer"))
        if customer_id:
            supabase = get_supabase_admin()
            supabase.table("profiles").update({"plan": "free", "stripe_customer_id": None}).eq("stripe_customer_id", customer_id).execute()

    return {"received": True}


@app.get("/health")
def health():
    """Public liveness probe; operational configuration stays private."""
    return {"status": "ok"}
