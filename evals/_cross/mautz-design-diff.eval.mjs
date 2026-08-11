/**
 * The Mautz test — decisions-reproduced (AD-1's honest KPI, ratcheted).
 * =====================================================================
 * Auto-solve the SAME room as the real professionally designed (and to-the-
 * penny order-verified) Mautz kitchen, and count how many of the designer's
 * material decisions the auto layout reproduces. The 2026-08 audit measured
 * ~4/16 on the pre-AD-0 solver; the floor lives in evals/si/v2-baseline.json
 * and may only go UP.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { suite } from '../_lib.mjs';
import { solve } from '../../eclipse-engine/src/index.js';
import { setPricingBrand, findSkuNormalized } from '../../frontend/src/skuResolver.js';
import { roomInput } from '../si/mautzRoom.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = JSON.parse(readFileSync(join(HERE, '../si/v2-baseline.json'), 'utf8'));

export default async function run() {
  const s = suite('mautz design diff (decisions reproduced)');
  const r = solve(roomInput());
  const P = (r.placements || []).filter(p => p.sku);
  const skus = P.map(p => String(p.sku || ''));
  const talls = r.talls || [];
  const has = (re) => skus.some(x => re.test(x));

  const decisions = [];
  const D = (label, ok) => decisions.push([label, !!ok]);

  D('lazy-susan corner (BL family)', has(/^(FC-)?BLS?\d|^(FC-)?BLSB/));
  D('blind corner (BBC family)', has(/^(FC-)?BBC\d/));
  D('tall anchors a run end', (() => {
    if (!talls.length) return false;
    for (const t of talls) {
      if (typeof t.position !== 'number') continue;
      const wl = (r.walls || []).find(w => w.wallId === t.wall);
      if (!wl) continue;
      const run = (wl.cabinets || []).filter(c => typeof c.position === 'number');
      const runEnd = Math.max(...run.map(c => c.position + (c.width || 0)));
      if (t.position <= 1 || t.position + t.width >= runEnd - 1) return true;
    }
    return false;
  })());
  D('over-fridge RW cabinet', has(/^(FC-)?RW\d/));
  const sinkApp = P.find(p => p.type === 'appliance' && /sink/i.test(p.applianceType || ''));
  const sinkUps = (r.uppers || []).find(u => u.wallId === (sinkApp && sinkApp.wall));
  D('no upper over the sink window', !!sinkApp && !(sinkUps?.cabinets || []).some(c =>
    !/^P?RH/.test(c.sku || '')
    && Math.min(c.position + c.width, sinkApp.position + sinkApp.width) - Math.max(c.position, sinkApp.position) > 6));
  const waste = P.find(p => /^(FC-)?BWDM/.test(p.sku || ''));
  D('waste pull-out near the sink', !!(waste && sinkApp && waste.wall === sinkApp.wall && Math.abs(waste.position - sinkApp.position) <= 60));
  D('drawer bases present (B*D family)', has(/^(FC-)?B[234]D\d|^(FC-)?B2TD/));
  const sbP = P.find(p => /^(FC-)?SB\d/.test(p.sku || ''));
  D('36-inch-class sink base', !!(sbP && Math.abs((sbP.width || 0) - 36) <= 3));
  D('≥95% of SKUs resolve in the catalog', (() => {
    setPricingBrand('eclipse');
    let ok = 0, tot = 0;
    for (const p of P.filter(p => ['base', 'wall', 'tall', 'corner'].includes(p.type))) {
      tot++;
      try { const e = findSkuNormalized(p.sku); if (e && !e.error && e._resolution !== 'substituted') ok++; } catch { /* miss */ }
    }
    return tot > 0 && ok / tot >= 0.95;
  })());
  D('every wall carries a run', (r.walls || []).every(wl => (wl.cabinets || []).some(c => typeof c.position === 'number')));
  D('no sliver cabinets', P.filter(p => ['base', 'wall'].includes(p.type) && p.width < 11.99
    && !/^(FC-)?(OVF|F)\d|^(FC-)?BWDM|EP/.test(p.sku || '')).length === 0);
  D('upper corner unit (WSE/WSC)', has(/^S?WSE|^S?WSC/));

  const reproduced = decisions.filter(([, ok]) => ok).length;
  for (const [label, ok] of decisions) s.ok(`${ok ? 'reproduces' : 'MISSES'}: ${label}`, true); // informational rows
  s.ok(`decisions reproduced ratchet: ${reproduced}/${decisions.length} ≥ ${BASELINE.mautzDecisions}/${BASELINE.mautzDecisionsTotal}`,
    reproduced >= BASELINE.mautzDecisions);
  s.eq('decision count matches the baseline denominator', decisions.length, BASELINE.mautzDecisionsTotal);

  return s.done();
}
