/**
 * Eval scaffold generator — onboarding isn't done until the line is GUARDED.
 * ==========================================================================
 * Given a zero-code tenant package (what the in-app ingest or the CLI emits),
 * produce a ready-to-commit `evals/<id>/catalog-sanity.eval.mjs` in the exact
 * shape the hand-written tenants use (see evals/aspect/): a SKU-count floor,
 * deterministic spot prices sampled from the ingested rows, provenance-note
 * and unpriced-row checks — plus a TODO golden-order template that the ack
 * flywheel ("Save as regression fixture") later replaces with a real order.
 * Pure module: the UI download button and the eval both call this.
 */

// Deterministic sample: first / last / median / quartile rows of the PRICED
// catalog, by stable row order — same package in, same scaffold out.
export function sampleSpotRows(pkg, n = 6) {
  const rows = ((pkg.catalog && pkg.catalog.rows) || []).filter(r => r.s && r.p > 0);
  if (!rows.length) return [];
  const picks = new Set();
  for (let i = 0; i < n; i++) picks.add(Math.min(rows.length - 1, Math.round((i / Math.max(n - 1, 1)) * (rows.length - 1))));
  return [...picks].sort((a, b) => a - b).map(i => rows[i]);
}

export function buildEvalScaffold(pkg) {
  const id = pkg.id;
  const rows = ((pkg.catalog && pkg.catalog.rows) || []);
  const priced = rows.filter(r => r.p > 0).length;
  const floor = Math.max(1, Math.floor(priced * 0.9 / 50) * 50);   // 90%, rounded to 50s
  const spots = sampleSpotRows(pkg, 6)
    .map(r => `  s.eq('${String(r.s).replace(/'/g, "\\'")} (ingested spot price)', t.catalog.find(${JSON.stringify(r.s)})?.p, ${r.p});`)
    .join('\n');
  return `/**
 * ${pkg.branding?.manufacturerName || id} — onboarding scaffold (generated ${new Date().toISOString().slice(0, 10)}
 * from ${pkg._meta?.source || pkg.sourceName || 'the ingested spec book'}).
 * Spot prices below were sampled from the ingest itself: they lock the
 * EXTRACTION, not the manufacturer. Verify a handful against the printed book,
 * then keep this green forever.
 *
 * TODO (the trust flywheel): when the first real order acknowledgment
 * reconciles clean in the app, use "Save as regression fixture" on the Order
 * tab and commit the downloaded order-*.eval.mjs beside this file — that is
 * what upgrades this line from "ingested" to "order-verified".
 */
import { suite } from '../_lib.mjs';
import { getTenant } from '../../eclipse-pricing/src/tenants/index.js';

export default async function run() {
  const s = suite('${id} catalog sanity');
  const t = getTenant(${JSON.stringify(id)});
  s.ok('≥ ${floor} SKUs ingested', t.catalog.count >= ${floor}, String(t.catalog.count));
${spots}
  s.ok('provenance note present until order-verified', !!t.branding.catalogNote);
  const unpriced = t.catalog.list().filter(r => !(r.p > 0) && !r.pg).length;
  s.eq('unpriced rows', unpriced, ${rows.length - priced});
  return s.done();
}
`;
}
