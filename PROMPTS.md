# AI Interaction Log
**Candidate Code:** CC63 · **Tool:** Claude Code / Antigravity (Google DeepMind)

## Workflow overview
This K-Means Curator was built with an AI coding assistant across five stepped prompts, each triggering one implementation phase from the plan. Every prompt is preserved verbatim in the prompts/ folder. This log summarises what I asked, what constraints I hard-coded to prevent common failures, and where I refined the AI's first output.

---

## Prompt 00 — Bootstrap
**Goal:** Blank repo → Jest installed → folder structure ready.
**Constraints hard-coded:** CommonJS only, no "type": "module", no frameworks, no bundlers.
**AI output review:** [placeholder — Aniruddh fills in what the assistant actually did]
**Refinements made:** [placeholder]

---

## Prompt 02 — Step 2: Engine
**Goal:** Pure K-Means engine module with 14 unit tests + 2 integration tests.
**Constraints hard-coded:**
- Tie-break via if (bestDistance - distance > EPS) (NOT < on the distance) — pre-empts the most common K-Means bug.
- Unrounded comparisons only.
- Empty-panel retention (copy previous centre, no arithmetic).
- Signature = plain concatenation with | separator, no sort, no hash.
- isConverged first-iteration guard.
- Dual export (module.exports + window global).
**AI output review:** [placeholder]
**Refinements made:** [placeholder — e.g. "First pass used if (distance < bestDistance); failed test 3b. Prompted for the corrected pattern and it passed."]

---

## Prompt 03 — Step 3: Controller
**Goal:** State machine + main oracle reproduction + step-vs-runToEnd equality test.
**Constraints hard-coded:**
- Two frozen references (originalStickers, originalCentres) never mutated.
- Same-code-path invariant: unToEnd() is a loop over step().
- editSticker mutates only currentStickers, restores centres from originals, clears history.
- 20-iteration cap forces NOT_CONVERGED.
- All engine calls go through the module reference (not destructured locals) so Jest spies intercept.
**AI output review:** [placeholder]
**Refinements made:** [placeholder]

---

## Prompt 04 — Step 4: UI
**Goal:** Canvas scatter plot + panel cards + sticker inspection + editor + validation banner.
**Constraints hard-coded:**
- Legend uses shape + colour + text (not colour-only).
- Initial vs current centres visually distinct (hollow ✕ vs filled ★).
- Display max 3 decimal places; underlying values still unrounded.
- Inspection distances computed against pre-update assignment centres (required for iter-1 tie note to be correct).
- Zero regression on the engine/controller test suite.
**AI output review:** [placeholder]
**Refinements made:** [placeholder]

---

## Prompt 05 — Step 5: Tests + Docs
**Goal:** Full test coverage audit + README + PROMPTS + DESIGN.
**Constraints hard-coded:** Every test 1–19 traceable to a file. T20 added. Clean-clone install must pass.
**AI output review:** [placeholder]
**Refinements made:** [placeholder]

---

## Overall pattern of iterative refinement
[Placeholder for Aniruddh to fill in one paragraph describing the arc: e.g. "Prompts got progressively tighter. Prompt 00 was single-page; Prompt 02 added explicit invariants and grep-able anti-patterns after a first-pass engine used ES modules. Prompt 03 added the same-code-path test after Prompt 02's review flagged it as contract-critical."]
