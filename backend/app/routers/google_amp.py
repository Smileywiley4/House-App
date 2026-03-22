"""Google AMP URL API proxy — authenticated batch AMP lookups."""
from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user_id
from app.google_amp_url import (
    BatchGetAmpUrlsRequest,
    BatchGetAmpUrlsResponse,
    batch_get_amp_urls,
)

router = APIRouter(prefix="/google", tags=["google"])


@router.post("/amp-url/batch-get", response_model=BatchGetAmpUrlsResponse)
async def amp_url_batch_get(
    body: BatchGetAmpUrlsRequest,
    _user_id: str = Depends(get_current_user_id),
):
    """
    Batch-resolve canonical URLs to AMP URLs (ampUrls + urlErrors per Google spec).
    Requires Supabase JWT. API key stays on the server.
    """
    try:
        return await batch_get_amp_urls(body)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
