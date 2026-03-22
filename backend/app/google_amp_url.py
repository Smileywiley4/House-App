"""
Google AMP URL API — batch map canonical URLs to AMP equivalents.

REST: POST https://ampurl.googleapis.com/v1/url:batchGet?key=...

Request (BatchGetAmpUrlsRequest):
  - urls: list[str]
  - lookupStrategy: FETCH_LIVE_DOC | IN_INDEX_DOC | LOOKUP_STRATEGY_UNSPECIFIED

Response (BatchGetAmpUrlsResponse):
  - ampUrls: list[AmpUrl]
  - urlErrors: list[AmpUrlError]

Enable "AMP URL API" in Google Cloud Console for the API key's project.
"""
from __future__ import annotations

import logging
from enum import Enum
from typing import Any

import httpx
from pydantic import BaseModel, Field
from app.config import get_settings

logger = logging.getLogger(__name__)

AMP_URL_BATCH_GET = "https://ampurl.googleapis.com/v1/url:batchGet"
MAX_URLS_PER_REQUEST = 50


class LookupStrategy(str, Enum):
    """Matches Google's LookupStrategy JSON enum names."""

    LOOKUP_STRATEGY_UNSPECIFIED = "LOOKUP_STRATEGY_UNSPECIFIED"
    FETCH_LIVE_DOC = "FETCH_LIVE_DOC"
    IN_INDEX_DOC = "IN_INDEX_DOC"


class BatchGetAmpUrlsRequest(BaseModel):
    urls: list[str] = Field(..., min_length=1, max_length=MAX_URLS_PER_REQUEST)
    lookupStrategy: LookupStrategy = LookupStrategy.FETCH_LIVE_DOC


class ErrorCode(str, Enum):
    """
    Google AMP URL API `urlErrors[].errorCode` enum (JSON string names).

    The API may return new codes over time; responses still parse into `AmpUrlError.errorCode` as `str`.
    Use these members for comparisons when handling known outcomes.
    """

    ERROR_CODE_UNSPECIFIED = "ERROR_CODE_UNSPECIFIED"
    INPUT_URL_INVALID = "INPUT_URL_INVALID"
    INPUT_URL_NOT_FOUND = "INPUT_URL_NOT_FOUND"
    INPUT_URL_PARSE_ERROR = "INPUT_URL_PARSE_ERROR"
    INPUT_URL_SECURITY_ERROR = "INPUT_URL_SECURITY_ERROR"
    NOT_AMP_URL = "NOT_AMP_URL"
    URL_IS_NOT_FOUND = "URL_IS_NOT_FOUND"
    AMPHTML_URL_CRAWL_FAILURE = "AMPHTML_URL_CRAWL_FAILURE"
    AMPHTML_URL_DOWNLOAD_FAILURE = "AMPHTML_URL_DOWNLOAD_FAILURE"
    INVALID_AMP = "INVALID_AMP"
    UNREADABLE_SYNTAX = "UNREADABLE_SYNTAX"
    BAD_HISTORICAL_RESPONSE = "BAD_HISTORICAL_RESPONSE"


class AmpUrl(BaseModel):
    """
    Google API `AmpUrl` object (one entry in `ampUrls`).

    {
      "originalUrl": string,
      "ampUrl": string,
      "cdnAmpUrl": string,
    }

    Missing keys default to "" so batch responses stay parseable if the API omits a field.
    """

    model_config = {"extra": "allow"}

    originalUrl: str = ""
    ampUrl: str = ""
    cdnAmpUrl: str = ""


class AmpUrlError(BaseModel):
    """
    Google API `AmpUrlError` object (one entry in `urlErrors`).

    {
      "errorCode": enum(ErrorCode),
      "errorMessage": string,
      "originalUrl": string,
    }

    `errorCode` is stored as `str` so unknown enum values from Google still deserialize.
    Compare to `ErrorCode` members (e.g. `err.errorCode == ErrorCode.NOT_AMP_URL.value`).
    """

    model_config = {"extra": "allow"}

    errorCode: str = ""
    errorMessage: str = ""
    originalUrl: str = ""


class BatchGetAmpUrlsResponse(BaseModel):
    ampUrls: list[AmpUrl] = Field(default_factory=list)
    urlErrors: list[AmpUrlError] = Field(default_factory=list)


def _api_key() -> str | None:
    s = get_settings()
    key = (s.google_amp_url_api_key or s.google_places_api_key or "").strip()
    return key or None


async def batch_get_amp_urls(body: BatchGetAmpUrlsRequest) -> BatchGetAmpUrlsResponse:
    """
    Call Google AMP URL API batchGet. Returns structured ampUrls and urlErrors.
    """
    key = _api_key()
    if not key:
        logger.warning("AMP URL API: no GOOGLE_AMP_URL_API_KEY or GOOGLE_PLACES_API_KEY set")
        raise ValueError("Google API key not configured for AMP URL API")

    payload: dict[str, Any] = {
        "urls": body.urls,
        "lookupStrategy": body.lookupStrategy.value,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                AMP_URL_BATCH_GET,
                params={"key": key},
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        data = resp.json()
        if resp.status_code != 200:
            logger.warning(
                "AMP URL API HTTP %s: %s",
                resp.status_code,
                data if isinstance(data, dict) else resp.text[:500],
            )
            raise RuntimeError(
                (data.get("error", {}) or {}).get("message")
                or f"AMP URL API error HTTP {resp.status_code}"
            )

        return BatchGetAmpUrlsResponse.model_validate(data)
    except httpx.RequestError as e:
        logger.error("AMP URL API request error: %s", e)
        raise RuntimeError("AMP URL API request failed") from e
