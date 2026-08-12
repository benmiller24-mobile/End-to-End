/**
 * AD-0 — mechanical solver defects, pinned forever.
 * ==================================================
 * Every check below is a defect that SHIPPED (verified + reproduced in the
 * 2026-08 auto-design audit, docs/audits/auto-design-audit-2026-08.json) and
 * was fixed in phase AD-0 of docs/Auto-Design-Rebuild-Plan.md. If any of these
 * goes red, a state-desync/corruption class bug is back — do not waive.
 */
import { suite } from '../_lib.mjs';
import { solve } from '../../eclipse-engine/src/index.js';
import { TEMPLATES, getTemplate } from '../../eclipse-engine/src/templates.js';

export default async function run() {
  const s = suite('auto-design mechanical defects (AD-0)');

  // ── 1. Hood follows the centered range (galley_island shipped it 25.5" off,
  //       with a wall cabinet over the cooktop) ──
  {
    const r = solve(getTemplate('galley_island').input);
    for (const wl of r.walls) {
      const range = (wl.cabinets || []).find(c => /range|cooktop/i.test(c.applianceType || ''));
      if (!range) continue;
      const rc = range.position + range.width / 2;
      const ups = (r.uppers || []).find(u => u.wallId === wl.wallId);
      const hood = (ups?.cabinets || []).find(c => /^P?RH\d|hood/i.test(c.sku || ''));
      if (hood) {
        const hc = hood.position + hood.width / 2;
        s.ok(`hood centered on range (offset ${Math.abs(hc - rc).toFixed(1)}")`, Math.abs(hc - rc) <= 1.5);
      }
      for (const c of (ups?.cabinets || [])) {
        if (/^P?RH\d|hood/i.test(c.sku || '')) continue;
        const overlap = Math.min(c.position + c.width, range.position + range.width) - Math.max(c.position, range.position);
        s.ok(`no field upper over the range (${c.sku})`, overlap <= 1);
      }
    }
  }

  // ── Solve everything once for the sweep checks ──
  const results = TEMPLATES.map(t => ({ id: t.id, r: solve(t.input) }));

  // ── 2. No corrupted SKUs from width rewrites (B3D30→B24D30, W2339L→W24L) ──
  {
    let corrupt = [];
    for (const { id, r } of results) {
      for (const p of (r.placements || [])) {
        const sku = String(p.sku || '');
        if (/^(FC-)?B(?!2HD|2TD|3D|4D|\d)/.test(sku)) continue;
        if (/^(FC-)?B(?!2HD\d|2TD\d|3D\d|4D\d)\d{2,}D\d/.test(sku)) corrupt.push(`${id}:${sku}`);
        if (/^(FC-)?W\d{1,2}[LR]$/.test(sku)) corrupt.push(`${id}:${sku}`);   // upper lost its height digits
        if (/^(FC-)?BD\d/.test(sku)) corrupt.push(`${id}:${sku}`);            // drawer count stripped
      }
    }
    s.eq(`no width-rewrite SKU corruption (${corrupt.slice(0, 3).join(' ')})`, corrupt.length, 0);
  }

  // ── 3. ONE upper corner unit per corner (was a duplicated pair) ──
  {
    let dup = 0;
    for (const { r } of results) {
      const byCorner = {};
      for (const uc of (r.upperCorners || [])) {
        if (uc.sku !== 'WSC24-PH') continue;
        byCorner[uc.wall] = (byCorner[uc.wall] || 0) + 1;
      }
      for (const n of Object.values(byCorner)) if (n > 1) dup++;
    }
    s.eq('one WSC24-PH per corner, never a duplicated pair', dup, 0);
  }

  // ── 4. Dropped-appliance guard: real drops error, hosted forms don't ──
  {
    const dbl = results.find(x => x.id === 'island_double').r;
    s.ok('island_double: silently dropped wall oven now raises severity=error',
      (dbl.validation || []).some(v => v.severity === 'error' && v.rule === 'appliance_dropped' && /wallOven/i.test(v.message)));
    const cp = results.find(x => x.id === 'island_centerpiece').r;
    s.ok('island_centerpiece: island sink hosted by a sink base is NOT a false positive',
      !(cp.validation || []).some(v => v.rule === 'appliance_dropped' && /sink/i.test(v.message)));
  }

  // ── 5. Positional integrity across every template ──
  {
    let undefTall = 0, overflow = 0, midRunEP = 0;
    for (const { r } of results) {
      for (const tl of (r.talls || [])) if (typeof tl.position !== 'number') undefTall++;
      for (const wl of (r.walls || [])) {
        const cabs = (wl.cabinets || []).filter(c => typeof c.position === 'number').sort((a, b) => a.position - b.position);
        if (cabs.length && Math.max(...cabs.map(c => c.position + (c.width || 0))) > wl.wallLength + 0.6) overflow++;
        for (let i = 1; i < cabs.length - 1; i++) {
          const c = cabs[i];
          if ((c.type === 'end_panel' || /^(FC-)?(BEP|WEP|UDEP|BDEP)\d?/.test(String(c.sku || '')))
            && cabs[i - 1].type !== 'appliance' && cabs[i + 1].type !== 'appliance'
            && !/^(FC-)?(REP|FREP)/.test(String(c.sku || ''))) midRunEP++;
        }
      }
    }
    s.eq('no tall with position=undefined', undefTall, 0);
    s.eq('no wall run overflowing its wall (>0.6")', overflow, 0);
    s.eq('no end panel stranded mid-run away from an appliance', midRunEP, 0);
  }

  // ── 6. The three always-crashing passes now RUN (were swallowed as info) ──
  {
    let passErrs = [];
    for (const { id, r } of results) {
      for (const v of (r.validation || [])) {
        if (/part_id_error|style_morph_error|alignment_error/.test(v.rule || '')) passErrs.push(`${id}:${v.rule}`);
      }
    }
    s.eq(`part-id / style-morph / alignment passes crash-free (${passErrs.slice(0, 3).join(' ')})`, passErrs.length, 0);
    const k = results.find(x => x.id === 'l_shape_standard').r;
    s.ok('part IDs actually generate', (k.partIds?.parts?.length || 0) > 0);
    s.ok('BOM actually generates', !!k.bom);
    s.ok('style morph actually generates', (k.styleMorph?.cabinets?.length || 0) > 0);
    s.ok('vertical alignment actually scores', typeof k.alignmentReport?.overallScore === 'number');
    s.ok('crown molding extrusion actually generates', !!k.moldingExtrusion);
    s.ok('light-rail extrusion actually generates', !!k.lightRailExtrusion);
  }

  // ── 7. Door-swing warnings name real objects, never "undefined vs undefined" ──
  {
    let undef = 0;
    for (const { r } of results) {
      for (const v of (r.validation || [])) {
        if (v.rule === 'door_swing_collision' && /undefined/.test(v.message || '')) undef++;
      }
    }
    s.eq('no "undefined vs undefined" swing warnings', undef, 0);
  }

  // ── 8. walls[] and placements[] agree (waste-swap used to mutate after compile) ──
  {
    let disagree = [];
    for (const { id, r } of results) {
      for (const wl of (r.walls || [])) {
        for (const c of (wl.cabinets || [])) {
          if (c.type !== 'base' || typeof c.position !== 'number' || !c.sku) continue;
          const hit = (r.placements || []).some(p => p.wall === wl.wallId && p.sku === c.sku && Math.abs((p.position ?? -999) - c.position) < 0.51);
          if (!hit) disagree.push(`${id}:${wl.wallId}:${c.sku}@${c.position}`);
        }
      }
    }
    s.eq(`every wall base exists identically in placements (${disagree.slice(0, 3).join(' ')})`, disagree.length, 0);
  }

  return s.done();
}
