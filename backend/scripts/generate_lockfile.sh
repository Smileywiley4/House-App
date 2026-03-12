#!/bin/sh
# Generate backend/requirements.lock from current environment. Run after: pip install -r requirements.txt
cd "$(dirname "$0")/.."
pip freeze > requirements.lock
echo "Wrote requirements.lock"
