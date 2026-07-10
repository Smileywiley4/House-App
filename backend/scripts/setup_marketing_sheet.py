#!/usr/bin/env python3
"""Prepare the marketing Google Sheet (headers, formatting, filters).

Usage (from backend/):
  python scripts/setup_marketing_sheet.py

Requires GOOGLE_MARKETING_SHEET_ID and GOOGLE_SHEETS_SA_JSON in backend/.env or environment.
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.google_sheets_marketing import (
    MARKETING_SHEET_HEADERS,
    MARKETING_SHEET_TAB_NAME,
    ensure_marketing_sheet_layout,
    marketing_sheets_configured,
)


async def main() -> int:
    if not marketing_sheets_configured():
        print("Missing GOOGLE_MARKETING_SHEET_ID or GOOGLE_SHEETS_SA_JSON.", file=sys.stderr)
        return 1
    ok = await ensure_marketing_sheet_layout(force=True)
    if not ok:
        print("Sheet setup failed — check logs and service account share on the spreadsheet.", file=sys.stderr)
        return 1
    print(f"OK — tab renamed to “{MARKETING_SHEET_TAB_NAME}”, headers:")
    print(" | ".join(MARKETING_SHEET_HEADERS))
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
