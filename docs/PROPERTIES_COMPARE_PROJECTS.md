# Properties vs Compare vs Projects

Decision note for Product. No UI changes in this doc — pick **A** or **B** below.

Nav today (`Layout.jsx`): **Compare** → `/Compare`, **Properties** → `/SavedProperties`, **Projects** → `/ProjectDetail`.  
Legacy `/SideBySide` and `/QuickCompare` only redirect to `/Compare`.

---

## 1. What’s stored / computed differently

### Properties (`SavedProperties`)

| | |
|---|---|
| **Role** | Flat library of **manually scored** homes from Evaluate. |
| **API / table** | `api.entities.PropertyScore` → `GET/POST/DELETE /api/property_scores` → `property_scores`. |
| **Stored** | `property_address`, `scores[]` (`category_id`, `category_label`, `importance`, `score`), `weighted_total`, `max_possible`, `percentage`, timestamps. No listing snapshot, lat/lng, or folder. |
| **Computed** | Percentage is **baked in at save** on Evaluate (user-set importance × score). List page only sorts by `percentage` and marks a “Top Pick.” |
| **UI quirk** | Nav says “Properties”; page H1 still says **“Property Comparison”**. Routes comment: formerly the old Compare page. |

### Compare (`Compare`; SideBySide = redirect)

| | |
|---|---|
| **Role** | **Ephemeral side-by-side session** (columns / cards / table), not a durable collection. |
| **Data sources** | (1) Same `PropertyScore` rows as Properties; (2) Browse → Compare handoff via `sessionStorage` (`browseCompare.js`); (3) ad-hoc address search rows. Browse/search rows are in-memory only unless saved elsewhere. |
| **Stored** | No compare-session table. Plan caps enforced via `usePlan` / `api.projects.validateCompare` and optional `PropertyScore.create({ compare_session })`. |
| **Computed** | Client-side winner from selected slots’ `percentage`. Browse rows map `auto_scores` with **fixed importance 5** (or use `overall_percentage` if present). Category grid unions categories from whatever is in the slots. |
| **Extras** | “Save to project” (needs `_browseSnapshot`), ShareComparison, realtor “Send to client for scoring.” |

### Projects (`ProjectDetail`)

| | |
|---|---|
| **Role** | Named **folders** of listings with **project-owned** preference weights; optional collaborators. |
| **API / tables** | `api.projects.*` → `/api/projects` → `user_projects`, `user_project_properties`, `project_members`. |
| **Stored (project)** | `title`, `scoring_presets.weights` (category → 0–10). Limits: 2 projects free / 20 paid. |
| **Stored (property)** | `property_key`, address, lat/lng, full `property_snapshot`, `auto_scores`, `overall_percentage`. Unique per `(project_id, property_key)`. |
| **Computed** | Server `project_scoring.py`: fact + location auto-scores, then **weighted % from project presets**. Changing prefs triggers rescore of all members’ listings. |
| **Collab** | Invite by email; collaborators add/edit properties; owner-only prefs + delete. |
| **UI** | Ranked list by `overall_percentage` — **not** the multi-view Compare layout (though Compare can dump browse selections into a project). |

### Overlap in one line

- **Properties** = durable **manual** Evaluate scores (personal, flat).  
- **Compare** = **view / session** over PropertyScores + temporary browse cards.  
- **Projects** = durable **auto-scored folders** with shared prefs + members.

Same “match %” idea, different persistence and who owns the weights.

---

## 2. Could Projects + Compare merge?

**Yes, as product UX** — they already touch: Browse validates compare count, Compare offers “Save to project,” both use browse auto-scores and the same 2/4 compare caps.

**Not a drop-in data merge** without migration choices:

| Keep separate | Merge friction |
|---|---|
| Compare is session + view modes; Projects are durable + prefs + invites. | Compare still leans on `property_scores` (manual Evaluate). Project scores are auto + project weights — same address can disagree. |
| Properties list is the Evaluate archive. | Folding Compare into Projects without a path for Evaluate rows leaves “Properties” orphaned or forces another import model. |
| SideBySide/QuickCompare already collapsed into Compare. | Easy win already done; remaining confusion is **three** product surfaces, not two URLs. |

**Feasible merge shape:** Projects = source of truth for “homes I’m deciding on”; Compare = view mode *inside* a project (slots from project properties). PropertyScores stay as personal Evaluate history or get copied into a project as snapshots.

---

## 3. Proposals (choose one)

### A — Clearer labeling (no model merge)

Keep three backends; fix names so intent is obvious:

| Surface | Suggested naming |
|---|---|
| SavedProperties | Nav + H1: **Saved scores** (or “My scores”) — *not* “Comparison.” |
| Compare | Keep **Compare** — “Side-by-side session.” |
| Projects | Keep **Projects** — “Folders with scoring preferences.” |

Optional copy: Compare → “Back to saved scores”; empty Properties → “Score a home on Evaluate.” Lowest effort; stops “Properties ≈ Compare ≈ Projects” confusion without schema work.

### B — Merge Compare into Projects

One durable place to collect homes; Compare becomes a project view (or “open in Compare” only with an active project).

Rough implications:

1. Primary path: Browse / Evaluate → add to project → project Compare view.  
2. Decide fate of `property_scores`: keep as personal archive, or migrate/import into projects.  
3. SessionStorage browse handoff targets a project (or “scratch project”) instead of a free-floating Compare page.  
4. Collab + project prefs become the only weight source for “official” ranking; document that Evaluate manual % may differ.

Higher effort; clearest long-term story if Projects are the decision workspace.

---

## Recommendation framing (not a decision)

- Choose **A** if you want clarity now and to keep Evaluate’s personal score history separate from browse/project auto-scoring.  
- Choose **B** if the main user job is “pick among listings with shared criteria,” and Compare-without-a-project is leftover UX.

**User chooses A or B.** This doc does not implement either.
