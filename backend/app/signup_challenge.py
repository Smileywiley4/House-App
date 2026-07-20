"""Signed signup email-confirmation challenges (15-minute OTP)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

from app.config import get_settings

SIGNUP_CODE_TTL_SEC = 15 * 60
SIGNUP_RESEND_COOLDOWN_SEC = 60


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _from_b64url(value: str) -> bytes:
    pad = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + pad)


def _secret() -> str:
    s = get_settings()
    return (s.supabase_jwt_secret or s.supabase_service_role_key or "").strip()


def hash_signup_code(code: str, email: str) -> str:
    secret = _secret()
    msg = f"{email.strip().lower()}:{str(code).strip()}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()


def mint_signup_challenge(payload: dict[str, Any]) -> str:
    secret = _secret()
    if not secret:
        raise RuntimeError("Signup challenge secret is not configured")
    body = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = _b64url(hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).digest())
    return f"{body}.{sig}"


def read_signup_challenge(token: str | None) -> dict[str, Any] | None:
    secret = _secret()
    if not secret or not token or "." not in token:
        return None
    body, sig = token.split(".", 1)
    expected = _b64url(hmac.new(secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256).digest())
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        payload = json.loads(_from_b64url(body).decode("utf-8"))
    except Exception:
        return None
    if not payload.get("email") or not payload.get("exp"):
        return None
    if time.time() > float(payload["exp"]):
        return None
    return payload


def generate_six_digit_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"
