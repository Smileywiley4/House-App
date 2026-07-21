# Realtor license verification

**Status:** Investigation / design notes only. No automated verification ships today.  
**Rule:** Never show **Verified** (or equivalent trust chrome) unless a real check against an authoritative source succeeded.

Last reviewed: 2026-07-21

---

## What’s in the app today

### Schema (`public.profiles`)

From `supabase/migrations/20250222000000_propertypulse_schema.sql`:

| Column | Type | Notes |
|--------|------|--------|
| `realtor_license` | `text` | Free-form; no format or state check |
| `brokerage` | `text` | Free-form |
| `state` | `text` | Free-form practice state (not dedicated `license_state`) |

There is **no** `verification_status`, `verified_at`, `license_state`, or related audit fields.

Authenticated clients may update `realtor_license`, `brokerage`, and `state` directly (`20260709150000_restrict_profile_sensitive_updates.sql`). Backend `PATCH /api/auth/me` accepts the same fields with length limits only (`backend/app/routers/auth.py` → `UpdateProfileBody`).

### UI

| Surface | Behavior |
|---------|----------|
| **Realtor Portal → Profile** | Editable Brokerage, License #, State of Practice. Copy says info is “used to **verify** your realtor access” — inaccurate: access is plan/role gated. |
| **Profile → Profile tab** | Optional Realtor License + Brokerage + State. No status label. |
| **Client-facing** | Brokerage may appear (e.g. visits / realtor search); license is not treated as verified. |
| **Pricing** | Realtor plan lists “Realtor profile & **license verification**” — **marketing overclaim**; no verification exists. |

### What actually gates “Realtor”

`plan === "realtor"` / `role === "realtor"|"admin"` (Stripe / admin), **not** license fields. Anyone on a Realtor plan can type any brokerage/license string.

---

## Real-time US license lookup — realistic now?

**Verdict: Partial — yes for a small subset via official open-data APIs; no for national real-time coverage without a paid aggregator or per-state scrape (avoid scrape).**

There is **no** single official national API for US real-estate licenses. NAR membership ≠ state license authority.

### Prefer official APIs / bulk downloads only

| Jurisdiction | Feasibility | Notes |
|--------------|-------------|--------|
| **Texas (TREC)** | **Easy (official)** | Open Data / Socrata: [Broker and Sales Agent License Holder Information](https://data.texas.gov/dataset/Broker-and-Sales-Agent-License-Holder-Information/s7ft-44qi) — SODA JSON by `license_number`, status, related broker fields. Good first pilot. |
| **Colorado (DORA)** | **Easy (official)** | [data.colorado.gov](https://data.colorado.gov/) Socrata datasets for licensed real-estate professionals / professional licenses — queryable SODA API. |
| **Florida (DBPR)** | **Partial (official bulk, not live REST)** | Weekly CSV licensee files + public web lookup; no first-party real-time REST. Can ingest officially published CSVs on a schedule; do not scrape the portal. |
| **California (DRE)** | **Hard without vendor** | Public web lookup; no well-documented free official API for product use. Third-party scrapers exist — **out of policy** (ToS / fragility). |
| **NY, WA, most others** | **Portal / PDF / no stable open API** | Manual lookup or licensed data vendor. |

### Third-party aggregators (optional later)

Services such as **RELD** (Real Estate License Database) offer normalized multi-state verify APIs. They can be legitimate product partners, but:

- They are **not** the state board; freshness and coverage vary by jurisdiction.
- Treat hits as “verified against vendor dataset at `verified_at`,” not “government-certified identity.”
- Still require name/license match rules and human review for edge cases.

**Do not** scrape state board HTML/ASP portals to fake “real-time” coverage.

---

## Recommended interim (honest, no theater)

1. **Treat license + brokerage as self-reported** in product copy and (when you touch UI) a clear **Self-reported** label next to those fields.
2. **Fix overclaims now (copy-only):**
   - Pricing: rename “license verification” → e.g. “Realtor profile (license & brokerage)” or “License & brokerage on profile.”
   - Realtor Portal: remove “used to verify your realtor access”; say it personalizes display / is self-reported.
3. **Keep Realtor plan access payment/role-based** until verification exists; do not imply license fields unlock access.
4. **Optional low lift:** link “Look up your license” to the state’s official public search URL by selected `license_state` (external tab) — helps users, doesn’t claim we verified.
5. **Later:** state-by-state automated check (start TX + CO), status machine below; only then show **Verified**.

**Never:** green check / “Verified” / BadgeCheck meaning license-checked unless `verification_status = verified` after a real lookup.

---

## Schema fields to add later

Suggested columns on `profiles` (or a `realtor_license_verifications` table if you want history):

```text
license_state          text        -- ISO-ish USPS code: CA, TX, …
license_number         text        -- prefer over overloaded realtor_license long-term
license_type           text        -- optional: salesperson | broker | …
brokerage              text        -- keep; optionally brokerage_license_number
verification_status    text        -- self_reported | pending | verified | failed | expired
verification_source    text        -- e.g. trec_soda | colorado_soda | reld | manual_admin
verified_at            timestamptz
verification_checked_at timestamptz
verification_expires_at timestamptz -- optional; re-check before renewals
verification_failure_reason text
verified_name_match    text        -- snapshot of board name used for match
```

Migration notes:

- Backfill: existing `realtor_license` → `license_number`; `state` → normalize into `license_state` where possible; set `verification_status = 'self_reported'`.
- Restrict client updates: users may edit self-reported fields; **only service role / backend** may set `verified*` / `verification_status` to `verified`.
- Re-edit of license number or state should reset status to `self_reported` or `pending`.

### UI status labels (honest)

| Status | Client-visible label |
|--------|----------------------|
| `self_reported` / null | **Self-reported** |
| `pending` | **Verification pending** |
| `verified` | **Verified** (+ state + date) |
| `failed` | **Could not verify** (no scare copy; offer official lookup link) |
| `expired` | **Previously verified — re-check needed** |

---

## Implementation phases (when product asks)

| Phase | Scope |
|-------|--------|
| **0** | Copy honesty + optional Self-reported label (no Verified). |
| **1** | Schema + admin/manual verify path (support marks verified after viewing state site). |
| **2** | Automated TX (+ CO) SODA lookup on save; match license # + fuzzy name; store provenance. |
| **3** | FL CSV ingest job or paid aggregator for broader coverage; never scrape. |

---

## Liability / trust notes

- Self-reported credentials without disclosure create **trust and liability** risk if clients believe the app checked the board.
- Terms already state Property Pocket is not a brokerage; still avoid implying regulatory credentialing.
- Recommend qualified legal review before any “Verified realtor” consumer marketing.

---

## Explicit product rule

> **Never show “Verified” unless actually checked** against an official open-data API, an officially published bulk file we ingested, a contracted data vendor with documented source, or a documented human review. Free-text license fields alone are always **Self-reported**.
