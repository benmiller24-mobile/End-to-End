/**
 * Floorplan vision extraction — live API smoke (skips without a key).
 * Renders the Christiansen plan page (the set the vector path can't read)
 * and asserts the structured extraction comes back shaped for the solver.
 * Run with ANTHROPIC_API_KEY set to exercise it: costs a few cents.
 */
import { suite } from '../_lib.mjs';

export default async function run() {
  const s = suite('floorplan vision extraction');
  if (!process.env.ANTHROPIC_API_KEY) {
    s.ok('skipped — ANTHROPIC_API_KEY not set (vision path exercised in production via /api/floorplan)', true);
    return s.done();
  }
  const { default: handler } = await import('../../netlify/functions/floorplan.js');
  const { execSync } = await import('child_process');
  const { readFileSync, existsSync } = await import('fs');
  const src = '/Users/benjaminmiller/Downloads/02072024 CHRISTIANSEN 2409 S HUMBOLDT ST.pdf';
  if (!existsSync(src) || !existsSync('/tmp/pdfrender')) {
    s.ok('skipped — local fixture PDF/renderer unavailable', true);
    return s.done();
  }
  execSync(`/tmp/pdfrender "${src}" 2 /tmp/chr-plan-eval.png`);
  const image = readFileSync('/tmp/chr-plan-eval.png').toString('base64');
  const res = await handler(new Request('http://local/api/floorplan', {
    method: 'POST', body: JSON.stringify({ image, mediaType: 'image/png' }),
  }));
  const out = await res.json();
  s.eq('200 from handler', res.status, 200);
  const x = out.extraction || {};
  s.ok('walls extracted', Array.isArray(x.walls) && x.walls.length >= 2);
  s.ok('every wall has inches + confidence', (x.walls || []).every(w => w.lengthIn > 0 && ['printed', 'scaled', 'guessed'].includes(w.confidence)));
  s.ok('layoutType valid', ['single-wall', 'galley', 'l-shape', 'u-shape', 'g-shape'].includes(x.layoutType));
  return s.done();
}
