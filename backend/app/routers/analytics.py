"""Analytics: track custom category usage for product insights."""
import logging
from fastapi import APIRouter
from pydantic import BaseModel
from app.dependencies import get_supabase_admin

router = APIRouter(prefix="/analytics", tags=["analytics"])
logger = logging.getLogger(__name__)


class CustomCategoryBody(BaseModel):
    label: str


@router.post("/custom-category")
async def track_custom_category(body: CustomCategoryBody):
    label = (body.label or "").strip()
    if not label or len(label) > 200:
        return {"ok": False}
    normalized = label.lower()
    try:
        supabase = get_supabase_admin()
        existing = (
            supabase.table("custom_categories")
            .select("id, use_count")
            .eq("normalized_label", normalized)
            .limit(1)
            .execute()
        )
        if existing.data and len(existing.data) > 0:
            row = existing.data[0]
            supabase.table("custom_categories").update(
                {"use_count": row["use_count"] + 1}
            ).eq("id", row["id"]).execute()
        else:
            supabase.table("custom_categories").insert({
                "label": label,
                "normalized_label": normalized,
                "use_count": 1,
            }).execute()
    except Exception as e:
        logger.error("Failed to track custom category: %s", e)
    return {"ok": True}
