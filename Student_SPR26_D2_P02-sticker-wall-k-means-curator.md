# SPR26_D2_P02: Sticker Wall K-Means Curator
*AI-Assisted Coding Interview Problem*

---

# Problem Statement

You are helping a student art club prepare a giant sticker wall for its annual festival. Hundreds of visitors will see the wall, and the organisers want stickers with a similar look to appear together on colourful display panels.

The club has given every sticker two playful scores from `0` to `10`: **warmth** describes how cool or warm its colours feel, and **sparkle** describes how quiet or energetic its design feels. The organisers could let a computer form the panels instantly, but they do not want a mysterious final answer. They want to watch each sticker choose a panel, see the panel centres move, and understand why the arrangement eventually stops changing.

Build an interactive **Sticker Wall K-Means Curator** that turns this process into a visual story. A user should be able to load your festival collection, step through the grouping process, inspect a sticker's choice, change a sticker, replay the result, and reset the wall for the next visitor.

Create the sticker collection and test scenarios yourself; no starter asset is supplied. Give your main collection an appealing theme and document its expected iterations independently of the application. The application must calculate its result from the sticker and centre data—it must not read the documented answers as input.

Your main demonstration should contain **8–12 stickers** and `2` or `3` fixed starting panel centres. Design it deliberately so that:

- at least one sticker is exactly tied between two centres in the first iteration;
- at least one sticker changes panel in a later iteration;
- every panel is non-empty when the run converges; and
- convergence takes from `2` through `8` iterations, including the repeated assignment that proves it.

Here is a small illustration of the rules. It is intentionally too small to be your main demonstration. With centres `mint = (0, 0)` and `coral = (10, 10)`, use these stickers in the listed order:

| Sticker | Warmth | Sparkle |
| --- | ---: | ---: |
| `button` | 0 | 0 |
| `star` | 5 | 5 |
| `flame` | 6 | 5 |
| `heart` | 5 | 6 |
| `sun` | 9 | 9 |

In iteration 1, `star` is exactly `50` squared-distance units from both centres, so it joins the earlier centre, `mint`. The updated centres are `mint = (2.5, 2.5)` and `coral = (6.667, 6.667)`, and the total squared error is `42.333` after display rounding. In iteration 2, `star` moves to `coral`; the centres become `(0, 0)` and `(6.25, 6.25)`, with total squared error `21.5`. Iteration 3 repeats those assignments and therefore marks the run as converged.

Create one primary visual workspace with a labelled warmth/sparkle map, sticker markers, initial and current panel centres, assignment lines, panel cards, iteration number, centre movement, total squared error, validation feedback, and **Load Demo**, **Step**, **Run to End**, and **Reset** controls. Selecting a sticker should show its squared distance to every current centre and explain any tie. Let the user edit at least one sticker's two scores and restart from the original centres.

A browser application is a natural fit, but a desktop application, notebook, or another local solution with an equally clear interactive plot is acceptable. Keep all computation local. Image recognition, external AI services, accounts, a backend, and automatic selection of starting centres are outside scope.

## Contracts

### Collection data and validation

- A collection contains an integer `k` from `2` through `4`, from `2` through `30` stickers, and exactly `k` initial centres. `k` cannot exceed the sticker count.
- Sticker IDs and centre IDs are separately unique, non-empty strings. Preserve sticker source order for membership lists and centre source order throughout the run.
- Every sticker and centre has finite numeric `warmth` and `sparkle` coordinates from `0` through `10`, inclusive. Use the supplied values directly; do not normalize them, randomize them, or choose replacement centres.
- Validate `k`, stickers, and centres before the first iteration. Reject an invalid count, empty or duplicate ID, non-finite coordinate, or coordinate outside `0–10`; identify the affected field or item when available. Clear stale iterations, groups, and metrics on every invalid result. Exact error-code wording and a general-purpose collection editor are not required.
- Your main demonstration may be stored directly in the application. Also create repeatable candidate-authored tests for a collection that produces an empty panel and for at least two different validation failures. A general-purpose collection editor or file importer is not required.

### One k-means iteration

For each iteration, perform these stages in order:

