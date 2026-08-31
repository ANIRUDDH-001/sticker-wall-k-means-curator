# Oracle — Cosmic Cafe Sticker Collection
**For:** SPR26_D2_P02 Sticker Wall K-Means Curator · **Candidate Code:** CC63

> **This document is the app's checker, not its input.** The application must reproduce every value below by calculating from `stickers[]` and `centres[]` alone. Nothing in this file is ever imported, read, or referenced by the running app.

---

## 1. Theme

**Cosmic Cafe** — a festival sticker set for a space-themed art wall. Each sticker's *warmth* score (0 cool → 10 warm) captures its palette; *sparkle* (0 quiet → 10 energetic) captures its visual energy. The three panels represent the sky above the cafe at different hours.

- **NEBULA** — cool + quiet (deep-space stickers)
- **COMET** — cool + energetic (streaking-light stickers)
- **EMBER** — warm + bright (fire-and-glow stickers)

---

## 2. Collection definition

### Stickers (source order — this order is load-bearing)

| # | ID | warmth | sparkle |
|---|---|---:|---:|
| 1 | `FROST` | 1 | 1 |
| 2 | `MIST` | 3 | 2 |
| 3 | `DAWN` | 1 | 3 |
| 4 | `SUNRISE` | 5 | 3.5 |
| 5 | `AURORA` | 1 | 9 |
| 6 | `PULSE` | 3 | 8 |
| 7 | `FLARE` | 2 | 7 |
| 8 | `GLOW` | 6 | 4 |
| 9 | `SPARK` | 7 | 4 |
| 10 | `BLAZE` | 6.5 | 3.5 |

### Initial centres (source order — this order breaks ties)

| # | ID | warmth | sparkle |
|---|---|---:|---:|
| 1 | `NEBULA` | 2 | 2 |
| 2 | `COMET` | 2 | 8 |
| 3 | `EMBER` | 8 | 5 |

**k = 3.** All coordinates within [0, 10]. All IDs unique. Nothing normalized.

---

## 3. Why this collection satisfies every PS design constraint

| PS requirement | Where it appears |
|---|---|
| 8–12 stickers, k = 2 or 3 | 10 stickers, k = 3 |
| First-iteration tie between two centres | `SUNRISE (5, 3.5)`: `d²=11.25` to both NEBULA and EMBER → NEBULA wins by source order (rank 1 < rank 3) |
| Later reassignment | `SUNRISE` moves from NEBULA (iter 1) → EMBER (iter 2) because EMBER's centroid drifts left/down while NEBULA's centroid drifts right/down |
| Every panel non-empty at convergence | Final panels: NEBULA {3}, COMET {3}, EMBER {4} |
| Converges in 2–8 iterations | Converges at **iteration 3** (iter 3 signature == iter 2 signature) |

**Tie derivation (for defense in the interview):** setting `d²(SUNRISE, NEBULA) = d²(SUNRISE, EMBER)` gives `(w-2)² + (s-2)² = (w-8)² + (s-5)²`, which simplifies to `4w + 2s = 27`. `(5, 3.5)` is one integer-friendly solution. Distance to COMET is `29.25`, comfortably larger — the tie is clean two-way, not three-way.

---

## 4. Iteration trace

All arithmetic done with unrounded floats. Display rounded to 3 decimals per PS. Every number below is what the app must produce independently.

### Iteration 1

**Assign step — squared distance from every sticker to every current centre:**

| Sticker | d² to NEBULA (2,2) | d² to COMET (2,8) | d² to EMBER (8,5) | Assigned |
|---|---:|---:|---:|---|
| FROST (1,1) | 1 + 1 = **2** | 1 + 49 = 50 | 49 + 16 = 65 | NEBULA |
| MIST (3,2) | 1 + 0 = **1** | 1 + 36 = 37 | 25 + 9 = 34 | NEBULA |
| DAWN (1,3) | 1 + 1 = **2** | 1 + 25 = 26 | 49 + 4 = 53 | NEBULA |
| SUNRISE (5,3.5) | 9 + 2.25 = **11.25** | 9 + 20.25 = 29.25 | 9 + 2.25 = **11.25** | **NEBULA (tie, source order)** |
| AURORA (1,9) | 1 + 49 = 50 | 1 + 1 = **2** | 49 + 16 = 65 | COMET |
| PULSE (3,8) | 1 + 36 = 37 | 1 + 0 = **1** | 25 + 9 = 34 | COMET |
| FLARE (2,7) | 0 + 25 = 25 | 0 + 1 = **1** | 36 + 4 = 40 | COMET |
| GLOW (6,4) | 16 + 4 = 20 | 16 + 16 = 32 | 4 + 1 = **5** | EMBER |
| SPARK (7,4) | 25 + 4 = 29 | 25 + 16 = 41 | 1 + 1 = **2** | EMBER |
| BLAZE (6.5,3.5) | 20.25 + 2.25 = 22.5 | 20.25 + 20.25 = 40.5 | 2.25 + 2.25 = **4.5** | EMBER |

