// Drawing-quality audit harness: solve a grid of rooms, render FloorPlanView +
// ElevationView, rasterize every sheet, and run programmatic quality checks.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import FloorPlanView from '/Users/benjaminmiller/Documents/End-to-End/frontend/src/FloorPlanView.jsx';
import ElevationView from '/Users/benjaminmiller/Documents/End-to-End/frontend/src/ElevationView.jsx';
import { buildManualResult } from '/Users/benjaminmiller/Documents/End-to-End/frontend/src/manualDesign.js';
import { solve } from '/Users/benjaminmiller/Documents/End-to-End/eclipse-engine/src/solver.js';
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'fs';

mkdirSync('/tmp/audit', { recursive: true });
const findings = [];
const note = (cfg, sev, what) => findings.push({ cfg, sev, what });

// ── Config grid ──
const APPS_STD = [{ type: 'sink' }, { type: 'range', width: 30 }, { type: 'refrigerator', width: 36 }, { type: 'dishwasher', width: 24 }];
const CONFIGS = [
  { id: 'L-basic', layoutType: 'l-shape', walls: [{ id: 'A', length: 144 }, { id: 'B', length: 120 }], appliances: APPS_STD },
  { id: 'L-window-door', layoutType: 'l-shape',
    walls: [{ id: 'A', length: 156, openings: [{ type: 'window', posFromLeft: 60, position: 60, width: 36 }] },
            { id: 'B', length: 132, openings: [{ type: 'door', posFromLeft: 96, position: 96, width: 32 }] }],
    appliances: [{ type: 'sink', wall: 'A', pinned: true }, { type: 'range', width: 36 }, { type: 'refrigerator', width: 36 }, { type: 'dishwasher', width: 24 }] },
  { id: 'U-9ft-soffit', layoutType: 'u-shape', ceiling: 108,
    walls: [{ id: 'A', length: 144, soffit: { drop: 12, depth: 14 } }, { id: 'B', length: 108 }, { id: 'C', length: 144 }], appliances: APPS_STD },
  { id: 'U-tight', layoutType: 'u-shape', walls: [{ id: 'A', length: 96 }, { id: 'B', length: 84 }, { id: 'C', length: 96 }], appliances: APPS_STD },
  { id: 'G-shape', layoutType: 'g-shape', walls: [{ id: 'A', length: 144 }, { id: 'B', length: 96 }, { id: 'C', length: 120 }, { id: 'D', length: 84 }], appliances: APPS_STD },
  { id: 'galley', layoutType: 'galley', walls: [{ id: 'A', length: 144 }, { id: 'B', length: 144 }], appliances: APPS_STD },
  { id: 'single-wall', layoutType: 'single-wall', walls: [{ id: 'A', length: 168 }], appliances: APPS_STD },
  { id: 'Ben-L-island', layoutType: 'l-shape',
    walls: [{ id: 'A', length: 156 }, { id: 'B', length: 120 }],
    appliances: [{ type: 'range', width: 30, wall: 'A', pinned: true }, { type: 'sink', width: 36, wall: 'B', pinned: true },
      { type: 'dishwasher', width: 24, wall: 'B', pinned: true }, { type: 'refrigerator', width: 36, wall: 'A', pinned: true }],
    island: { length: 73, depth: 38 } },
  { id: 'L-angled45', layoutType: 'l-shape', walls: [{ id: 'A', length: 144 }, { id: 'B', length: 120, turn: 45 }], appliances: APPS_STD },
  { id: 'U-angled-diag', layoutType: 'u-shape', walls: [{ id: 'A', length: 144 }, { id: 'B', length: 48, turn: 45 }, { id: 'C', length: 120, turn: 45 }], appliances: APPS_STD },
  { id: 'L-tall-ovens', layoutType: 'l-shape', walls: [{ id: 'A', length: 168 }, { id: 'B', length: 132 }],
    appliances: [{ type: 'sink' }, { type: 'cooktop', width: 36 }, { type: 'wallOven', width: 30 }, { type: 'refrigerator', width: 36 }, { type: 'pantry' }] },
  { id: 'vanity', layoutType: 'single-wall', roomType: 'vanity', walls: [{ id: 'A', length: 72 }], appliances: [{ type: 'sink' }] },
];

