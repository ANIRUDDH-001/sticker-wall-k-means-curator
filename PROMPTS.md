# AI Interaction Log
**Candidate Code:** CC63 · **Tool:** Claude Code / Antigravity (Google DeepMind)

## Workflow overview
This K-Means Curator was built with an AI coding assistant across five structured phases, progressively hardening the mathematical foundation, editing model, visualization truth, and interactive user experience. Every phase maintained 100% green test passing rates without breaking backward compatibility or oracle independence.

---

## Prompt 01 — Phase 1: Core Algorithm & Controller Hardening
**Goal:** Harden pure K-Means engine and controller state machine against all edge cases.
**Constraints hard-coded:**
- CommonJS module dual-export (`module.exports` + `window` global).
- Deterministic lossless signature encoding (`JSON.stringify(assignments)`).
- Full float64 precision throughout computation without premature rounding.
- Strict tie-breaking with `bestDistance - distance > EPS` (where `EPS = 1e-12`).
**AI output review:** Engine and controller passed all 59 core unit and oracle tests.
**Refinements made:** Ensured invalid edit attempts cleanly reset stale run state (`iteration = 0`, `status = 'READY'`, `history = []`) without corrupting baseline data.

---

## Prompt 02 — Phase 2: Interactive Collection & Centroid Editing
**Goal:** Implement 3-tier state hierarchy, dynamic centroid management ($k \in [2, 4]$), direct map dragging, and scenario switching.
**Constraints hard-coded:**
- Immutable original demo baseline (`originalStickers`, `originalCentres`) must never be mutated.
- Working baseline (`baselineStickers`, `baselineCentres`) stores custom user edits.
- Active run copies (`currentStickers`, `currentCentres`) execute the iterations.
- Direct canvas dragging must route through the shared `editSticker` / `editCentre` validation pipeline.
**AI output review:** Added test suites P2-1 through P2-10 (69 tests green).
**Refinements made:** Synchronized drag tooltips and numeric input fields simultaneously with coordinate boundary clamping $[0, 10]$.

---

## Prompt 03 — Phase 3: Mathematically Truthful Visualization & Replay
**Goal:** Visually separate decision centres (pre-update) from updated centres (post-update) and implement read-only historical timeline replay.
**Constraints hard-coded:**
- Assignment lines must terminate strictly at decision centres.
- Centroid drift arrows connect decision centres to updated centres.
- Sticker inspection computes squared distances against decision centres.
- Historical timeline replay (`Iter 0` to `Iter 3 ✓`) must render historical snapshots without mutating active controller state.
**AI output review:** Added test suites P3-1 through P3-4 (73 tests green).
**Refinements made:** Added 4-Stage Flow bar (`Assign → Update → Measure → Check`) with dynamic narrative descriptions per iteration.

---

## Prompt 04 — Phase 4: Single-Screen Cosmic Observatory Redesign
**Goal:** Redesign interface into a single-screen desktop/laptop observatory fitting completely within viewport (1366×768, 1440×900, 1920×1080) with zero page scrolling.
**Constraints hard-coded:**
- Deep-space visual language (`#060913` to `#0f172a`), subtle cosmic starfield, clean typography.
- Multi-channel visual encoding: shapes, letters, colors, and text descriptions (Circle/Triangle/Square/Diamond).
- Generic Key Event detection deriving ties, reassignments, and convergence dynamically.
- Accessible focus rings, ARIA live regions, and `prefers-reduced-motion` support.
- Fullscreen API toggle with vendor prefix support and `.pseudo-fullscreen` fallback.
- Auto-load Cosmic Cafe baseline on startup.
**AI output review:** Added test suites P4-1 through P4-4 (86 tests green).
**Refinements made:** Unified top header controls and horizontal timeline strip to fit within single-screen viewports without vertical scrolling.

---

## Prompt 05 — Phase 5: Formal QA & Acceptance Audit
**Goal:** Comprehensive PS contract checklist, edge-case hardening, deep Step vs Run-to-End equivalence verification, and documentation audit.
**Constraints hard-coded:**
- Zero oracle imports or hard-coded lookup tables in source code.
- Step-by-step iteration must be byte-for-byte identical (`JSON.stringify`) to Run-to-End across all scenarios.
- Full sticker lifecycle (add, remove, edit, drag) and centroid management ($k \in [2, 4]$) verified.
- Invariance verification: sticker coordinates remain strictly fixed across all iterations.
- All 94 unit, integration, and UI tests green.
**AI output review:** Full suite of 94 tests passing across all test modules.
**Refinements made:** Cleaned up documentation formatting, verified fresh dependency installation, and verified 100% acceptance compliance.

---

## Overall pattern of iterative refinement
Development followed a strict correctness-first, then interaction, then visual design, then formal verification sequence. By establishing a hand-calculated oracle and lossless state machine early, later UX and visual redesigns were executed rapidly with zero regressions to the underlying mathematical truth.

