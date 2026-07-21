"""Load settings from environment. Compatible with Cursor, Supabase, and standard Python tooling."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    # Backward-compatible single price IDs (treated as monthly if the interval-specific IDs are not set)
    stripe_premium_price_id: str = ""
    stripe_realtor_price_id: str = ""

    # Recommended interval-specific Price IDs
    stripe_premium_monthly_price_id: str = ""
    stripe_premium_annual_price_id: str = ""
    stripe_realtor_monthly_price_id: str = ""
    stripe_realtor_annual_price_id: str = ""
    # RevenueCat webhook + entitlement sync (iOS IAP)
    revenuecat_webhook_secret: str = ""
    revenuecat_premium_entitlement_id: str = "Propurty Pro"
    revenuecat_realtor_entitlement_id: str = "realtor"
    openai_api_key: str = ""
    # OpenAI fallback / economy tier — gpt-4o-mini is cost-effective for structured JSON tasks
    openai_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    # Messages API model id — see https://docs.anthropic.com/en/docs/about-claude/models
    anthropic_model: str = "claude-sonnet-4-20250514"
    # Prompt caching (https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
    anthropic_prompt_cache_ephemeral: bool = True
    google_places_api_key: str = ""
    # Optional separate server-side key for the Street View Static API.
    # Falls back to google_places_api_key when omitted.
    google_street_view_api_key: str = ""
    # Optional: dedicated key for AMP URL API; if empty, GOOGLE_PLACES_API_KEY is used (same GCP project must enable AMP URL API).
    google_amp_url_api_key: str = ""
    google_cse_id: str = ""
    rentcast_api_key: str = ""
    rentcast_base_url: str = "https://api.rentcast.io/v1"
    # Google Sheets — marketing signup CRM (service account JSON string + spreadsheet id)
    google_marketing_sheet_id: str = ""
    google_sheets_sa_json: str = ""
    # Google Workspace Admin SDK — Data Transfer API (OAuth service account + domain-wide delegation)
    google_workspace_sa_json_path: str = ""
    google_workspace_delegated_admin_email: str = ""
    google_workspace_customer_id: str = ""
    # readonly | readwrite — maps to admin.datatransfer.readonly vs admin.datatransfer
    google_workspace_datatransfer_access: str = "readonly"
    # Google AdSense Management API v2 — OAuth refresh token for the publisher Google account
    google_adsense_client_id: str = ""
    google_adsense_client_secret: str = ""
    google_adsense_refresh_token: str = ""
    # readonly -> adsense.readonly; readwrite -> adsense (full)
    google_adsense_access: str = "readonly"
    # Optional AdSense publisher account for revenue snapshots (pub-… or accounts/pub-…). If empty, first account from API is used.
    google_adsense_publisher_account: str = ""
    # Google DoubleClick Search API v2 (Search Ads 360) — OAuth refresh token; scope doubleclicksearch
    google_doubleclicksearch_client_id: str = ""
    google_doubleclicksearch_client_secret: str = ""
    google_doubleclicksearch_refresh_token: str = ""
    # Optional host only (no path); default https://www.googleapis.com
    google_doubleclicksearch_base_url: str = ""
    # Google Analytics Hub API v1 — service account JSON (no domain delegation)
    google_analytics_hub_sa_json_path: str = ""
    # readonly -> bigquery.readonly; readwrite -> bigquery; cloud_platform -> cloud-platform
    google_analytics_hub_access: str = "readwrite"
    # Google Android Management API v1 — service account JSON (https://developers.google.com/android/management)
    google_android_management_sa_json_path: str = ""
    # Google Chat API v1 — service account; optional impersonation + comma-separated OAuth scopes
    google_chat_sa_json_path: str = ""
    google_chat_impersonate_email: str = ""
    # Default (empty) -> chat.bot only; set e.g. https://www.googleapis.com/auth/chat.spaces,https://www.googleapis.com/auth/chat.messages
    google_chat_scopes: str = ""
    # Chrome Web Store API v2 — service account (https://developer.chrome.com/docs/webstore/api)
    google_chrome_webstore_sa_json_path: str = ""
    # readonly (chromewebstore.readonly) | readwrite (chromewebstore; required for publish/upload/cancel/deploy)
    google_chrome_webstore_access: str = "readwrite"
    # Google Cloud Data Fusion API v1 — service account (cloud-platform scope)
    google_data_fusion_sa_json_path: str = ""
    # Optional: regional host e.g. https://datafusion.us-central1.rep.googleapis.com (default: global datafusion.googleapis.com)
    google_data_fusion_base_url: str = ""
    # Google Cloud Filestore API v1 — service account (cloud-platform scope)
    google_filestore_sa_json_path: str = ""
    google_filestore_base_url: str = ""
    # Google Cloud OS Login API v1 — service account (cloud-platform)
    google_oslogin_sa_json_path: str = ""
    google_oslogin_base_url: str = ""
    # Google Cloud Translation API v3 — service account (cloud-platform)
    google_translate_sa_json_path: str = ""
    google_translate_base_url: str = ""
    # Google Data Manager API v1 — service account (https://www.googleapis.com/auth/datamanager)
    google_datamanager_sa_json_path: str = ""
    google_datamanager_base_url: str = ""
    # Google Drive API v3 — service account; optional Workspace impersonation (domain-wide delegation)
    google_drive_sa_json_path: str = ""
    google_drive_impersonate_email: str = ""
    # Comma-separated OAuth scopes (default: https://www.googleapis.com/auth/drive)
    google_drive_scopes: str = ""
    google_drive_base_url: str = ""
    # Google Policy Analyzer API v1 — service account (cloud-platform)
    google_policyanalyzer_sa_json_path: str = ""
    google_policyanalyzer_base_url: str = ""
    # Google Policy Simulator API v1 — service account (cloud-platform)
    google_policysimulator_sa_json_path: str = ""
    google_policysimulator_base_url: str = ""
    # Google SaaS Runtime API v1 (saasservicemgmt) — service account (cloud-platform)
    google_saasservicemgmt_sa_json_path: str = ""
    google_saasservicemgmt_base_url: str = ""
    # Google Service Networking API v1 — service account (cloud-platform)
    google_servicenetworking_sa_json_path: str = ""
    google_servicenetworking_base_url: str = ""
    cors_origins: str = "http://localhost:5173"
    # Public web app URL for invite links (e.g. https://app.example.com)
    app_public_url: str = "http://localhost:5173"  # TODO(rebrand): final domain TBD; prod fallback house-app-rho.vercel.app
    # Shared secret for GitHub Actions / cron → POST /api/cron/rentcast-daily-refresh
    cron_secret: str = ""
    # Comma-separated Supabase user UUIDs allowed to run publisher revenue sync etc. (in addition to profiles.plan=admin)
    platform_admin_user_ids: str = ""
    admin_user_ids: str = ""
    port: int = 8000

    @property
    def platform_admin_id_set(self) -> frozenset[str]:
        return frozenset(x.strip() for x in f"{self.platform_admin_user_ids},{self.admin_user_ids}".split(",") if x.strip())

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_list(self) -> list[str]:
        origins = [o.strip().rstrip("/") for o in self.cors_origins.split(",") if o.strip()]
        trusted_origins = {
            self.app_public_url.strip().rstrip("/"),
            "https://house-app-rho.vercel.app",
        }
        origins.extend(origin for origin in trusted_origins if origin and origin not in origins)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
