/**
 * Generate-and-score — the AD-3 auto-design core.
 * ================================================
 * The audited failure of the old path was ARCHITECTURAL: one greedy pass froze
 * every width and position before any quality judgment ran. This module turns
 * the pipeline into the recommended shape (docs/Auto-Design-Rebuild-Plan.md §4):
 *
 *   probe-solve → enumerate CANDIDATE COMPOSITIONS (including professionally
 *   ARRANGED appliance placements derived from the probe's wall assignments) →
 *   realize each through solve() → rank with the designer rubric → argmax.
 *
 * The branch points are the decisions the audit showed greedy gets wrong and
 * can never revisit: appliance clustering + landing budgets, corner strategy,
 * drawer preference, appliance-width snapping. solve() remains the realizer;
 * the search sits ABOVE it, so the old behavior is literally the candidates=1
 * special case.
 *
 * Deterministic by construction: fixed variant order, stable ranking
 * tie-breaks (pass > fewer hard fails > score > craft > FIRST variant), no
 * randomness anywhere.
 */
import { solve } from './solver.js';
import { scoreKitchenV2 } from './designScore.js';

const normType = (s) => String(s || '').replace(/[^a-z]/gi, '').toLowerCase();

// ── Designed arrangements from the probe ────────────────────────────────────
// The professional sequence: appliances are POSITIONED FIRST, clustered into
// work zones with the NKBA landing budget distributed into the gaps — instead
// of the packer's even-spread-with-slivers. The probe tells us which wall each
// appliance landed on and what span is actually usable (corner reservations).
function arrangementsFromProbe(input, probe) {
  const arrangements = [];
  const canonicalOrder = ['refrigerator', 'walloven', 'dishwasher', 'sink', 'range', 'cooktop'];
  // Counter needed AFTER each appliance type (NKBA landings shared between neighbors).
  const gapAfter = { refrigerator: 15, walloven: 15, dishwasher: 0, sink: 24, range: 15, cooktop: 15 };
  const gapAtEnd = { refrigerator: 0, walloven: 0, dishwasher: 21, sink: 18, range: 12, cooktop: 12 };

  for (const wl of (probe.walls || [])) {
    const apps = (wl.cabinets || []).filter(c => c.type === 'appliance' && typeof c.position === 'number' && (c.width || 0) > 0);
    // The sink usually materializes as a SINK BASE cabinet, not an appliance —
    // include it as the sink so the arrangement can budget its landings.
    if (!apps.some(c => normType(c.applianceType) === 'sink')) {
      const sb = (wl.cabinets || []).find(c => /^(FC-)?(SB|VSB)\d/.test(String(c.sku || '')) && typeof c.position === 'number');
      if (sb) apps.push({ type: 'appliance', applianceType: 'sink', position: sb.position, width: sb.width });
    }
    if (apps.length < 2) continue;
    const all = (wl.cabinets || []).filter(c => typeof c.position === 'number' && (c.width || 0) > 0);
    const wallLen = wl.wallLength || 0;
    if (!(wallLen > 0)) continue;
    const span0 = Math.max(0, Math.min(...all.map(c => c.position)));
    const span1 = Math.min(wallLen, Math.max(...all.map(c => c.position + c.width)));
    const ordered = [...apps].sort((a, b) =>
      canonicalOrder.indexOf(normType(a.applianceType)) - canonicalOrder.indexOf(normType(b.applianceType)));
    const totalW = ordered.reduce((s, a) => s + a.width, 0);
    const slack = (span1 - span0) - totalW;
    if (slack < 6) continue;

    // Budget the slack into the gaps after each appliance (+ run end), scaled.
    const wants = ordered.map((a, i) => {
      const t = normType(a.applianceType);
      const nxt = ordered[i + 1];
      if (!nxt) return gapAtEnd[t] ?? 12;
      if (normType(nxt.applianceType) === 'dishwasher' || t === 'dishwasher') return 0;  // DW hugs the sink
      return gapAfter[t] ?? 12;
    });
    const wantTotal = wants.reduce((a, b) => a + b, 0) || 1;
    const scale = Math.min(1.5, slack / wantTotal);
    const gaps = wants.map(w => Math.floor((w * scale) / 1.5) * 1.5);
    const used = gaps.reduce((a, b) => a + b, 0);
    gaps[gaps.length - 1] += Math.max(0, slack - used);   // remainder to the run end

    for (const mirror of [false, true]) {
      const seq = mirror ? [...ordered].reverse() : ordered;
      const gseq = mirror ? [...gaps].reverse() : gaps;
      let at = span0;
      const positions = new Map();
      seq.forEach((a, i) => {
        if (mirror && i === 0) at += gseq[0] || 0;   // reversed: leading gap first
        positions.set(normType(a.applianceType), { wall: wl.wallId, position: Math.round(at * 2) / 2 });
        at += a.width + (mirror ? (gseq[i + 1] || 0) : (gseq[i] || 0));
      });
      arrangements.push({
        label: `arranged:${wl.wallId}${mirror ? '-mirrored' : ''}`,
        apply: (a) => {
          const hit = positions.get(normType(a.type));
          // pinned: the arrangement IS the design decision — later passes may
          // not relocate what the landing budget placed.
          return hit ? { ...a, wall: hit.wall, position: hit.position, pinned: true } : a;
        },
      });
    }
  }
  return arrangements;
}

