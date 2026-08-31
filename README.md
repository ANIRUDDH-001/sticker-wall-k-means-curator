# Sticker Wall K-Means Curator (Cosmic Cafe Observatory)
**Candidate Code:** CC63 · **Problem:** SPR26_D2_P02

## What this is
An interactive, mathematically truthful K-Means clustering observatory over 10 festival stickers on a 2D warmth × sparkle map, with $k=3$ panels (`NEBULA`, `COMET`, `EMBER`). Users step through each iteration, watch centroids drift, inspect distance matrices and tie-break explanations, edit stickers/centroids interactively via direct canvas dragging or forms, and replay past iterations via an immutable timeline. Every intermediate value (assignments, centre updates, movements, SSE, convergence) is visible on a single unified screen without page scrolling.

## Run the app
No build step. No local server required.
```bash
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```
The Cosmic Cafe baseline automatically loads at **Iteration 0** on startup. Click **Step** to advance through the iterations or **Run to End** to run until convergence.

## Run the tests
```bash
npm install
npm test
```
Expected: 94 tests across 3 suites, 100% green.

## File map
| Path | Purpose |
|---|---|
| index.html | UI shell & Cosmic Observatory single-screen layout |
| js/engine.js | Pure K-Means mathematical engine (zero DOM references) |
| js/controller.js | State machine + step/runToEnd/reset/editSticker/addCentre/removeCentre |
| js/ui.js | Canvas rendering + smart label collision avoidance + inspector + replay |
| css/style.css | Cosmic Observatory deep-space theme + responsive single-screen layout |
| tests/engine.test.js | Engine unit + integration tests (T1–T9, T11–T14, Int-A) |
| tests/controller.test.js | Controller behaviour + oracle tests (T10, T15–T19, P2, P3, P4, P5 QA) |
| tests/t20.test.js | Validation-clearing test (T20) |
| data/oracle.md | Hand-verified expected values (checker only, never imported by code) |
| data/demo.js | Raw Cosmic Cafe collection (runtime input) |
| data/emptyPanel.js | Raw empty-panel scenario (runtime input) |
| 01_IMPLEMENTATION_PLAN.md | Implementation plan + phase evolution log |
| DESIGN.md | Architecture + trade-offs + design rationale |
| PROMPTS.md | Factual AI interaction log |
| INTERVIEW_NOTES.md | 30s pitch, 4-stage lifecycle, tie/empty panel rules, and 5-min demo script |

**Folder philosophy:** `data/` holds inputs (raw collections) and the reference (`oracle.md`). `js/` holds only logic. The oracle is never required, imported, fetched, or parsed by any code — its role is independent verification.

## Design summary
Three-layer, one-direction dependency:
```
data/demo.js ────────┐
                     ├─→ js/engine.js ─→ js/controller.js ─→ js/ui.js
data/emptyPanel.js ──┘      (pure)          (stateful)        (DOM)

data/oracle.md ────── Reference only, never imported by runtime code
```
- **Pure Engine (`js/engine.js`):** Zero DOM references. Pure mathematical functions.
- **Controller (`js/controller.js`):** State machine managing 3-tier collection hierarchy, immutable history snapshots, and validation.
- **Visualizer (`js/ui.js`):** Canvas 2D rendering, deterministic smart label placement, and inspector updates.

## Core K-Means Mathematical Invariants
1. **Distance:** Unrounded squared Euclidean distance $d^2 = (w_s - w_c)^2 + (s_s - s_c)^2$.
2. **Tie-Break:** Strict $\le 10^{-12}$ source-order tie-break (earlier centroid in collection wins).
3. **Centroid Update:** Arithmetic mean $(\bar{w}, \bar{s})$. Empty centroids retain previous coordinates with 0 movement and no division-by-zero.
4. **Convergence:** Discrete assignment signature equality ($\text{Signature}_t == \text{Signature}_{t-1}$).
5. **Coordinate Invariance:** Sticker coordinates remain strictly fixed during K-Means iterations; only assignments and centroid positions change.

## Browser support
Tested in Chrome 120+, Firefox 120+, Safari 17+, Edge 120+. Canvas 2D and ES5/ES6 standard JavaScript — zero runtime dependencies.
