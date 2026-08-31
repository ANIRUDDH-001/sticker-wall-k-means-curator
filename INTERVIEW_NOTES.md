# Interview Preparation & Demonstration Notes
**Candidate Code:** CC63 · **Problem:** SPR26_D2_P02 (Sticker Wall K-Means Curator)

---

## 1. 30-Second Elevator Pitch
> *"I built an interactive, mathematically truthful K-Means clustering observatory for festival stickers on a 2D Warmth × Sparkle map. It exposes every intermediate calculation — unrounded squared distance comparisons, strict floating-point tie breaking, centroid mean drift, and discrete signature convergence — in an intuitive single-screen UI. The engine is a 100% pure JavaScript calculation module that reproduces a hand-verified mathematical oracle without ever reading an answer key."*

---

## 2. Architectural Structure (One Direction, Three Layers)

```
data/demo.js ────────┐
                     ├─→  js/engine.js  ─→  js/controller.js  ─→  js/ui.js
data/emptyPanel.js ──┘        (pure)          (stateful)        (DOM / Canvas)

data/oracle.md ────── Reference document only (never imported / read by runtime code)
```

- **Layer 1: Pure Engine (`js/engine.js`):** Zero DOM/browser references, pure input-to-output functions. Verifiable in Node and unit tests.
- **Layer 2: State Machine Controller (`js/controller.js`):** Coordinates iteration history snapshots, 3-tier state hierarchy, validation, and step execution.
- **Layer 3: Visualizer (`js/ui.js`):** Canvas 2D rendering, interactive event handlers, timeline replay, and accessible inspection.

---

## 3. Four-Stage K-Means Iteration Lifecycle
Each iteration strictly executes four discrete mathematical stages:
1. **Stage 1 (Assign):** Computes $d^2 = (w_s - w_c)^2 + (s_s - s_c)^2$ to all decision centres. Assigns sticker to the minimum $d^2$ centre.
2. **Stage 2 (Update):** Computes arithmetic mean $(\bar{w}, \bar{s})$ of assigned sticker coordinates. Empty centres retain previous coordinates ($0$ movement).
3. **Stage 3 (Measure):** Calculates total Sum of Squared Errors (SSE) across all clusters.
4. **Stage 4 (Check):** Evaluates assignment signature stability: $\text{Signature} = \text{concat}(c_{\text{assigned}})$. If $\text{Signature}_t == \text{Signature}_{t-1}$, mark `CONVERGED`.

---

## 4. Key Mathematical Rules & Edge Cases

### A. Signature Convergence (Why not SSE threshold?)
- Standard K-Means converges when cluster memberships stabilize. An SSE epsilon ($\Delta\text{SSE} < \epsilon$) can trigger false early termination during slow centroid drift or oscillate. Assignment signature matching is discrete, exact, and deterministic.

### B. Strict Source-Order Tie-Break Rule
- If multiple centres yield identical minimum squared distance ($|d_1^2 - d_2^2| \le 10^{-12}$), the tie is broken deterministically by selecting the centre appearing earlier in the centre collection source order (`centres[0]` before `centres[1]`).

### C. Empty-Centre Retention
- If a centroid receives zero sticker assignments (such as `EXILE` in the Empty Panel scenario), it retains its pre-iteration coordinates with zero drift ($0.000$) and no division-by-zero/`NaN` error.

### D. Why $k=2$ is the Minimum for this PS
- Clustering requires partitioning into at least 2 distinct groups ($k \ge 2$) up to $k=4$. If $k=1$, clustering is trivial; if $k > N$, cluster count exceeds data points.

---

## 5. Step vs Run-to-End Equivalence
- Step and Run-to-End invoke the exact same state machine method: `controller.step()`.
- `runToEnd()` executes a synchronous loop with a 20-iteration guard.
- **Test Evidence:** Integration test `QA-2` verifies byte-identical history (`JSON.stringify`) between stepping 3 times and running to end.

---

## 6. Three-Tier State Hierarchy & Edit/Reset Semantics
1. **Original Baseline (`originalStickers`, `originalCentres`):** Deeply frozen immutable reference of the Cosmic Cafe demo.
2. **Working Baseline (`baselineStickers`, `baselineCentres`):** Stores user parameter edits, added stickers, added centres, or deletions.
3. **Active Run State (`currentStickers`, `currentCentres`):** Working copies updated during active iteration execution.
- **Edit Semantics:** Any parameter edit clears stale run history and restarts execution from the configured baseline.
- **Reset Semantics:** Always restores the working baseline back to the immutable demo baseline.

---

## 7. Prepared Approaches for Three Likely Live Modifications (10-Min Asks)

1. **Ask 1: "Highlight stickers that changed cluster this iteration"**
   - *Location:* `js/ui.js` inside `renderCanvas` / sticker loop.
   - *Implementation:* Compare `snap.assignments[i]` with `prevSnap.assignments[i]`. If different, draw a distinctive orange halo or badge. (Already surfaced in Sticker Inspector).
2. **Ask 2: "Export panel memberships to JSON"**
   - *Location:* `js/controller.js` + `js/ui.js`.
   - *Implementation:* Create an export button triggering `controller.exportMemberships()` generating `{ iteration, status, panels: { [id]: members } }`.
3. **Ask 3: "Add a Step Backward / Previous Iteration Button"**
   - *Location:* `js/ui.js` on button click.
   - *Implementation:* Decrement `viewedIteration` by 1 and call `render()` to replay the immutable historical snapshot.

---

## 8. Five-Minute Interview Demonstration Sequence

| Time | Step / Action | What to Say / Highlight |
|---|---|---|
| **0:00 – 0:45** | **App Startup (Iter 0)** | *"The Cosmic Cafe baseline loads automatically at Iteration 0. The map displays 10 stickers and 3 initial centroids (NEBULA, COMET, EMBER). The UI is structured into a single screen with zero scrolling required."* |
| **0:45 – 1:30** | **Click Step → Iteration 1 (Tie Event)** | *"Notice SUNRISE at (5, 3.5). Its squared distance to NEBULA is 11.250 and to EMBER is 11.250. It ties exactly! NEBULA wins because it appears earlier in source order. The assignment line connects directly to the decision centre."* |
| **1:30 – 2:15** | **Click Step → Iteration 2 (Reassignment)** | *"Centroids drift based on the new means. EMBER moves closer to SUNRISE. In Iteration 2, SUNRISE reassigns from NEBULA to EMBER. Note that SUNRISE's coordinates remain strictly fixed at (5, 3.5); only its cluster membership changes."* |
| **2:15 – 3:00** | **Click Step → Iteration 3 (Convergence)** | *"Iteration 3 produces the exact same assignment signature. Centroid movement is 0.000 across all clusters, and the system marks status CONVERGED. The centroids render as unified stable stars."* |
| **3:00 – 3:45** | **Timeline Scrubbing & Inspection** | *"We can click 'Iter 1' on the timeline bar to replay the historical tie snapshot without corrupting the completed run. Clicking SUNRISE on the map inspects its exact squared distances."* |
| **3:45 – 4:30** | **Empty Panel Scenario** | *"Switching scenario to 'Empty Panel Test' demonstrates K-Means resilience when a cluster receives 0 members: EXILE is retained at (9,9) with 0 movement and no NaN errors."* |
| **4:30 – 5:00** | **Interactive Editing & Reset** | *"We can drag any sticker or centroid directly on the map, or use '+ Add Sticker'. Clicking 'Reset' instantly restores the immutable Cosmic Cafe baseline. All 94 automated tests pass green."* |
