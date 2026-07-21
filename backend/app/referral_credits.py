"""Referral reward: one billing-month credit for inviter + invitee via Stripe Customer Balance.

TODO(rebrand): final domain TBD — keep house-app-rho.vercel.app fallbacks until DNS is ready.
"""
from __future__ import annotations

import logging
import secrets
import string
from datetime import datetime, timezone
from typing import Any

import stripe

from app.config import Settings, get_settings
from app.stripe_billing import plan_from_subscription_price_ids, stripe_customer_id

logger = logging.getLogger(__name__)

PAID_PLANS = frozenset({"premium", "realtor", "admin"})
CODE_ALPHABET = string.ascii_uppercase + string.digits


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_referral_code(length: int = 8) -> str:
    return "PP" + "".join(secrets.choice(CODE_ALPHABET) for _ in range(length))


def ensure_referral_invite(supabase, user_id: str) -> dict:
    """Return existing invite row or create one with a unique code."""
    existing = (
        supabase.table("referral_invites")
        .select("*")
        .eq("inviter_id", user_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]
    for _ in range(8):
        code = generate_referral_code()
        try:
            ins = (
                supabase.table("referral_invites")
                .insert({"inviter_id": user_id, "code": code})
                .select()
                .execute()
            )
            if ins.data:
                return ins.data[0]
        except Exception:
            logger.exception("referral invite insert collision for %s", user_id)
    raise RuntimeError("Could not allocate referral code")


def invite_url_for_code(code: str, s: Settings | None = None) -> str:
    settings = s or get_settings()
    base = (settings.app_public_url or "https://house-app-rho.vercel.app").rstrip("/")
    return f"{base}/signup?ref={code}"


def _profile_plan(supabase, user_id: str) -> tuple[str, str | None]:
    r = supabase.table("profiles").select("plan, stripe_customer_id").eq("id", user_id).execute()
    row = r.data[0] if r.data else {}
    return ((row.get("plan") or "free").strip().lower(), row.get("stripe_customer_id"))


def _is_paid_plan(plan: str | None) -> bool:
    return (plan or "").strip().lower() in PAID_PLANS


def _subscription_interval_and_amount_cents(subscription: Any) -> tuple[str, int]:
    """Return ('monthly'|'annual', unit_amount cents) for the primary subscription item."""
    items = getattr(subscription, "items", None)
    data = getattr(items, "data", None) if items is not None else None
    if not data and isinstance(subscription, dict):
        data = ((subscription.get("items") or {}).get("data")) or []
    if not data:
        return "monthly", 399
    first = data[0]
    price = getattr(first, "price", None)
    if price is None and isinstance(first, dict):
        price = first.get("price") or {}
    if isinstance(price, dict):
        unit = int(price.get("unit_amount") or 0)
        recurring = price.get("recurring") or {}
        interval = (recurring.get("interval") or "month").lower()
    else:
        unit = int(getattr(price, "unit_amount", None) or 0)
        recurring = getattr(price, "recurring", None)
        interval = (getattr(recurring, "interval", None) or "month").lower()
    if unit <= 0:
        unit = 399
    billing = "annual" if interval in {"year", "annual"} else "monthly"
    return billing, unit


def month_credit_cents_for_subscription(subscription: Any) -> int:
    """
    Credit equal to one month of the subscriber's plan.
    Monthly: full cycle amount. Annual: ~1/12 of annual list price (rounded).
    """
    billing, unit = _subscription_interval_and_amount_cents(subscription)
    if billing == "annual":
        return max(1, round(unit / 12))
    return max(1, unit)


def _find_active_subscription(customer_id: str):
    for status in ("active", "trialing"):
        result = stripe.Subscription.list(customer=customer_id, status=status, limit=5)
        data = getattr(result, "data", None) or []
        if data:
            return data[0]
    return None


def _apply_customer_balance_credit(
    customer_id: str,
    amount_cents: int,
    *,
    redemption_id: str,
    role: str,
) -> str | None:
    """Credit Stripe customer balance (negative amount = money owed to customer)."""
    if not customer_id or amount_cents <= 0:
        return None
    txn = stripe.Customer.create_balance_transaction(
        customer_id,
        amount=-abs(int(amount_cents)),
        currency="usd",
        description=f"Propurty referral credit ({role})",
        metadata={
            "referral_redemption_id": redemption_id,
            "referral_role": role,
            "source": "referral_program",
        },
    )
    return getattr(txn, "id", None) or (txn.get("id") if isinstance(txn, dict) else None)


def claim_referral_code(supabase, *, invitee_id: str, code: str) -> dict:
    """Attach invitee to an inviter's code. Idempotent; one redemption per invitee."""
    raw = (code or "").strip().upper()
    if not raw:
        return {"ok": False, "reason": "missing_code"}

    existing = (
        supabase.table("referral_redemptions")
        .select("*")
        .eq("invitee_id", invitee_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        row = existing.data[0]
        return {
            "ok": True,
            "already_claimed": True,
            "status": row.get("status"),
            "code": row.get("code"),
        }

    inv = (
        supabase.table("referral_invites")
        .select("*")
        .eq("code", raw)
        .limit(1)
        .execute()
    )
    if not inv.data:
        # Case-insensitive fallback
        inv = (
            supabase.table("referral_invites")
            .select("*")
            .ilike("code", raw)
            .limit(1)
            .execute()
        )
    if not inv.data:
        return {"ok": False, "reason": "invalid_code"}

    invite = inv.data[0]
    inviter_id = str(invite["inviter_id"])
    if inviter_id == invitee_id:
        return {"ok": False, "reason": "self_referral"}

    row = {
        "invite_id": invite["id"],
        "inviter_id": inviter_id,
        "invitee_id": invitee_id,
        "code": invite["code"],
        "status": "signed_up",
        "updated_at": _now_iso(),
    }
    try:
        ins = supabase.table("referral_redemptions").insert(row).select().execute()
    except Exception:
        logger.exception("referral claim insert failed")
        # Race: another claim won
        again = (
            supabase.table("referral_redemptions")
            .select("*")
            .eq("invitee_id", invitee_id)
            .limit(1)
            .execute()
        )
        if again.data:
            return {
                "ok": True,
                "already_claimed": True,
                "status": again.data[0].get("status"),
                "code": again.data[0].get("code"),
            }
        return {"ok": False, "reason": "claim_failed"}

    return {
        "ok": True,
        "already_claimed": False,
        "status": "signed_up",
        "code": invite["code"],
        "redemption": ins.data[0] if ins.data else None,
    }


def try_apply_referral_credits_for_user(
    supabase,
    user_id: str,
    *,
    plan_id: str | None = None,
    customer_id: str | None = None,
) -> dict:
    """
    When an invitee first lands on Premium/Realtor (or higher), credit both parties
    one month of their respective paid plan (customer balance → next invoice).
    Inviter must also be on a paid plan to receive credit; otherwise invitee still
    gets credit and inviter is marked ineligible for their half.
    Idempotent via redemption.status.
    """
    s = get_settings()
    if not s.stripe_secret_key:
        return {"applied": False, "reason": "stripe_not_configured"}
    stripe.api_key = s.stripe_secret_key

    red = (
        supabase.table("referral_redemptions")
        .select("*")
        .eq("invitee_id", user_id)
        .limit(1)
        .execute()
    )
    if not red.data:
        return {"applied": False, "reason": "no_redemption"}
    redemption = red.data[0]
    status = (redemption.get("status") or "").lower()
    if status == "credited":
        return {"applied": False, "reason": "already_credited", "redemption_id": redemption["id"]}
    if status in ("forfeited", "ineligible"):
        return {"applied": False, "reason": status, "redemption_id": redemption["id"]}
    if status != "signed_up":
        return {"applied": False, "reason": f"bad_status:{status}"}

    invitee_plan = (plan_id or "").strip().lower()
    invitee_customer = customer_id
    if not invitee_plan or not invitee_customer:
        pr = (
            supabase.table("profiles")
            .select("plan, stripe_customer_id")
            .eq("id", user_id)
            .execute()
        )
        prow = pr.data[0] if pr.data else {}
        invitee_plan = invitee_plan or (prow.get("plan") or "free").strip().lower()
        invitee_customer = invitee_customer or prow.get("stripe_customer_id")

    if invitee_plan not in ("premium", "realtor", "admin"):
        return {"applied": False, "reason": "invitee_not_paid"}

    if not invitee_customer:
        return {"applied": False, "reason": "invitee_no_stripe_customer"}

    invitee_sub = _find_active_subscription(invitee_customer)
    if not invitee_sub:
        return {"applied": False, "reason": "invitee_no_active_sub"}

    invitee_cents = month_credit_cents_for_subscription(invitee_sub)
    redemption_id = str(redemption["id"])
    inviter_id = str(redemption["inviter_id"])

    invitee_txn = _apply_customer_balance_credit(
        invitee_customer,
        invitee_cents,
        redemption_id=redemption_id,
        role="invitee",
    )

    inviter_plan, inviter_customer = _profile_plan(supabase, inviter_id)
    inviter_cents = None
    inviter_txn = None
    if _is_paid_plan(inviter_plan) and inviter_customer:
        inviter_sub = _find_active_subscription(inviter_customer)
        if inviter_sub:
            inviter_cents = month_credit_cents_for_subscription(inviter_sub)
            inviter_txn = _apply_customer_balance_credit(
                inviter_customer,
                inviter_cents,
                redemption_id=redemption_id,
                role="inviter",
            )
        else:
            inviter_cents = 0
    else:
        # Reward path requires Pro+ on both sides for inviter half; invitee still credited.
        inviter_cents = 0

    supabase.table("referral_redemptions").update(
        {
            "status": "credited",
            "invitee_plan_at_credit": invitee_plan,
            "invitee_credit_cents": invitee_cents,
            "inviter_credit_cents": inviter_cents or 0,
            "invitee_stripe_balance_txn_id": invitee_txn,
            "inviter_stripe_balance_txn_id": inviter_txn,
            "credit_applied_at": _now_iso(),
            "updated_at": _now_iso(),
        }
    ).eq("id", redemption_id).eq("status", "signed_up").execute()

    logger.info(
        "Referral credits applied redemption=%s invitee=%s (+%sc) inviter=%s (+%sc)",
        redemption_id,
        user_id,
        invitee_cents,
        inviter_id,
        inviter_cents or 0,
    )
    return {
        "applied": True,
        "redemption_id": redemption_id,
        "invitee_credit_cents": invitee_cents,
        "inviter_credit_cents": inviter_cents or 0,
    }


def forfeit_unused_referral_balance_on_cancel(supabase, customer_id: str) -> None:
    """
    If a credited user cancels before the next invoice consumes their referral
    balance, reverse that referral credit amount and mark the redemption forfeited.
    """
    s = get_settings()
    if not s.stripe_secret_key or not customer_id:
        return
    stripe.api_key = s.stripe_secret_key

    pr = (
        supabase.table("profiles")
        .select("id")
        .eq("stripe_customer_id", customer_id)
        .limit(1)
        .execute()
    )
    if not pr.data:
        return
    user_id = str(pr.data[0]["id"])

    for role, col, cents_key in (
        ("invitee", "invitee_id", "invitee_credit_cents"),
        ("inviter", "inviter_id", "inviter_credit_cents"),
    ):
        rows = (
            supabase.table("referral_redemptions")
            .select("*")
            .eq(col, user_id)
            .eq("status", "credited")
            .execute()
        )
        for redemption in rows.data or []:
            amount = int(redemption.get(cents_key) or 0)
            if amount <= 0:
                continue
            try:
                cust = stripe.Customer.retrieve(customer_id)
                balance = int(getattr(cust, "balance", 0) or 0)
                # Negative balance = remaining credit. Only claw back up to referral amount.
                if balance >= 0:
                    continue
                remaining_credit = -balance
                clawback = min(remaining_credit, amount)
                if clawback <= 0:
                    continue
                stripe.Customer.create_balance_transaction(
                    customer_id,
                    amount=clawback,
                    currency="usd",
                    description="Referral credit forfeited (canceled before next billing statement)",
                    metadata={
                        "referral_redemption_id": str(redemption["id"]),
                        "referral_role": role,
                        "source": "referral_forfeit",
                    },
                )
                supabase.table("referral_redemptions").update(
                    {
                        "status": "forfeited",
                        "forfeited_at": _now_iso(),
                        "forfeit_reason": "canceled_before_renewal",
                        "updated_at": _now_iso(),
                    }
                ).eq("id", redemption["id"]).execute()
            except Exception:
                logger.exception(
                    "Failed to forfeit referral balance customer=%s redemption=%s",
                    customer_id,
                    redemption.get("id"),
                )


def handle_paid_subscription_for_referrals(
    supabase,
    *,
    user_id: str | None,
    plan_id: str | None,
    customer_id: str | None,
) -> None:
    """Best-effort hook from Stripe webhooks / checkout."""
    if not user_id:
        if customer_id:
            pr = (
                supabase.table("profiles")
                .select("id, plan")
                .eq("stripe_customer_id", customer_id)
                .limit(1)
                .execute()
            )
            if pr.data:
                user_id = str(pr.data[0]["id"])
                plan_id = plan_id or pr.data[0].get("plan")
        if not user_id:
            return
    try:
        try_apply_referral_credits_for_user(
            supabase,
            user_id,
            plan_id=plan_id,
            customer_id=customer_id,
        )
    except Exception:
        logger.exception("Referral credit apply failed for user %s", user_id)
