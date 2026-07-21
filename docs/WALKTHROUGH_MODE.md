# Live walk-through mode — investigation & staged plan

**Status:** Not built (as of 2026-07-21). Pricing lists it as a Premium feature and also as “Coming Soon.” Do not treat existing “Gamified walk-through” UI as this product.

**Goal (product):** Mobile-first, in-person, room-by-room scoring — large taps, room tagging, photos/notes, progress without live numeric score pressure, offline queue, resume. Gate: Premium (and Realtor, via existing `isPremium` / `canUseAIFeatures`).

---

## Honest inventory

### What exists (build on directly)

| Piece | Location | Reuse for live walk-through? |
|--------|----------|------------------------------|
| **Preference questionnaire** (swipe/tap love→hate) | `src/components/ai/GamifiedWalkthrough.jsx`, `backend/app/preference_learning.py`, `questionnaire_*` tables | **Related but different.** Learns category *importance* over time; does not score rooms, capture photos, or tag spaces. Keep as a separate Premium tool (or later merge “after tour” preference pass). |
| **Premium gating** | `PremiumFeatureGroup` / `PremiumGate`, `usePlan().canUseAIFeatures` | Yes — wrap Stage 1 UI the same way Evaluate already wraps the toolkit. |
| **Evaluate score sheet** | `Evaluate.jsx` + `CategorySlider.jsx` (0–10 range sliders, importance + score) | Score *model* and category IDs (`categories.jsx`) are the sync target. UX is **not** tour-friendly (dual thin sliders, live % hero). |
| **Visit library photos** | `user_property_photos`, `PropertyVisits.jsx`, `api.library.uploadPhoto`, Storage `property-photos` | Yes for photo upload/storage. Today: property-level only; optional `caption`; **no room tag**. |
| **Visit notes / personal score** | `user_saved_properties.visit_notes`, `personal_score` | Property-level notes only — not per-room / per-category. |
| **Realtor → client assignment** | `realtor_property_assignments`, Realtor Portal “Send for walk-through”, `ClientAssignmentsInbox` | Entry point for clients; currently opens the **questionnaire**, not a room tour. |
| **Mobile shell** | `Layout.jsx` (`pb-20` + `MobileBottomNav`), safe-area on nav/feedback | Baseline responsive chrome. |
| **Tap haptics** | `src/lib/tapHaptics.js`, `TapFeedback` | Good for large-tap scoring. |
| **Expo camera (native)** | `mobile/App.js` + `expo-camera` | Pattern for capture; web Stage 1 can use `<input capture="environment">` / file picker first. |
| **AI visit-notes → scores (backend only)** | `POST /api/preferences/visit-notes-to-scores` | Optional Stage 2+ assist; **no Evaluate UI** wired today. |

### What does **not** exist (needs groundwork)

- Room model (list of rooms / spaces for a visit session)
- Quick-tap 1–5 (or similar) scoring UI distinct from Evaluate’s 0–10 dual sliders
- Photos/notes **tagged to a room** (or category)
- Progress UX that **hides** live overall % during the tour
- Offline queue / sync / service worker (manifest is metadata-only; no Workbox / `vite-plugin-pwa`)
- Resume of an in-progress **tour session** (questionnaire sessions are a different entity)
- Per-category notes or photos on the main Evaluate scorecard — **confirmed not shipped**

### Pricing copy (current)

- **Free:** “Mobile-friendly for walk-throughs” (generic mobile Evaluate — not the Premium mode).
- **Premium feature list:** “Gamified live walk-through mode” (presented as included).
- **Coming Soon block:** “Gamified Walk-Through” — survey during live tours that auto-scores categories.

**Copy tension:** Sold on Premium and also labeled Coming Soon. Prefer aligning messaging when Stage 1 ships (or move to Coming Soon only until then).

---

## Investigation notes

### 1. Mobile responsiveness (Evaluate / Layout / bottom nav)

