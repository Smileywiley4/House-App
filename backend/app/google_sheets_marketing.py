"""Append marketing opt-in signups to Google Sheets via API v4."""
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

MARKETING_SHEET_TAB_NAME = "Marketing signups"

# Row 1 headers — must stay in sync with append row order (A–H).
MARKETING_SHEET_HEADERS = [
    "Signed up (UTC)",
    "Email",
    "Name",
    "Phone",
    "Plan",
    "Marketing opt-in",
    "Source",
    "User ID",
]

# Column widths in pixels (A–H).
MARKETING_COLUMN_WIDTHS = [168, 240, 160, 130, 88, 120, 110, 290]

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


def _format_signed_up_at(value: datetime | str | None) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    if isinstance(value, datetime):
        dt = value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    else:
        dt = datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M UTC")


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
        f"{SHEETS_API}/{sid}/values/A1:H1",
        headers=_auth_headers(),
    )
    r.raise_for_status()
    rows = r.json().get("values") or []
    if not rows:
        return []
    return [str(c).strip() for c in rows[0]]


async def ensure_marketing_sheet_layout(*, force: bool = False) -> bool:
    """
    Prepare row 1 headers, tab name, freeze, filters, and column widths.
    Safe to call repeatedly; skips work after first success unless force=True.
    """
    global _layout_initialized
    if _layout_initialized and not force:
        return True
    if not marketing_sheets_configured():
        logger.warning("Marketing sheet layout skipped: Google Sheets env not configured")
        return False

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            sheet_gid = await _first_sheet_id(client)
            existing = await _read_header_row(client)
            needs_headers = not existing or existing != MARKETING_SHEET_HEADERS

            if needs_headers:
                sid = _sheet_id()
                await client.put(
                    f"{SHEETS_API}/{sid}/values/A1:H1",
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
                            "startColumnIndex": 0,
                            "endColumnIndex": 1,
                        },
                        "cell": {
                            "userEnteredFormat": {
                                "numberFormat": {
                                    "type": "DATE_TIME",
                                    "pattern": "yyyy-mm-dd hh:mm",
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
        logger.info("Marketing Google Sheet layout ensured (tab=%s)", MARKETING_SHEET_TAB_NAME)
        return True
    except Exception as exc:
        logger.warning("Marketing sheet layout failed: %s", exc)
        return False


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
) -> bool:
    """
    Append a row when marketing_opt_in is true.
    Returns True if a row was appended; False if skipped or not configured.
    Never raises — logs warnings on failure.
    """
    if not marketing_opt_in:
        return False
    if not marketing_sheets_configured():
        logger.warning(
            "Google Sheets marketing sync skipped: set GOOGLE_MARKETING_SHEET_ID and GOOGLE_SHEETS_SA_JSON"
        )
        return False

    await ensure_marketing_sheet_layout()

    plan_label = (plan or "free").strip().lower()
    row = [
        _format_signed_up_at(signed_up_at),
        (email or "").strip().lower(),
        (full_name or "").strip(),
        (phone or "").strip(),
        plan_label,
        "Yes" if marketing_opt_in else "No",
        (source or "signup").strip(),
        user_id,
    ]

    sheet_id = _sheet_id()
    url = f"{SHEETS_API}/{sheet_id}/values/A:H:append"
    params = {"valueInputOption": "USER_ENTERED", "insertDataOption": "INSERT_ROWS"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                url,
                params=params,
                json={"values": [row]},
                headers=_auth_headers(),
            )
            r.raise_for_status()
        logger.info("Marketing signup synced to Google Sheets for user %s", user_id)
        return True
    except Exception as exc:
        logger.warning("Google Sheets marketing sync failed for user %s: %s", user_id, exc)
        return False
