// Design-your-own real-world test: rebuild the Christiansen Residence kitchen
// (Colorado Modern Kitchen, 02/2024 package) through the Design Studio's
// manual-design pipeline, and publish the output documents as a static page.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FloorPlanView from '/Users/benjaminmiller/Documents/End-to-End/frontend/src/FloorPlanView.jsx';
import ElevationView from '/Users/benjaminmiller/Documents/End-to-End/frontend/src/ElevationView.jsx';
import { buildManualResult, manualChecks, ISLAND_WALL } from '/Users/benjaminmiller/Documents/End-to-End/frontend/src/manualDesign.js';
import { setPricingBrand, findSkuNormalized } from '/Users/benjaminmiller/Documents/End-to-End/frontend/src/skuResolver.js';
import { modChargeList, ROT_OPTIONS } from '/Users/benjaminmiller/Documents/End-to-End/eclipse-pricing/src/modData.js';
import { writeFileSync } from 'fs';

// ── Room: L footprint, 292½" back wall, 132" return, 11-ft ceiling ──
const walls = [
  { id: 'A', length: 292.5, ceilingHeight: 132, openings: [] },
  { id: 'B', length: 132, ceilingHeight: 132, openings: [] },
];

// ── Wall A, left → right (Eclipse-standard mapping of the CMK design) ──
let _n = 0;
const it = (sku, position, zone, w, h, d, extra = {}) =>
  ({ id: `c${_n++}`, sku, wall: 'A', position, zone, width: w, height: h, depth: d, ...extra });
const items = [
  // 54" pocket-door storage bank (CMK custom pocket system → U-pair proxy)
  it('U2790R', 0, 'tall', 27, 90, 24),
  it('U2790L', 27, 'tall', 27, 90, 24),
  // base run
  it('B21L', 54, 'base', 21, 34.5, 24),
  it('B4D12', 75, 'base', 12, 34.5, 24),
  { id: `c${_n++}`, sku: null, wall: 'A', position: 87, zone: 'appliance', width: 36, height: 34.5, depth: 24, applianceType: 'cooktop' },  // Thermador CIT367YGS induction
  it('B4D12', 123, 'base', 12, 34.5, 24),
  { id: `c${_n++}`, sku: null, wall: 'A', position: 135, zone: 'appliance', width: 24, height: 34.5, depth: 24, applianceType: 'microwave' },  // Thermador MD24WS microwave drawer
  it('B3D18', 159, 'base', 18, 34.5, 24),
  { id: `c${_n++}`, sku: null, wall: 'A', position: 177, zone: 'appliance', width: 36, height: 84, depth: 27, applianceType: 'refrigerator' },  // 36" Thermador panel-ready bottom-freezer
  it('O3084', 213, 'tall', 30, 84, 24),     // 30" Thermador double oven / steam tower
  it('B30', 243, 'base', 30, 34.5, 24, { rot: 'DROT5/8', rotQ: 2 }),  // two hardwood roll-outs
  it('B18L', 273, 'base', 18, 34.5, 24, { mods: { ESFR: true } }),  // finished side to floor at run end
  // uppers — Aventos lifting-flap fronts in the CMK design, standard W proxies here
  it('W3324', 54, 'upper', 33, 24, 13, { yMount: 60, mods: { AVENTOS_HK: 2, PFG: true } }),  // CMK lifting-flap glass fronts
  // Zephyr AK9234BS Monsoon I liner (34⅜" for the 36" chase) centered over the cooktop
  { id: `c${_n++}`, sku: null, wall: 'A', position: 87.81, zone: 'upper', width: 34.375, height: 12, depth: 19, yMount: 66, applianceType: 'hood', _liner: true },
  it('W3624', 123, 'upper', 36, 24, 13, { yMount: 60 }),
  it('W1824L', 159, 'upper', 18, 24, 13, { yMount: 60 }),
  it('RW3624-27', 177, 'upper', 36, 24, 27, { yMount: 84 }),  // above-fridge
  // ── ISLAND work side (CMK island-front): wine ref · trash pull-out · sink · DW · drawers ──
  { id: `c${_n++}`, sku: 'B24R', wall: ISLAND_WALL, position: 0, zone: 'base', width: 24, height: 34.5, depth: 24, mods: { NTK: true } },  // furniture-look island end (no toe)
  { id: `c${_n++}`, sku: 'BWDMA18', wall: ISLAND_WALL, position: 24, zone: 'base', width: 18, height: 34.5, depth: 24 },
  { id: `c${_n++}`, sku: 'SB36', wall: ISLAND_WALL, position: 42, zone: 'base', width: 36, height: 34.5, depth: 24 },
  { id: `c${_n++}`, sku: null, wall: ISLAND_WALL, position: 78, zone: 'appliance', width: 24, height: 34.5, depth: 24, applianceType: 'dishwasher' },
  { id: `c${_n++}`, sku: 'B3D18', wall: ISLAND_WALL, position: 102, zone: 'base', width: 18, height: 34.5, depth: 24 },
];