- Bottom nav: `md:hidden`, safe-area padding; main/footer get `pb-20` so content clears the bar.
- Feedback FAB sits above the nav (`bottom-[max(5.5rem,...)]`).
- Evaluate uses `px-6`, stacked category cards; importance + score are side-by-side from `md:` up, stacked on small screens.
- Range thumbs are ~18px (Layout global CSS) — usable but not “large tap” tour UX.
- Sticky/live score chrome at top of Evaluate shows overall % — opposite of “no live numeric score pressure.”
- Toast at `fixed bottom-6` can sit near the bottom nav on mobile — watch collisions when adding tour chrome.

**Verdict:** Shell is mobile-ready enough to host a new mode; Evaluate itself is a desktop-ish scorecard, not a tour flow.

### 2. Per-category notes/photos on Evaluate

**Not shipped.** `CategorySlider` has importance + score only. No note field, camera, or media per category. Grep of Evaluate / evaluate components finds no notes/photos UI.

### 3. Visit library, categories, Premium gating

- Photos: Premium/Realtor via library API; upload on Property Visits; schema has `caption` / `sort_order` / `source`, **no `room_id` / `room_tag`**.
- Categories: shared IDs in `src/components/evaluate/categories.jsx` (+ questionnaire subset in `GAMIFIED_QUESTIONS`).
- AI / walk-through toolkit on Evaluate is behind `PremiumFeatureGroup` (`canUseAIFeatures`). Property Visits page also Premium-gated.

### 4. Offline / PWA

- `public/manifest.json` — name, icons, `display: standalone` only.
- No service worker registration, no offline queue, no IndexedDB sync layer.
- Mentions of “offline” in code are incidental (ads blocked, PDF no-op).

### 5. Name collision

Existing product name **“Gamified walk-through”** = preference questionnaire. Proposed **live walk-through mode** = room-by-room tour. Stage 1 docs/UI should use distinct labels (e.g. “Live tour” / “Room walk-through”) to avoid shipping confusion.

---

## Proposed stages

### Stage 1 (first PR) — online-only MVP

**Scope**

1. New Premium entry: “Start live tour” from Evaluate (and optionally from a realtor assignment) — separate from “Start tour questionnaire.”
2. Room tagging: curated room list (Kitchen, Living, Primary bed, Bath, Exterior, Other…) + optional custom label; progress = rooms visited / total, **not** live overall %.
3. Quick-tap scoring: large 1–5 (map to existing 1–10 category scores on sync, e.g. ×2) for categories relevant to the current room.
4. Camera / gallery: capture or pick photo → upload via `api.library.uploadPhoto` when online; store room tag in **new** column or caption convention until schema lands (prefer migration: `room_tag text` on `user_property_photos`).
5. Optional short note per room → append into `visit_notes` or a new `walkthrough_sessions` JSON blob.
6. On complete: write/update property score categories + ensure saved property exists in library.
7. Gate with existing Premium helpers; require Python backend + library (same as Visits).

**Out of scope for Stage 1:** offline queue, voice notes, polish animations, auto-score from notes LLM.

**Suggested schema (minimal)**

- `walkthrough_sessions` — user, property_address, status, rooms jsonb, scores jsonb, started/completed.
- `user_property_photos.room_tag` (nullable text) — or `metadata jsonb`.

### Stage 2+

- Offline queue (IndexedDB + flush on `online`); optional true PWA caching later.
- Voice notes → text (or attach audio blobs).
- Resume interrupted sessions; hide Evaluate % until tour ends.
- Wire `visit-notes-to-scores` as optional “fill from notes” after tour.
- Motion / celebratory progress (without score anxiety).
- Native Expo flow sharing the same session API.
- Clarify Pricing: remove from Coming Soon when Stage 1 is live, or demote feature bullet until then.

---

## Gate

Always **Premium** (and Realtor/Admin via `isPremium` / `canUseAIFeatures`), consistent with Pricing and current AI toolkit gating. Free remains “mobile-friendly Evaluate,” not live tour mode.

---

## Non-goals for Stage 1

- Replacing Evaluate’s full scorecard
- Claiming the preference questionnaire *is* live walk-through mode
- Shipping offline as incomplete/fake sync
