# PropertyPulse API (FastAPI)

All supported APIs and env vars: **[`../docs/API_CONFIGURATION.md`](../docs/API_CONFIGURATION.md)** (and `../.env.example` for the Vite app).

**AdSense (Google’s [v2/python samples](https://github.com/googleads/googleads-adsense-examples/tree/main/v2/python)):**  
`scripts/adsense_oauth_to_env.py` + [`scripts/README_ADSENSE.md`](scripts/README_ADSENSE.md)

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # then fill in secrets
```

## Run

```bash
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Health: `GET http://localhost:8000/health`
- API prefix: `/api`, integrations: `/api/integrations/...`

Use a project-local `.venv` (already gitignored) so `pip install` does not require writing to system Python.
