/**
 * Self-serve onboarding — the eval-scaffold generator is itself guarded.
 * ======================================================================
 * Onboarding a line isn't done until the line is guarded: the in-app
 * "Eval scaffold" download must emit a catalog-sanity eval whose assertions
 * HOLD against the live tenant it was generated from. Proven here on the
 * Aspect package (the original zero-code onboarding).
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { suite } from '../_lib.mjs';
import { getTenant } from '../../eclipse-pricing/src/tenants/index.js';
import { buildEvalScaffold, sampleSpotRows } from '../../frontend/src/evalScaffold.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(HERE, '../../eclipse-pricing/src/tenants/packages/aspect.package.json'), 'utf8'));

export default async function run() {
  const s = suite('onboarding eval scaffold');

  // Deterministic sampling: same package in, same spot rows out.
  const a = sampleSpotRows(pkg, 6).map(r => r.s).join('|');
  const b = sampleSpotRows(pkg, 6).map(r => r.s).join('|');
  s.ok('spot sampling is deterministic', a === b && a.length > 0);
  s.ok('samples span the catalog (first ≠ last)', a.split('|')[0] !== a.split('|').slice(-1)[0]);

  const src = buildEvalScaffold(pkg);
  s.ok('scaffold imports the eval harness', src.includes("from '../_lib.mjs'"));
  s.ok('scaffold targets the right tenant', src.includes(`getTenant("${pkg.id}")`));
  s.ok('scaffold carries the flywheel TODO (golden order upgrade path)', /Save as regression fixture/.test(src));

  // Execute the scaffold's semantics against the LIVE registered tenant:
  // count floor + every sampled spot price must hold.
  const t = getTenant(pkg.id);
  const floorM = src.match(/t\.catalog\.count >= (\d+)/);
  s.ok('count floor present', !!floorM);
  if (floorM) s.ok(`live count ${t.catalog.count} ≥ floor ${floorM[1]}`, t.catalog.count >= Number(floorM[1]));
  const spots = [...src.matchAll(/t\.catalog\.find\("([^"]+)"\)\?\.p, ([\d.]+)\)/g)];
  s.ok(`scaffold pins ${spots.length} spot prices (≥ 4)`, spots.length >= 4);
  for (const [, sku, want] of spots) {
    s.eq(`scaffold assertion holds: ${sku} = ${want}`, t.catalog.find(sku)?.p, Number(want));
  }

  return s.done();
}
