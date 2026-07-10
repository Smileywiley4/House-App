"""FastAPI dependencies: Supabase client and current user from JWT."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from app.config import get_settings
from app.supabase_client import get_supabase_admin

security = HTTPBearer(auto_error=False)


async def get_current_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if not creds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = creds.credentials
    s = get_settings()
    if not s.supabase_jwt_secret:
        raise HTTPException(status_code=503, detail="Authentication is not configured")
    try:
        payload = jwt.decode(
            token,
            s.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        sub = payload.get("sub")
        if not sub or payload.get("role") != "authenticated":
            raise HTTPException(status_code=401, detail="Invalid token")
        return sub
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


PAID_PLANS = frozenset({"premium", "realtor", "admin"})


async def require_paid_plan(user_id: str = Depends(get_current_user_id)) -> str:
    """Premium / Realtor / Admin — for visit photos, folders, and library features."""
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("plan").eq("id", user_id).execute()
    plan = (r.data[0] if r.data else {}).get("plan") or "free"
    if plan not in PAID_PLANS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This feature requires a Premium or Realtor subscription",
        )
    return user_id


async def require_admin_plan(user_id: str = Depends(get_current_user_id)) -> str:
    """Google Workspace / enterprise API proxies — plan `admin` or PLATFORM_ADMIN_USER_IDS."""
    s = get_settings()
    if user_id in s.platform_admin_id_set:
        return user_id
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("plan").eq("id", user_id).execute()
    plan = (r.data[0] if r.data else {}).get("plan") or "free"
    if plan != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin plan required for Google Workspace admin API proxy",
        )
    return user_id


async def require_platform_admin(user_id: str = Depends(get_current_user_id)) -> str:
    """
    Publisher tools (AdSense revenue snapshots, etc.): `profiles.plan = admin`,
    or UUID listed in PLATFORM_ADMIN_USER_IDS (comma-separated).
    """
    s = get_settings()
    if user_id in s.platform_admin_id_set:
        return user_id
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("plan").eq("id", user_id).execute()
    plan = (r.data[0] if r.data else {}).get("plan") or "free"
    if plan != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin required (set profiles.plan=admin or PLATFORM_ADMIN_USER_IDS)",
        )
    return user_id


async def require_realtor_plan(user_id: str = Depends(get_current_user_id)) -> str:
    """Realtor tier (or admin) — for inbox of shared visits."""
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("plan").eq("id", user_id).execute()
    plan = (r.data[0] if r.data else {}).get("plan") or "free"
    if plan not in ("realtor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Realtor subscription required to view shared visits",
        )
    return user_id


async def get_optional_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> str | None:
    if not creds:
        return None
    token = creds.credentials
    s = get_settings()
    if not s.supabase_jwt_secret:
        return None
    try:
        payload = jwt.decode(
            token,
            s.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload.get("sub") if payload.get("role") == "authenticated" else None
    except JWTError:
        return None


def user_has_paid_plan(supabase, user_id: str) -> bool:
    r = supabase.table("profiles").select("plan").eq("id", user_id).execute()
    plan = (r.data[0] if r.data else {}).get("plan") or "free"
    return plan in PAID_PLANS


LLM_DAILY_LIMIT = 80


async def require_paid_llm_access(user_id: str = Depends(require_paid_plan)) -> str:
    """Paid subscribers only; enforces daily LLM rate limit."""
    supabase = get_supabase_admin()
    from datetime import datetime, timezone, timedelta

    since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    r = (
        supabase.table("llm_usage_log")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .gte("created_at", since)
        .execute()
    )
    count = r.count if r.count is not None else len(r.data or [])
    if count >= LLM_DAILY_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Daily AI usage limit reached. Try again tomorrow or contact support.",
        )
    return user_id


def log_llm_usage(supabase, user_id: str, feature: str) -> None:
    try:
        supabase.table("llm_usage_log").insert({"user_id": user_id, "feature": feature}).execute()
    except Exception:
        pass
