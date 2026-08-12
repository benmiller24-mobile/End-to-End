/**
 * Taste-loop harness, step 2 (AD-5): the vision judge.
 * =====================================================
 * Reads the pair manifest from render-batch.mjs and asks a vision model which
 * floor plan "looks professionally designed" — blind A/B (sides randomized by
 * pair index parity, deterministic), one verdict per pair, with a reason.
 * Writes judgments.json + a preference summary.
 *
 * OFFLINE ONLY — this never runs on the solve path. Requires ANTHROPIC_API_KEY
 * in the environment; exits 0 with a clear message when unset (CI-safe).
 *
 *   ANTHROPIC_API_KEY=… node evals/si/judge/judge-pairs.mjs [dir=evals/si/judge/out]
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const dir = resolve(process.argv[2] || join(HERE, 'out'));

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.log('judge-pairs: ANTHROPIC_API_KEY not set — skipping (the judge is offline calibration, never a gate).');
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
const b64 = (f) => readFileSync(join(dir, f)).toString('base64');

const judgments = [];
for (const pair of manifest.pairs) {
  // Deterministic blind sides: even pair index → legacy is A, odd → best is A.
  const flip = manifest.pairs.indexOf(pair) % 2 === 1;
  const A = flip ? pair.best : pair.legacy;
  const B = flip ? pair.legacy : pair.best;
  const body = {
    model: 'claude-sonnet-5',
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'You are a senior kitchen designer reviewing two floor plans (A then B) for the SAME room. Judge purely on design quality: appliance placement and landings, work zones, cabinet width rhythm (no slivers), corner treatment, overall composition. Answer with strict JSON: {"winner":"A"|"B"|"tie","confidence":0-1,"reason":"one sentence"}.' },
        { type: 'text', text: 'Plan A:' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64(A) } },
        { type: 'text', text: 'Plan B:' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64(B) } },
      ],
    }],
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error(`${pair.id}: API ${res.status}`); continue; }
  const out = await res.json();
  const text = (out.content || []).map(c => c.text || '').join('');
  let verdict = null;
  try { verdict = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch { /* unparseable */ }
  if (!verdict?.winner) { console.error(`${pair.id}: unparseable verdict: ${text.slice(0, 80)}`); continue; }
  const winnerTag = verdict.winner === 'tie' ? 'tie' : ((verdict.winner === 'A') !== flip ? 'legacy' : 'best');
  judgments.push({ id: pair.id, flip, winner: winnerTag, confidence: verdict.confidence, reason: verdict.reason });
  console.log(`${pair.id}: ${winnerTag}${verdict.confidence != null ? ` (${verdict.confidence})` : ''} — ${verdict.reason}`);
}

const bestWins = judgments.filter(j => j.winner === 'best').length;
const decided = judgments.filter(j => j.winner !== 'tie').length;
const summary = {
  pairs: judgments.length, bestWins, legacyWins: decided - bestWins, ties: judgments.length - decided,
  bestPreference: decided ? +(bestWins / decided).toFixed(3) : null,
};
writeFileSync(join(dir, 'judgments.json'), JSON.stringify({ summary, judgments }, null, 1));
console.log(`\nsolveBest preferred in ${bestWins}/${decided} decided pairs (${summary.bestPreference == null ? 'n/a' : Math.round(summary.bestPreference * 100) + '%'}) → ${join(dir, 'judgments.json')}`);