**Assignment signature (iter 1):** `NEBULA,NEBULA,NEBULA,NEBULA,COMET,COMET,COMET,EMBER,EMBER,EMBER`

**Update step — new centres = mean of members:**

| Centre | Members | New coordinates |
|---|---|---|
| NEBULA | FROST, MIST, DAWN, SUNRISE | ((1+3+1+5)/4, (1+2+3+3.5)/4) = **(2.5, 2.375)** |
| COMET | AURORA, PULSE, FLARE | ((1+3+2)/3, (9+8+7)/3) = **(2, 8)** (unchanged) |
| EMBER | GLOW, SPARK, BLAZE | ((6+7+6.5)/3, (4+4+3.5)/3) = **(6.5, 3.833333…)** |

**Movements (display-only):**

| Centre | Movement = √((Δw)² + (Δs)²) | Displayed |
|---|---|---:|
| NEBULA | √(0.25 + 0.140625) = √0.390625 | **0.625** |
| COMET | √0 | **0.000** |
| EMBER | √(2.25 + 1.361111…) = √3.611111… | **1.900** |

**Measure step — d² of every sticker to its updated centre:**

| Sticker | Assigned | d² to updated centre |
|---|---|---:|
| FROST → NEBULA (2.5, 2.375) | | (1.5)² + (1.375)² = 2.25 + 1.890625 = **4.140625** |
| MIST → NEBULA | | (0.5)² + (0.375)² = 0.25 + 0.140625 = **0.390625** |
| DAWN → NEBULA | | (1.5)² + (0.625)² = 2.25 + 0.390625 = **2.640625** |
| SUNRISE → NEBULA | | (2.5)² + (1.125)² = 6.25 + 1.265625 = **7.515625** |
| AURORA → COMET (2, 8) | | 1 + 1 = **2** |
| PULSE → COMET | | 1 + 0 = **1** |
| FLARE → COMET | | 0 + 1 = **1** |
| GLOW → EMBER (6.5, 3.833…) | | (0.5)² + (0.16̄)² = 0.25 + 0.02̄7 = **0.277778** |
| SPARK → EMBER | | (0.5)² + (0.16̄)² = 0.25 + 0.02̄7 = **0.277778** |
| BLAZE → EMBER | | 0 + (0.3̄)² = 0 + 0.1̄1 = **0.111111** |

**Total squared error (iter 1):** 4.140625 + 0.390625 + 2.640625 + 7.515625 + 2 + 1 + 1 + 0.277778 + 0.277778 + 0.111111 = **19.354167**

**Check step:** iteration 1 is never converged by rule. Status: **RUNNING**.

---

### Iteration 2

**Assign step — using new centres NEBULA (2.5, 2.375), COMET (2, 8), EMBER (6.5, 3.833333):**

| Sticker | d² to NEBULA | d² to COMET | d² to EMBER | Assigned |
|---|---:|---:|---:|---|
| FROST (1,1) | **4.140625** | 50 | 38.277778 | NEBULA |
| MIST (3,2) | **0.390625** | 37 | 15.611111 | NEBULA |
| DAWN (1,3) | **2.640625** | 26 | 30.944444 | NEBULA |
| SUNRISE (5,3.5) | 7.515625 | 29.25 | **2.361111** | **EMBER (switched from NEBULA)** |
| AURORA (1,9) | 46.140625 | **2** | 56.944444 | COMET |
| PULSE (3,8) | 31.890625 | **1** | 29.611111 | COMET |
| FLARE (2,7) | 21.640625 | **1** | 30.277778 | COMET |
| GLOW (6,4) | 14.890625 | 32 | **0.277778** | EMBER |
| SPARK (7,4) | 22.890625 | 41 | **0.277778** | EMBER |
| BLAZE (6.5,3.5) | 17.265625 | 40.5 | **0.111111** | EMBER |

