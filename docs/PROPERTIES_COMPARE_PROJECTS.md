# Properties vs Compare vs Projects

Architecture investigation for Product. **No UI or schema changes** in this note — choose **A** or **B** below before any implementation.

**Nav today** (`Layout.jsx`):

| Nav label | Route key | Path |
|-----------|-----------|------|
| Compare | `Compare` | `/Compare` |
| Properties | `SavedProperties` | `/SavedProperties` |
| Projects | `ProjectDetail` | `/ProjectDetail` (± `?id=`) |

Legacy `/SideBySide` and `/QuickCompare` only redirect to `/Compare`.

**Out of scope (adjacent):** **Visits** (`user_saved_properties` / `property_folders`) is a fourth, premium visit-photo library — see `docs/VISIT_LIBRARY.md`. It is not the “Properties” nav item.

---

## Summary matrix

| | **Properties** | **Compare** | **Projects** |
|---|---|---|---|
| **JTBD** | Keep a durable archive of homes I manually scored | Hold 2–4 candidates in a working side-by-side view right now | Organize a named search (prefs + listings + collab) |
| **Persistence** | DB `property_scores` | Ephemeral (React slots + sessionStorage handoff) | DB `user_projects` + `user_project_properties` |
| **Score source** | Manual Evaluate (user importance × score) | Mix of saved PropertyScores + browse auto-scores | Server auto-scores × **project** weights |
| **Plan caps** | None on row count | 2 free / 4 paid slots | 2 free / 20 paid projects |
| **Feeds others?** | → Compare (picker + default slots) | → Projects (“Save to project”) | → Compare? **No** (today) |

---

## 1. Properties (nav “Properties” → `SavedProperties`)

### User intent

“I evaluated this address on **Score address / Evaluate** and want a lasting ranked list of my personal scores.”

### What is stored

| Layer | Detail |
|-------|--------|
| **Table** | `property_scores` (`supabase/migrations/20250222000000_propertypulse_schema.sql`) |
| **API** | `api.entities.PropertyScore` → `GET/POST/DELETE /api/entities/property_scores` |
| **Columns** | `user_id`, `property_address`, `scores` (jsonb array of `{category_id, category_label, importance, score}`), `weighted_total`, `max_possible`, `percentage`, `created_at` |
| **Not stored** | Listing snapshot, lat/lng, photos, folders, project linkage |

Created from **Evaluate** via `PropertyScore.create(...)` after the user rates categories.

### What is computed

- **At save (Evaluate):** `percentage = round(Σ(importance × score) / Σ(importance × 10) × 100)`.
- **On Properties page:** client sorts by `percentage`, labels highest as “Top Pick.” No rescoring on load.

### Relationship

- **Compare pulls from Properties:** yes — Compare loads all `PropertyScore` rows as the picker pool and, if no browse handoff, seeds the first two slots from them.
- **Projects:** no automatic sync; Properties and Projects are separate score stores.

### Naming quirk

Nav = “Properties”; page H1 = **“Property Comparison”**; route comment = “formerly the old Compare page.” SEO title is already clearer (“Your scored properties”).

---

## 2. Compare (`/Compare`; SideBySide = redirect)

### User intent

“Show me these few homes **side by side** (columns / cards / table) so I can pick a winner in this session.”

### What is stored

| Layer | Detail |
|-------|--------|
| **DB** | **No** compare-session table |
| **sessionStorage** | `browseCompareProperties` (+ `browseComparePropertiesBackup`, ~2 min TTL) via `src/lib/browseCompare.js` — Browse / Evaluate / QuickCompare handoff |
| **React state** | `slots[]` (score ids or null), `scores[]` (merged PropertyScores + ephemeral browse/search rows), `viewMode` |
| **Cleared on logout** | `clearClientAuth.js` removes compare-related session keys |

Ephemeral browse/search rows live only in memory unless the user uses **Save to project** (requires `_browseSnapshot`).

### What is computed

- Plan slot limit: `usePlan().maxCompareCount` (2 / 4); soft-check `POST /api/projects/compare/validate`.
- Winner = highest `percentage` among filled slots.
- Browse → compare row: map `auto_scores` with **fixed importance 5**, or use `overall_percentage` if present (`browseListingToCompareRow`).
- Category grid = union of categories on currently selected rows.

### Relationship

| From → To | Behavior |
|-----------|----------|
| Browse → Compare | Checkbox selection → sessionStorage → Compare consumes and fills slots |
| Evaluate → Compare | “Compare” button writes one listing into sessionStorage |
| Properties → Compare | Same `PropertyScore` list powers slots/picker; empty handoff defaults to first 2 saved scores |
| Compare → Projects | “Save to project” for rows that still have `_browseSnapshot` |
| Projects → Compare | **Not wired** — no “open project in Compare” |

