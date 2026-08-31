# Implementation Plan — Sticker Wall K-Means Curator
**Problem:** SPR26_D2_P02 · **Candidate Code:** CC63 · **Interview:** Sep 1 2026, 08:00 IST

---

## 1. Problem in one line

Build a browser tool that runs deterministic K-Means over a hand-designed set of 8–12 stickers with 2–3 centres, step-by-step, so a volunteer can watch every assignment, every centre update, and every convergence check with full explanatory replay — and prove the app's output matches an independently hand-worked oracle.

---

## 2. Technology stack + why

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Browser, single `index.html` opened directly | Zero build, zero server, one-command demo |
| Language | Vanilla JavaScript (ES modules) | No framework surface to defend; every function is mine |
| Visualization | HTML5 Canvas (native) | No Chart.js/D3 dependency; scatter plot is ~40 lines |
| Styling | Plain CSS (single stylesheet) | Text/symbol legend as required — no colour-only cues |
| Tests | **Jest** on the engine module | Matches resume claim (Tools & Testing: Jest); pure-JS engine has no DOM to mock |
| Package manager | npm | Only needed for Jest |

**Rejected options and why:**
- **Next.js / React** — I don't list React as a skill and won't invent one under interview pressure. Framework noise hides the algorithm.
- **Chart.js / D3** — Adds a library I'd have to defend; a 10×10 scatter plot is trivial in Canvas.
- **Python / Streamlit** — Interviewer expects a browser demo; local server would be a moving part.

**Defensible one-liner for the interview:** *"I picked the smallest surface area that satisfies every acceptance criterion, so I can explain every line and modify it live in the browser."*

---

## 3. File layout

```
sticker-wall/
  index.html              # UI shell + Canvas + panel cards + controls
  css/style.css           # Layout, legend, colour + symbol treatment
  js/engine.js            # Pure K-Means logic — no DOM references
  js/ui.js                # DOM wiring, Canvas draw, event handlers
  tests/engine.test.js    # Jest unit tests
  data/oracle.md          # Hand-worked expected values per iteration
  package.json            # Jest config only
  README.md               # How to run + how to test
  PROMPTS.md              # AI interaction log (built as I work)
  DESIGN.md               # Architecture, trade-offs, AI-influenced decisions
```

**Why split `engine.js` from `ui.js`:** Same iteration function is called by Step, Run to End, and every test. If a test needs to call `runIteration()` without a Canvas, it can. This is also how I prove Step and Run to End produce identical states — one code path.

---

## 4. Five-step implementation plan

### Step 1 — Design the sticker collection + write the oracle
**Duration:** ~1.5 hrs · **Deliverable:** `data/oracle.md`

**Design targets (from PS contract):**
- Theme: `Cosmic Cafe` (or similar) — 10 stickers, k = 3 panels: `nebula` (cool/quiet), `comet` (cool/bright), `ember` (warm/bright)
- Sticker coordinates chosen so that:
  - Exactly one sticker is tied between two centres in iteration 1 (solve `d²(s, c₁) = d²(s, c₂)` for an integer-friendly pair)
  - At least one sticker is far enough from its iteration-1 centre that centroid drift reassigns it in iteration 2 or 3
  - No centre is empty at convergence
  - Full run converges in 3–5 iterations (target 4)

**Work by hand (or in a spreadsheet), record for every iteration:**
- Assignment map `sticker_id → centre_id`
- Squared distance from each sticker to each centre (unrounded)
- Updated centre coordinates (unrounded)
- Total squared error (unrounded)
- Centre movement per centre (unrounded)
- Assignment signature (concatenation in sticker source order)
- Converged flag

**Checkpoint:** `oracle.md` contains an iteration table the app must reproduce without reading it. A second small oracle exists for the empty-panel scenario (deliberately place all stickers on one side so one centre gets nothing on iteration 1).

**Guardrail:** No number in `oracle.md` is ever imported by the app. The oracle exists to *check* the app, not *drive* it.

---

