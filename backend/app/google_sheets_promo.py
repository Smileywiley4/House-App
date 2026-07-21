"""Promo / access codes backed by a Google Sheets tab (Active / Inactive)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from app.google_sheets_marketing import (
    SHEETS_API,
    _auth_headers,
    _column_letter,
    _format_utc,
    _sheet_id,
    ensure_marketing_sheet_layout,
    marketing_sheets_configured,
)

logger = logging.getLogger(__name__)

PROMO_CODES_TAB_NAME = "Promo codes"

PROMO_CODE_HEADERS = [
    "Code",
    "Status",
    "Benefit",
    "Grants plan",
    "Discount percent",
    "Description",
    "Max uses",
    "Times used",
    "Created (UTC)",
    "Notes",
]

# Seeded when the Codes tab is created/ensured. Also used as a hard-coded fallback
# so ADMIN always works even if Google Sheets is unavailable.
ADMIN_PROMO_CODE = {
    "code": "ADMIN",
    "status": "Active",
    "benefit": "free_access",
    "grants_plan": "any",
    "discount_percent": "100",
    "description": "100% off forever — grants free Premium or Realtor (any paid plan), perpetual testing access.",
    "max_uses": "",
    "times_used": "0",
    "notes": "Internal / testing. In-app redeem sets admin_comp (no expiry). Stripe ADMIN promo is forever 100% off.",
}


def builtin_admin_promo() -> dict:
    """Always-on ADMIN code: 100% off forever / free Premium or Realtor (no expiry)."""
    return {
        "code": "ADMIN",
        "status": "active",
        "benefit": "free_access",
        "grants_plan": "any",
        "discount_percent": 100.0,
        "description": ADMIN_PROMO_CODE["description"],
        "max_uses": None,
        "times_used": 0,
        "created_at": "",
        "notes": ADMIN_PROMO_CODE["notes"],
        "builtin": True,
    }

_PROMO_LAYOUT_READY = False


def _last_col() -> str:
    return _column_letter(len(PROMO_CODE_HEADERS) - 1)


async def _sheet_gid_by_title(client: httpx.AsyncClient, title: str) -> int | None:
    sid = _sheet_id()
    r = await client.get(
        f"{SHEETS_API}/{sid}",
        params={"fields": "sheets(properties(sheetId,title))"},
        headers=_auth_headers(),
    )
    r.raise_for_status()
    for sheet in r.json().get("sheets") or []:
        props = sheet.get("properties") or {}
        if props.get("title") == title:
            return int(props["sheetId"])
    return None


async def _ensure_promo_tab(client: httpx.AsyncClient) -> int:
    gid = await _sheet_gid_by_title(client, PROMO_CODES_TAB_NAME)
    if gid is not None:
        return gid
    sid = _sheet_id()
    r = await client.post(
        f"{SHEETS_API}/{sid}:batchUpdate",
        json={
            "requests": [
                {
                    "addSheet": {
                        "properties": {
                            "title": PROMO_CODES_TAB_NAME,
                            "gridProperties": {"frozenRowCount": 1},
                        }
                    }
                }
            ]
        },
        headers=_auth_headers(),
    )
    r.raise_for_status()
    replies = r.json().get("replies") or []
    props = ((replies[0] or {}).get("addSheet") or {}).get("properties") or {}
    return int(props["sheetId"])


def _row_from_seed(seed: dict) -> list[str]:
    return [
        seed["code"],
        seed["status"],
        seed["benefit"],
        seed["grants_plan"],
        str(seed.get("discount_percent") or ""),
        seed.get("description") or "",
        str(seed.get("max_uses") or ""),
        str(seed.get("times_used") or "0"),
        _format_utc(),
        seed.get("notes") or "",
    ]


async def ensure_promo_codes_sheet(*, force: bool = False) -> bool:
    """Create/format the Promo codes tab and seed ADMIN if missing."""
    global _PROMO_LAYOUT_READY
    if _PROMO_LAYOUT_READY and not force:
        return True
    if not marketing_sheets_configured():
        return False

    # Keep Accounts tab layout in sync when preparing codes.
    await ensure_marketing_sheet_layout(force=force)

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            gid = await _ensure_promo_tab(client)
            sid = _sheet_id()
            last = _last_col()

            header_r = await client.get(
                f"{SHEETS_API}/{sid}/values/'{PROMO_CODES_TAB_NAME}'!A1:{last}1",
                headers=_auth_headers(),
            )
            header_r.raise_for_status()
            existing = (header_r.json().get("values") or [[]])[0] if header_r.json().get("values") else []
            if list(existing) != PROMO_CODE_HEADERS:
                await client.put(
                    f"{SHEETS_API}/{sid}/values/'{PROMO_CODES_TAB_NAME}'!A1:{last}1",
                    params={"valueInputOption": "RAW"},
                    json={"values": [PROMO_CODE_HEADERS]},
                    headers=_auth_headers(),
                )

            # Seed ADMIN if the code column does not already include it.
            codes_r = await client.get(
                f"{SHEETS_API}/{sid}/values/'{PROMO_CODES_TAB_NAME}'!A2:A",
                headers=_auth_headers(),
            )
            codes_r.raise_for_status()
            existing_codes = {
                str(row[0]).strip().upper()
                for row in (codes_r.json().get("values") or [])
                if row and str(row[0]).strip()
            }
            if ADMIN_PROMO_CODE["code"] not in existing_codes:
                await client.post(
                    f"{SHEETS_API}/{sid}/values/'{PROMO_CODES_TAB_NAME}'!A:{last}:append",
                    params={"valueInputOption": "RAW", "insertDataOption": "INSERT_ROWS"},
                    json={"values": [_row_from_seed(ADMIN_PROMO_CODE)]},
                    headers=_auth_headers(),
                )

            widths = [110, 90, 110, 110, 120, 280, 90, 100, 160, 260]
            requests = [
                {
                    "updateSheetProperties": {
                        "properties": {
                            "sheetId": gid,
                            "title": PROMO_CODES_TAB_NAME,
                            "gridProperties": {"frozenRowCount": 1},
                        },
                        "fields": "title,gridProperties.frozenRowCount",
                    }
                },
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": gid,
                            "startRowIndex": 0,
                            "endRowIndex": 1,
                            "startColumnIndex": 0,
                            "endColumnIndex": len(PROMO_CODE_HEADERS),
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "backgroundColor": {"red": 0.93, "green": 0.95, "blue": 0.98},
                                "textFormat": {"bold": True, "fontSize": 10},
                                "horizontalAlignment": "CENTER",
                                "verticalAlignment": "MIDDLE",
                                "wrapStrategy": "WRAP",
                            }
                        },
                        "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
                    }
                },
                {
                    "setBasicFilter": {
                        "filter": {
                            "range": {
                                "sheetId": gid,
                                "startRowIndex": 0,
                                "startColumnIndex": 0,
                                "endColumnIndex": len(PROMO_CODE_HEADERS),
                            }
                        }
                    }
                },
            ]
            for idx, width in enumerate(widths):
                requests.append(
                    {
                        "updateDimensionProperties": {
                            "range": {
                                "sheetId": gid,
                                "dimension": "COLUMNS",
                                "startIndex": idx,
                                "endIndex": idx + 1,
                            },
                            "properties": {"pixelSize": width},
                            "fields": "pixelSize",
                        }
                    }
                )
            await client.post(
                f"{SHEETS_API}/{sid}:batchUpdate",
                json={"requests": requests},
                headers=_auth_headers(),
            )

        _PROMO_LAYOUT_READY = True
        logger.info("Promo codes sheet ensured (tab=%s)", PROMO_CODES_TAB_NAME)
        return True
    except Exception as exc:
        logger.warning("Promo codes sheet setup failed: %s", exc)
        return False


def _parse_promo_row(values: list[str]) -> dict | None:
    if not values or not str(values[0]).strip():
        return None
    padded = list(values) + [""] * (len(PROMO_CODE_HEADERS) - len(values))
    max_uses_raw = str(padded[6]).strip()
    times_used_raw = str(padded[7]).strip() or "0"
    try:
        max_uses = int(max_uses_raw) if max_uses_raw else None
    except ValueError:
        max_uses = None
    try:
        times_used = int(float(times_used_raw))
    except ValueError:
        times_used = 0
    discount_raw = str(padded[4]).strip()
    try:
        discount_percent = float(discount_raw) if discount_raw else None
    except ValueError:
        discount_percent = None
    return {
        "code": str(padded[0]).strip().upper(),
        "status": str(padded[1]).strip().lower(),
        "benefit": str(padded[2]).strip().lower(),
        "grants_plan": str(padded[3]).strip().lower() or "premium",
        "discount_percent": discount_percent,
        "description": str(padded[5]).strip(),
        "max_uses": max_uses,
        "times_used": times_used,
        "created_at": str(padded[8]).strip(),
        "notes": str(padded[9]).strip(),
    }


async def find_promo_code(code: str) -> tuple[dict | None, int | None]:
    """Return (promo dict, 1-based sheet row) or (None, None).

    ADMIN is always available as a built-in 100% off / free-access code when the
    sheet is missing, misconfigured, or does not list it.
    """
    needle = (code or "").strip().upper()
    if not needle:
        return None, None

    if marketing_sheets_configured():
        await ensure_promo_codes_sheet()
        sid = _sheet_id()
        last = _last_col()
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(
                    f"{SHEETS_API}/{sid}/values/'{PROMO_CODES_TAB_NAME}'!A2:{last}",
                    headers=_auth_headers(),
                )
                r.raise_for_status()
                for index, row in enumerate(r.json().get("values") or []):
                    parsed = _parse_promo_row(row)
                    if parsed and parsed["code"] == needle:
                        # Sheet can deactivate ADMIN by setting Status to Inactive.
                        return parsed, index + 2
        except Exception as exc:
            logger.warning("Promo code lookup failed: %s", exc)

    if needle == ADMIN_PROMO_CODE["code"]:
        return builtin_admin_promo(), None
    return None, None


async def increment_promo_code_uses(row_number: int, current_uses: int) -> bool:
    if not row_number:
        return False
    sid = _sheet_id()
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.put(
                f"{SHEETS_API}/{sid}/values/'{PROMO_CODES_TAB_NAME}'!H{row_number}",
                params={"valueInputOption": "RAW"},
                json={"values": [[str(current_uses + 1)]]},
                headers=_auth_headers(),
            )
            r.raise_for_status()
        return True
    except Exception as exc:
        logger.warning("Failed incrementing promo uses: %s", exc)
        return False


def resolve_granted_plan(promo: dict, requested_plan: str | None) -> str | None:
    """
    Map a promo code to a concrete plan.
    free_access + grants_plan=any → requested premium|realtor (default premium).
    """
    benefit = promo.get("benefit") or ""
    if benefit not in {"free_access", "free", "grant_plan"}:
        return None
    grants = (promo.get("grants_plan") or "premium").lower()
    requested = (requested_plan or "premium").strip().lower()
    allowed = {"premium", "realtor"}
    if grants == "any":
        return requested if requested in allowed else "premium"
    if grants in allowed or grants == "admin":
        return grants
    return None
