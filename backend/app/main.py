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
from app.dependencies import get_supabase_admin
from app.routers import auth, property_scores, clients, private_listings, presets, property, llm, subscription, analytics, user_library, invitations, revenue, google_amp, google_workspace_datatransfer, google_adsense, google_adsense_platform, google_analytics_hub, google_android_management, google_chat, google_chrome_webstore, google_data_fusion, google_datamanager, google_doubleclicksearch, google_drive, google_filestore, google_oslogin, google_policyanalyzer, google_policysimulator, google_saasservicemgmt, google_servicenetworking, google_translate


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
app.include_router(property_scores.router, prefix="/api/entities")
app.include_router(clients.router, prefix="/api/entities")
app.include_router(private_listings.router, prefix="/api/entities")
app.include_router(presets.router, prefix="/api/entities")
app.include_router(property.router, prefix="/api")
app.include_router(llm.router, prefix="/api/integrations")
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
app.include_router(invitations.router, prefix="/api")


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
        meta = session.get("metadata") or {}
        user_id = meta.get("user_id") or session.get("client_reference_id") or (session.get("subscription_data", {}) or {}).get("metadata", {}).get("user_id")
        plan_id = meta.get("plan_id") or (session.get("subscription_data") or {}).get("metadata", {}).get("plan_id", "premium")
        # Defensive mapping: only allow expected plan values.
        if plan_id not in ["premium", "realtor"]:
            plan_id = "premium"
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
    from app.llm import active_provider
    s = get_settings()
    return {
        "status": "ok",
        "llm_provider": active_provider(),
        "anthropic_key_set": bool(s.anthropic_api_key),
        "anthropic_key_prefix": s.anthropic_api_key[:12] + "..." if s.anthropic_api_key else None,
        "openai_key_set": bool(s.openai_api_key),
        "openai_key_prefix": s.openai_api_key[:8] + "..." if s.openai_api_key else None,
        "google_places_key_set": bool(s.google_places_api_key),
        "google_amp_url_key_set": bool(s.google_amp_url_api_key or s.google_places_api_key),
        "google_workspace_datatransfer_configured": bool(
            s.google_workspace_sa_json_path.strip()
            and s.google_workspace_delegated_admin_email.strip()
        ),
        "google_adsense_configured": bool(
            s.google_adsense_client_id.strip()
            and s.google_adsense_client_secret.strip()
            and s.google_adsense_refresh_token.strip()
        ),
        "google_doubleclicksearch_configured": bool(
            s.google_doubleclicksearch_client_id.strip()
            and s.google_doubleclicksearch_client_secret.strip()
            and s.google_doubleclicksearch_refresh_token.strip()
        ),
        "google_analytics_hub_configured": bool(s.google_analytics_hub_sa_json_path.strip()),
        "google_android_management_configured": bool(s.google_android_management_sa_json_path.strip()),
        "google_chat_configured": bool(s.google_chat_sa_json_path.strip()),
        "google_chrome_webstore_configured": bool(s.google_chrome_webstore_sa_json_path.strip()),
        "google_data_fusion_configured": bool(s.google_data_fusion_sa_json_path.strip()),
        "google_filestore_configured": bool(s.google_filestore_sa_json_path.strip()),
        "google_oslogin_configured": bool(s.google_oslogin_sa_json_path.strip()),
        "google_translate_configured": bool(s.google_translate_sa_json_path.strip()),
        "google_datamanager_configured": bool(s.google_datamanager_sa_json_path.strip()),
        "google_drive_configured": bool(s.google_drive_sa_json_path.strip()),
        "google_policyanalyzer_configured": bool(s.google_policyanalyzer_sa_json_path.strip()),
        "google_policysimulator_configured": bool(s.google_policysimulator_sa_json_path.strip()),
        "google_saasservicemgmt_configured": bool(s.google_saasservicemgmt_sa_json_path.strip()),
        "google_servicenetworking_configured": bool(s.google_servicenetworking_sa_json_path.strip()),
        "google_cse_id_set": bool(s.google_cse_id),
        "supabase_url_set": bool(s.supabase_url),
        "supabase_service_key_set": bool(s.supabase_service_role_key),
    }
