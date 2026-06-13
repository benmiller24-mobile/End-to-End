/**
 * Self-improving QA gate (cross-tenant).
 * ======================================
 * Runs a slice of the deterministic kitchen corpus through the full auto-design
 * pipeline — solve → realize (metric tenants) → score the 5 metrics (design,
 * price, floor plan, NKBA, aesthetic) — in Eclipse, Shiloh AND pronorm, and
 * asserts every kitchen passes in every line. This locks the four solver fixes
 * the loop surfaced (end-panel overlap false-positive, proportionality
 * denominator, crown-spans-hood, terminus-appliance symmetry) so they can't
 * regress. The full 100×3 sweep lives in evals/si/run-corpus.mjs.
 */
import { suite } from '../_lib.mjs';
import { runOne } from '../si/run-corpus.mjs';
import { corpusArray } from '../si/corpus.mjs';

const BRANDS = ['eclipse', 'shiloh', 'pronorm'];

export default async function run() {
  const s = suite('self-improving corpus gate');
  const corpus = corpusArray(18);   // spans single / galley / L / U (+island)

  for (const brand of BRANDS) {
    let pass = 0;
    const fails = [];
    for (const k of corpus) {
      const r = runOne(k, brand);
      if (r.score.pass) pass++;
      else fails.push(`${k.id}(${(r.score.failed || []).join('|')})`);
    }
    s.eq(`${brand}: all ${corpus.length} kitchens pass`, pass, corpus.length);
    if (fails.length) s.ok(`${brand} failures: ${fails.slice(0, 6).join(' ')}`, false);
  }

  // Metric integrity: a representative kitchen yields all five metrics with scores.
  const probe = runOne(corpus[7], 'eclipse');   // an L kitchen
  const m = probe.score.metrics;
  for (const key of ['design', 'price', 'floorplan', 'nkba', 'aesthetic']) {
    s.ok(`metric '${key}' present + scored`, m[key] && typeof m[key].score === 'number');
  }
  s.ok('priced cabinets resolve (no substitutions/misses)', m.price.missing === 0 && m.price.substituted === 0);
  s.ok('pronorm realizes to its own catalogue', runOne(corpus[7], 'pronorm').score.metrics.price.total > 0);

  return s.done();
}
