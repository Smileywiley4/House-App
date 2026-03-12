"""Property scores CRUD. All scoped to current user."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.dependencies import get_supabase_admin, get_current_user_id

router = APIRouter(prefix="/property_scores", tags=["property_scores"])


class CreateScoreBody(BaseModel):
    property_address: str
    scores: list[dict] = []
    weighted_total: int = 0
    max_possible: int = 0
    percentage: int = 0


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
