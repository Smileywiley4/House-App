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
        raise HTTPException(status_code=500, detail="JWT secret not configured")
    try:
        payload = jwt.decode(
            token,
            s.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        sub = payload.get("sub")
        if not sub:
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
