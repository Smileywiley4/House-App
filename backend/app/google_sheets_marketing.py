"""Account CRM sync to Google Sheets (profile / contact only — never payment data)."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account

from app.config import get_settings

logger = logging.getLogger(__name__)

SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets"
SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets"

MARKETING_SHEET_TAB_NAME = "Accounts"

# Row 1 headers — must stay in sync with row order (A–P).
# Intentionally excludes all financial fields (no card data, Stripe IDs, amounts, or billing invoices).
MARKETING_SHEET_HEADERS = [
    "Signup date",
    "Signup time (UTC)",
    "Name",
    "Email",
    "Phone",
    "Account type",
    "State",
    "Brokerage",
    "Realtor license",
    "Marketing opt-in",
    "Promo code used",
    "Promo code",
    "Account status",
    "Status updated (UTC)",
    "Source",
    "User ID",
]

USER_ID_COLUMN_INDEX = MARKETING_SHEET_HEADERS.index("User ID")  # 0-based
STATUS_COLUMN_INDEX = MARKETING_SHEET_HEADERS.index("Account status")
STATUS_UPDATED_COLUMN_INDEX = MARKETING_SHEET_HEADERS.index("Status updated (UTC)")
SIGNUP_DATE_COLUMN_INDEX = MARKETING_SHEET_HEADERS.index("Signup date")
SIGNUP_TIME_COLUMN_INDEX = MARKETING_SHEET_HEADERS.index("Signup time (UTC)")
PROMO_USED_COLUMN_INDEX = MARKETING_SHEET_HEADERS.index("Promo code used")
PROMO_CODE_COLUMN_INDEX = MARKETING_SHEET_HEADERS.index("Promo code")


def _column_letter(index: int) -> str:
    """Convert 0-based column index to A1 letter(s)."""
    n = index + 1
    letters = ""
    while n:
        n, rem = divmod(n - 1, 26)
        letters = chr(65 + rem) + letters
    return letters


LAST_COLUMN_LETTER = _column_letter(len(MARKETING_SHEET_HEADERS) - 1)

# Column widths in pixels (A–P).
MARKETING_COLUMN_WIDTHS = [
    120,  # Signup date
    130,  # Signup time
    160,  # Name
    240,  # Email
    130,  # Phone
    110,  # Account type
    72,   # State
    150,  # Brokerage
    130,  # Realtor license
    120,  # Marketing opt-in
    120,  # Promo code used
    120,  # Promo code
    120,  # Account status
    168,  # Status updated
    110,  # Source
    290,  # User ID
]

_ACCOUNT_TYPE_LABELS = {
    "free": "Free",
    "premium": "Premium",
    "realtor": "Realtor",
    "admin": "Admin",
}

_layout_initialized = False


def marketing_sheets_configured() -> bool:
    s = get_settings()
    return bool(s.google_marketing_sheet_id.strip() and s.google_sheets_sa_json.strip())


def _sheet_id() -> str:
    return get_settings().google_marketing_sheet_id.strip()


def _get_access_token() -> str:
    raw = get_settings().google_sheets_sa_json.strip()
    if not raw:
        raise ValueError("GOOGLE_SHEETS_SA_JSON not configured")
    info = json.loads(raw)
    creds = service_account.Credentials.from_service_account_info(info, scopes=[SHEETS_SCOPE])
    creds.refresh(GoogleAuthRequest())
    if not creds.token:
        raise RuntimeError("Failed to refresh Google Sheets service account token")
    return creds.token


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_get_access_token()}"}


def _as_utc_datetime(value: datetime | str | None = None) -> datetime:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value.strip():
        raw = value.strip().replace("Z", "+00:00")
        # Accept already-formatted sheet values like "2026-07-20 14:30 UTC".
        if raw.endswith(" UTC") and "T" not in raw:
            try:
                return datetime.strptime(raw, "%Y-%m-%d %H:%M UTC").replace(tzinfo=timezone.utc)
            except ValueError:
                try:
                    return datetime.strptime(raw, "%Y-%m-%d %H:%M:%S UTC").replace(tzinfo=timezone.utc)
                except ValueError:
                    pass
        try:
            parsed = datetime.fromisoformat(raw)
            return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def _format_utc(value: datetime | str | None = None) -> str:
    return _as_utc_datetime(value).strftime("%Y-%m-%d %H:%M UTC")


def _format_signup_date(value: datetime | str | None = None) -> str:
    return _as_utc_datetime(value).strftime("%Y-%m-%d")


def _format_signup_time(value: datetime | str | None = None) -> str:
    return _as_utc_datetime(value).strftime("%H:%M:%S UTC")


def _account_type_label(plan: str | None) -> str:
    key = (plan or "free").strip().lower()
    return _ACCOUNT_TYPE_LABELS.get(key, key.title() or "Free")


def _profile_row(
    *,
    user_id: str,
    email: str | None,
    full_name: str | None,
    phone: str | None,
    plan: str | None,
    state: str | None,
    brokerage: str | None,
    realtor_license: str | None,
    marketing_opt_in: bool,
    account_status: str,
    source: str,
    signed_up_at: datetime | str | None,
    status_updated_at: datetime | str | None = None,
    promo_code: str | None = None,
    promo_code_used: bool | None = None,
) -> list[str]:
    code = (promo_code or "").strip().upper()
    used = "Yes" if (promo_code_used if promo_code_used is not None else bool(code)) else "No"
    return [
        _format_signup_date(signed_up_at),
        _format_signup_time(signed_up_at),
        (full_name or "").strip(),
        (email or "").strip().lower(),
        (phone or "").strip(),
        _account_type_label(plan),
        (state or "").strip(),
        (brokerage or "").strip(),
        (realtor_license or "").strip(),
        "Yes" if marketing_opt_in else "No",
        used,
        code,
        account_status,
        _format_utc(status_updated_at),
        (source or "signup").strip(),
        user_id,
    ]


async def _fetch_spreadsheet(client: httpx.AsyncClient) -> dict:
    sid = _sheet_id()
    r = await client.get(
        f"{SHEETS_API}/{sid}",
        params={"fields": "sheets(properties(sheetId,title,gridProperties))"},
        headers=_auth_headers(),
    )
    r.raise_for_status()
    return r.json()


async def _first_sheet_id(client: httpx.AsyncClient) -> int:
    data = await _fetch_spreadsheet(client)
    sheets = data.get("sheets") or []
    if not sheets:
        raise RuntimeError("Spreadsheet has no sheets")
    return int(sheets[0]["properties"]["sheetId"])


async def _read_header_row(client: httpx.AsyncClient) -> list[str]:
    sid = _sheet_id()
    r = await client.get(
        f"{SHEETS_API}/{sid}/values/A1:{LAST_COLUMN_LETTER}1",
        headers=_auth_headers(),
    )
    r.raise_for_status()
    rows = r.json().get("values") or []
    if not rows:
        return []
    return [str(c).strip() for c in rows[0]]


async def _find_row_index_by_user_id(client: httpx.AsyncClient, user_id: str) -> int | None:
    """Return 1-based sheet row number for the user, or None."""
    target = (user_id or "").strip()
    if not target:
        return None
    col_letter = _column_letter(USER_ID_COLUMN_INDEX)
    r = await client.get(
        f"{SHEETS_API}/{_sheet_id()}/values/{col_letter}2:{col_letter}",
        headers=_auth_headers(),
    )
    r.raise_for_status()
    rows = r.json().get("values") or []
    for index, row in enumerate(rows):
        if row and str(row[0]).strip() == target:
            return index + 2  # header is row 1
    return None


async def ensure_marketing_sheet_layout(*, force: bool = False) -> bool:
    """
    Prepare row 1 headers, tab name, freeze, filters, and column widths.
    Safe to call repeatedly; skips work after first success unless force=True.
    """
    global _layout_initialized
    if _layout_initialized and not force:
        return True
    if not marketing_sheets_configured():
        logger.warning("Account sheet layout skipped: Google Sheets env not configured")
        return False

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            sheet_gid = await _first_sheet_id(client)
            existing = await _read_header_row(client)
            needs_headers = not existing or existing != MARKETING_SHEET_HEADERS

            if needs_headers:
                sid = _sheet_id()
                await client.put(
                    f"{SHEETS_API}/{sid}/values/A1:{LAST_COLUMN_LETTER}1",
                    params={"valueInputOption": "RAW"},
                    json={"values": [MARKETING_SHEET_HEADERS]},
                    headers=_auth_headers(),
                )

            requests: list[dict] = [
                {
                    "updateSheetProperties": {
                        "properties": {
                            "sheetId": sheet_gid,
                            "title": MARKETING_SHEET_TAB_NAME,
                            "gridProperties": {"frozenRowCount": 1},
                        },
                        "fields": "title,gridProperties.frozenRowCount",
                    }
                },
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": sheet_gid,
                            "startRowIndex": 0,
                            "endRowIndex": 1,
                            "startColumnIndex": 0,
                            "endColumnIndex": len(MARKETING_SHEET_HEADERS),
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "backgroundColor": {"red": 0.91, "green": 0.96, "blue": 0.93},
                                "textFormat": {
                                    "bold": True,
                                    "fontSize": 10,
                                    "foregroundColor": {"red": 0.10, "green": 0.13, "blue": 0.20},
                                },
                                "horizontalAlignment": "CENTER",
                                "verticalAlignment": "MIDDLE",
                                "wrapStrategy": "WRAP",
                            }
                        },
                        "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
                    }
                },
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": sheet_gid,
                            "startRowIndex": 1,
                            "endRowIndex": 10000,
                            "startColumnIndex": SIGNUP_DATE_COLUMN_INDEX,
                            "endColumnIndex": SIGNUP_DATE_COLUMN_INDEX + 1,
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "numberFormat": {
                                    "type": "DATE",
                                    "pattern": "yyyy-mm-dd",
                                },
                                "horizontalAlignment": "LEFT",
                            }
                        },
                        "fields": "userEnteredFormat(numberFormat,horizontalAlignment)",
                    }
                },
                {
                    "repeatCell": {
                        "range": {
                            "sheetId": sheet_gid,
                            "startRowIndex": 1,
                            "endRowIndex": 10000,
                            "startColumnIndex": SIGNUP_TIME_COLUMN_INDEX,
                            "endColumnIndex": SIGNUP_TIME_COLUMN_INDEX + 1,
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "numberFormat": {
                                    "type": "TEXT",
                                },
                                "horizontalAlignment": "LEFT",
                            }
                        },
                        "fields": "userEnteredFormat(numberFormat,horizontalAlignment)",
                    }
                },
                {
                    "setBasicFilter": {
                        "filter": {
                            "range": {
                                "sheetId": sheet_gid,
                                "startRowIndex": 0,
                                "startColumnIndex": 0,
                                "endColumnIndex": len(MARKETING_SHEET_HEADERS),
                            }
                        }
                    }
                },
            ]

            for idx, width in enumerate(MARKETING_COLUMN_WIDTHS):
                requests.append(
                    {
                        "updateDimensionProperties": {
                            "range": {
                                "sheetId": sheet_gid,
                                "dimension": "COLUMNS",
                                "startIndex": idx,
                                "endIndex": idx + 1,
                            },
                            "properties": {"pixelSize": width},
                            "fields": "pixelSize",
                        }
                    }
                )

            sid = _sheet_id()
            r = await client.post(
                f"{SHEETS_API}/{sid}:batchUpdate",
                json={"requests": requests},
                headers=_auth_headers(),
            )
            r.raise_for_status()

        _layout_initialized = True
        logger.info("Account Google Sheet layout ensured (tab=%s)", MARKETING_SHEET_TAB_NAME)
        return True
    except Exception as exc:
        logger.warning("Account sheet layout failed: %s", exc)
        return False


async def upsert_account_row(
    *,
    user_id: str,
    email: str | None,
    full_name: str | None,
    phone: str | None,
    plan: str | None,
    state: str | None = None,
    brokerage: str | None = None,
    realtor_license: str | None = None,
    marketing_opt_in: bool = False,
    account_status: str = "Active",
    source: str = "signup",
    signed_up_at: datetime | str | None = None,
    status_updated_at: datetime | str | None = None,
    promo_code: str | None = None,
    promo_code_used: bool | None = None,
) -> bool:
    """
    Create or update the CRM row for an account.
    Stores contact / account-type fields only — never payment or card data.
    """
    target = (user_id or "").strip()
    if not target:
        return False
    if not marketing_sheets_configured():
        logger.warning(
            "Google Sheets account sync skipped: set GOOGLE_MARKETING_SHEET_ID and GOOGLE_SHEETS_SA_JSON"
        )
        return False

    await ensure_marketing_sheet_layout()

    row = _profile_row(
        user_id=target,
        email=email,
        full_name=full_name,
        phone=phone,
        plan=plan,
        state=state,
        brokerage=brokerage,
        realtor_license=realtor_license,
        marketing_opt_in=marketing_opt_in,
        account_status=account_status,
        source=source,
        signed_up_at=signed_up_at,
        status_updated_at=status_updated_at or datetime.now(timezone.utc),
        promo_code=promo_code,
        promo_code_used=promo_code_used,
    )

    sheet_id = _sheet_id()
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            existing_row = await _find_row_index_by_user_id(client, target)
            if existing_row is not None:
                # Preserve original signup date + time once written.
                get_r = await client.get(
                    f"{SHEETS_API}/{sheet_id}/values/A{existing_row}:{LAST_COLUMN_LETTER}{existing_row}",
                    headers=_auth_headers(),
                )
                get_r.raise_for_status()
                existing_values = (get_r.json().get("values") or [[]])[0]
                if len(existing_values) > SIGNUP_DATE_COLUMN_INDEX and str(existing_values[SIGNUP_DATE_COLUMN_INDEX]).strip():
                    row[SIGNUP_DATE_COLUMN_INDEX] = str(existing_values[SIGNUP_DATE_COLUMN_INDEX]).strip()
                if len(existing_values) > SIGNUP_TIME_COLUMN_INDEX and str(existing_values[SIGNUP_TIME_COLUMN_INDEX]).strip():
                    row[SIGNUP_TIME_COLUMN_INDEX] = str(existing_values[SIGNUP_TIME_COLUMN_INDEX]).strip()
                # Preserve promo columns unless this upsert explicitly sets a code.
                if not (promo_code or "").strip():
                    if len(existing_values) > PROMO_USED_COLUMN_INDEX and str(existing_values[PROMO_USED_COLUMN_INDEX]).strip():
                        row[PROMO_USED_COLUMN_INDEX] = str(existing_values[PROMO_USED_COLUMN_INDEX]).strip()
                    if len(existing_values) > PROMO_CODE_COLUMN_INDEX and str(existing_values[PROMO_CODE_COLUMN_INDEX]).strip():
                        row[PROMO_CODE_COLUMN_INDEX] = str(existing_values[PROMO_CODE_COLUMN_INDEX]).strip()

                put_r = await client.put(
                    f"{SHEETS_API}/{sheet_id}/values/A{existing_row}:{LAST_COLUMN_LETTER}{existing_row}",
                    params={"valueInputOption": "RAW"},
                    json={"values": [row]},
                    headers=_auth_headers(),
                )
                put_r.raise_for_status()
            else:
                append_r = await client.post(
                    f"{SHEETS_API}/{sheet_id}/values/A:{LAST_COLUMN_LETTER}:append",
                    params={"valueInputOption": "RAW", "insertDataOption": "INSERT_ROWS"},
                    json={"values": [row]},
                    headers=_auth_headers(),
                )
                append_r.raise_for_status()
        logger.info("Account sheet synced for user %s (status=%s)", target, account_status)
        return True
    except Exception as exc:
        logger.warning("Google Sheets account sync failed for user %s: %s", target, exc)
        return False


# Backward-compatible name used by older call sites / docs.
async def append_marketing_signup(
    *,
    user_id: str,
    email: str | None,
    full_name: str | None,
    phone: str | None,
    plan: str | None,
    marketing_opt_in: bool,
    source: str = "signup",
    signed_up_at: datetime | str | None = None,
    state: str | None = None,
    brokerage: str | None = None,
    realtor_license: str | None = None,
    promo_code: str | None = None,
) -> bool:
    return await upsert_account_row(
        user_id=user_id,
        email=email,
        full_name=full_name,
        phone=phone,
        plan=plan,
        state=state,
        brokerage=brokerage,
        realtor_license=realtor_license,
        marketing_opt_in=marketing_opt_in,
        account_status="Active",
        source=source,
        signed_up_at=signed_up_at,
        promo_code=promo_code,
    )


async def mark_account_cancelled(user_id: str) -> bool:
    """Mark the CRM row as Deleted and clear personal contact fields on deletion."""
    target = (user_id or "").strip()
    if not target:
        return True
    if not marketing_sheets_configured():
        return True

    await ensure_marketing_sheet_layout()
    now = _format_utc()
    name_idx = MARKETING_SHEET_HEADERS.index("Name")
    source_idx_abs = MARKETING_SHEET_HEADERS.index("Source")
    name_letter = _column_letter(name_idx)
    source_letter = _column_letter(source_idx_abs)

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            row_number = await _find_row_index_by_user_id(client, target)
            if row_number is None:
                return await upsert_account_row(
                    user_id=target,
                    email=None,
                    full_name=None,
                    phone=None,
                    plan=None,
                    marketing_opt_in=False,
                    account_status="Deleted",
                    source="account_deletion",
                    signed_up_at=now,
                    status_updated_at=now,
                )

            clear_range = f"{name_letter}{row_number}:{source_letter}{row_number}"
            get_resp = await client.get(
                f"{SHEETS_API}/{_sheet_id()}/values/{clear_range}",
                headers=_auth_headers(),
            )
            get_resp.raise_for_status()
            prev = ((get_resp.json() or {}).get("values") or [[]])[0]
            width = source_idx_abs - name_idx + 1
            row_vals = list(prev) + [""] * max(0, width - len(prev))
            row_vals = row_vals[:width]
            row_vals[0] = ""
            row_vals[1] = "[deleted]"
            row_vals[2] = ""
            opt_idx = MARKETING_SHEET_HEADERS.index("Marketing opt-in") - name_idx
            if 0 <= opt_idx < len(row_vals):
                row_vals[opt_idx] = "No"
            status_idx = STATUS_COLUMN_INDEX - name_idx
            updated_idx = STATUS_UPDATED_COLUMN_INDEX - name_idx
            row_vals[status_idx] = "Deleted"
            row_vals[updated_idx] = now
            row_vals[source_idx_abs - name_idx] = "account_deletion"

            response = await client.put(
                f"{SHEETS_API}/{_sheet_id()}/values/{clear_range}",
                params={"valueInputOption": "RAW"},
                json={"values": [row_vals]},
                headers=_auth_headers(),
            )
            response.raise_for_status()
        logger.info("Marked account sheet row Deleted (PII cleared) for user %s", target)
        return True
    except Exception as exc:
        logger.warning("Failed marking account cancelled for user %s: %s", target, exc)
        return False


async def delete_marketing_signup(user_id: str) -> bool:
    """Compatibility wrapper — account cancellation marks the row Deleted (does not erase history)."""
    return await mark_account_cancelled(user_id)
