# Design Summary
**Candidate Code:** CC63 · **Problem:** SPR26_D2_P02

---

## Architecture — one direction, three layers

`
data/demo.js ────────┐
                     ├─→  engine.js  →  controller.js  →  ui.js
data/emptyPanel.js ──┘        (pure)         (stateful)     (DOM)

data/oracle.md ────── reference document, never imported by any code
`

- engine.js has **zero** DOM references (verifiable: Select-String -Path js/engine.js -Pattern 'document|querySelector' returns no matches).
- controller.js has zero DOM references.
- Data files under data/ have zero DOM references.
- Only ui.js touches Canvas or DOM.

**Why this matters for the contract:** Step and Run to End are required by the PS to produce identical states from the same iteration operation. The three-layer split enforces this — both controls invoke controller.step(), which calls engine.runIteration(). There is no separate iteration code path for Run to End. Test 19 in 	ests/controller.test.js asserts byte-identical history from the two paths (JSON.stringify(history1) === JSON.stringify(history2)).

**Why data lives under data/, not js/:** the oracle document at data/oracle.md is the checker; the collection files at data/demo.js and data/emptyPanel.js are the runtime inputs. Both are inputs to *someone* (the oracle to the human reviewer, the collections to the app), but neither is logic. js/ is reserved for the pure calculation + controller + DOM layers. This is what lets the interview claim "the app never reads its answer key" be architecturally provable, not just a policy.

---

## Technology choices and why

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Browser, single index.html | Zero build, zero server, one-command demo |
| Language | Vanilla JavaScript (CommonJS) | No framework surface to defend; every function is mine |
| Visualization | HTML5 Canvas 2D | No Chart.js / D3 dependency; scatter plot is ~40 lines |
| Styling | Plain CSS | Legend uses shape + colour + text; no library needed |
| Tests | Jest | Matches resume claim (Tools & Testing: Jest); engine has no DOM to mock |
| Package manager | npm (Jest only) | No runtime dependencies |

**Rejected options:**
- React / Next.js — I don't list React as a resume skill; framework noise hides the algorithm.
- Chart.js / D3 — extra dependency to defend for a 10 × 10 scatter plot that's ~40 lines of Canvas.
- Python / Streamlit — interviewer expects a browser demo; needing a local server is a moving part.

---

## T20 design choice: throw vs return-error-state

createController(collection) **throws** on invalid input rather than returning an error-state controller.

**Rationale:** A thrown error means the caller cannot accidentally call step() or unToEnd() on a partially-initialised object — because there is no partially-initialised object. An error-state approach would require every downstream caller to check if (ctrl.status === 'ERROR') before each call, which is easy to forget. The throw pattern is a hard barrier; the catch pattern is soft and leaky.

**Test 20 verifies two things:**
1. An invalid collection causes createController to throw a catchable error.
2. A prior *valid* controller is completely unaffected by the failed attempt — no state leakage across object instances.

---

## AI-influenced decisions

- **Three-tier state architecture (demo baseline -> working baseline -> active runState).** The immutable demo baseline (`originalStickers`, `originalCentres`) is deeply frozen and never mutated. The working baseline (`baselineStickers`, `baselineCentres`) stores the user's custom edits, added centres, or removed centres. The active run copies (`currentStickers`, `currentCentres`) execute the iterations. Reset always restores from the immutable demo baseline.
- **Shared direct manipulation drag pipeline.** Canvas dragging converts pointer coordinates to clamped warmth/sparkle values and reuses the exact same `ctrl.editSticker` / `ctrl.editCentre` methods as the numeric inputs, preventing parallel editing logic bugs.
- **Dynamic $k=2..4$ Centroid Management.** Centroids can be added, removed, or edited with live validation guarding $2 \le k \le 4$ and $k \le \text{sticker count}$. Legend and panel cards adapt dynamically to any active cluster configuration.
- **Tolerance test split into 3a (0.5e-12, tied) and 3b (2e-12, not tied).** Enforced the strict `bestDistance - distance > EPS` pattern in the engine.
- **Inspection distances use pre-update centres.** After Step 1, `controller.currentCentres` holds the *updated* centres. But the inspection panel shows the distances that *drove* the assignment — the centres before the update.
- **Lossless signature encoding (`JSON.stringify`).** Lossless JSON serialization prevents delimiter collisions for arbitrary IDs.
- **Invalid edit state isolation.** An invalid coordinate edit visibly fails and resets any stale active run state (`iteration = 0`, `status = 'READY'`, `history = []`) without corrupting baseline data.
- **Live modification prep ranked by rehearsal safety, not likelihood.** Highlighted in `01_IMPLEMENTATION_PLAN.md` §7.

---

## Trade-offs I made

| Prioritised | Deferred |
|---|---|
| Byte-identical Step vs Run to End (Test 19) | Speed control / scrubber |
| Independent oracle verified twice by hand | Save-as-JSON export |
| Empty-panel retention with no NaN path | Save-as-image button |
| Legend with shape + colour + text | Colour-blind mode toggle |
| CommonJS + zero build | ES modules |
| Grep-provable DOM isolation in engine | Fancy animations |
| T20: throw-on-invalid (hard barrier) | Error-state controller pattern |

---

## What I would add with another day
- Save panel memberships as JSON (optional PS acceptance item).
- Save the finished sticker wall as a PNG.
- Keyboard shortcut: space bar for Step, R for Reset.
- A "step backward" button using history[iteration - 1].
- Highlight stickers that changed panel this iteration (comparison of history[n-1].assignments to history[n].assignments).