function svgsOf(html) {
  return [...html.matchAll(/<svg[\s\S]*?<\/svg>/g)].map(m =>
    m[0].includes('xmlns') ? m[0] : m[0].replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'));
}
function rasterize(svg, path, width = 1100) {
  try {
    writeFileSync(path, new Resvg(svg, { fitTo: { mode: 'width', value: width }, background: 'white' }).render().asPng());
    return true;
  } catch (e) { return e.message; }
}

// crude text-collision check from SVG markup: extract <text> x/y/font-size/anchor/content
function textCollisions(svg, cfgId, sheet) {
  const texts = [];
  for (const m of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
    const attrs = m[1];
    const inner = m[2].replace(/<[^>]+>/g, '').trim();
    if (!inner) continue;
    const num = (name, dflt) => { const mm = attrs.match(new RegExp(`${name}="([-\\d.]+)"`)); return mm ? parseFloat(mm[1]) : dflt; };
    const x = num('x', null), y = num('y', null), fs = num('font-size', 10);
    if (x == null || y == null) continue;
    const anchorM = attrs.match(/text-anchor="(\w+)"/);
    const anchor = anchorM ? anchorM[1] : 'start';
    const transform = /transform=/.test(attrs);            // rotated labels — skip (boxes wrong)
    const w = inner.length * fs * 0.58;
    const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    texts.push({ inner, x0, x1: x0 + w, y0: y - fs, y1: y + 1, transform, fs });
  }
  let n = 0;
  const seen = new Set();
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.transform || b.transform) continue;
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (ox > Math.min(a.x1 - a.x0, b.x1 - b.x0) * 0.45 && oy > Math.min(a.y1 - a.y0, b.y1 - b.y0) * 0.55) {
        const key = `${a.inner}|${b.inner}`;
        if (!seen.has(key)) { seen.add(key); n++; if (n <= 4) note(cfgId, 'quality', `${sheet}: text overlap "${a.inner}" × "${b.inner}"`); }
      }
    }
  }
  if (n > 4) note(cfgId, 'quality', `${sheet}: …and ${n - 4} more text overlaps`);
}

for (const cfg of CONFIGS) {
  let result;
  const ceil = cfg.ceiling || 96;
  const walls = cfg.walls.map(w => ({ ...w, ceilingHeight: w.ceilingHeight || ceil }));
  try {
    result = solve({ layoutType: cfg.layoutType, roomType: cfg.roomType || 'kitchen', walls, appliances: cfg.appliances, prefs: { ceilingHeight: ceil }, ...(cfg.island ? { island: cfg.island } : {}) });
  } catch (e) { note(cfg.id, 'error', `solve threw: ${e.message}`); continue; }
  result._inputWalls = (result._inputWalls || walls).map(w => ({ ...w, ceilingHeight: w._realCeilingHeight || w.ceilingHeight || ceil }));
  if (result.walls && result.walls[0] && !result.walls[0].id) result.walls.forEach(w => { w.id = w.wallId; w.length = w.wallLength; });

  // data-level checks
  for (const wl of (result.walls || [])) {
    const len = wl.wallLength || wl.length;
    const run = (wl.cabinets || []).filter(c => typeof c.position === 'number' && c.width > 0 && c.type !== 'end_panel').sort((a, b) => a.position - b.position);
    for (let i = 1; i < run.length; i++) {
      const gap = run[i].position - (run[i - 1].position + run[i - 1].width);
      if (gap < -0.26) note(cfg.id, 'accuracy', `wall ${wl.wallId}: ${run[i].sku || run[i].applianceType} overlaps ${run[i - 1].sku || run[i - 1].applianceType} by ${(-gap).toFixed(2)}"`);
      if (gap > 0.26 && gap < 9) note(cfg.id, 'accuracy', `wall ${wl.wallId}: unexplained ${gap.toFixed(2)}" gap before ${run[i].sku || run[i].applianceType} (not a filler)`);
    }
    if (run.length && run[run.length - 1].position + run[run.length - 1].width > len + 0.51) {
      note(cfg.id, 'accuracy', `wall ${wl.wallId}: run past wall end`);
    }
  }
  for (const ul of (result.uppers || [])) {
    for (const c of (ul.cabinets || [])) {
      const top = (c._elev?.yMount ?? 54) + (c._elev?.height ?? c.height ?? 36);
      if (top > ceil + 0.01) note(cfg.id, 'accuracy', `upper ${c.sku} top at ${top}" exceeds ${ceil}" ceiling (wall ${ul.wallId})`);
    }
  }
  for (const t of (result.talls || [])) {
    const h = t._elev?.height ?? t.height ?? 93;
    if ((t._elev?.yMount ?? 0) + h > ceil + 0.01) note(cfg.id, 'accuracy', `tall ${t.sku} exceeds ceiling`);
  }

  // floor plan
  try {
    const html = renderToStaticMarkup(React.createElement(FloorPlanView, { solverResult: result, inputWalls: result._inputWalls, titleBlock: { project: cfg.id } }));
    if (/NaN|undefined/.test(html)) note(cfg.id, 'error', `floorplan markup contains ${(html.match(/NaN/g) || []).length ? 'NaN' : 'undefined'}`);
    const svgs = svgsOf(html);
    svgs.forEach((s, i) => {
      const r = rasterize(s, `/tmp/audit/${cfg.id}-plan${i ? '-' + i : ''}.png`);
      if (r !== true) note(cfg.id, 'error', `floorplan svg ${i} failed to rasterize: ${r}`);
      textCollisions(s, cfg.id, 'plan');
    });
  } catch (e) { note(cfg.id, 'error', `FloorPlanView threw: ${e.message}`); }

  // elevations
  try {
    const html = renderToStaticMarkup(React.createElement(ElevationView, { solverResult: result, trim: { toeKick: true, crown: true, lightRail: true }, titleBlock: { project: cfg.id } }));
    if (/NaN|undefined/.test(html)) note(cfg.id, 'error', `elevation markup contains NaN/undefined`);
    const svgs = svgsOf(html);
    if (!svgs.length) note(cfg.id, 'error', 'elevation produced no SVG');
    svgs.forEach((s, i) => {
      const r = rasterize(s, `/tmp/audit/${cfg.id}-elev-${i}.png`, 1000);
      if (r !== true) note(cfg.id, 'error', `elevation svg ${i} failed to rasterize: ${r}`);
      textCollisions(s, cfg.id, `elev${i}`);
    });
  } catch (e) { note(cfg.id, 'error', `ElevationView threw: ${e.message}`); }
}

