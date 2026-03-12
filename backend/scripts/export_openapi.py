"""Export OpenAPI schema to JSON. Run from repo root: python backend/scripts/export_openapi.py"""
import json
import os
import sys

# Set minimal env so app loads without real secrets
os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "placeholder")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "placeholder")
os.environ.setdefault("SUPABASE_JWT_SECRET", "placeholder")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.main import app

out = os.path.join(os.path.dirname(__file__), "..", "..", "openapi.json")
with open(out, "w") as f:
    json.dump(app.openapi(), f, indent=2)
print(f"Wrote {out}")