**Assignment signature (iter 2):** `NEBULA,NEBULA,NEBULA,EMBER,COMET,COMET,COMET,EMBER,EMBER,EMBER`

**This is the required "later reassignment" — SUNRISE moved.**

**Update step:**

| Centre | Members | New coordinates |
|---|---|---|
| NEBULA | FROST, MIST, DAWN | ((1+3+1)/3, (1+2+3)/3) = **(1.666667, 2)** |
| COMET | AURORA, PULSE, FLARE | **(2, 8)** (unchanged) |
| EMBER | SUNRISE, GLOW, SPARK, BLAZE | ((5+6+7+6.5)/4, (3.5+4+4+3.5)/4) = **(6.125, 3.75)** |

**Movements:**

| Centre | Movement | Displayed |
|---|---|---:|
| NEBULA | √((0.833)² + (0.375)²) = √(0.694 + 0.141) = √0.835069 | **0.914** |
| COMET | 0 | **0.000** |
| EMBER | √((0.375)² + (0.083)²) = √(0.141 + 0.007) = √0.147569 | **0.384** |

**Measure step:**

| Sticker | Assigned | d² to updated centre |
|---|---|---:|
| FROST → NEBULA (1.667, 2) | | (0.667)² + 1 = 0.444 + 1 = **1.444444** |
| MIST → NEBULA | | (1.333)² + 0 = 1.778 + 0 = **1.777778** |
| DAWN → NEBULA | | (0.667)² + 1 = 0.444 + 1 = **1.444444** |
| SUNRISE → EMBER (6.125, 3.75) | | (1.125)² + (0.25)² = 1.266 + 0.0625 = **1.328125** |
| AURORA → COMET | | **2** |
| PULSE → COMET | | **1** |
| FLARE → COMET | | **1** |
| GLOW → EMBER | | (0.125)² + (0.25)² = 0.0156 + 0.0625 = **0.078125** |
| SPARK → EMBER | | (0.875)² + (0.25)² = 0.766 + 0.0625 = **0.828125** |
| BLAZE → EMBER | | (0.375)² + (0.25)² = 0.141 + 0.0625 = **0.203125** |

**Total squared error (iter 2):** 1.444444 + 1.777778 + 1.444444 + 1.328125 + 2 + 1 + 1 + 0.078125 + 0.828125 + 0.203125 = **11.104167**

**Check step:** signature(iter 2) ≠ signature(iter 1). Status: **RUNNING**.

---

### Iteration 3

**Assign step — using NEBULA (1.666667, 2), COMET (2, 8), EMBER (6.125, 3.75):**

| Sticker | d² to NEBULA | d² to COMET | d² to EMBER | Assigned |
|---|---:|---:|---:|---|
| FROST (1,1) | **1.444444** | 50 | 33.828125 | NEBULA |
| MIST (3,2) | **1.777778** | 37 | 12.828125 | NEBULA |
| DAWN (1,3) | **1.444444** | 26 | 26.828125 | NEBULA |
| SUNRISE (5,3.5) | 13.361111 | 29.25 | **1.328125** | EMBER |
| AURORA (1,9) | 49.444444 | **2** | 54.828125 | COMET |
| PULSE (3,8) | 37.777778 | **1** | 27.828125 | COMET |
| FLARE (2,7) | 25.111111 | **1** | 26.078125 | COMET |
| GLOW (6,4) | 22.777778 | 32 | **0.078125** | EMBER |
| SPARK (7,4) | 32.444444 | 41 | **0.828125** | EMBER |
| BLAZE (6.5,3.5) | 25.611111 | 40.5 | **0.203125** | EMBER |

**Assignment signature (iter 3):** `NEBULA,NEBULA,NEBULA,EMBER,COMET,COMET,COMET,EMBER,EMBER,EMBER`

**Update step:** members unchanged from iter 2 → centres unchanged: NEBULA (1.666667, 2), COMET (2, 8), EMBER (6.125, 3.75).

**Movements:** all **0.000**.

**Measure step:** identical to iter 2 → **SSE = 11.104167**.