// Manual-mode result through both views (the studio path)
try {
  const walls = [
    { id: 'A', length: 144, ceilingHeight: 96, openings: [{ type: 'window', position: 54, posFromLeft: 54, width: 36 }] },
    { id: 'B', length: 120, ceilingHeight: 96 },
  ];
  const items = [
    { id: 'm1', sku: 'SB36', wall: 'A', position: 54, width: 36, zone: 'base', depth: 24, height: 34.5 },
    { id: 'm2', sku: 'DW', wall: 'A', position: 30, width: 24, zone: 'appliance', applianceType: 'dishwasher', depth: 24, height: 34.5 },
    { id: 'm3', sku: 'B30', wall: 'A', position: 90, width: 30, zone: 'base', depth: 24, height: 34.5 },
    { id: 'm4', sku: 'W3030', wall: 'A', position: 90, width: 30, zone: 'upper', depth: 13, height: 30, yMount: 54 },
    { id: 'm5', sku: 'W3015', wall: 'A', position: 90, width: 30, zone: 'upper', depth: 13, height: 15, yMount: 84 },
    { id: 'm6', sku: 'F334 1/2', wall: 'A', position: 120, width: 3, zone: 'base', depth: 24, height: 34.5 },
    { id: 'm7', sku: 'B3D24', wall: 'B', position: 36, width: 24, zone: 'base', depth: 24, height: 34.5 },
    { id: 'm8', sku: 'T2484', wall: 'B', position: 60, width: 24, zone: 'tall', depth: 24, height: 84 },
  ];
  const result = buildManualResult({ walls, items, island: { length: 72, depth: 36 }, roomType: 'kitchen', layoutType: 'l-shape' });
  result._inputWalls = walls;
  const planHtml = renderToStaticMarkup(React.createElement(FloorPlanView, { solverResult: result, inputWalls: walls, titleBlock: { project: 'manual' } }));
  svgsOf(planHtml).forEach((s, i) => { rasterize(s, `/tmp/audit/manual-plan${i ? '-' + i : ''}.png`); textCollisions(s, 'manual', 'plan'); });
  if (/NaN|undefined/.test(planHtml)) note('manual', 'error', 'manual floorplan has NaN/undefined');
  const elevHtml = renderToStaticMarkup(React.createElement(ElevationView, { solverResult: result, trim: {}, titleBlock: {} }));
  const es = svgsOf(elevHtml);
  if (!es.length) note('manual', 'error', 'manual elevation produced no SVG');
  es.forEach((s, i) => { rasterize(s, `/tmp/audit/manual-elev-${i}.png`, 1000); textCollisions(s, 'manual', `elev${i}`); });
  if (/NaN|undefined/.test(elevHtml)) note('manual', 'error', 'manual elevation has NaN/undefined');
} catch (e) { note('manual', 'error', `manual path threw: ${e.message}`); }

console.log(JSON.stringify(findings, null, 1));
console.log('TOTAL FINDINGS:', findings.length, '| errors:', findings.filter(f => f.sev === 'error').length, '| accuracy:', findings.filter(f => f.sev === 'accuracy').length, '| quality:', findings.filter(f => f.sev === 'quality').length);
