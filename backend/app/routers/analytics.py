"""Analytics: track custom category usage for product insights."""
import logging
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, Field, field_validator
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


class MobileDeviceSnapshotBody(BaseModel):
    """Anonymous Expo / mobile device-class row for aggregate stats (opt-in from client)."""

    platform: str | None = Field(None, max_length=32)
    os_name: str | None = Field(None, max_length=64)
    os_version: str | None = Field(None, max_length=64)
    manufacturer: str | None = Field(None, max_length=128)
    brand: str | None = Field(None, max_length=128)
    model_name: str | None = Field(None, max_length=128)
    model_id: str | None = Field(None, max_length=128)
    device_type: int | None = None
    is_physical_device: bool | None = None
    design_name: str | None = Field(None, max_length=128)
    product_name: str | None = Field(None, max_length=128)
    total_memory_bytes: int | None = Field(None, ge=0, le=2**50)
    device_year_class: int | None = None
    app_version: str | None = Field(None, max_length=64)
    app_build: str | None = Field(None, max_length=64)
    expo_runtime: str | None = Field(None, max_length=64)
    client_timestamp: datetime | None = None

    @field_validator(
        "platform",
        "os_name",
        "os_version",
        "manufacturer",
        "brand",
        "model_name",
        "model_id",
        "design_name",
        "product_name",
        "app_version",
        "app_build",
        "expo_runtime",
        mode="before",
    )
    @classmethod
    def coerce_optional_str(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            return v
        return str(v)

    @field_validator("device_type", "device_year_class", "total_memory_bytes", mode="before")
    @classmethod
    def coerce_optional_int(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, bool):
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, float):
            return int(round(v))
        try:
            return int(v)
        except (TypeError, ValueError):
            return None


@router.post("/mobile-device-snapshot")
async def mobile_device_snapshot(body: MobileDeviceSnapshotBody):
    """Insert one opt-in device snapshot row (no auth; rate-limit at edge in production if needed)."""
    row = {
        "platform": body.platform,
        "os_name": body.os_name,
        "os_version": body.os_version,
        "manufacturer": body.manufacturer,
        "brand": body.brand,
        "model_name": body.model_name,
        "model_id": body.model_id,
        "device_type": body.device_type,
        "is_physical_device": body.is_physical_device,
        "design_name": body.design_name,
        "product_name": body.product_name,
        "total_memory_bytes": body.total_memory_bytes,
        "device_year_class": body.device_year_class,
        "app_version": body.app_version,
        "app_build": body.app_build,
        "expo_runtime": body.expo_runtime,
        "client_timestamp": body.client_timestamp.isoformat()
        if body.client_timestamp
        else None,
        "source": "expo_mobile",
    }
    try:
        supabase = get_supabase_admin()
        supabase.table("mobile_device_snapshots").insert(row).execute()
    except Exception as e:
        logger.error("Failed to insert mobile_device_snapshots: %s", e)
        return {"ok": False}
    return {"ok": True}
