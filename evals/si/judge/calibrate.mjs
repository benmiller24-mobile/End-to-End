/**
 * Taste-loop harness, step 3 (AD-5): rubric ↔ judge agreement report.
 * ====================================================================
 * Cross-references the vision judge's pairwise preferences (judgments.json)
 * with the rubric's per-metric verdicts on the same kitchens, and reports
 * which metrics AGREE with judged taste and which don't — the evidence base
 * for adjusting rubric weights/thresholds by hand. Deliberately a REPORT,
 * not an auto-tuner: scorer changes stay reviewed, deterministic commits.
 *
 *   node evals/si/judge/calibrate.mjs [dir=evals/si/judge/out]
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const dir = resolve(process.argv[2] || join(HERE, 'out'));

const { solve, solveBest } = await import(join(ROOT, 'eclipse-engine/src/index.js'));
const { scoreKitchenV2 } = await import(join(ROOT, 'eclipse-engine/src/designScore.js'));
const { corpusArray } = await import(join(ROOT, 'evals/si/corpus.mjs'));

let judgments;
try { judgments = JSON.parse(readFileSync(join(dir, 'judgments.json'), 'utf8')); }
catch { console.log('calibrate: no judgments.json — run render-batch + judge-pairs first.'); process.exit(0); }

const byId = new Map(corpusArray(200).map(k => [k.id, k]));
const agree = {}, disagree = {};
for (const j of judgments.judgments) {
  if (j.winner === 'tie') continue;
  const k = byId.get(j.id);
  if (!k) continue;
  const walls = k.walls.map(w => ({ ...w, ceilingHeight: w.ceilingHeight || k.ceiling || 96 }));
  const input = { layoutType: k.layoutType, roomType: 'kitchen', walls, appliances: k.appliances, prefs: k.prefs || {}, applyApplianceRec: true, ...(k.island ? { island: k.island } : {}) };
  let legacy, best;
  try { legacy = scoreKitchenV2(solve(input), { room: { walls } }); best = solveBest(input).score; } catch { continue; }
  // For each metric, did the rubric's per-metric winner match the judge's?
  const lm = new Map(legacy.metrics.map(m => [m.id, m]));
  for (const m of best.metrics) {
    const l = lm.get(m.id);
    if (!l || !m.applicable || !l.applicable) continue;
    if (m.pass === l.pass) continue;              // metric didn't distinguish the pair
    const metricWinner = m.pass ? 'best' : 'legacy';
    const bucket = metricWinner === j.winner ? agree : disagree;
    bucket[m.id] = (bucket[m.id] || 0) + 1;
  }
}

console.log('── metric agreement with the vision judge (only pairs a metric distinguished) ──');
const ids = [...new Set([...Object.keys(agree), ...Object.keys(disagree)])].sort();
if (!ids.length) console.log('no distinguishing metrics in the judged set — render more pairs.');
for (const id of ids) {
  const a = agree[id] || 0, d = disagree[id] || 0;
  console.log(`${id.padEnd(14)} agrees ${a}  disagrees ${d}  (${Math.round((a / Math.max(a + d, 1)) * 100)}%)`);
}
console.log('\nJudge summary:', JSON.stringify(judgments.summary));
console.log('Interpretation: metrics with LOW agreement are candidates for threshold review; adjust designScore.js by hand and re-run — the ratchet evals keep any regression visible.');
