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
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_places_api_key: str = ""
    google_cse_id: str = ""
    cors_origins: str = "http://localhost:5173"
    # Public web app URL for invite links (e.g. https://app.example.com)
    app_public_url: str = "http://localhost:5173"
    port: int = 8000

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