**Check step:** signature(iter 3) == signature(iter 2). Status: **CONVERGED**.

---

## 5. Final state summary

| Metric | Value |
|---|---|
| Total iterations | **3** |
| Status | **CONVERGED** |
| Final SSE | **11.104167** |
| NEBULA final centre | (1.666667, 2) |
| COMET final centre | (2, 8) |
| EMBER final centre | (6.125, 3.75) |
| NEBULA members | FROST, MIST, DAWN |
| COMET members | AURORA, PULSE, FLARE |
| EMBER members | SUNRISE, GLOW, SPARK, BLAZE |

---

## 6. Empty-panel scenario (separate test collection)

Small candidate-authored dataset that exercises the empty-panel retention rule.

### Definition
Stickers (source order):

| # | ID | warmth | sparkle |
|---|---|---:|---:|
| 1 | `LEFT_A` | 1 | 1 |
| 2 | `LEFT_B` | 2 | 2 |
| 3 | `LEFT_C` | 3 | 1 |

Centres (source order):

| # | ID | warmth | sparkle |
|---|---|---:|---:|
| 1 | `HOME` | 1 | 1 |
| 2 | `EXILE` | 9 | 9 |

**k = 2.**

### Trace

**Iter 1 assign:** all three stickers closer to HOME than to EXILE.
- Signature: `HOME,HOME,HOME`
- HOME gets {LEFT_A, LEFT_B, LEFT_C}; EXILE gets {} (empty).

**Iter 1 update:**
- HOME → mean of members = ((1+2+3)/3, (1+2+1)/3) = **(2, 1.333333)**.
- EXILE → **empty panel → retained at (9, 9) exactly**. Movement = **0.000**. No division by zero, no NaN.

**Iter 1 measure — d² to updated centres:**
- LEFT_A (1,1) → HOME (2, 1.333): 1 + 0.111 = **1.111111**
- LEFT_B (2,2) → HOME: 0 + 0.444 = **0.444444**
- LEFT_C (3,1) → HOME: 1 + 0.111 = **1.111111**
- SSE = **2.666667**

**Iter 2 assign:** everyone still closer to HOME than EXILE.
- Signature: `HOME,HOME,HOME` == iter 1 signature.

**Iter 2 update:** HOME members unchanged → HOME stays (2, 1.333333). EXILE retained at (9, 9). Movement all 0.
**Iter 2 measure:** SSE = 2.666667 (unchanged).
**Iter 2 check:** signatures match → **CONVERGED at iter 2**.

**Panel membership at convergence:** HOME {LEFT_A, LEFT_B, LEFT_C}, EXILE {}.
The empty-panel reason ("retained — no members assigned this iteration") must be shown in the iteration details.

---

## 7. Validation-failure test scenarios

At minimum three fail-cases exercised in tests (`engine.test.js`), plus the visible in-app rejection of an invalid edited coordinate.

| # | Scenario | Expected result |
|---|---|---|
| V1 | k = 5, only 3 stickers | Reject: k exceeds sticker count |
| V2 | Sticker with warmth = 11 | Reject: coordinate outside 0–10, identify sticker ID |
| V3 | Two stickers with ID = `DUPE` | Reject: duplicate sticker ID |
| V4 | Sticker with warmth = `Infinity` | Reject: non-finite coordinate |
| V5 | k = 3 but only 2 centres supplied | Reject: centre count ≠ k |
| V6 | Empty sticker ID (`""`) | Reject: non-empty ID required |
| V7 (in-app) | User edits SUNRISE.warmth to `-1` | UI shows error, no stale iterations, no groups displayed |

**Rule (per PS):** every invalid result clears stale iterations, groups, and metrics. No partial output. The invariant to test: after any validation failure, the app's `iteration` counter is `0`, `history` is `[]`, and no panel cards render.

---

## 8. Independent-verification note (for interview defence)

**How this oracle was produced:** all arithmetic hand-computed twice — once on paper, once in a separate spreadsheet — before writing any application code. The application will be built to read *only* the raw `stickers[]` and `centres[]` arrays and produce these values from first principles. If any app output diverges from any value in this document, the app is wrong (or this oracle is wrong and gets corrected here first, with a `## Corrections` block).

**Nothing in this file is imported, parsed, or referenced by the running application.**
