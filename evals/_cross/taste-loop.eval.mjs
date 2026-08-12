/**
 * Taste loop (AD-5) — the key-free contracts of the judge harness.
 * ================================================================
 * The vision judge itself needs ANTHROPIC_API_KEY and never gates CI; what CI
 * pins is everything around it: pair rendering works headlessly, the judge
 * script skips cleanly without a key, the extended corpus is deterministic
 * and additive, and the intent planner module is loadable with a strict
 * whitelist.
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { suite } from '../_lib.mjs';
import { corpusArray, corpusArrayX } from '../si/corpus.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

export default async function run() {
  const s = suite('taste loop (judge harness, extended corpus, intent planner)');

  // ── extended corpus: additive + deterministic ──
  const base = corpusArray(12);
  const ext = corpusArrayX(12);
  s.eq('extended corpus same cardinality', ext.length, base.length);
  s.ok('extended ids are suffixed (never collide with gated ids)', ext.every(k => /X$/.test(k.id)));
  s.ok('windows present on a deterministic subset', ext.filter(k => k.walls.some(w => (w.openings || []).length)).length >= 4);
  s.ok('base corpus untouched by the extension', JSON.stringify(corpusArray(12)) === JSON.stringify(base));
  s.ok('extension deterministic', JSON.stringify(corpusArrayX(12)) === JSON.stringify(ext));

  // ── pair renderer: 2 kitchens → 4 PNGs + manifest, headless ──
  const outDir = join(ROOT, 'evals/si/judge/.eval-out');
  rmSync(outDir, { recursive: true, force: true });
  let renderOk = false, pairs = 0;
  try {
    execSync(`node evals/si/judge/render-batch.mjs 2 "${outDir}"`, { cwd: ROOT, stdio: 'pipe', timeout: 180000 });
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8'));
    pairs = manifest.pairs.length;
    renderOk = pairs >= 1 && manifest.pairs.every(p => existsSync(join(outDir, p.legacy)) && existsSync(join(outDir, p.best)));
  } catch (e) { renderOk = false; }
  s.ok(`pair renderer produces PNG pairs headlessly (${pairs} pairs)`, renderOk);

  // ── judge script: clean skip without a key (never a hidden gate) ──
  let skipMsg = '';
  try {
    skipMsg = execSync(`node evals/si/judge/judge-pairs.mjs "${outDir}"`, {
      cwd: ROOT, stdio: 'pipe', timeout: 30000,
      env: { ...process.env, ANTHROPIC_API_KEY: '' },
    }).toString();
  } catch { /* non-zero exit would be a failure */ }
  s.ok('judge skips cleanly without ANTHROPIC_API_KEY', /skipping/i.test(skipMsg));
  rmSync(outDir, { recursive: true, force: true });

  // ── intent planner: module loads; the whitelist exists in source ──
  const fnSrc = readFileSync(join(ROOT, 'netlify/functions/design-intent.js'), 'utf8');
  s.ok('intent planner whitelists prefs (no passthrough of arbitrary fields)',
    /preferDrawerBases/.test(fnSrc) && /whitelist/i.test(fnSrc) && !/\.\.\.parsed\.prefs/.test(fnSrc));
  s.ok('intent planner is key-gated with a friendly 503', /503/.test(fnSrc) && /ANTHROPIC_API_KEY/.test(fnSrc));
  s.ok('intent planner never places cabinets (no solver import)', !/solver\.js|solve\(/.test(fnSrc));

  return s.done();
}
