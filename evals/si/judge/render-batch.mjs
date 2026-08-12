/**
 * Taste-loop harness, step 1 (AD-5): render candidate PAIRS headlessly.
 * =====================================================================
 * For N corpus kitchens, renders the floor plan of (A) the legacy single-pass
 * solve and (B) the generate-and-score solveBest pick, to PNGs via the
 * repo-standard SSR pipeline (esbuild bundle → renderToStaticMarkup →
 * @resvg/resvg-js). Emits a manifest the vision judge (judge-pairs.mjs)
 * consumes. Key-free and fully offline.
 *
 *   node evals/si/judge/render-batch.mjs [count=12] [outDir=evals/si/judge/out]
 */
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const count = parseInt(process.argv[2] || '12', 10);
const outDir = resolve(process.argv[3] || join(HERE, 'out'));

// ── 1. Bundle an SSR renderer for FloorPlanView (repo-standard recipe) ──
// The entry must live INSIDE frontend/ so bare imports (react) resolve.
const entry = join(ROOT, 'frontend', '.ssr-judge-entry.jsx');
mkdirSync(outDir, { recursive: true });
writeFileSync(entry, `
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FloorPlanView from './src/FloorPlanView.jsx';
export function renderPlanSvg(solverResult) {
  try {
    const html = renderToStaticMarkup(React.createElement(FloorPlanView, { solverResult, inputWalls: solverResult._inputWalls }));
    // the component's root IS the plan svg (data-pdf attr not present in all
    // render modes) — take the outermost svg block.
    const m = html.match(/<svg[\\s\\S]*<\\/svg>/);
    if (!m) return { error: 'no floorplan svg in ' + html.length + ' chars: ' + html.slice(0, 120) };
    return { svg: m[0] };
  } catch (e) {
    return { error: e.message };
  }
}
`);
const bundle = join(outDir, '.ssr-bundle.mjs');
try {
  execSync(
    `./node_modules/.bin/esbuild "${entry}" --bundle --format=esm --platform=node --outfile="${bundle}" ` +
    `--banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" --loader:.js=jsx --external:canvas`,
    { cwd: join(ROOT, 'frontend'), stdio: 'pipe' });
} catch (e) {
  console.error('esbuild failed:\n' + String(e.stderr || e.stdout || e.message));
  process.exit(1);
}

const { renderPlanSvg } = await import(bundle);
const { Resvg } = await import(join(ROOT, 'frontend/node_modules/@resvg/resvg-js/index.js'));
const { solve, solveBest } = await import(join(ROOT, 'eclipse-engine/src/index.js'));
const { corpusArray } = await import(join(ROOT, 'evals/si/corpus.mjs'));

// ── 2. Render pairs ──
const manifest = [];
for (const k of corpusArray(count)) {
  const walls = k.walls.map(w => ({ ...w, ceilingHeight: w.ceilingHeight || k.ceiling || 96 }));
  const input = { layoutType: k.layoutType, roomType: 'kitchen', walls, appliances: k.appliances, prefs: k.prefs || {}, applyApplianceRec: true, ...(k.island ? { island: k.island } : {}) };
  const out = { id: k.id, layout: k.layoutType };
  for (const [tag, result] of [['legacy', (() => { try { return solve(input); } catch { return null; } })()],
                               ['best', (() => { try { return solveBest(input).result; } catch { return null; } })()]]) {
    if (!result) { out[tag] = null; continue; }
    result._inputWalls = (result._inputWalls || walls);
    const r2 = renderPlanSvg(result);
    if (!r2.svg) { out[tag] = null; out[tag + 'Err'] = r2.error; console.error(k.id, tag, 'render:', (r2.error || '').slice(0, 160)); continue; }
    const png = new Resvg(r2.svg, { fitTo: { mode: 'width', value: 900 } }).render().asPng();
    const file = `${k.id}-${tag}.png`;
    writeFileSync(join(outDir, file), png);
    out[tag] = file;
  }
  if (out.legacy && out.best) manifest.push(out);
  console.log(`${k.id}: legacy=${!!out.legacy} best=${!!out.best}`);
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ generated: null, pairs: manifest }, null, 1));
rmSync(entry, { force: true });
console.log(`\n${manifest.length} pairs rendered → ${outDir}/manifest.json`);