1. **Assign:** For every sticker, calculate its squared Euclidean distance to each current centre:

   ```text
   squared_distance = (warmth - centre_warmth)^2
                    + (sparkle - centre_sparkle)^2
   ```

   Assign it to the centre with the smallest value. Compare unrounded values. Values differing by at most `1e-12` are tied, and the earlier centre in source order wins.
2. **Update:** Replace each non-empty centre with the arithmetic mean of the stickers assigned to it. If a centre receives no stickers, retain its previous coordinates exactly for that iteration.
3. **Measure:** After the update, calculate total squared error by summing each sticker's squared distance to the updated centre of its current assignment. Do not reassign stickers until the next iteration.
4. **Check:** Form an assignment signature from the assigned centre ID of every sticker in sticker source order. The first iteration cannot be converged. After an update, mark the run `CONVERGED` when its signature equals the immediately preceding iteration's signature.

- If `20` iterations complete without that match, stop with `NOT_CONVERGED` and keep the twentieth state visible. This is a defensive guard; you do not need to invent a dataset that reaches it.
- For each centre, calculate display-only movement after the update as `sqrt((new_warmth - old_warmth)^2 + (new_sparkle - old_sparkle)^2)`. An empty panel whose centre is retained has movement `0`. Do not use movement or displayed rounding to decide convergence.
- Display coordinates, movements, distances, and error to at most three decimal places. Rounding for display must never influence assignment, centre movement, convergence, or tests.
- **Step** and **Run to End** must use the same iteration operation. Editing a sticker resets iteration history, assignments, and metrics and restarts from the collection's original centres. **Reset** restores the original stickers and centres as well.

## Acceptance Criteria

- **Required:** Create, document, and load in one action a themed main collection with 8–12 stickers and `k = 2` or `3` that satisfies the first-iteration tie, later reassignment, non-empty final panels, and 2–8-iteration convergence conditions above.
- **Required:** Independently record the expected membership, updated centres, total squared error, and convergence flag for every iteration of your main collection. Reproduce those values in the application without treating the recorded answers as calculation input.
- **Required:** Present a clear warmth/sparkle map with initial and current centres, assignment lines, panel membership cards, movements, total squared error, iteration state, and a legend that remains understandable without relying on colour alone.
- **Required:** Let a user inspect a sticker and see its unrounded-decision distances in a suitably rounded display, the chosen centre, and the source-order tie rule when relevant.
- **Required:** Make **Step** and **Run to End** produce identical states. Let the user edit at least one sticker coordinate, restart from the original centres, and use **Reset** to restore the documented demonstration exactly.
- **Required:** Demonstrate a candidate-authored empty-panel case in which its centre remains fixed without division by zero or a non-numeric value. Show the retained-centre reason in the iteration details.
- **Required:** Visibly reject an invalid edited coordinate without stale groups or metrics. Provide repeatable test evidence for at least one additional validation category.
- **Required:** Provide focused tests for squared distance, an exact tie, mean updates, later reassignment, empty-panel retention, squared error, signature-based convergence, validation, edits, and reset.
- **Optional:** Let the organiser save a local image of the finished sticker wall or a compact JSON summary of its panel memberships.

Use AI coding assistants. Before implementation, create a short plan with 3–5 ordered steps and useful checkpoints. Be prepared to present that plan, explain any changes you made to it, share relevant prompts, summarize your design, and show test evidence such as tests, screenshots, or output samples.

## How You'll Be Evaluated
- **Planning and Solution Presentation**: Present your 3–5-step implementation plan, explain how the work followed or changed that plan, and demonstrate the working solution with clear explanations
- **AI Prompting Strategy**: Show the prompts you used to translate this problem statement into technical specifications for AI assistants
- **Design Constraints and Technology Choices**: Explain the constraints you provided to AI regarding design patterns, technology stack, and architectural decisions
- **AI-Influenced Decision Making**: Discuss trade-offs, assumptions, and how AI recommendations influenced your choices for components, data structures, and implementation approaches
- **Testing and Validation**: Demonstrate how you tested the application covering both typical usage scenarios and edge cases
- **Live Modification Capability**: Be prepared to implement one small modification, and possibly a second if time permits, using AI assistance; keep your development environment ready for focused changes and verification

