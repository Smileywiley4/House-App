"""
PropertyPulse Python backend — FastAPI.
Runs with: uvicorn app.main:app --reload
Compatible with Cursor, Supabase, Stripe, and standard Python tooling.
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import stripe

from app.config import get_settings
from app.dependencies import get_supabase_admin
from app.routers import auth, property_scores, clients, private_listings, presets, property, llm, subscription


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # shutdown if needed


app = FastAPI(title="PropertyPulse API", version="1.0", lifespan=lifespan)

s = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=s.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(property_scores.router, prefix="/api/entities")
app.include_router(clients.router, prefix="/api/entities")
app.include_router(private_listings.router, prefix="/api/entities")
app.include_router(presets.router, prefix="/api/entities")
app.include_router(property.router, prefix="/api")
app.include_router(llm.router, prefix="/api/integrations")
app.include_router(subscription.router, prefix="/api")


@app.post("/api/webhooks/stripe")
async def stripe_webhook(request: Request):
    """Stripe webhook: subscription created/updated → set profile.plan and stripe_customer_id."""
    s = get_settings()
    if s.stripe_secret_key:
        stripe.api_key = s.stripe_secret_key
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    secret = s.stripe_webhook_secret
    if not secret:
        raise HTTPException(status_code=500, detail="Webhook secret not set")
    try:
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = session.get("client_reference_id") or session.get("subscription_data", {}).get("metadata", {}).get("user_id")
        plan_id = (session.get("subscription_data") or {}).get("metadata", {}).get("plan_id", "premium")
        customer_id = session.get("customer")
        if user_id:
            supabase = get_supabase_admin()
            supabase.table("profiles").update({
                "plan": plan_id,
                "stripe_customer_id": customer_id,
            }).eq("id", user_id).execute()

    if event["type"] == "customer.subscription.deleted":
        sub = event["data"]["object"]
        customer_id = sub.get("customer")
        if customer_id:
            supabase = get_supabase_admin()
            supabase.table("profiles").update({"plan": "free", "stripe_customer_id": None}).eq("stripe_customer_id", customer_id).execute()

    return {"received": True}


@app.get("/health")
def health():
    return {"status": "ok"}
