# AdSense Management API v2 — align with Google’s Python samples

Official examples (interactive OAuth, `google-api-python-client`, `adsense.dat` token file):

**[googleads/googleads-adsense-examples — `v2/python`](https://github.com/googleads/googleads-adsense-examples/tree/main/v2/python)**

That repo’s README explains:

- `pip install google-api-python-client google_auth_oauthlib`
- Run `get_all_accounts.py` (etc.) with `client_secrets.json` from a **Desktop** OAuth client
- Tokens saved to **`adsense.dat`** by default

## How PropertyPulse uses the same API

| Google samples | This app |
|----------------|----------|
| `adsense_util.get_adsense_credentials()` + `adsense.dat` | **`GOOGLE_ADSENSE_*` in `backend/.env`** (refresh token for servers) |
| `discovery.build('adsense', 'v2', ...)` | **`httpx` + REST** in `app/google_adsense_v2.py` (same `adsense.googleapis.com/v2` endpoints) |
| `generate_report.py` | **`reports:generate`** via proxy + **`revenue_adsense.sync_yesterday_snapshot()`** |

You can run Google’s scripts locally to explore; for **production**, use our **`.env` refresh token** (no `adsense.dat` on the server).

## Get a refresh token (recommended)

From **`backend/`**:

```bash
pip install google-auth-oauthlib
python scripts/adsense_oauth_to_env.py /path/to/client_secrets.json
```

Paste the printed lines into **`backend/.env`**.

Use the same **Desktop** OAuth client JSON pattern as [Google’s `client_secrets.json` template](https://github.com/googleads/googleads-adsense-examples/blob/main/v2/python/client_secrets.json) in the examples repo.

## Show ads (revenue placeholders in the UI)

Display ads are **not** driven by the Management API. Configure **Vite** env vars so `<AdSlot>` can load `adsbygoogle.js`:

- `VITE_GOOGLE_ADS_CLIENT_ID` = your AdSense **`ca-pub-…`** publisher ID  
- `VITE_GOOGLE_ADS_SLOT_LEADERBOARD` / `VITE_GOOGLE_ADS_SLOT_INFEED` = ad **unit** slot IDs from [AdSense](https://adsense.google.com/) → **Ads → By ad unit**

See also **`docs/PUBLISHER_REVENUE_ADSENSE_STRIPE.md`**.
