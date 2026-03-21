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

## Peer sharing & invitations

Migration: `20250229000000_peer_sharing_and_invites.sql`

- **`library_peer_shares`** — share **one folder** or **one saved property** with another user (`recipient_user_id`). View-only for recipients in the API; folder shares allow opening each listing inside the folder.
- **`app_invitations`** — email invites with a **token**; links look like `{APP_PUBLIC_URL}/login?invite={token}`. Accept after sign-in: `POST /api/invitations/accept` (profile email must match invitee).

**Endpoints**

- `GET /api/library/users/search?q=` — find profiles to share with (premium).
- `POST /api/library/peer-shares` — `{ recipient_user_id, folder_id | saved_property_id, message? }`
- `GET /api/library/shared-with-me` — incoming peer shares (enriched).
- `GET /api/library/peer-shares/outgoing` — shares you sent.
- `DELETE /api/library/peer-shares/{id}`
- `POST /api/invitations` — `{ emails: [], message? }` (premium)
- `GET /api/invitations/validate?token=` — public
- `POST /api/invitations/accept` — authenticated
- `GET /api/invitations/sent`

Set **`APP_PUBLIC_URL`** in the backend env so invite links point at your deployed web app.

**Web:** Profile → **Invite & share** (contacts picker on supported browsers). **Visits** → **Shared with you** + share folder/property with another account; **Share with realtor** unchanged.

**Mobile:** `expo-contacts` + share sheet for a generic app link; full tracked invites still use the web Profile flow.
