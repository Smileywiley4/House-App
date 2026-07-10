"""LLM proxy: invoke with prompt + optional JSON schema. Premium subscribers only."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import get_supabase_admin, require_paid_llm_access, log_llm_usage
from app.llm import invoke_llm

router = APIRouter(prefix="/llm", tags=["llm"])


class InvokeBody(BaseModel):
    prompt: str
    response_json_schema: dict | None = None
    feature: str = "invoke"


@router.post("/invoke")
async def invoke(body: InvokeBody, user_id: str = Depends(require_paid_llm_access)):
    supabase = get_supabase_admin()
    log_llm_usage(supabase, user_id, body.feature or "invoke")
    result = await invoke_llm(body.prompt, body.response_json_schema, feature=body.feature)
    return result or {}
