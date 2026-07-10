"""LLM proxy: invoke with prompt + optional JSON schema. Premium subscribers only."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_supabase_admin, require_paid_llm_access, log_llm_usage
from app.llm import has_llm_provider, invoke_llm

router = APIRouter(prefix="/llm", tags=["llm"])


class InvokeBody(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=12_000)
    response_json_schema: dict | None = None
    feature: str = Field(default="invoke", min_length=1, max_length=100)


@router.post("/invoke")
async def invoke(body: InvokeBody, user_id: str = Depends(require_paid_llm_access)):
    if not has_llm_provider():
        raise HTTPException(status_code=503, detail="AI service is not configured")
    supabase = get_supabase_admin()
    log_llm_usage(supabase, user_id, body.feature or "invoke")
    result = await invoke_llm(body.prompt, body.response_json_schema, feature=body.feature)
    if result is None:
        raise HTTPException(status_code=502, detail="AI service did not return a usable response")
    return result