### Step 2 — Core engine module (`engine.js`)
**Duration:** ~2 hrs · **Deliverable:** Pure JS module + first passing tests

**Public surface:**
```js
export function validate(collection)          // → { ok, errors[] }
export function squaredDistance(a, b)         // → number
export function assign(stickers, centres)     // → assignments[]  (tie: earlier centre wins, 1e-12 tol)
export function updateCentres(stickers, assignments, centres)  // empty panel → keep old coords
export function totalSquaredError(stickers, assignments, centres)
export function signature(assignments)        // → string
export function runIteration(state)           // → new state, single source of truth for Step + Run to End
export function isConverged(currentSig, prevSig, iteration)  // iteration 0 always false
```

**Contract gotchas encoded here (defensibility ammunition):**
- Squared distance comparisons use **unrounded** floats; ties within `1e-12` resolved by centre source order
- Empty centre retains previous coordinates exactly; movement = 0; no NaN, no divide-by-zero
- `runIteration` performs the four stages in strict order: Assign → Update → Measure → Check
- First iteration is never converged even if the signature happens to match a synthetic prior state

**Checkpoint:** Jest tests for the PS's built-in `button/star/flame/heart/sun` example pass end-to-end. Iteration 1 produces `mint=(2.5, 2.5)`, `coral=(6.667, 6.667)`, SSE `42.333`. Iteration 2 produces `mint=(0, 0)`, `coral=(6.25, 6.25)`, SSE `21.5`. Iteration 3 is CONVERGED.

---

### Step 3 — Replay controller + main-collection run
**Duration:** ~1.5 hrs · **Deliverable:** State machine wired to engine, main oracle reproduced

**Controller state:**
```js
{
  originalStickers, originalCentres,   // frozen — Reset restores from these
  currentStickers, currentCentres,     // Reset also restores from originals
  iteration,                           // 0 before first Step
  assignments,                         // last iteration's assignments
  prevSignature,                       // for convergence check
  status,                              // 'ready' | 'running' | 'CONVERGED' | 'NOT_CONVERGED'
  history                              // array of iteration snapshots — powers "inspect any iteration"
}
```

**Behaviour to lock in:**
- `step()` calls `runIteration()` once, appends to history
- `runToEnd()` loops `step()` until CONVERGED or 20 iterations → NOT_CONVERGED (keep iteration 20 visible)
- `reset()` restores `currentStickers` and `currentCentres` from originals; clears history and status
- `editSticker(id, warmth, sparkle)` validates → mutates `currentStickers` only (`originalStickers` stays frozen for Reset) → restores `currentCentres` from `originalCentres` → clears history, assignments, and metrics
- `reset()` restores `currentStickers` from `originalStickers` and `currentCentres` from `originalCentres` (both frozen references — never mutated at any point in the lifecycle)
- **Step and Run to End share `runIteration()`** — no separate loop code path

**Checkpoint:** Console-run the main Cosmic Cafe collection through Run to End. Every iteration's assignments, centres, SSE, and convergence flag match `oracle.md`. Then Reset, then Step through the same collection one iteration at a time — history at convergence is byte-identical to the Run to End history.

---

### Step 4 — UI (`index.html` + `ui.js` + Canvas)
**Duration:** ~2 hrs · **Deliverable:** Interactive workspace

**Layout (single page, three regions):**
- **Left:** Canvas warmth×sparkle map, 0–10 both axes, gridlines, axis labels
  - Sticker markers: circle + text label + shape-per-panel (○/△/□) so colour isn't load-bearing
  - Initial centres: hollow ✕; current centres: filled ★; assignment lines: thin grey from sticker to its centre
- **Right top:** Iteration counter, status pill (READY / iteration N / CONVERGED / NOT_CONVERGED), total SSE, "reset from original" note
- **Right middle:** Panel cards — one per centre, listing member sticker IDs in source order, current coords, movement this iteration
- **Right bottom:** Sticker inspection panel — click a sticker to see its unrounded squared distance to *every* current centre (displayed to 3 decimals), the assigned centre, and a "tie broken by source order" note when applicable
- **Bottom bar:** `Load Demo` · `Step` · `Run to End` · `Reset` · sticker editor (dropdown + warmth + sparkle + Apply)

