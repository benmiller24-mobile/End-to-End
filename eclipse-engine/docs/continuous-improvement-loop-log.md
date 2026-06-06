# Continuous Improvement Loop — Error Fixing Log

Iterative test → diagnose → fix → re-test pass over the engine's validation
output. Errors per example went from **13 each (≈39 total)** to **6 total**.

## Starting state: 13 errors/example
Categories: phantom work-triangle (8x, duplicated across two validators),
NKBA-Landing-Sink, wall_overflow (2x), Range-Hood-Required, audit_dishwasher.

## Fixes committed (8 commits)
1. **Phantom work-triangle (−8/layout)** — both triangle validators measured from
   room x/y coordinates that aren't assigned at solve() time, so every leg read
   0' → 8 bogus errors. Both now skip when coordinates are missing/degenerate.
2. **False audit errors** — `extractPlacements` read a non-existent keyed
   appliance object; now reads `walls[].cabinets` + island. Dishwasher swing /
   missing-work-center checks gated on coordinates / downgraded to suggestions.
3. **False wall_overflow** — thin finished end panels (BEP ~0.75") were counted
   as cabinets overflowing the wall; both boundary checks now exclude trim.
4. **Real wall_overflow** — the left-filler shift could push the last cabinet
   past the wall end (not just a corner); the shift cap now applies to the wall
   boundary in all cases.
5. **False Range-Hood-Required** — `hoodPresent` was never computed (fired even
   when a hood existed) and fired with no cooktop at all; now computes
   hoodPresent + gates on a cooking surface existing.
6. **Real hood gap** — an island range produced no ventilation; `solveIsland`
   now generates an island-mounted hood (RH50, cooktop + 3"/side).
   (Earlier in the session: corner overrun, 435 false collisions, appliance-drop.)

## Final state: 6 errors total (all genuine, not bugs/false-positives)
- **NKBA-Landing-Sink (island, simple)** — sink has 18" primary landing vs the
  24" NKBA *recommendation*. A soft multi-objective placement tradeoff (the
  scorer accepts it in favor of triangle/window goals). Not a code violation.
- **l-shape (filler_too_wide, no_space, audit_dishwasher)** — the 99"×115" L is
  genuinely too small to fit corner + range + sink + fridge + dishwasher with
  full clearances; the dishwasher legitimately can't be placed. A real space
  constraint of that specific tiny layout, not an engine defect.

## Verification
- `test-cli`: 32 passed / 0 failed throughout.
- All examples solve and render (floor plan, every wall elevation, island
  elevations) without throwing.

## Remaining (deeper, lower-priority)
- Strengthen sink placement to reach 24" primary landing on roomy walls (needs
  tracing why the sink anchors at its current position; a scorer nudge alone
  didn't move it).
- Multi-wall coordinate projection so the work triangle / collisions can be
  *evaluated* (not just skipped) inside solve().
