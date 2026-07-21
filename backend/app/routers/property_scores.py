"""Property scores CRUD. All scoped to current user."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.dependencies import get_supabase_admin, get_current_user_id

router = APIRouter(prefix="/property_scores", tags=["property_scores"])

FREE_MAX_COMPARE = 2
PAID_MAX_COMPARE = 4


class CreateScoreBody(BaseModel):
    property_address: str
    scores: list[dict] = []
    weighted_total: int = 0
    max_possible: int = 0
    percentage: int = 0
    # When true, soft-enforce plan compare-session caps (browse → compare save).
    compare_session: bool = False
    compare_session_count: int | None = Field(None, ge=1, le=50)


def _row_to_score(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "property_address": row["property_address"],
        "scores": row.get("scores") or [],
        "weighted_total": row.get("weighted_total") or 0,
        "max_possible": row.get("max_possible") or 0,
        "percentage": row.get("percentage") or 0,
        "created_date": row.get("created_at"),
    }


@router.get("")
async def list_scores(user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    r = supabase.table("property_scores").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return [_row_to_score(row) for row in (r.data or [])]


@router.post("")
async def create_score(body: CreateScoreBody, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    if body.compare_session:
        plan_r = supabase.table("profiles").select("plan").eq("id", user_id).execute()
        plan = (plan_r.data[0] if plan_r.data else {}).get("plan") or "free"
        limit = PAID_MAX_COMPARE if plan in ("premium", "realtor", "admin") else FREE_MAX_COMPARE
        count = body.compare_session_count or 1
        if count > limit:
            raise HTTPException(
                status_code=403,
                detail=f"Your plan allows comparing up to {limit} properties.",
            )
    row = {
        "user_id": user_id,
        "property_address": body.property_address,
        "scores": body.scores,
        "weighted_total": body.weighted_total,
        "max_possible": body.max_possible,
        "percentage": body.percentage,
    }
    r = supabase.table("property_scores").insert(row).select().execute()
    if not r.data:
        raise HTTPException(status_code=500, detail="Insert failed")
    return _row_to_score(r.data[0])


@router.delete("/{score_id}")
async def delete_score(score_id: str, user_id: str = Depends(get_current_user_id)):
    supabase = get_supabase_admin()
    supabase.table("property_scores").delete().eq("id", score_id).eq("user_id", user_id).execute()
    return {"ok": True}
