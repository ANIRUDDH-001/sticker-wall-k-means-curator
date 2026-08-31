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

- **Single-Screen Observatory Architecture.** Recomposed the application into a single-screen desktop/laptop interface (1366×768, 1440×900, 1920×1080) with zero page scrolling.
  - **Left/Center (~65%):** Dominant 2D canvas workspace with subtle dark starfield background.
  - **Right (~35%):** Telemetry header, Key Event detector, 4-Stage connected pipeline stepper, and structured distance matrix table.
  - **Bottom Utility Rail:** Replay timeline, compact cluster summary chips, unified sticker/centroid editors, and legend.
- **Deterministic Label Collision Avoidance.** Evaluates 6 candidate positions per sticker (right, above-right, below-right, left, above, below) checking bounding box collisions against other stickers, centroids, and placed labels.
- **Structured Distance Matrix Table.** Renders an explicit table (`Centroid | d² | Result`) displaying distances to pre-update decision centres with `✓ ASSIGNED` and `TIED` badges.
- **Mathematical visualization truth (decision centres vs updated centres).** Assignment lines terminate at decision centres (`inputCentres` before update) rather than updated centres. A separate dashed drift arrow connects each decision centre to its updated centre position, making the 4 stages (Assign -> Update -> Measure -> Check) visually clear.
- **Read-only historical timeline replay.** Replay scrubs through immutable history snapshots (`ctrl.history[i]`) allowing users to inspect past iterations without mutating the controller's active execution or baseline data.
- **Three-tier state architecture (demo baseline -> working baseline -> active runState).** The immutable demo baseline (`originalStickers`, `originalCentres`) is deeply frozen and never mutated. The working baseline (`baselineStickers`, `baselineCentres`) stores the user's custom edits, added centres, or removed centres. The active run copies (`currentStickers`, `currentCentres`) execute the iterations. Reset always restores from the immutable demo baseline.
- **Shared direct manipulation drag pipeline.** Canvas dragging converts pointer coordinates to clamped warmth/sparkle values and reuses the exact same `ctrl.editSticker` / `ctrl.editCentre` methods as the numeric inputs, preventing parallel editing logic bugs.
- **Dynamic $k=2..4$ Centroid Management.** Centroids can be added, removed, or edited with live validation guarding $2 \le k \le 4$ and $k \le \text{sticker count}$. Legend and panel cards adapt dynamically to any active cluster configuration.
- **Tolerance test split into 3a (0.5e-12, tied) and 3b (2e-12, not tied).** Enforced the strict `bestDistance - distance > EPS` pattern in the engine.
- **Lossless signature encoding (`JSON.stringify`).** Lossless JSON serialization prevents delimiter collisions for arbitrary IDs.
- **Invalid edit state isolation.** An invalid coordinate edit visibly fails and resets any stale active run state (`iteration = 0`, `status = 'READY'`, `history = []`) without corrupting baseline data.

---

## Trade-offs I made

| Prioritised | Deferred |
|---|---|
| Byte-identical Step vs Run to End (Test 19) | Scrubber slider |
| Independent oracle verified twice by hand | Save-as-JSON export |
| Empty-panel retention with no NaN path | Save-as-image PNG export |
| Accessible legend with shape + colour + text | Custom theme picker |
| CommonJS + zero build | Complex UI framework (React/Vue) |
| Grep-provable DOM isolation in engine | Heavy 3D WebGL background effects |
| T20: throw-on-invalid (hard barrier) | Error-state controller pattern |

---

## What I would add with another day
- Save panel memberships as JSON (optional PS acceptance item).
- Save the finished sticker wall as a PNG image.
- Keyboard shortcut: Space bar for Step, R for Reset, F for Fullscreen.
- Step backward / scrub timeline slider.
- High-contrast / light-mode accessibility toggle.
