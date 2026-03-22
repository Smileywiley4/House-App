#!/usr/bin/env python3
# Copyright 2021 Google LLC (sample pattern); PropertyPulse wrapper.
#
# Produces GOOGLE_ADSENSE_* lines for backend/.env using the same OAuth approach as
# https://github.com/googleads/googleads-adsense-examples/tree/main/v2/python
# (InstalledAppFlow + client_secrets.json from a Google Cloud "Desktop" OAuth client).

"""
One-time AdSense Management API OAuth → refresh token for FastAPI (.env).

Prereqs (same as Google's README):
  pip install google-auth-oauthlib

1. In Google Cloud Console: APIs & Services → Credentials → Create OAuth client ID
   → Application type **Desktop app**. Download JSON as client_secrets.json
2. Enable **AdSense Management API** for the project.
3. Run from `backend/`:

     python scripts/adsense_oauth_to_env.py path/to/client_secrets.json

4. Paste printed lines into backend/.env

Display ads on the site use **AdSense** `ca-pub-…` in Vite env (see AdSlot.jsx), not this OAuth.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


SCOPES_READONLY = ["https://www.googleapis.com/auth/adsense.readonly"]
SCOPES_READWRITE = ["https://www.googleapis.com/auth/adsense"]


def _installed_block(data: dict) -> dict:
    if "installed" in data:
        return data["installed"]
    if "web" in data:
        return data["web"]
    return {}


def main() -> None:
    ap = argparse.ArgumentParser(description="AdSense OAuth → refresh token for PropertyPulse backend")
    ap.add_argument(
        "client_secrets",
        nargs="?",
        default="client_secrets.json",
        help="OAuth client JSON (Desktop or Web client from GCP)",
    )
    ap.add_argument(
        "--readwrite",
        action="store_true",
        help="Request adsense scope (write) instead of adsense.readonly",
    )
    args = ap.parse_args()
    p = Path(args.client_secrets)
    if not p.is_file():
        print(f"File not found: {p}", file=sys.stderr)
        sys.exit(1)

    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError as e:
        print("Install: pip install google-auth-oauthlib", file=sys.stderr)
        raise SystemExit(1) from e

    scopes = SCOPES_READWRITE if args.readwrite else SCOPES_READONLY
    flow = InstalledAppFlow.from_client_secrets_file(str(p), scopes)
    creds = flow.run_local_server(port=0, prompt="consent")

    raw = json.loads(p.read_text())
    inst = _installed_block(raw)
    cid = inst.get("client_id") or ""
    csec = inst.get("client_secret") or ""
    rt = getattr(creds, "refresh_token", None) or ""
    if not rt:
        print(
            "No refresh_token returned. Try revoking app access in Google Account settings "
            "and re-run with prompt=consent, or use a Desktop OAuth client.",
            file=sys.stderr,
        )
        sys.exit(1)

    access = "readwrite" if args.readwrite else "readonly"
    print()
    print("# --- Paste into backend/.env (keep secret; never commit) ---")
    print(f"GOOGLE_ADSENSE_CLIENT_ID={cid}")
    print(f"GOOGLE_ADSENSE_CLIENT_SECRET={csec}")
    print(f"GOOGLE_ADSENSE_REFRESH_TOKEN={rt}")
    print(f"GOOGLE_ADSENSE_ACCESS={access}")
    print()
    print("# Optional: pin publisher account for revenue snapshots")
    print("# GOOGLE_ADSENSE_PUBLISHER_ACCOUNT=pub-XXXXXXXX")
    print()
    print("# --- Frontend: AdSense ad units (from adsense.google.com → Ads → By ad unit) ---")
    print("# VITE_GOOGLE_ADS_CLIENT_ID=ca-pub-XXXXXXXX   # same numeric pub as in AdSense")
    print("# VITE_GOOGLE_ADS_SLOT_LEADERBOARD=1234567890")
    print("# VITE_GOOGLE_ADS_SLOT_INFEED=0987654321")
    print()
    print("# Docs: backend/scripts/README_ADSENSE.md")
    print()


if __name__ == "__main__":
    main()
