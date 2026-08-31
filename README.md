# Sticker Wall K-Means Curator
**Candidate Code:** CC63 · **Problem:** SPR26_D2_P02

## What this is
An interactive K-Means clustering tool over 10 hand-designed festival stickers on a 2D warmth × sparkle map, with 3 panels. Users step through each iteration, watch centres drift, inspect any sticker's distances, edit a sticker, and reset. Every intermediate value (assignments, centre updates, movements, SSE, convergence) is visible on screen — no black-box answer.

## Run the app
No build step. No server required.
```bash
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```
Then click **Load** to load the Cosmic Cafe collection.

## Run the tests
```bash
npm install
npm test
```
Expected: 90 tests, all green.

## File map
| Path | Purpose |
|---|---|
| index.html | UI shell & layout |
| js/engine.js | Pure K-Means logic (zero DOM references) |
| js/controller.js | State machine + step/runToEnd/reset/editSticker/addCentre/removeCentre |
| js/ui.js | Canvas rendering + event handlers + direct map dragging |
| css/style.css | Cosmic Cafe theme + responsive layout + legend |
| tests/engine.test.js | Engine unit + integration tests (T1–T9, T11–T14, Int-A) |
| tests/controller.test.js | Controller behaviour + oracle tests (T10, T15–T19, P2, P3, P4, P5 QA) |
| tests/t20.test.js | Validation-clearing test (T20) |
| data/oracle.md | Hand-verified expected values (checker only, never imported by code) |
| data/demo.js | Raw Cosmic Cafe collection (runtime input) |
| data/emptyPanel.js | Raw empty-panel scenario (runtime input) |
| 01_IMPLEMENTATION_PLAN.md | Implementation plan + change log |
| DESIGN.md | Architecture + trade-offs |
| PROMPTS.md | AI interaction log |

**Folder philosophy:** `data/` holds inputs (raw collections) AND the reference (oracle checker). `js/` holds only logic. The oracle is never required, imported, fetched, or parsed by any code — its role is verification, not input.

## Design summary
Three-layer, one-direction dependency:
```
data/demo.js ─┐
              ├─→ engine.js → controller.js → ui.js
data/emptyPanel.js ─┘   (pure)    (stateful)    (DOM)

data/oracle.md ─── reference only, never imported
```
Engine has zero DOM references (grep-provable). Controller has zero DOM references. Data files have zero DOM references. Only ui.js touches Canvas or DOM. This is what lets Step and Run to End provably use the same code path — both call engine.runIteration() via controller.step().

## Independent oracle verification
The oracle at data/oracle.md was hand-computed twice (paper + spreadsheet) BEFORE any code was written. The application reads only raw stickers[] and centres[] arrays; it never imports the oracle. Integration tests 17 and 18 assert the app reproduces every documented value from raw input alone.

## Live modification readiness
See §7 of 01_IMPLEMENTATION_PLAN.md for six predicted modifications and my prepared approach for each.

## Browser support
Tested in Chrome 120+, Firefox 120+, Safari 17+. Canvas 2D and plain ES5-compatible syntax — no experimental APIs.
