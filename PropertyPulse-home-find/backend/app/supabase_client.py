"""Shared Supabase client (service role) for backend operations."""
from app.config import get_settings
from supabase import create_client, Client


_client: Client | None = None


def get_supabase_admin() -> Client:
    global _client
    if _client is None:
        s = get_settings()
        if not s.supabase_url or not s.supabase_service_role_key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required")
        _client = create_client(s.supabase_url, s.supabase_service_role_key)
    return _client
