"""Account deletion helpers: Stripe cancel, storage wipe, referrals, audit log, Sheets CRM."""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timezone

import stripe
from fastapi import HTTPException

from app.config import get_settings
from app.google_sheets_marketing import mark_account_cancelled

logger = logging.getLogger(__name__)


def email_hash(email: str | None) -> str | None:
    raw = (email or "").strip().lower()
    if not raw:
        return None
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def wipe_user_storage(supabase, user_id: str) -> None:
    for bucket in ("avatars", "property-photos"):
        try:
            listed = supabase.storage.from_(bucket).list(user_id) or []
            paths: list[str] = []
            for item in listed:
                if not isinstance(item, dict):
                    continue
                name = item.get("name") or ""
                if not name:
                    continue
                paths.append(f"{user_id}/{name}")
                try:
                    children = supabase.storage.from_(bucket).list(f"{user_id}/{name}") or []
                    for child in children:
                        if isinstance(child, dict) and child.get("name"):
                            paths.append(f"{user_id}/{name}/{child['name']}")
                except Exception:
                    pass
            if paths:
                supabase.storage.from_(bucket).remove(paths)
        except Exception:
            logger.warning(
                "Storage wipe best-effort failed for bucket=%s user=%s",
                bucket,
                user_id,
                exc_info=True,
            )


def forfeit_referrals(supabase, user_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "status": "forfeited",
        "forfeited_at": now,
        "forfeit_reason": "account_deletion",
        "updated_at": now,
    }
    try:
        supabase.table("referral_redemptions").update(payload).eq("inviter_id", user_id).eq(
            "status", "signed_up"
        ).execute()
        supabase.table("referral_redemptions").update(payload).eq("invitee_id", user_id).eq(
            "status", "signed_up"
        ).execute()
    except Exception:
        logger.warning("Referral forfeit best-effort failed for user %s", user_id, exc_info=True)


def cancel_stripe_for_deletion(stripe_customer_id: str) -> bool:
    """
    Immediately cancel open subscriptions so no renewal charge occurs.
    Zero customer balance to forfeit unused referral credits.
    """
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(
            status_code=503,
            detail="Account deletion is temporarily unavailable while billing is being verified.",
        )
    stripe.api_key = settings.stripe_secret_key
    subscriptions = stripe.Subscription.list(
        customer=stripe_customer_id,
        status="all",
        limit=100,
    )
    cancellable = {"active", "trialing", "past_due", "unpaid", "paused"}
    for subscription in subscriptions.auto_paging_iter():
        if getattr(subscription, "status", None) in cancellable:
            stripe.Subscription.cancel(subscription.id)

    try:
        customer = stripe.Customer.retrieve(stripe_customer_id)
        bal = int(getattr(customer, "balance", 0) or 0)
        if bal < 0:
            stripe.Customer.create_balance_transaction(
                stripe_customer_id,
                amount=-bal,
                currency=getattr(customer, "currency", None) or "usd",
                description="Unused referral credit forfeited on account deletion",
            )
    except Exception:
        logger.warning(
            "Could not zero Stripe customer balance for %s",
            stripe_customer_id,
            exc_info=True,
        )
    return True


def anonymize_profile_row(supabase, user_id: str) -> None:
    try:
        supabase.table("profiles").update(
            {
                "plan": "free",
                "marketing_opt_in": False,
                "marketing_opt_in_at": None,
                "full_name": None,
                "phone": None,
                "avatar_url": None,
                "realtor_license": None,
                "brokerage": None,
                "username": None,
            }
        ).eq("id", user_id).execute()
    except Exception:
        logger.warning("Profile anonymize before delete failed for %s", user_id, exc_info=True)


def write_deletion_log(
    supabase,
    *,
    user_id: str,
    email: str | None,
    plan_at: str,
    had_stripe: bool,
    stripe_cancelled: bool,
    sheet_marked: bool,
    source: str = "profile_delete",
) -> None:
    try:
        supabase.table("account_deletion_log").insert(
            {
                "user_id": user_id,
                "email_hash": email_hash(email),
                "plan_at_deletion": plan_at,
                "had_stripe_customer": had_stripe,
                "stripe_cancelled": stripe_cancelled,
                "sheet_marked": sheet_marked,
                "source": source,
            }
        ).execute()
    except Exception:
        logger.warning("account_deletion_log insert failed for %s", user_id, exc_info=True)


async def run_account_deletion(supabase, user_id: str, *, auth_email: str | None = None) -> None:
    """
    Full deletion pipeline. Raises HTTPException on billing/auth failure.
    Sheets CRM update is best-effort (logged); does not block Apple-required deletion.
    """
    profile_response = (
        supabase.table("profiles")
        .select("stripe_customer_id, email, plan")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    profile = profile_response.data[0] if profile_response.data else {}
    stripe_customer_id = profile.get("stripe_customer_id")
    email = profile.get("email") or auth_email
    plan_at = profile.get("plan") or "free"
    stripe_cancelled = False

    if stripe_customer_id:
        try:
            cancel_stripe_for_deletion(stripe_customer_id)
            stripe_cancelled = True
        except HTTPException:
            raise
        except Exception as exc:
            logger.exception("Could not cancel Stripe subscriptions before account deletion")
            raise HTTPException(
                status_code=502,
                detail="We could not cancel web billing, so the account was not deleted. Please try again.",
            ) from exc

    anonymize_profile_row(supabase, user_id)
    forfeit_referrals(supabase, user_id)
    wipe_user_storage(supabase, user_id)

    sheet_marked = False
    try:
        sheet_marked = bool(await mark_account_cancelled(user_id))
    except Exception:
        logger.warning("Sheets mark deleted failed for %s", user_id, exc_info=True)

    write_deletion_log(
        supabase,
        user_id=user_id,
        email=email,
        plan_at=plan_at,
        had_stripe=bool(stripe_customer_id),
        stripe_cancelled=stripe_cancelled,
        sheet_marked=sheet_marked,
    )

    try:
        supabase.table("iap_events").delete().eq("app_user_id", user_id).execute()
        supabase.auth.admin.delete_user(user_id)
    except Exception as exc:
        logger.exception("Supabase account deletion failed")
        raise HTTPException(
            status_code=502,
            detail="Account deletion failed. Please try again or contact support.",
        ) from exc


def collect_export_payload(supabase, user_id: str) -> dict:
    profile = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    row = profile.data[0] if profile.data else {}
    safe_profile = {
        k: v
        for k, v in (row or {}).items()
        if k
        not in {
            "stripe_customer_id",
            "stripe_subscription_id",
            "revenuecat_app_user_id",
        }
    }

    def _safe_list(table: str, column: str = "user_id", limit: int = 500) -> list:
        try:
            r = supabase.table(table).select("*").eq(column, user_id).limit(limit).execute()
            return list(r.data or [])
        except Exception:
            return []

    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "user_id": user_id,
        "profile": safe_profile,
        "property_scores": _safe_list("property_scores"),
        "presets": _safe_list("user_presets"),
        "projects": _safe_list("user_projects"),
        "contacts": _safe_list("user_contacts"),
        "property_shares": _safe_list("property_shares", "from_user_id")
        + _safe_list("property_shares", "to_user_id"),
        "referral_redemptions": _safe_list("referral_redemptions", "invitee_id")
        + _safe_list("referral_redemptions", "inviter_id"),
        "note": (
            "Snapshot of primary account data. Payment card numbers are never stored by us "
            "(Stripe processes payments). Contact support for additional access requests."
        ),
    }