### Extras

ShareComparison; realtor “Send to client for scoring”; PaywallModal when adding slots past free limit.

---

## 3. Projects (`ProjectDetail`)

### User intent

“This is my **named search folder** (e.g. ‘Denver under 600k’) with **its own** importance weights, auto-ranked listings, and optional collaborators.”

### What is stored

| Layer | Detail |
|-------|--------|
| **Tables** | `user_projects`, `user_project_properties` (`20260721160000_user_projects.sql`); `project_members` (collab, later migration) |
| **API** | `api.projects.*` → `/api/projects` (**Python backend required**; Supabase/Base44 adapters reject) |
| **Project row** | `title`, `scoring_presets` (`{ weights: { category_id: 0–10 } }`) |
| **Property row** | `property_key`, `property_address`, lat/lng, `property_snapshot`, `auto_scores`, `overall_percentage`; unique `(project_id, property_key)` |
| **Limits** | 2 projects free / 20 paid (`usePlan` + API) |

Entry points: Browse “Start project” / “Save selected,” Compare “Save to project,” Projects list “Start project.”

### What is computed

Server `backend/app/project_scoring.py`:

1. Fact + location **auto-scores** (browse scoring stack).
2. `overall_percentage` = weighted % using **that project’s** presets.
3. Updating prefs can **rescore** all properties in the project.

UI: ranked list by `overall_percentage` — **not** Compare’s multi-view layout.

### Relationship

- Can receive listings **from** Browse and Compare.
- Does **not** currently push into Compare slots.
- Scores are **not** the same rows as `property_scores` — same address can have different % (manual Evaluate weights vs project auto weights).

---

## 4. Overlap & confusion sources

1. **Three “sets of homes”** in nav with overlapping verbs (compare / save / score).
2. **Properties page still titled like Compare** while Compare is the real side-by-side.
3. **Two durable score systems:** `property_scores` (manual) vs `user_project_properties` (auto + project prefs).
4. **Compare is a view/session; Projects are folders** — product language sometimes blurs them (“save to project” from compare).
5. **Visits folders** (`property_folders`) are yet another folder concept for visit photos — easy to confuse with Projects if not labeled carefully.

---

## 5. Proposal options (choose one)

### (A) Keep all three + clearer nav / labels / first-visit explainers

**Idea:** Keep the three backends; make intent obvious in copy and onboarding.

| Surface | Suggested labeling |
|---------|-------------------|
| SavedProperties | Nav + H1: **Saved scores** (or “My scores”) — drop “Property Comparison” |
| Compare | Keep **Compare** — “Working side-by-side (clears when you leave / not a folder)” |
| Projects | Keep **Projects** — “Named folders with scoring preferences” |

Optional: one-time explainer strip; Compare “Back to saved scores”; empty states that point to Evaluate vs Browse.

**Pros:** Lowest effort; preserves Evaluate history as personal archive; no migration.  
**Cons:** Three concepts remain; power users may still ask “where do I put this house?”

### (B) Merge plan if two are redundant

**Most plausible merge:** Treat **Project = named persistent Compare set**.

Rough target UX:

1. Primary path: Browse / Evaluate → add to a **project** → open **Compare view inside that project** (slots from project properties).
2. Standalone `/Compare` either becomes “scratch / last session” or always requires (or creates) a project.
3. Decide fate of `property_scores`:
   - keep as personal Evaluate archive only, **or**
   - import/copy into projects as snapshots.
4. Project prefs become the weight source for “official” ranking in that workspace; document that Evaluate manual % may differ.

**Pros:** One durable “decision workspace”; Compare becomes a **mode**, not a third collection; matches collab + prefs already on Projects.  
**Cons:** Higher effort; must migrate mental model + data; Evaluate-only users need a clear path; sessionStorage handoff must target a project (or scratch project).

**Less recommended:** Merging Properties into Compare (Compare is intentionally ephemeral). Merging Properties into Projects without a Compare view loses the side-by-side job.

---

## Lean recommendation (Product still chooses)

**Prefer (A) near-term**, then optionally evolve toward **(B)** once Projects usage is proven.

**Rationale:**

- The three surfaces already encode **different jobs** (archive vs session view vs named weighted folder). Redundancy is mostly **naming and missing “Projects → Compare”**, not three identical stores.
- A full merge (B) is a product + migration project; A fixes the main confusion (Properties H1 / nav) cheaply and keeps Evaluate history intact.
- A small **bridge** that does not require choosing B yet: “Open in Compare” from a project (feed slots from `user_project_properties`) — clarifies relationship without collapsing models.

**If** analytics show users treat Compare as a permanent shortlist and ignore Projects, switch to **(B)** and make Compare a project view.

**User chooses A or B (or A-then-B).** This doc does not implement either.