// ── Variant enumeration ──────────────────────────────────────────────────────
function* enumerateVariants(input, probe) {
  const walls = input.walls || [];
  const apps = input.appliances || [];
  const prefs = input.prefs || {};

  const arrangements = probe ? arrangementsFromProbe(input, probe) : [];
  const applianceRecOptions = input.applyApplianceRec === false ? [false] : [true, false];
  const cornerOptions = walls.length < 2
    ? [prefs.cornerTreatment || 'auto']
    : (prefs.cornerTreatment && prefs.cornerTreatment !== 'auto'
      ? [prefs.cornerTreatment]
      : ['auto', 'lazySusan', 'blindCorner']);
  const drawerOptions = typeof prefs.preferDrawerBases === 'boolean'
    ? [prefs.preferDrawerBases]
    : [true, false];

  let idx = 0;
  // Arranged families first — the probe showed where appliances land; the
  // arrangement is the professional correction of that placement.
  for (const arr of [...arrangements, null]) {
    for (const rec of (arr ? [false] : applianceRecOptions)) {
      for (const corner of cornerOptions) {
        for (const drawers of drawerOptions) {
          const label = [
            arr ? arr.label : null,
            rec ? 'rec' : 'as-given',
            `corner:${corner}`,
            drawers ? 'drawers' : 'doors',
          ].filter(Boolean).join(' ');
          yield {
            idx: idx++, label,
            input: {
              ...input,
              applyApplianceRec: rec,
              prefs: { ...prefs, cornerTreatment: corner, preferDrawerBases: drawers, _compose: true, ...(arr ? { _noRecenter: true } : {}) },
              appliances: apps.map(a => (arr ? arr.apply({ ...a }) : { ...a })),
            },
          };
        }
      }
    }
  }
}

function rankKey(v2) {
  return [v2.pass ? 1 : 0, -v2.hardFails.length, v2.score, v2.craftFraction];
}
function better(a, b) {
  const ka = rankKey(a.v2), kb = rankKey(b.v2);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i] > kb[i];
  }
  return false;   // tie → keep the earlier variant (stable)
}

/**
 * The auto-design entry point: explore candidate compositions, ship the best.
 * @param {Object} input       ordinary solve() input
 * @param {Object} [opts]
 * @param {number}   [opts.candidates=16]   exploration budget (1 = plain solve)
 * @param {Function} [opts.onCandidate]     observer for each explored variant
 * @returns {{result, score, explored, best, alternatives}}
 */
export function solveBest(input, opts = {}) {
  const budget = Math.max(1, opts.candidates ?? 16);
  const room = { walls: input.walls || [] };
  const scored = [];
  let best = null, explored = 0;

  const consider = (v, result) => {
    const v2 = scoreKitchenV2(result, { room });
    const cand = { ...v, result, v2 };
    scored.push({ idx: v.idx, label: v.label, pass: v2.pass, score: v2.score, hardFails: v2.hardFails });
    if (!best || better(cand, best)) best = cand;
    return v2;
  };

  // Candidate 0: the plain solve — it doubles as the PROBE that tells the
  // arrangement builder where appliances actually land.
  let probe = null;
  try {
    probe = solve(input);
    explored++;
    consider({ idx: -1, label: 'as-solved' }, probe);
  } catch (_e) { /* probe failure → grid only */ }

  for (const v of enumerateVariants(input, probe)) {
    if (explored >= budget) break;
    if (opts.onCandidate) { try { opts.onCandidate(v); } catch (_e) { /* observer only */ } }
    explored++;
    let result;
    try { result = solve(v.input); } catch (_e) { continue; }
    const v2 = consider(v, result);
    // Early exits keep solve time honest: a near-ceiling pass can't be beaten;
    // any pass after a reasonable exploration is good enough to ship.
    if (v2.pass && v2.score >= 95) break;
    if (best && best.v2.pass && explored >= 10) break;
  }

  if (!best) {
    const result = solve(input);   // let a genuine failure throw honestly
    return { result, score: scoreKitchenV2(result, { room }), explored: explored + 1, best: { label: 'as-given' }, alternatives: [] };
  }
  try {
    best.result.decisions = best.result.decisions || [];
    best.result.decisions.push({
      pass: 'search',
      text: `Explored ${explored} candidate compositions; chose "${best.label}" — rubric ${best.v2.score}/100${best.v2.pass ? '' : ` (best available; ${best.v2.hardFails.length} hard issue(s) remain: ${best.v2.hardFails[0] || ''})`}.`,
    });
  } catch (_e) { /* decoration only */ }
  const alternatives = scored
    .filter(s => s.idx !== best.idx)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  return { result: best.result, score: best.v2, explored, best: { idx: best.idx, label: best.label }, alternatives };
}
