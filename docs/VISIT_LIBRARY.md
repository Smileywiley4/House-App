# Property visits & library

## Who can use it

- **Premium or Realtor** subscription (`profiles.plan` in `premium`, `realtor`, or `admin`).
- **Realtor inbox** (`GET /api/library/realtor/inbox`) requires **Realtor** (or admin) plan.

## Database

Apply migration:

`supabase/migrations/20250228000000_user_property_library.sql`

Creates:

- `user_saved_properties` — address, scores, **personal_score** (1–10), **visit_notes**, listing URL snapshot
- `user_property_photos` — Supabase Storage paths (`property-photos` bucket), `user_upload` | `listing_import`
- `property_folders` / `property_folder_items`
- `property_realtor_shares` — buyer → subscribed realtor
- `profiles.linked_realtor_id` — optional default realtor link (also patchable via `PATCH /api/auth/me`)

## Backend (FastAPI)

- Router: `app/routers/user_library.py` → prefix `/api/library`
- Listing scrape: `app/listing_photos.py` (best-effort HTML image extraction; respect site terms/robots in production)

## Web app

- **Visits** nav → `PropertyVisits` page (`VITE_USE_PYTHON_BACKEND=true` required for `api.library`).
- **Realtor Portal** → **Shared visits** tab for inbox.

## Mobile (Expo)

- `mobile/` includes `expo-camera` + `expo-sharing`.
- `App.js` — capture + share; add Supabase auth + multipart upload to the same photo endpoint when you wire tokens.

## Legal / scraping

Importing photos from third-party listing URLs is **best-effort** for user-provided links they are allowed to access. Do not use it to bypass MLS or site terms of service.
