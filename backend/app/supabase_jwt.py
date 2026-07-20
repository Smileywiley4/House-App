"""Verify Supabase Auth JWTs (ES256 JWKS + legacy HS256)."""
from __future__ import annotations

import base64
import json
import logging
import time
from typing import Any

import httpx
from jose import JWTError, jwk, jwt

from app.config import get_settings

logger = logging.getLogger(__name__)

_JWKS_CACHE: dict[str, Any] = {"fetched_at": 0.0, "keys": {}, "url": ""}
_JWKS_TTL_SEC = 3600


def _b64url_json(segment: str) -> dict[str, Any]:
    padded = segment + "=" * (-len(segment) % 4)
    return json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")))


def _token_header(token: str) -> dict[str, Any]:
    header_seg = token.split(".", 1)[0]
    return _b64url_json(header_seg)


def _jwks_url() -> str:
    s = get_settings()
    base = (s.supabase_url or "").rstrip("/")
    if not base:
        return ""
    return f"{base}/auth/v1/.well-known/jwks.json"


def _fetch_jwks(force: bool = False) -> dict[str, Any]:
    url = _jwks_url()
    if not url:
        return {}
    now = time.time()
    if (
        not force
        and _JWKS_CACHE["url"] == url
        and _JWKS_CACHE["keys"]
        and now - float(_JWKS_CACHE["fetched_at"]) < _JWKS_TTL_SEC
    ):
        return _JWKS_CACHE["keys"]
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.get(url)
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        logger.warning("Failed to fetch Supabase JWKS from %s: %s", url, exc)
        return _JWKS_CACHE["keys"] or {}
    by_kid = {}
    for item in data.get("keys") or []:
        kid = item.get("kid")
        if kid:
            by_kid[kid] = item
    _JWKS_CACHE["url"] = url
    _JWKS_CACHE["keys"] = by_kid
    _JWKS_CACHE["fetched_at"] = now
    return by_kid


def _decode_es256(token: str) -> dict[str, Any]:
    header = _token_header(token)
    kid = header.get("kid")
    keys = _fetch_jwks()
    jwk_data = keys.get(kid) if kid else None
    if not jwk_data:
        keys = _fetch_jwks(force=True)
        jwk_data = keys.get(kid) if kid else None
    if not jwk_data and len(keys) == 1:
        jwk_data = next(iter(keys.values()))
    if not jwk_data:
        raise JWTError("No matching JWKS key for token")
    key = jwk.construct(jwk_data)
    return jwt.decode(
        token,
        key,
        algorithms=["ES256"],
        audience="authenticated",
        options={"verify_aud": True},
    )


def _decode_hs256(token: str) -> dict[str, Any]:
    s = get_settings()
    if not s.supabase_jwt_secret:
        raise JWTError("HS256 JWT secret not configured")
    return jwt.decode(
        token,
        s.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
    )


def decode_supabase_access_token(token: str) -> dict[str, Any]:
    """
    Decode a Supabase user access token.

    New Supabase projects sign access tokens with ES256 (JWKS).
    Older projects / some tooling still use the legacy HS256 JWT secret.
    """
    if not (token or "").strip():
        raise JWTError("Empty token")
    try:
        alg = (_token_header(token).get("alg") or "").upper()
    except Exception as exc:
        raise JWTError(f"Malformed token header: {exc}") from exc

    if alg == "ES256":
        return _decode_es256(token)
    if alg == "HS256":
        return _decode_hs256(token)

    # Unknown/missing alg: try ES256 then HS256.
    try:
        return _decode_es256(token)
    except JWTError:
        return _decode_hs256(token)


def auth_verification_configured() -> bool:
    s = get_settings()
    return bool((s.supabase_url or "").strip() or (s.supabase_jwt_secret or "").strip())