**Legend:** Uses shape *and* colour *and* text labels — required by contract (must be understandable without colour alone).

**Checkpoint:**
- Load Demo → main collection appears, iteration 0
- Step 4 times → CONVERGED, panel cards, movements, SSE all match oracle
- Click any sticker → inspection panel shows correct distances
- Edit one sticker's coordinate → assignments and iteration reset from original centres
- Reset → back to original stickers, original centres, iteration 0, no stale highlights

---

### Step 5 — Tests, edge cases, deliverable docs
**Duration:** ~1.5 hrs · **Deliverable:** Green Jest suite + README + PROMPTS + DESIGN

**Test list (mapped to PS "Required" acceptance items):**

| # | Test | Covers |
|---|---|---|
| 1 | `squaredDistance` on known pairs | Formula correctness |
| 2 | Exact tie → earlier centre in source order wins | Tie rule |
| 3a | Difference of `0.5e-12` → still tied → earlier centre wins | Float tolerance (inside window) |
| 3b | Difference of `2e-12` → not tied → smaller distance wins | Float tolerance (outside window) |
| 4 | `updateCentres` on manually computed means | Mean update |
| 5 | Later reassignment (2-iter case) | Reassignment across iterations |
| 6 | Empty panel — centre retained exactly, movement = 0 | Empty-panel retention |
| 7 | `totalSquaredError` on hand-worked example | SSE arithmetic |
| 8 | Signature convergence — matching signatures → CONVERGED | Convergence rule |
| 9 | First iteration cannot be CONVERGED even if signature matches | First-iteration guard |
| 10 | 20-iteration ceiling → NOT_CONVERGED with state visible | Defensive cap |
| 11 | Invalid k (0, 1, 5) → rejected | k validation |
| 12 | Coordinate outside 0–10 → rejected | Coordinate validation |
| 13 | Duplicate sticker ID → rejected | ID validation |
| 14 | Non-finite coordinate (NaN, Infinity) → rejected | Numeric validation |
| 15 | Edit sticker → history cleared, restarts from original centres | Edit semantics |
| 16 | Reset → original stickers and centres restored exactly | Reset semantics |
| 17 | Main oracle end-to-end reproduction | Integration proof |
| 18 | Empty-panel oracle end-to-end reproduction | Empty-panel integration |
| 19 | Step-loop history `deepEqual` Run-to-End history on main collection | Same-code-path proof (contract-critical) |

**Docs to write:**
- `README.md` — one-command run (`open index.html`), test command (`npm test`), file map
- `PROMPTS.md` — chronological log of the key prompts I sent to Claude, what I accepted, what I rejected, what I refined
- `DESIGN.md` — the technology-stack rationale from §2, the two-module split, the "engine has no DOM" invariant, trade-offs I deferred (animation framework, JSON export, image save)

**Checkpoint:** All 18 tests green. README lets a stranger run the app and the tests. PROMPTS shows iterative refinement (not one-shot).

---

## 5. Deliverable → Cisco-required-item mapping

| Cisco deliverable (Student Guide) | Where it lives in my repo |
|---|---|
| Implementation Plan | `01_IMPLEMENTATION_PLAN.md` (this file) |
| Working Solution + running instructions | `index.html`, `README.md` |
| Sample data | `data/oracle.md`, `js/engine.js` (main + empty-panel collections) |
| AI Interaction Documentation | `PROMPTS.md` |
| Design Summary | `DESIGN.md` |
| Test Evidence | `tests/engine.test.js`, screenshot of green Jest run |
| Live modification readiness | See §7 below |

---

## 6. Contract landmines I have to defend (do not let these slip)

