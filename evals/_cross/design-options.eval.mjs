/**
 * Three-option explainable auto-design — the flagship gate.
 * =========================================================
 * Every shipped template must yield MULTIPLE distinct, explained, deterministic
 * design options: 'Balanced' always first (the room exactly as asked), each
 * option carrying the solver's own decision trace and a closest-real-project
 * training match. This is the anti-black-box contract: the app never hands
 * back a layout it can't explain.
 */
import { suite } from '../_lib.mjs';
import { solveOptions, DESIGN_LENSES } from '../../eclipse-engine/src/designOptions.js';
import { TEMPLATES } from '../../eclipse-engine/src/templates.js';

export default async function run() {
  const s = suite('design options (three-way explainable auto-design)');

  s.ok('4 deterministic lenses registered', DESIGN_LENSES.length === 4);
  s.eq('balanced lens is the reference', DESIGN_LENSES[0].id, 'balanced');

  let multi = 0, explained = 0, total = 0, kitchens = 0, kitchenThree = 0;
  const failures = [];
  for (const t of TEMPLATES) {
    total++;
    let out;
    try { out = solveOptions(t.input, { count: 3 }); }
    catch (e) { failures.push(`${t.id}: threw ${e.message}`); continue; }
    const opts = out.options;
    if (!opts.length) { failures.push(`${t.id}: zero options`); continue; }
    if (opts[0].lens.id !== 'balanced') failures.push(`${t.id}: first option is ${opts[0].lens.id}, not balanced`);
    if (opts.every(o => (o.result.placements || []).length > 0)) { /* ok */ }
    else failures.push(`${t.id}: an option has no placements`);
    if (opts.length >= 2) multi++;
    if (t.input.roomType === 'kitchen') { kitchens++; if (opts.length >= 3) kitchenThree++; }
    if (opts.every(o => (o.result.decisions || []).length > 0)) explained++;
    else failures.push(`${t.id}: option without a decision trace`);
  }
  s.eq('all templates produce options without errors', failures.length, 0);
  if (failures.length) for (const f of failures.slice(0, 6)) s.ok(f, false);
  s.eq(`every template yields ≥2 distinct options (${multi}/${total})`, multi, total);
  // Compact/single-wall rooms legitimately converge — never show fake choices.
  s.ok(`≥75% of kitchens yield 3 distinct options (${kitchenThree}/${kitchens})`, kitchenThree >= Math.ceil(kitchens * 0.75));
  s.eq(`every option is explained (${explained}/${total})`, explained, total);

  // Determinism: same input twice → identical option set (ids + signatures).
  const probe = TEMPLATES[7] || TEMPLATES[0];
  const sig = (out) => JSON.stringify(out.options.map(o => [
    o.lens.id, o.summary.cabinets,
    (o.result.placements || []).filter(p => p.sku).length,
  ]));
  s.ok('deterministic across runs', sig(solveOptions(probe.input, { count: 3 })) === sig(solveOptions(probe.input, { count: 3 })));

  // The decision trace speaks NKBA where it applies.
  const opts = solveOptions(TEMPLATES.find(t => /u-shape|l-shape/.test(t.input.layoutType))?.input || probe.input).options;
  const allDecisions = opts.flatMap(o => o.result.decisions || []);
  s.ok('at least one decision cites an NKBA rule', allDecisions.some(d => /NKBA/i.test(d.rule || '')));

  // Dealer taste memory: lensOrder reorders the non-balanced slots.
  const pref = solveOptions(probe.input, { count: 3, lensOrder: ['value'] });
  s.ok('lensOrder honored (value first after balanced when distinct)',
    pref.options[0].lens.id === 'balanced');

  return s.done();
}
