/**
 * Cabinet modification layer tests — brand availability, charge math, and
 * the fit/draw metadata the Design Studio and drawings rely on.
 * Prices verified against Eclipse v8.8.1 C1–C2 and Shiloh v3.4.2 C1–C2.
 */
import { CABINET_MODS, MODS_BY_CODE, getApplicableMods, modCharge, modChargeList, calcModCost, ROT_OPTIONS } from './src/modData.js';

let pass = 0, fail = 0;
const t = (name, cond) => {
  if (cond) { pass++; console.log(`ok   ${name}`); }
  else { fail++; console.log(`FAIL ${name}`); }
};

// ── Brand availability ──
const eclipseBase = getApplicableMods({ t: 'B', s: 'B24' }, 'eclipse').map(m => m.code);
const shilohBase = getApplicableMods({ t: 'B', s: 'B24' }, 'shiloh').map(m => m.code);
const shilohWall = getApplicableMods({ t: 'W', s: 'W3030' }, 'shiloh').map(m => m.code);
const eclipseWall = getApplicableMods({ t: 'W', s: 'W3030' }, 'eclipse').map(m => m.code);

t('Eclipse base offers tip-on drawers', eclipseBase.includes('TIP_ONDR'));
t('Shiloh base hides tip-on drawers (Eclipse-only)', !shilohBase.includes('TIP_ONDR'));
t('Shiloh base offers front-only FR', shilohBase.includes('FR'));
t('Eclipse base hides FR (Shiloh-only)', !eclipseBase.includes('FR'));
t('Shiloh base offers peninsula conversion', shilohBase.includes('P'));
t('Shiloh base offers extended top ET', shilohBase.includes('ET'));
t('Shiloh wall offers finished-bottom prep PFB', shilohWall.includes('PFB'));
t('Eclipse wall offers lighting prep PWL', eclipseWall.includes('PWL'));
t('Shiloh wall hides PWL (Eclipse-only)', !shilohWall.includes('PWL'));
t('Both lines offer Aventos HK on walls', eclipseWall.includes('AVENTOS_HK') && shilohWall.includes('AVENTOS_HK'));
t('Both lines offer toe-kick mods', eclipseBase.includes('NTK') && shilohBase.includes('NTK'));
t('Finished interior FI available both lines', eclipseBase.includes('FI') && shilohBase.includes('FI'));

// ── Charge math (catalog list prices) ──
t('NTK $89/cab', modCharge(MODS_BY_CODE.NTK, true) === 89);
t('FTK $89/face ×2', modCharge(MODS_BY_CODE.FTK, 2) === 178);
t('RCK both sides $292', modCharge(MODS_BY_CODE.RCK, 'B') === 292);
t('WSL $290/side', modCharge(MODS_BY_CODE.WSL, true) === 290);
t('ET $300/cab', modCharge(MODS_BY_CODE.ET, 'ET.L') === 300);
t('PFB $59/cab', modCharge(MODS_BY_CODE.PFB, true) === 59);
// BFE $0.114/sq-in: 24" deep × 34.5" tall side = 828 sq-in → $94.39 (×2 both)
const bfe1 = modCharge(MODS_BY_CODE.BFE, 'L', { depth: 24, height: 34.5 });
const bfe2 = modCharge(MODS_BY_CODE.BFE, 'B', { depth: 24, height: 34.5 });
t('BFE per-sq-in one side ≈ $94.39', Math.abs(bfe1 - 94.392) < 0.01);
t('BFE both sides doubles', Math.abs(bfe2 - 2 * bfe1) < 0.01);
// Percent mods ride the line base
t('FI 25% of $1000 base', modCharge(MODS_BY_CODE.FI, true, {}, 1000) === 250);
t('FR −30% of $1000 base', modCharge(MODS_BY_CODE.FR, true, {}, 1000) === -300);
t('MOD_SQ 30% of $1000 base', modCharge(MODS_BY_CODE.MOD_SQ, { h: 30 }, {}, 1000) === 300);

// ── modChargeList → engine lines ──
const lines = modChargeList({ NTK: true, FI: true, CROT: 2, WSL: true }, { depth: 24, height: 34.5 });
const byCode = Object.fromEntries(lines.map(l => [l.code, l]));
t('modChargeList emits NTK flat 89', byCode.NTK?.flat === 89);
t('modChargeList emits FI as pct fraction', byCode.FI?.pct === 0.25);
t('modChargeList emits CROT qty 2 → $84', byCode.CROT?.flat === 84);
t('modChargeList emits WSL flat 290', byCode.WSL?.flat === 290);

// ── calcModCost stays backward compatible (quote-table path) ──
const legacy = calcModCost({ rot: 'DROT5/8', rotQ: 1 }, { NTK: true }, 500);
t('calcModCost NTK + 1 ROT = 89 + 268', legacy === 89 + 268);

// ── draw/fit metadata for the views ──
t('NTK carries draw:noToe', MODS_BY_CODE.NTK.draw === 'noToe');
t('FTK carries draw:flushToe', MODS_BY_CODE.FTK.draw === 'flushToe');
t('FHD carries draw:fullHeightDoor', MODS_BY_CODE.FHD.draw === 'fullHeightDoor');
t('WSL/WSR/center stile carry draw effects', MODS_BY_CODE.WSL.draw === 'wideStileL' && MODS_BY_CODE.WSR.draw === 'wideStileR' && MODS_BY_CODE.CENTER_STILE.draw === 'centerStile');
t('MOD_SQ carries fit dims h/d/w', JSON.stringify(MODS_BY_CODE.MOD_SQ.fit) === '["h","d","w"]');
t('FREE_D carries fit d + depth options', MODS_BY_CODE.FREE_D.fit?.[0] === 'd' && MODS_BY_CODE.FREE_D.options.length === 4);
t('ROT options intact (10 trays)', ROT_OPTIONS.length === 10);
t('No duplicate mod codes', new Set(CABINET_MODS.map(m => m.code)).size === CABINET_MODS.length);

console.log('\n══════════════════════════════════════════════════');
console.log(`Modification tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
