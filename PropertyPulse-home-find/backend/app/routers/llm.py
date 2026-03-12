"""LLM proxy: invoke with prompt + optional JSON schema. Used by AI features in frontend."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.dependencies import get_current_user_id
from app.llm import invoke_llm

router = APIRouter(prefix="/llm", tags=["llm"])


class InvokeBody(BaseModel):
    prompt: str
    response_json_schema: dict | None = None


@router.post("/invoke")
async def invoke(body: InvokeBody, user_id: str = Depends(get_current_user_id)):
    result = await invoke_llm(body.prompt, body.response_json_schema)
    return result or {}
