"""Marketing sync webhook — authenticated profile → Google Sheets."""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user_id, get_supabase_admin, require_platform_admin
from app.google_sheets_marketing import (
    MARKETING_SHEET_HEADERS,
    MARKETING_SHEET_TAB_NAME,
    ensure_marketing_sheet_layout,
    marketing_sheets_configured,
)
from app.routers.auth import _profile_to_user, maybe_sync_marketing_profile

router = APIRouter(prefix="/webhooks/marketing", tags=["marketing"])


@router.post("/setup-sheet")
async def setup_sheet(_admin_id: str = Depends(require_platform_admin)):
    """One-time (or force) sheet prep: headers, formatting, filters, column widths."""
    if not marketing_sheets_configured():
        raise HTTPException(
            status_code=503,
            detail="Google Sheets not configured. Set GOOGLE_MARKETING_SHEET_ID and GOOGLE_SHEETS_SA_JSON.",
        )
    ok = await ensure_marketing_sheet_layout(force=True)
    if not ok:
        raise HTTPException(status_code=502, detail="Could not prepare marketing sheet layout.")
    return {
        "ok": True,
        "tab": MARKETING_SHEET_TAB_NAME,
        "headers": MARKETING_SHEET_HEADERS,
    }


@router.post("/sync-profile")
async def sync_profile(user_id: str = Depends(get_current_user_id)):
    """Internal: sync current user's profile to Google Sheets if marketing_opt_in."""
    supabase = get_supabase_admin()
    r = supabase.table("profiles").select("*").eq("id", user_id).execute()
    row = r.data[0] if r.data else None
    if not row:
        return {"synced": False, "reason": "profile_not_found"}
    row = await maybe_sync_marketing_profile(supabase, row, source="sync-profile")
    synced = bool(row and row.get("marketing_sheet_synced_at"))
    return {"synced": synced, "profile": _profile_to_user(row)}
