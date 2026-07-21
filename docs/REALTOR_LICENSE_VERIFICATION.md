# Realtor license verification

**Status:** Phase 1 shipped (schema + request + admin fulfill).  
**Rule:** Never show Verified / green check unless `license_verification_status = verified` after a real check.

## How a realtor requests verification
1. Realtor Portal → Profile (or Profile → Profile): enter license #, 2-letter state, brokerage.
2. Save, then **Request verification** → status `pending`.
3. UI shows self-reported / pending — **no green check**.

## How ops verifies (MVP)
1. Admin: `profiles.plan=admin` or UUID in `PLATFORM_ADMIN_USER_IDS` / `ADMIN_USER_IDS`.
2. `GET /api/admin/license-verification/pending`
3. Open `lookup_url` (state board), confirm license + name.
4. `PATCH /api/admin/license-verification/{user_id}` `{ "status": "verified"|"rejected", "notes": "..." }`

## Where the green check appears
Only when verified: Profile header, Realtor Portal header, Contacts (realtor), Shared Homes sender.

Self-reported ≠ verified. Free-text alone never shows Verified.

## Legal
Not legal advice — recommend attorney review before consumer “verified realtor” marketing.

Migration: `20260721290000_realtor_license_verification.sql`