1. **Unrounded comparisons.** Display shows 3 decimals, but assignment, movement, and convergence use full-precision floats. Rounding for display never touches calculation.
2. **First iteration is never converged.** Even if the signature I construct pre-iteration matches (it won't, but a smart interviewer might try to trap me on this), iteration 1 always runs.
3. **Empty panel retention.** Old centre coordinates preserved exactly; movement = 0; no `NaN`, no `Infinity`.
4. **Edit vs Reset.** Editing a sticker restarts iteration from **original centres**, not current centres. Reset restores stickers *and* centres.
5. **Step and Run to End produce identical final state.** Same `runIteration()` code path. I will prove this in a test that snapshots both histories and compares them.
6. **Deterministic tie-break by centre source order** (not sticker source order). Ties within `1e-12` collapse to earlier centre.
7. **Signature = concatenation of assigned centre IDs in sticker source order.** Not sorted, not hashed — plain concatenation. Convergence is `currentSig === prevSig`.

---

## 7. Live modification readiness

Likely 10-minute asks the interviewer might frame as a "user request." My workflow for each: restate → identify constraints → prompt Claude → review diff → apply → verify against oracle.

**I do not choose the modification — the interviewer does.** The ranking below is by predicted likelihood *and* by rehearsal priority (I should practice the safest ones first).

**Predicted asks (ranked by "safe to attempt in 10 min"):**
1. *"Highlight stickers that changed panel this iteration"* — Compare `assignments[i]` to `history[iteration-1].assignments[i]`, add a badge to the sticker marker. Contained to `ui.js`. Oracle still valid. **Safest — rehearse this one first.**
2. *"Export the final panel memberships as JSON"* — Add a Download button, serialize `{iteration, status, panels: {centreId: [stickerIds]}}`. Zero engine change. Oracle still valid.
3. *"Add a Back button that steps one iteration backwards"* — Replay `history[iteration - 1]` visually; engine unchanged, controller adds one method. Oracle still valid.
4. *"Change the tie-break to alphabetical sticker ID"* — Modify one line in `assign()`. Test #2 goes red immediately — I flag that I'd update the test suite alongside the code change, not just the code.
5. *"Add a movement threshold as a secondary convergence signal"* — Refuse to change the primary convergence rule (signature-based, per contract). *Add* a display-only "small movement" hint. Explain out loud why I'd reject the naive interpretation.
6. *"Add a fourth panel"* — Change demo k to 4, add a fourth centre. Higher risk because it invalidates the oracle; I'd demo it interactively and be explicit that I can't oracle-check the modified run in 10 min. Only attempt if the interviewer specifically asks.

**Environment ready:** repo pre-opened in editor, `index.html` open in browser, terminal on `npm test`, Claude tab pinned.

---

## 8. Changes from plan

*To be filled during implementation. Format:*

- **Step 2:** implemented as planned
- **Step 3:** implemented as planned - createController factory with deepFreeze originals, step/runToEnd sharing one code path, editSticker/reset semantics, 20-iter cap; all 43 tests green including full Cosmic Cafe and empty-panel oracle reproduction. — engine.js has 8 functions, zero DOM refs, dual CJS/window export; all 20 Jest tests green including PS built-in example integration test.

- **Step X:** *what I changed* — *why* — *what I verified after*

Example: *Step 4 — Moved sticker inspection from a modal to an always-visible panel — modal blocked view of the map during the demo — verified all inspection outputs still match the oracle distances.*

---

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Oracle wrong → app "fails" against a bad reference | Compute oracle twice: once by hand, once in a spreadsheet with formulas; compare before Step 2 begins |
| Sticker collection doesn't hit convergence in 2–8 iters | Design centres and stickers so drift is small; if a run exceeds 8, adjust one sticker's coordinate by ±0.5 and rerun the oracle |
| First-iteration tie disappears when I adjust coordinates | Lock the tied sticker's position first; design other stickers around it |
| Live modification breaks a passing test | Run `npm test` before saying "done" during the live change; if red, restate what broke and either fix or revert |
| Canvas hit-testing for sticker clicks is fiddly | Store sticker screen coords after each draw; click handler does linear scan (10 stickers, negligible) |


