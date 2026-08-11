/**
 * Scorer v2 — the honest design-quality gate (AD-1) with a ratchet.
 * =================================================================
 * Three contracts:
 *  1. CALIBRATION — the scorer passes a REAL professional design (Mautz) and
 *     fails obvious garbage (a kitchen with no base cabinets scored 94/100
 *     under v1; v2 must hard-fail it).
 *  2. HONESTY — the corpus pass-rate is measured against evals/si/v2-baseline.json
 *     and may only go UP (the ratchet). v1 (180/180) remains as crash-freedom.
 *  3. DETERMINISM — same result in, same verdict out.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { suite } from '../_lib.mjs';
import { solve } from '../../eclipse-engine/src/index.js';
import { corpusArray } from '../si/corpus.mjs';
import { scoreKitchenV2 } from '../si/scoreKitchenV2.mjs';
import { realDesign } from '../si/mautzRoom.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = JSON.parse(readFileSync(join(HERE, '../si/v2-baseline.json'), 'utf8'));

export default async function run() {
  const s = suite('scorer v2 (designer rubric + ratchet)');

  // ── 1a. The REAL Mautz design passes ──
  const { result: mautz, room } = realDesign();
  const vm = scoreKitchenV2(mautz, { room });
  s.ok(`real Mautz design PASSES v2 (score ${vm.score}, craft ${Math.round(vm.craftFraction * 100)}%)`, vm.pass);
  s.eq('real Mautz design has zero hard fails', vm.hardFails.length, 0);

  // ── 1b. Garbage fails: a "kitchen" with zero base cabinets (v1 gave it 94) ──
  const garbage = {
    walls: [{ wallId: 'A', wallLength: 144, cabinets: [
      { type: 'appliance', applianceType: 'sink', position: 0, width: 33 },
      { type: 'appliance', applianceType: 'range', position: 40, width: 30 },
    ] }],
    uppers: [], talls: [], placements: [], validation: [],
  };
  const vg = scoreKitchenV2(garbage, { room: { walls: [{ id: 'A', length: 144 }] } });
  s.ok('zero-base "kitchen" HARD-FAILS v2', !vg.pass && vg.hardFails.some(h => /hard-bases/.test(h)));

  // ── 1c. A severity=error finding fails regardless of rule name ──
  const errKitchen = { ...garbage, validation: [{ severity: 'error', rule: 'Cyncly-Anything-At-All', message: 'x' }] };
  const ve = scoreKitchenV2(errKitchen, { room: { walls: [{ id: 'A', length: 144 }] } });
  s.ok('any severity=error is a hard fail (no rule-name filter)', ve.hardFails.some(h => /hard-errors/.test(h)));

  // ── 2. The ratchet: corpus pass-rate ≥ recorded floor ──
  let pass = 0, n = 0;
  const failReasons = {};
  for (const k of corpusArray(BASELINE.corpusTotal)) {
    const walls = k.walls.map(w => ({ ...w, ceilingHeight: w.ceilingHeight || k.ceiling || 96 }));
    const input = { layoutType: k.layoutType, roomType: 'kitchen', walls, appliances: k.appliances, prefs: k.prefs || {}, applyApplianceRec: true, ...(k.island ? { island: k.island } : {}) };
    let r; try { r = solve(input); } catch { n++; continue; }
    const v2 = scoreKitchenV2(r, { room: { walls } });
    n++; if (v2.pass) pass++;
    else {
      const key = v2.hardFails[0]?.split(':')[0] || v2.metrics.filter(m => !m.hard && m.applicable && !m.pass).map(m => m.id).slice(0, 2).join('+');
      failReasons[key] = (failReasons[key] || 0) + 1;
    }
  }
  s.ok(`corpus v2 pass-rate ratchet: ${pass}/${n} ≥ ${BASELINE.corpusPass}/${BASELINE.corpusTotal} (fails: ${Object.entries(failReasons).map(([k, v]) => `${k}×${v}`).join(' ')})`,
    pass >= BASELINE.corpusPass);

  // ── 3. Determinism ──
  const va = scoreKitchenV2(mautz, { room });
  s.ok('deterministic verdicts', JSON.stringify(va) === JSON.stringify(vm));

  return s.done();
}