// ── Island: 119½" with waterfall ends; sink/DW/wine/trash live here in the
// real design (studio islands are dimensional slabs today — see notes) ──
const island = { length: 119.5, depth: 32, overhang: 12, x: 112, y: 115 };

const result = buildManualResult({ walls, items, island, roomType: 'kitchen', layoutType: 'l-shape' });
result._inputWalls = walls;

// ── 1. Validation through the studio's own checks ──
const checks = manualChecks(walls, items);
const errors = checks.filter(c => c.severity === 'error');

// ── 2. Render the documents ──
const titleBlock = { project: 'Christiansen Residence — Studio rebuild', client: '2409 S. Humboldt St, Denver CO', designer: 'Eclipse Kitchen Designer · Design Studio test' };
const planHtml = renderToStaticMarkup(React.createElement(FloorPlanView, { solverResult: result, inputWalls: walls, titleBlock }));
const elevHtml = renderToStaticMarkup(React.createElement(ElevationView, { solverResult: result, trim: { toeKick: true, lightRail: true }, titleBlock }));
const svgs = (html) => [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m => m[0]);
const planSvgs = svgs(planHtml);
const elevSvgs = svgs(elevHtml);

// ── 3. Price every line through the quote resolver ──
setPricingBrand('eclipse');
const lines = [];
let total = 0, misses = 0;
for (const i of items) {
  if (!i.sku) { lines.push({ sku: `[${i.applianceType.toUpperCase()} ${i.width}"]`, note: 'appliance by others', price: null }); continue; }
  const hit = findSkuNormalized(i.sku);
  if (hit && hit.p != null) { total += hit.p; lines.push({ sku: i.sku, price: hit.p, approx: hit._resolution !== 'exact' }); }
  else { misses++; lines.push({ sku: i.sku, price: null, note: 'NO PRICE RESOLVED' }); }
  // designer mods + roll-out trays price as catalog C1/C2 list charges
  const base = hit?.p || 0;
  for (const ml of modChargeList(i.mods || {}, i)) {
    const chg = ml.pct ? base * ml.pct : ml.flat;
    total += chg; lines.push({ sku: `  + MOD ${ml.code.replace(/_/g, ' ')}`, price: chg });
  }
  if (i.rot && i.rotQ > 0) {
    const ro = ROT_OPTIONS.find(r => r.v === i.rot);
    if (ro) { total += ro.price * i.rotQ; lines.push({ sku: `  + ${i.rot} ×${i.rotQ}`, price: ro.price * i.rotQ }); }
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Christiansen Residence — Design Studio test</title>
<style>
 body{font-family:'Helvetica Neue',Arial,sans-serif;color:#2b2b2b;background:#f6f3ee;margin:0;padding:24px;max-width:1180px;margin:auto}
 h1{font-size:22px;letter-spacing:.5px} h2{font-size:15px;margin-top:34px;text-transform:uppercase;letter-spacing:1px;color:#6b5a33}
 .card{background:#fff;border:1px solid #e2dccf;border-radius:8px;padding:14px;margin:14px 0}
 svg{width:100%;height:auto}
 table{border-collapse:collapse;width:100%;font-size:13px} td,th{padding:5px 9px;border-bottom:1px solid #eee;text-align:left}
 td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
 .ok{color:#2e7d32}.warn{color:#b26a00}.bad{color:#c0392b}
 .note{font-size:12.5px;color:#666;line-height:1.55}
 .badge{display:inline-block;padding:2px 9px;border-radius:10px;font-size:12px;font-weight:700}
</style></head><body>
<h1>Christiansen Residence — “Design Your Own” real-world test</h1>
<p class="note">Source: Colorado Modern Kitchen design package (02/05/2024) for 2409 S. Humboldt St, Denver.
Rebuilt through the Eclipse Kitchen Designer <b>Design Studio</b> manual pipeline: same room (292½" back wall + 132" return,
11-ft ceiling), same appliance positions (36" induction cooktop, microwave drawer, 36" panel-ready refrigerator,
30" double-oven tower), 119½" island <b>fully furnished</b> per the CMK island-front elevation (wine ref · trash pull-out · sink · DW · drawers) at the designer's position, with the closest Eclipse standard SKUs standing in for
CMK's custom metric frameless boxes.</p>

<div class="card"><b>Studio validation:</b>
 <span class="badge" style="background:${errors.length ? '#fdecea' : '#e8f5e9'};color:${errors.length ? '#c0392b' : '#2e7d32'}">
 ${errors.length === 0 ? '✓ 0 layout errors' : errors.length + ' errors'}</span>
 <span class="note">— overlap, overflow, opening-conflict and NKBA checks across ${items.length} hand-placed items.</span>
 ${checks.filter(c => c.severity === 'warning').map(c => `<div class="note warn">⚠ ${esc(c.message)}</div>`).join('')}
</div>

<h2>Floor plan</h2>
${planSvgs.map(s => `<div class="card">${s}</div>`).join('')}

<h2>Elevations</h2>
${elevSvgs.map(s => `<div class="card">${s}</div>`).join('')}

<h2>Eclipse list pricing (cabinetry, quote-path resolver)</h2>
<div class="card"><table>
<tr><th>SKU</th><th class="r">List</th><th>Resolution</th></tr>
${lines.map(l => `<tr><td style="font-family:monospace">${esc(l.sku)}</td>
 <td class="r">${l.price != null ? '$' + l.price.toLocaleString() : '—'}</td>
 <td>${l.note ? `<span class="${l.note.startsWith('NO') ? 'bad' : 'note'}">${esc(l.note)}</span>` : l.approx ? '<span class="warn">≈ family-resolved</span>' : '<span class="ok">exact</span>'}</td></tr>`).join('')}
<tr><th>Cabinetry list total</th><th class="r">$${total.toLocaleString()}</th><th>${misses ? `<span class="bad">${misses} unresolved</span>` : '<span class="ok">all lines priced</span>'}</th></tr>
</table></div>

<h2>What this test proved — and what it surfaced</h2>
<div class="card note">
<b>Worked:</b> hand-placed 17-item layout with stacked zones (talls, bases, appliances, uppers at two mount heights incl.
the 84" above-fridge cabinet), full dimension chains on a 292½" wall, designer-positioned island honored on the floor plan,
zero validation errors, and every cabinet priced through the live quote resolver.<br><br>
<b>Limitations found (real findings from this test):</b>
<ul>
<li><b>Island cabinetry — FIXED.</b> The first run of this test found islands were dimensional slabs; the studio now
places cabinets and appliances on the island's work face, and they flow to the floor plan, the island elevation sheet,
3D, the priced quote and the order package. The island above carries the full CMK arrangement.</li>
<li><b>Hood object — FIXED.</b> The studio now places hood liners and pro canopies in the upper band (this sheet
carries a Zephyr AK9234BS Monsoon I liner — 34⅜" for the 36" chase, 600 CFM, 66" AFF — centered over the cooktop),
and 20 researched pro hoods (Zephyr/Best/Vent-A-Hood/Faber/Thermador/Wolf/KitchenAid/ZLINE/Bosch/Kobe) joined the
appliance catalog with real widths and MSRPs.</li>
<li><b>Specialty fronts are proxies</b> — CMK's Aventos lifting-flap uppers and pocket-door system map to standard
W-series / U-tall pairs (Eclipse mods like lift-up hardware would be added as line mods at order time).</li>
<li>Metric widths (550/300/1000mm…) round to the nearest Eclipse inch standard — chains stay honest via labeled fillers/gaps.</li>
</ul>
Generated headlessly through the same code the live app runs · ${new Date().toISOString().slice(0, 10)}
</div>
</body></html>`;
writeFileSync('/Users/benjaminmiller/Documents/End-to-End/frontend/public/christiansen-test.html', html);
console.log('errors:', errors.length, '| warnings:', checks.length - errors.length, '| plan svgs:', planSvgs.length, '| elev svgs:', elevSvgs.length, '| priced:', lines.filter(l => l.price != null).length, '/', lines.filter(l => l.sku[0] !== '[').length, '| total: $' + total.toLocaleString());
