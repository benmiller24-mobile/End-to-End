/**
 * Design options — "the app designs it, three ways, and explains itself".
 * ========================================================================
 * solveOptions(input) runs the solver under a fixed set of DESIGN LENSES —
 * deterministic pref variations a designer would actually propose (no
 * randomness: same room in, same three options out, always). Candidates are
 * deduped by placement signature, ranked by validation cleanliness + training
 * fit, and each carries the solver's own decision trace (result.decisions)
 * plus its closest real training project — the anti-black-box answer to
 * one-click AI design.
 */
import { solve, scoreAgainstTraining } from './solver.js';

// Each lens must change something the solver genuinely honors (see prefs.* in
// solver.js). 'balanced' is ALWAYS first — it is the room exactly as asked.
export const DESIGN_LENSES = [
  {
    id: 'balanced', label: 'Balanced',
    blurb: 'The straight professional read of your room — nothing forced.',
    prefs: {},
  },
  {
    id: 'storage', label: 'Storage-first',
    blurb: 'Drawer banks over doors, working corners, consolidated talls — built for a family that cooks.',
    prefs: { preferDrawerBases: true, cornerTreatment: 'lazySusan', tallConsolidation: true },
  },
  {
    id: 'feature', label: 'Feature kitchen',
    blurb: 'The hood becomes the focal point, symmetry and display details step up.',
    prefs: { featureHood: true, preferSymmetry: true, sophistication: 'very_high' },
  },
  {
    id: 'value', label: 'Value-engineered',
    blurb: 'Simplest boxes that still work hard — the sharpest number for the same footprint.',
    prefs: { preferDrawerBases: false, sophistication: 'standard', cornerTreatment: 'blindCorner' },
  },
];

// Stable fingerprint of a layout: what is where. Two lenses that produce the
// same cabinets in the same places are ONE option.
function signatureOf(result) {
  return (result.placements || [])
    .filter(p => p.sku && p.type !== 'accessory')
    .map(p => `${p.wall}|${p.sku}|${Math.round(p.position || 0)}|${Math.round(p.width || 0)}`)
    .sort()
    .join(';');
}

function rankOf(result, training) {
  const errors = (result.validation || []).filter(v => v.severity === 'error').length;
  const warnings = (result.validation || []).filter(v => v.severity === 'warning').length;
  const cabs = result.metadata?.totalCabinets || 0;
  // Fewest errors first, then training confidence, then fewer warnings.
  return (cabs > 0 ? 0 : -1000) - errors * 100 - warnings * 2 + (training?.confidence || 0);
}

/**
 * @param {Object} input   the ordinary solve() input
 * @param {Object} [opts]
 * @param {number} [opts.count=3]        options to return
 * @param {string[]} [opts.lensOrder]    lens ids to try first (dealer taste memory)
 * @returns {{options: Array<{lens, result, training, rank, summary}>}}
 */
export function solveOptions(input, opts = {}) {
  const count = opts.count || 3;
  const order = [...DESIGN_LENSES].sort((a, b) => {
    const ia = (opts.lensOrder || []).indexOf(a.id);
    const ib = (opts.lensOrder || []).indexOf(b.id);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  const seen = new Set();
  const options = [];
  for (const lens of order) {
    let result;
    try {
      result = solve({ ...input, prefs: { ...(input.prefs || {}), ...lens.prefs } });
    } catch (_e) { continue; }
    if (!result || !(result.placements || []).length) continue;
    const sig = signatureOf(result);
    if (seen.has(sig)) continue;
    seen.add(sig);
    let training = null;
    try { training = scoreAgainstTraining(result); } catch (_e) { /* optional */ }
    options.push({
      lens: { id: lens.id, label: lens.label, blurb: lens.blurb, prefs: lens.prefs },
      result,
      training: training ? { confidence: training.confidence, closestMatch: training.closestMatch } : null,
      rank: rankOf(result, training),
      summary: {
        cabinets: result.metadata?.totalCabinets || 0,
        errors: result.metadata?.errors || 0,
        warnings: result.metadata?.warnings || 0,
        hasIsland: !!result.island,
        decisions: (result.decisions || []).length,
      },
    });
  }

  // 'balanced' stays the reference option in slot 1; the rest rank by quality.
  const balanced = options.find(o => o.lens.id === 'balanced');
  const rest = options.filter(o => o !== balanced).sort((a, b) => b.rank - a.rank);
  const ordered = [...(balanced ? [balanced] : []), ...rest].slice(0, count);
  return { options: ordered };
}
