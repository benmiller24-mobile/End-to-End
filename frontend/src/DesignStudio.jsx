import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { OFFICIAL_V88 } from '../../eclipse-pricing/src/officialV88.js';
import { SHILOH_CATALOG } from '../../eclipse-pricing/src/shilohSkuCatalog.js';
import { findSku } from '../../eclipse-pricing/src/skuCatalog.js';
import { setPricingBrand, findSkuNormalized } from './skuResolver.js';
import { makeItem, makeAppliance, settleItem, slideItem, placementIssues, bandOf, yRangeOf, isCornerSku, contextSnap, insertWithShift, skuInfo, priceLookup, manualChecks } from './manualDesign.js';

/**
 * Design Studio — drag-and-drop room + cabinet design (the "2020-style" mode),
 * built on the same wall-chain geometry as the floor plan and feeding the same
 * placements pipeline as the solver.
 *
 * Interactions: drag wall ends to resize (½" snap) · click any dimension to
 * type the laser number · drag windows/doors along walls · pick a cabinet in
 * the browser then click a wall band to place it · drag placed cabinets along
 * their wall (auto flush-snap) · click to select, ✕ or Delete to remove.
 */

const C = {
  bg: '#ffffff', line: '#1a1a1a', dim: '#8a8a8a', accent: '#b8944e', danger: '#c0392b',
  base: '#e9e2d4', upper: '#dfe7ee', tall: '#e3dcc9', appliance: '#d6d9dc', ghost: '#cccccc',
  sel: '#b8944e', wall: '#2b2b2b', window: '#9db8d6', door: '#c9a96e',
};
const WALL_T = 6, BASE_D = 24, UPPER_D = 13;

// World frames for the wall chain (matches FloorPlanView: 0/90/180/270).
// Galley is the exception: two PARALLEL runs across an aisle.
const GALLEY_GAP = 24 + 42 + 24 + WALL_T;   // base + aisle + base + wall
function frames(walls, layoutType) {
  if (/galley/.test(layoutType || '') && walls.length === 2) {
    return [
      { id: walls[0].id, x: 0, y: 0, angle: 0, length: walls[0].length },
      { id: walls[1].id, x: 0, y: GALLEY_GAP, angle: 0, length: walls[1].length },
    ];
  }
  const out = []; let x = 0, y = 0;
  const angles = [0, 90, 180, 270];
  walls.forEach((w, i) => {
    const a = angles[i % 4];
    out.push({ id: w.id, x, y, angle: a, length: w.length });
    const r = a * Math.PI / 180;
    x += Math.cos(r) * w.length; y += Math.sin(r) * w.length;
  });
  return out;
}
const toWorld = (f, along, perp) => {
  const r = f.angle * Math.PI / 180, nx = -Math.sin(r), nz = Math.cos(r);
  return { x: f.x + Math.cos(r) * along + nx * perp, y: f.y + Math.sin(r) * along + nz * perp };
};
const fmtIn = (v) => {
  const s = Math.round(v * 8) / 8, w = Math.floor(s), f = s - w;
  const F = { 0.125: '⅛', 0.25: '¼', 0.375: '⅜', 0.5: '½', 0.625: '⅝', 0.75: '¾', 0.875: '⅞' };
  return f ? `${w}${F[f] || ''}"` : `${w}"`;
};

// Family key for "swap width in place": replace the digit run that encodes the
// item's WIDTH with '#'. B24→'B#'; B3D24→'B3D#' (the 3-drawer digit survives);
// W3036→'W#36' (W-family packs WxH — only the first two digits are width).
export function familyKey(sku, w) {
  const s = String(sku || '').toUpperCase().replace(/^FC-/, '');
  if (!s || !(w > 0)) return null;
  const runs = [...s.matchAll(/\d+/g)];
  const wStr = String(Math.round(w));
  for (const r of runs) {
    if (parseInt(r[0], 10) === Math.round(w)) {
      return s.slice(0, r.index) + '#' + s.slice(r.index + r[0].length);
    }
  }
  for (const r of runs) {
    if (r[0].length === 4 && r[0].slice(0, 2) === wStr.padStart(2, '0')) {
      return s.slice(0, r.index) + '#' + s.slice(r.index + 2);
    }
  }
  return null;
}

// ── Catalog browser data ──
function catalogList(brand) {
  if (brand === 'shiloh') {
    const rows = [];
    for (const [sku, e] of SHILOH_CATALOG) {
      const info = skuInfo(sku, 'shiloh');
      rows.push({ sku, price: e.p, w: info.w, h: info.h, zone: info.zone, cat: { B: 'Base', W: 'Wall', T: 'Tall', V: 'Vanity' }[e.t] || 'Other', sub: '' });
    }
    return rows;
  }
  const rows = [];
  for (const [sku, e] of OFFICIAL_V88) {
    rows.push({ sku, w: e.w, h: e.h, dc: e.dc || 0, drc: e.drc || 0, zone: ({ W: 'upper', WC: 'upper', T: 'tall', GT: 'tall', BK: 'tall' })[e.cat] || 'base',
      cat: ({ B: 'Base', BC: 'Base Corner', T: 'Tall', W: 'Wall', WC: 'Wall Corner', V: 'Vanity', BK: 'Bookcase', GB: 'Gola Base', GBC: 'Gola Corner', GT: 'Gola Tall', GV: 'Gola Vanity' })[e.cat] || 'Other',
      sub: e.sub || '' });
  }
  return rows;
}

// Function facets — how designers actually think ("sink base", "drawer base"),
// not nomenclature. Each maps to a sub/cat/sku test over the catalog rows.
const FACETS = [
  ['Sink', r => /Sink/i.test(r.sub) || /^(SB\d|VSB|FSB|GSB)/.test(r.sku)],
  ['Drawer', r => /Drawer/i.test(r.sub) || /^B?\dD/.test(r.sku)],
  ['Corner', r => /Corner/i.test(r.cat) || /Corner|Susan/i.test(r.sub) || /^(LS|BLB|EZ)/.test(r.sku)],
  ['Pantry/Tall', r => /Tall|Bookcase/i.test(r.cat) || /Pantry|Oven|Utility/i.test(r.sub)],
  ['Fillers/Panels', r => /Filler|Panel|Skin/i.test(r.sub) || /^(F\d|REP|BEP|WEP|OVF|SCRIBE)/.test(r.sku)],
];

/** Front-configuration line drawing (what the SKU's face actually looks like):
 *  drawer strips on top, doors split vertically below — drawn from the
 *  official v8.8 door/drawer counts. */
function FrontThumb({ w = 24, h = 30, dc = 0, drc = 0, zone = 'base' }) {
  const W = 24, H = 26;
  const ratio = Math.min(2.2, Math.max(0.45, (w || 24) / (h || 30)));
  const bw = ratio >= 1 ? W : Math.max(9, W * ratio);
  const bh = ratio >= 1 ? Math.max(10, H / ratio) : H;
  const x0 = (W - bw) / 2, y0 = (H - bh) / 2;
  // drawers ride on top: a strip block when doors share the face, full face otherwise
  const drawersH = drc ? (dc ? Math.min(bh * 0.45, drc * 6) : bh) : 0;
  const doorsH = bh - drawersH;
  const els = [];
  for (let i = 0; i < drc; i++) {
    els.push(<rect key={`d${i}`} x={x0 + 0.8} y={y0 + (drawersH / drc) * i + 0.8} width={bw - 1.6} height={Math.max(1.5, drawersH / drc - 1.4)} fill="none" stroke="#9a8f7d" strokeWidth={0.7} />);
    els.push(<line key={`dh${i}`} x1={x0 + bw / 2 - 2.5} y1={y0 + (drawersH / drc) * (i + 0.5)} x2={x0 + bw / 2 + 2.5} y2={y0 + (drawersH / drc) * (i + 0.5)} stroke="#9a8f7d" strokeWidth={0.7} />);
  }
  for (let i = 0; i < Math.min(dc, 4); i++) {
    const dw = bw / Math.min(dc, 4);
    els.push(<rect key={`o${i}`} x={x0 + dw * i + 0.8} y={y0 + drawersH + 0.8} width={dw - 1.6} height={Math.max(2, doorsH - 1.6)} fill="none" stroke="#9a8f7d" strokeWidth={0.7} />);
    els.push(<circle key={`k${i}`} cx={x0 + dw * i + (i < dc / 2 ? dw - 2.6 : 2.6)} cy={y0 + drawersH + doorsH / 2} r={0.7} fill="#9a8f7d" />);
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ flexShrink: 0 }}>
      <rect x={x0} y={y0} width={bw} height={bh} fill={zone === 'upper' ? '#eef2f6' : zone === 'tall' ? '#efe9d8' : '#f3eee3'} stroke="#8a8071" strokeWidth={0.8} />
      {els}
    </svg>
  );
}

const APPLIANCE_PALETTE = [
  { type: 'range', label: 'Range 30"', width: 30 }, { type: 'range', label: 'Range 36"', width: 36 },
  { type: 'range', label: 'Range 48"', width: 48 }, { type: 'cooktop', label: 'Cooktop 36"', width: 36 },
  { type: 'dishwasher', label: 'Dishwasher 24"', width: 24 }, { type: 'refrigerator', label: 'Refrigerator 36"', width: 36 },
];

export default function DesignStudio({ walls, onWallsChange, items, onItemsChange, brand = 'eclipse', ghost = null, mode = 'full', layoutType = '', onApplyShape = null, island = null, onIslandChange = null }) {
  const roomOnly = mode === 'room';
  const svgRef = useRef(null);
  const elevRef = useRef(null);
  const [sel, setSel] = useState(null);             // selected item id | 'op:wallIdx:opIdx'
  const [armed, setArmed] = useState(null);          // {sku} | {applianceType,width} awaiting placement
  const [editDim, setEditDim] = useState(null);      // {wallIdx, value}
  const [editGap, setEditGap] = useState(null);      // {itemId, side:'left'|'right'} typing an offset
  const [hoverPt, setHoverPt] = useState(null);      // cursor world point while armed (ghost preview)
  const [lastPlacedId, setLastPlacedId] = useState(null); // auto-advance anchor (Winner cursor)
  const [fillGap, setFillGap] = useState(null);      // {wallIdx, band, start, end} gap being filled
  const [elevWall, setElevWall] = useState(null);    // wall id whose elevation strip is open
  const [editIsl, setEditIsl] = useState(null);      // 'length' | 'depth' island dim being typed
  const [drag, setDrag] = useState(null);
  const [cat, setCat] = useState('Base');
  const [search, setSearch] = useState('');
  const [widthF, setWidthF] = useState('');

  // ── Undo/redo: coalesced snapshots of {walls, items}. A burst of changes
  // (one drag) records once; Ctrl+Z walks back whole gestures. ──
  const histRef = useRef({ past: [], future: [], stamp: 0 });
  const presentRef = useRef({ walls, items, island });
  useEffect(() => { presentRef.current = { walls, items, island }; }, [walls, items, island]);
  const record = useCallback(() => {
    const h = histRef.current, now = Date.now();
    if (now - h.stamp > 500) {
      h.past.push(JSON.parse(JSON.stringify(presentRef.current)));
      if (h.past.length > 100) h.past.shift();
      h.future = [];
    }
    h.stamp = now;
  }, []);
  const changeWalls = useCallback((ws) => { record(); onWallsChange(ws); }, [record, onWallsChange]);
  const changeItems = useCallback((its) => { record(); onItemsChange(its); }, [record, onItemsChange]);
  const changeIsland = useCallback((isl) => { record(); onIslandChange && onIslandChange(isl); }, [record, onIslandChange]);
  const applySnap = useCallback((snap) => {
    onWallsChange(snap.walls); onItemsChange(snap.items);
    if (onIslandChange && snap.island !== undefined) onIslandChange(snap.island);
  }, [onWallsChange, onItemsChange, onIslandChange]);
  const undo = useCallback(() => {
    const h = histRef.current; if (!h.past.length) return;
    h.future.push(JSON.parse(JSON.stringify(presentRef.current)));
    const prev = h.past.pop(); h.stamp = 0;
    applySnap(prev);
  }, [applySnap]);
  const redo = useCallback(() => {
    const h = histRef.current; if (!h.future.length) return;
    h.past.push(JSON.parse(JSON.stringify(presentRef.current)));
    const next = h.future.pop(); h.stamp = 0;
    applySnap(next);
  }, [applySnap]);

  const [facet, setFacet] = useState(null);          // function facet ('Sink', 'Drawer', …)

  const fr = useMemo(() => frames(walls, layoutType), [walls, layoutType]);
  const all = useMemo(() => catalogList(brand), [brand]);
  const cats = useMemo(() => [...new Set(all.map(r => r.cat))].sort(), [all]);
  const list = useMemo(() => {
    let rows = all.filter(r => r.cat === cat);
    if (search) { const q = search.toUpperCase(); rows = all.filter(r => r.sku.toUpperCase().includes(q)); }
    if (facet) { const f = FACETS.find(x => x[0] === facet); if (f) rows = (search ? rows : all).filter(f[1]); }
    if (widthF) rows = rows.filter(r => Math.abs((r.w || 0) - Number(widthF)) < 0.6);
    rows = rows.slice(0, 60);
    // Price just the visible slice with the SAME normalizer the quote uses —
    // what you see is exactly what placing it will cost. ≈ = family-resolved.
    if (brand !== 'shiloh') {
      setPricingBrand('eclipse');
      rows = rows.map(r => {
        if (r.price != null) return r;
        const hit = findSkuNormalized(r.sku);
        return { ...r, price: hit?.p ?? null, approx: hit ? hit._resolution !== 'exact' : false };
      });
    }
    return rows;
  }, [all, cat, search, widthF, facet, brand]);

  // viewBox
  const vb = useMemo(() => {
    let maxX = 60, maxY = 60, minX = -40, minY = -50;
    fr.forEach(f => { const e = toWorld(f, f.length, 0); maxX = Math.max(maxX, f.x, e.x); maxY = Math.max(maxY, f.y, e.y); minX = Math.min(minX, f.x, e.x); minY = Math.min(minY, f.y, e.y); });
    return { x: minX - 50, y: minY - 56, w: maxX - minX + 130, h: maxY - minY + 150 };
  }, [fr]);

  const svgPoint = useCallback((evt) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }, []);
  // project a point onto a wall → along-distance
  const projectOnWall = useCallback((f, p) => {
    const r = f.angle * Math.PI / 180;
    return (p.x - f.x) * Math.cos(r) + (p.y - f.y) * Math.sin(r);
  }, []);
  const nearestWall = useCallback((p) => {
    let best = null, bd = 1e9;
    fr.forEach((f, i) => {
      const along = Math.max(0, Math.min(f.length, projectOnWall(f, p)));
      const w = toWorld(f, along, 0);
      const d = Math.hypot(p.x - w.x, p.y - w.y);
      if (d < bd) { bd = d; best = { f, i, along, dist: d }; }
    });
    return best;
  }, [fr, projectOnWall]);

  // Interior corners between consecutive wall runs (none in a galley).
  const corners = useMemo(() => {
    if (/galley/.test(layoutType || '') || walls.length < 2) return [];
    return fr.slice(0, -1).map((f, i) => ({ idx: i, pt: toWorld(f, f.length, 0) }));
  }, [fr, walls.length, layoutType]);
  const cornerSnap = useCallback((p, sku) => {
    if (!sku || !isCornerSku(sku)) return null;
    let best = null, bd = 30;   // snap radius
    for (const c of corners) {
      const d = Math.hypot(p.x - c.pt.x, p.y - c.pt.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }, [corners]);

  // Island frame (axis-aligned; walls run 0/90/180/270): default to the room's
  // interior centroid until the designer drags it.
  const islandBox = useMemo(() => {
    if (!island || !island.length) return null;
    const L = island.length, D = island.depth || 42;
    let cx = island.x, cy = island.y;
    if (cx == null || cy == null) {
      const pts = fr.map(f => toWorld(f, f.length / 2, BASE_D + 40));
      cx = pts.reduce((s, p) => s + p.x, 0) / Math.max(1, pts.length);
      cy = pts.reduce((s, p) => s + p.y, 0) / Math.max(1, pts.length);
    }
    return { cx, cy, L, D, x: cx - L / 2, y: cy - D / 2 };
  }, [island, fr]);

  // Aisle clearances: island edge → facing cabinet face on each wall
  // (NKBA: 42" work aisle; flag under 36" hard).
  const islandClear = useMemo(() => {
    if (!islandBox) return [];
    const out = [];
    fr.forEach((f, i) => {
      const w = walls[i];
      const hasRun = items.some(it => it.wall === w.id && it.zone !== 'upper');
      const face = hasRun ? BASE_D : 0;
      const horiz = f.angle % 180 === 0;
      if (horiz) {
        const wallY = f.y, inward = islandBox.cy > wallY ? 1 : -1;
        const faceY = wallY + inward * face;
        const edgeY = inward === 1 ? islandBox.y : islandBox.y + islandBox.D;
        const clear = (edgeY - faceY) * inward;
        // only count walls the island actually faces (x-ranges overlap)
        const x0 = Math.min(f.x, toWorld(f, f.length, 0).x), x1 = Math.max(f.x, toWorld(f, f.length, 0).x);
        if (islandBox.x < x1 && islandBox.x + islandBox.L > x0 && clear > 0 && clear < 90) {
          out.push({ clear, x: Math.max(x0, islandBox.x) + (Math.min(x1, islandBox.x + islandBox.L) - Math.max(x0, islandBox.x)) / 2, y0: faceY, y1: edgeY, horiz: true });
        }
      } else {
        const wallX = f.x, inward = islandBox.cx > wallX ? 1 : -1;
        const faceX = wallX + inward * face;
        const edgeX = inward === 1 ? islandBox.x : islandBox.x + islandBox.L;
        const clear = (edgeX - faceX) * inward;
        const y0r = Math.min(f.y, toWorld(f, f.length, 0).y), y1r = Math.max(f.y, toWorld(f, f.length, 0).y);
        if (islandBox.y < y1r && islandBox.y + islandBox.D > y0r && clear > 0 && clear < 90) {
          out.push({ clear, y: Math.max(y0r, islandBox.y) + (Math.min(y1r, islandBox.y + islandBox.D) - Math.max(y0r, islandBox.y)) / 2, x0: faceX, x1: edgeX, horiz: false });
        }
      }
    });
    return out;
  }, [islandBox, fr, walls, items]);

  // ── pointer handlers ──
  const onPointerMove = useCallback((evt) => {
    if (!drag) return;
    const p = svgPoint(evt);
    if (drag.kind === 'wallEnd') {
      const f = fr[drag.idx];
      const len = Math.max(24, Math.round(projectOnWall(f, p) * 2) / 2);
      const ws = walls.map((w, i) => i === drag.idx ? { ...w, length: len } : w);
      changeWalls(ws);
    } else if (drag.kind === 'item') {
      const it = items.find(i => i.id === drag.id); if (!it) return;
      const hit = nearestWall(p); if (!hit) return;
      const wallLen = walls[hit.i].length;
      let next = { ...it, wall: walls[hit.i].id, position: hit.along - it.width / 2 };
      // Bump-and-slide: stop flush at neighbors; Ctrl/Cmd = free (overlap allowed)
      next = slideItem(items, wallLen, next, { free: evt.ctrlKey || evt.metaKey });
      changeItems(items.map(i => i.id === it.id ? next : i));
    } else if (drag.kind === 'opening') {
      const w = walls[drag.wallIdx]; const f = fr[drag.wallIdx];
      const ops = [...(w.openings || [])];
      const op = { ...ops[drag.opIdx] };
      const newPos = Math.max(0, Math.min(w.length - (op.width || 36), Math.round((projectOnWall(f, p) - (op.width || 36) / 2) * 2) / 2));
      op.position = newPos; op.posFromLeft = newPos;
      ops[drag.opIdx] = op;
      changeWalls(walls.map((ww, i) => i === drag.wallIdx ? { ...ww, openings: ops } : ww));
    } else if (drag.kind === 'island' && island) {
      changeIsland({ ...island, x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 });
    } else if (drag.kind === 'elevItem') {
      // elevation strip drag: horizontal slides along the wall, vertical
      // remounts wall cabinets (the whole point of the strip)
      const svg = elevRef.current; if (!svg) return;
      const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY;
      const ep = pt.matrixTransform(svg.getScreenCTM().inverse());
      const it = items.find(i => i.id === drag.id); if (!it) return;
      const w = walls.find(x => x.id === it.wall); if (!w) return;
      const ceilH = w.ceilingHeight || 96;
      let next = { ...it, position: ep.x - 18 - it.width / 2 };
      if (it.zone === 'upper') {
        const h = it.height || 36;
        const yM = Math.round((ceilH - (ep.y - 8) - h / 2) * 2) / 2;
        next.yMount = Math.max(0, Math.min(yM, ceilH - h));
      }
      next = slideItem(items, w.length, next, { free: evt.ctrlKey || evt.metaKey });
      changeItems(items.map(i => i.id === it.id ? next : i));
    }
  }, [drag, fr, walls, items, island, changeWalls, changeItems, changeIsland, svgPoint, projectOnWall, nearestWall]);

  const onPointerUp = useCallback(() => setDrag(null), []);
  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => { window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); };
  }, [onPointerMove, onPointerUp]);

  // Live ghost while a SKU/appliance is armed: true footprint, settled into
  // place, tinted green (legal) or red (blocked, with the first reason).
  // One pipeline for ghost AND click so the preview is exactly what placing
  // does: corner magnet → context snap (window/range centering) → settle →
  // if blocked by an overlap, try insert-with-shift (neighbors make room).
  const buildCandidate = useCallback((p) => {
    if (!armed) return null;
    const cSnap = cornerSnap(p, armed.sku);
    const hit = cSnap ? null : nearestWall(p);
    if (!cSnap && (!hit || hit.dist > 60)) return null;
    const wIdx = cSnap ? cSnap.idx : hit.i;
    const w = walls[wIdx];
    const proto = armed.applianceType
      ? makeAppliance(armed.applianceType, w.id, 0, armed.width)
      : makeItem(armed.sku, w.id, 0, brand);
    proto.position = cSnap ? w.length - proto.width : hit.along - proto.width / 2;
    let item = proto, hint = null, shiftPlan = null;
    if (cSnap) {
      item = { ...proto, _corner: true };
    } else {
      const snapped = contextSnap(walls, items, proto);
      if (snapped.hint) { item = snapped.item; hint = snapped.hint; }
      else item = settleItem(items, w.length, proto);
    }
    let issues = placementIssues(walls, items, item);
    if (!cSnap && issues.some(s => /overlaps/.test(s))) {
      const plan = insertWithShift(items, w.length, hint ? item : proto);
      if (plan) {
        shiftPlan = plan;
        item = { ...item, position: plan.position };
        issues = placementIssues(walls, plan.items, item);
        hint = `↔ shifts ${plan.shifted} neighbor${plan.shifted > 1 ? 's' : ''}`;
      }
    }
    return { item, frameIdx: wIdx, corner: !!cSnap, issues, hint, shiftPlan };
  }, [armed, walls, items, brand, cornerSnap, nearestWall]);

  const ghostPlace = useMemo(() => {
    if (!armed || !hoverPt || drag) return null;
    return buildCandidate(hoverPt);
  }, [armed, hoverPt, drag, buildCandidate]);

  const onCanvasClick = useCallback((evt) => {
    if (!armed) { setSel(null); setEditGap(null); return; }
    const cand = buildCandidate(svgPoint(evt));
    if (!cand) return;
    // Red ghost = blocked drop (door opening, window, no room). Alt-click forces.
    if (cand.issues.length && !evt.altKey) return;
    changeItems([...(cand.shiftPlan ? cand.shiftPlan.items : items), cand.item]);
    setSel(cand.item.id); setLastPlacedId(cand.item.id);
    if (!evt.shiftKey) setArmed(null);   // hold shift to place several
  }, [armed, items, buildCandidate, svgPoint, changeItems]);

  // ── R5 auto-advance: with a SKU armed and a just-placed (or selected) anchor,
  // one-click arrows butt the next cabinet flush left/right and show the
  // remaining inches each way (AutoKitchen's blue/red arrows). ──
  const advance = useMemo(() => {
    if (!armed) return null;
    const anchor = items.find(i => i.id === lastPlacedId) || items.find(i => i.id === sel);
    if (!anchor) return null;
    const f = fr.find(x => x.id === anchor.wall);
    const w = walls.find(x => x.id === anchor.wall);
    if (!f || !w) return null;
    const info = armed.applianceType ? { w: armed.width || 30, zone: 'appliance' } : skuInfo(armed.sku, brand);
    const band = info.zone === 'upper' ? 'upper' : 'floor';
    const sibs = items.filter(i => i.id !== anchor.id && i.wall === anchor.wall && bandOf(i) === band);
    const aL = anchor.position, aR = anchor.position + anchor.width;
    const rightStop = Math.min(w.length, ...sibs.filter(i => i.position >= aR - 0.01).map(i => i.position));
    const leftStop = Math.max(0, ...sibs.filter(i => i.position + i.width <= aL + 0.01).map(i => i.position + i.width));
    return {
      anchor, frame: f, wall: w, width: info.w, zone: info.zone,
      remRight: Math.max(0, rightStop - aR), remLeft: Math.max(0, aL - leftStop),
    };
  }, [armed, items, lastPlacedId, sel, fr, walls, brand]);

  const placeFlush = useCallback((side) => {
    if (!advance) return;
    const { anchor, wall: w } = advance;
    const proto = armed.applianceType
      ? makeAppliance(armed.applianceType, anchor.wall, 0, armed.width)
      : makeItem(armed.sku, anchor.wall, 0, brand);
    proto.position = side === 'right' ? anchor.position + anchor.width : anchor.position - proto.width;
    const settled = settleItem(items, w.length, proto);
    if (placementIssues(walls, items, settled).length) return;
    changeItems([...items, settled]);
    setSel(settled.id); setLastPlacedId(settled.id);
  }, [advance, armed, items, walls, brand, changeItems]);

  // ── R6 swap-in-place: same-family widths with live price deltas. ──
  const swapOptions = useMemo(() => {
    const cur = items.find(i => i.id === sel);
    if (!cur || !cur.sku || armed) return null;
    const fam = familyKey(cur.sku, cur.width);
    if (!fam) return null;
    setPricingBrand(brand === 'shiloh' ? 'shiloh' : 'eclipse');
    const curHit = findSkuNormalized(cur.sku);
    const curPrice = curHit?.p ?? null;
    const rows = all.filter(r => r.sku !== cur.sku && familyKey(r.sku, r.w) === fam);
    const opts = rows.map(r => {
      const hit = r.price != null ? { p: r.price } : findSkuNormalized(r.sku);
      return { sku: r.sku, w: r.w, price: hit?.p ?? null, delta: hit?.p != null && curPrice != null ? hit.p - curPrice : null };
    }).filter(o => o.w);
    opts.sort((a, b) => Math.abs(a.w - cur.width) - Math.abs(b.w - cur.width));
    const top = opts.slice(0, 8).sort((a, b) => a.w - b.w);
    return top.length ? { cur, curPrice, options: top } : null;
  }, [items, sel, armed, all, brand]);

  const applySwap = useCallback((opt) => {
    const cur = swapOptions?.cur; if (!cur) return;
    const w = walls.find(x => x.id === cur.wall); if (!w) return;
    const info = skuInfo(opt.sku, brand);
    let next = { ...cur, sku: opt.sku, width: info.w, depth: info.d, height: info.h, zone: info.zone };
    next = slideItem(items, w.length, next);   // anchors left edge, re-fits if the new width crowds a neighbor
    changeItems(items.map(i => i.id === cur.id ? next : i));
  }, [swapOptions, walls, items, brand, changeItems]);

  // ── R3 fill-gap: click a gap chip → best-fit cabinets + trim-to-fit filler. ──
  const fillOptions = useMemo(() => {
    if (!fillGap) return null;
    const w = walls[fillGap.wallIdx]; if (!w) return null;
    const len = fillGap.end - fillGap.start;
    setPricingBrand(brand === 'shiloh' ? 'shiloh' : 'eclipse');
    const priced = (r) => {
      const hit = r.price != null ? { p: r.price, _resolution: 'exact' } : findSkuNormalized(r.sku);
      return { sku: r.sku, w: r.w, price: hit?.p ?? null, approx: hit ? hit._resolution !== 'exact' : false };
    };
    const isFloor = fillGap.band === 'floor';
    // cabinets that fit, biggest first; plainest SKU per width
    const fits = all.filter(r => !(/Filler/i.test(r.sub || '')) && r.w > 0 && r.w <= len + 0.01
      && (isFloor ? r.cat === 'Base' : r.cat === 'Wall'));
    const byWidth = new Map();
    for (const r of fits) {
      const prev = byWidth.get(r.w);
      if (!prev || r.sku.length < prev.sku.length) byWidth.set(r.w, r);
    }
    const cabs = [...byWidth.values()].sort((a, b) => b.w - a.w).slice(0, 4).map(priced);
    // smallest filler that covers the gap (trimmed on site), height-matched
    const fillers = all.filter(r => /Filler/i.test(r.sub || '') && (isFloor ? r.cat === 'Base' : r.cat === 'Wall'))
      .filter(r => !/FLUTED|PROFILE| R$| L$/i.test(r.sku));
    let filler = fillers.filter(r => r.w >= len - 0.01).sort((a, b) => a.w - b.w)[0]
      || fillers.sort((a, b) => b.w - a.w)[0] || null;
    if (filler) filler = priced(filler);
    return { len, wallId: w.id, filler, cabs };
  }, [fillGap, walls, all, brand]);

  const applyFill = useCallback((sku, asFiller) => {
    if (!fillGap) return;
    const w = walls[fillGap.wallIdx]; if (!w) return;
    const it = makeItem(sku, w.id, fillGap.start, brand);
    if (asFiller) it.width = Math.round((fillGap.end - fillGap.start) * 8) / 8;  // trim-to-fit
    const settled = settleItem(items, w.length, it);
    changeItems([...items, settled]);
    setSel(settled.id); setLastPlacedId(settled.id);
    setFillGap(null);
  }, [fillGap, walls, items, brand, changeItems]);

  // keyboard: delete, undo/redo, escape, nudge (1" / Shift ¼" / Alt ⅛")
  useEffect(() => {
    const h = (e) => {
      const inField = /input|textarea|select/i.test(document.activeElement?.tagName || '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault(); (e.shiftKey ? redo : undo)(); return;
      }
      if (e.key === 'Escape') { setArmed(null); setEditGap(null); setFillGap(null); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !inField) {
        if (sel === 'island') { onIslandChange && changeIsland(null); setSel(null); return; }
        changeItems(items.filter(i => i.id !== sel)); setSel(null);
        return;
      }
      if (/^Arrow/.test(e.key) && sel && !inField) {
        const step = e.altKey ? 0.125 : e.shiftKey ? 0.25 : 1;
        if (sel === 'island' && island) {
          e.preventDefault();
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          const bx = islandBox || { cx: 0, cy: 0 };
          changeIsland({ ...island, x: (island.x ?? bx.cx) + dx, y: (island.y ?? bx.cy) + dy });
          return;
        }
        const it = items.find(i => i.id === sel); if (!it) return;
        const w = walls.find(x => x.id === it.wall); if (!w) return;
        e.preventDefault();
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          const next = { ...it, position: it.position + (e.key === 'ArrowRight' ? step : -step) };
          const clamped = { ...next, position: Math.max(0, Math.min(next.position, w.length - it.width)) };
          if (!placementIssues(walls, items, clamped).length || e.ctrlKey || e.metaKey) {
            changeItems(items.map(i => i.id === it.id ? clamped : i));
          }
        } else if (it.zone === 'upper') {
          const ceilH = w.ceilingHeight || 96;
          const h2 = it.height || 36;
          const yM = Math.max(0, Math.min((it.yMount ?? 54) + (e.key === 'ArrowUp' ? step : -step), ceilH - h2));
          changeItems(items.map(i => i.id === it.id ? { ...i, yMount: yM } : i));
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sel, items, walls, island, islandBox, changeItems, changeIsland, onIslandChange, undo, redo]);

  const checks = useMemo(() => manualChecks(walls, items), [walls, items]);

  // Gap dimensions: leftover run space between neighbors and to wall ends —
  // the number every designer is mentally computing (Chief Architect "gaps").
  const gapDims = useMemo(() => {
    const out = [];
    walls.forEach((w, wi) => {
      if (!fr[wi]) return;
      for (const band of ['floor', 'upper']) {
        const list = items.filter(i => i.wall === w.id && bandOf(i) === band).sort((a, b) => a.position - b.position);
        if (!list.length) continue;
        let edge = 0;
        for (const it of list) {
          if (it.position > edge + 0.49) out.push({ start: edge, end: it.position, wallIdx: wi, band });
          edge = Math.max(edge, it.position + it.width);
        }
        if (w.length > edge + 0.49) out.push({ start: edge, end: w.length, wallIdx: wi, band });
      }
    });
    return out;
  }, [walls, items, fr]);

  const selItem = useMemo(() => items.find(i => i.id === sel) || null, [items, sel]);

  const addWall = () => changeWalls([...walls, { id: String.fromCharCode(65 + walls.length), length: 96, role: 'general' }].slice(0, 4));
  const removeWall = () => {
    if (walls.length <= 1) return;
    const gone = walls[walls.length - 1].id;
    changeWalls(walls.slice(0, -1));
    changeItems(items.filter(i => i.wall !== gone));
  };

  // ── render ──
  const itemFill = (it) => it.zone === 'upper' ? C.upper : it.zone === 'tall' ? C.tall : it.zone === 'appliance' ? C.appliance : C.base;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: roomOnly ? '1fr' : '1fr 290px', gap: 14, alignItems: 'start' }}>
      {/* ════ CANVAS ════ */}
      <div style={{ border: '1px solid #e4ddd2', borderRadius: 8, background: C.bg, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #eee7dc', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Design Studio</span>
          {onApplyShape && (
            <div style={{ display: 'flex', gap: 3 }}>
              {[['single-wall', '— Single'], ['galley', '∥ Galley'], ['l-shape', 'L Shape'], ['u-shape', 'U Shape'], ['g-shape', 'G Shape']].map(([shape, label]) => {
                const active = layoutType === shape;
                return (
                  <button key={shape} onClick={() => onApplyShape(shape)}
                    title={`Switch the room to a ${label.replace(/^[^A-Za-z]+/, '')} footprint (wall lengths and openings carry over where walls persist)`}
                    style={{ fontSize: 10.5, padding: '3px 8px', cursor: 'pointer', borderRadius: 4, fontWeight: active ? 700 : 400,
                      border: `1px solid ${active ? C.accent : '#ddd'}`, background: active ? '#c8a96e22' : '#fff', color: active ? C.accent : '#555' }}>
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={addWall} style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 4, background: '#fff' }}>+ Wall</button>
          <button onClick={removeWall} style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 4, background: '#fff' }}>− Wall</button>
          <button onClick={undo} title="Undo (Ctrl+Z)" style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 4, background: '#fff' }}>↶</button>
          <button onClick={redo} title="Redo (Ctrl+Shift+Z)" style={{ fontSize: 12, padding: '2px 8px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 4, background: '#fff' }}>↷</button>
          {onIslandChange && !roomOnly && (island && island.length
            ? <button onClick={() => { changeIsland(null); if (sel === 'island') setSel(null); }} style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 4, background: '#fff' }}>− Island</button>
            : <button onClick={() => changeIsland({ length: 72, depth: 36, overhang: 12 })} style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 4, background: '#fff' }}>+ Island</button>)}
          {armed && <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>Placing {armed.sku || armed.applianceType} — green = drop, red = blocked (Alt forces) · Shift = multiple · Esc cancels</span>}
          {selItem && (
            <button onClick={() => changeItems(items.map(i => i.id === selItem.id ? { ...i, locked: !i.locked } : i))}
              title="Locked items survive 'Design around my picks' — the solver builds around them and never moves them"
              style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', borderRadius: 4,
                border: `1px solid ${selItem.locked ? C.accent : '#ddd'}`, background: selItem.locked ? '#c8a96e22' : '#fff', color: selItem.locked ? C.accent : '#555', fontWeight: selItem.locked ? 700 : 400 }}>
              {selItem.locked ? '🔒 Locked' : '🔓 Lock'}
            </button>
          )}
          {sel && <button onClick={() => { changeItems(items.filter(i => i.id !== sel)); setSel(null); }}
            style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: `1px solid ${C.danger}`, color: C.danger, borderRadius: 4, background: '#fff' }}>✕ Remove selected</button>}
          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: checks.some(c => c.severity === 'error') ? C.danger : '#7a7'}}>
            {checks.filter(c => c.severity === 'error').length ? `${checks.filter(c => c.severity === 'error').length} issue(s)` : items.length ? '✓ layout clean' : 'drag walls · click dims to type · place cabinets from the catalog →'}
          </span>
        </div>
        {/* swap-in-place strip: same-family widths with price deltas */}
        {swapOptions && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #eee7dc', background: '#faf7f1', overflowX: 'auto' }}>
            <span style={{ fontSize: 10.5, color: '#777', whiteSpace: 'nowrap' }}>
              Swap <b style={{ fontFamily: 'monospace' }}>{swapOptions.cur.sku}</b>{swapOptions.curPrice != null ? ` ($${Number(swapOptions.curPrice).toLocaleString()})` : ''} →
            </span>
            {swapOptions.options.map(o => (
              <button key={o.sku} onClick={() => applySwap(o)}
                title={`Replace with ${o.sku}${o.price != null ? ` — $${Number(o.price).toLocaleString()}` : ''}; left edge stays anchored`}
                style={{ fontSize: 10.5, padding: '3px 8px', cursor: 'pointer', borderRadius: 4, border: '1px solid #d8cdb8', background: '#fff', whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{o.sku}</span>
                {o.delta != null && (
                  <span style={{ marginLeft: 5, color: o.delta > 0 ? '#a05533' : '#3a7d44', fontVariantNumeric: 'tabular-nums' }}>
                    {o.delta > 0 ? '+' : '−'}${Math.abs(Math.round(o.delta)).toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {/* fill-gap strip: best-fit cabinets + trim-to-fit filler */}
        {fillGap && fillOptions && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid #eee7dc', background: '#fffbe9', overflowX: 'auto' }}>
            <span style={{ fontSize: 10.5, color: '#8a6d1a', whiteSpace: 'nowrap', fontWeight: 700 }}>
              Fill {fmtIn(fillOptions.len)} gap · wall {fillOptions.wallId}:
            </span>
            {fillOptions.cabs.map(o => (
              <button key={o.sku} onClick={() => applyFill(o.sku, false)}
                style={{ fontSize: 10.5, padding: '3px 8px', cursor: 'pointer', borderRadius: 4, border: '1px solid #d8c89a', background: '#fff', whiteSpace: 'nowrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{o.sku}</span>
                <span style={{ marginLeft: 4, color: '#999' }}>{fmtIn(o.w)}</span>
                {o.price != null && <span style={{ marginLeft: 4, color: '#777' }}>{o.approx ? '≈' : ''}${Number(o.price).toLocaleString()}</span>}
              </button>
            ))}
            {fillOptions.filler && (
              <button onClick={() => applyFill(fillOptions.filler.sku, true)}
                title="Filler is ordered oversize and trimmed to the gap on site"
                style={{ fontSize: 10.5, padding: '3px 8px', cursor: 'pointer', borderRadius: 4, border: '1px solid #b8944e', background: '#fff', whiteSpace: 'nowrap', color: '#8a6d1a' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{fillOptions.filler.sku}</span>
                <span style={{ marginLeft: 4 }}>filler → trim to {fmtIn(fillOptions.len)}</span>
                {fillOptions.filler.price != null && <span style={{ marginLeft: 4, color: '#777' }}>${Number(fillOptions.filler.price).toLocaleString()}</span>}
              </button>
            )}
            <button onClick={() => setFillGap(null)} style={{ fontSize: 10.5, padding: '3px 8px', cursor: 'pointer', borderRadius: 4, border: '1px solid #ccc', background: '#fff', color: '#888' }}>✕</button>
          </div>
        )}
        <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ width: '100%', height: 'auto', maxHeight: 560, touchAction: 'none', cursor: armed ? 'crosshair' : 'default' }}
          onClick={onCanvasClick} onKeyDown={e => e.key === 'Escape' && setArmed(null)} tabIndex={0}
          onPointerMove={armed ? (e) => setHoverPt(svgPoint(e)) : undefined}
          onPointerLeave={armed ? () => setHoverPt(null) : undefined}>
          {/* walls */}
          {fr.map((f, wi) => {
            const e = toWorld(f, f.length, 0);
            const w = walls[wi];
            const mid = toWorld(f, f.length / 2, -16);
            const endHandle = toWorld(f, f.length, -WALL_T);
            return (
              <g key={f.id}>
                <line x1={f.x} y1={f.y} x2={e.x} y2={e.y} stroke={elevWall === w.id ? '#5a4a2a' : C.wall} strokeWidth={WALL_T} strokeLinecap="square"
                  style={{ cursor: roomOnly ? 'default' : 'pointer' }}
                  onClick={roomOnly ? undefined : (ev) => { ev.stopPropagation(); setElevWall(elevWall === w.id ? null : w.id); }}>
                  <title>{`Click for wall ${w.id} elevation (set wall-cabinet heights)`}</title>
                </line>
                {/* openings */}
                {(w.openings || []).map((op, oi) => {
                  const start = op.position ?? op.posFromLeft ?? 0;
                  const a = toWorld(f, start, 0), b = toWorld(f, start + (op.width || 36), 0);
                  return (
                    <g key={oi} style={{ cursor: 'grab' }}
                      onPointerDown={(ev) => { ev.stopPropagation(); setDrag({ kind: 'opening', wallIdx: wi, opIdx: oi }); setSel(`op:${wi}:${oi}`); }}>
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={op.type === 'window' ? C.window : C.door} strokeWidth={WALL_T} />
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#fff" strokeWidth={1.4} strokeDasharray={op.type === 'window' ? '0' : '4,3'} />
                      {(() => { const c = toWorld(f, start + (op.width || 36) / 2, -11); return (
                        <text x={c.x} y={c.y} fontSize={7} textAnchor="middle" fill={op.type === 'window' ? '#3f6aa0' : '#9c7b33'} fontFamily="Helvetica">{op.type} {fmtIn(op.width || 36)}</text>
                      ); })()}
                    </g>
                  );
                })}
                {/* wall-end drag handle */}
                <circle cx={endHandle.x} cy={endHandle.y} r={5} fill="#fff" stroke={C.accent} strokeWidth={1.6} style={{ cursor: 'grab' }}
                  onPointerDown={(ev) => { ev.stopPropagation(); setDrag({ kind: 'wallEnd', idx: wi }); }} />
                {/* dimension — click to type */}
                {editDim?.wallIdx === wi ? (
                  <foreignObject x={mid.x - 34} y={mid.y - 14} width={68} height={22}>
                    <input autoFocus defaultValue={w.length} style={{ width: '100%', fontSize: 11, textAlign: 'center' }}
                      onBlur={(ev) => { const v = parseFloat(ev.target.value); if (v >= 24) changeWalls(walls.map((ww, i) => i === wi ? { ...ww, length: Math.round(v * 8) / 8 } : ww)); setEditDim(null); }}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') ev.target.blur(); if (ev.key === 'Escape') setEditDim(null); }} />
                  </foreignObject>
                ) : (
                  <text x={mid.x} y={mid.y} fontSize={9.5} fontWeight={700} textAnchor="middle" fill={C.line} fontFamily="Helvetica"
                    style={{ cursor: 'text' }} onClick={(ev) => { ev.stopPropagation(); setEditDim({ wallIdx: wi }); }}>
                    {w.id}: {fmtIn(w.length)}
                  </text>
                )}
              </g>
            );
          })}
          {/* solver ghost (auto-design preview) */}
          {ghost && (ghost.walls || []).map(wl => {
            const f = fr.find(x => x.id === (wl.wallId || wl.id)); if (!f) return null;
            return (wl.cabinets || []).filter(c => typeof c.position === 'number' && c.width > 0).map((c, i) => {
              const a = toWorld(f, c.position, 2), b = toWorld(f, c.position + c.width, 2 + BASE_D);
              return <rect key={`${wl.wallId}-g${i}`} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x) || BASE_D} height={Math.abs(b.y - a.y) || BASE_D}
                fill="none" stroke={C.ghost} strokeWidth={0.8} strokeDasharray="3,2" />;
            });
          })}
          {/* placed items */}
          {items.map(it => {
            const f = fr.find(x => x.id === it.wall); if (!f) return null;
            const depth = it.zone === 'upper' ? UPPER_D : BASE_D;
            const a = toWorld(f, it.position, 2), b = toWorld(f, it.position + it.width, 2 + depth);
            const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
            const seld = sel === it.id;
            return (
              <g key={it.id} style={{ cursor: 'grab' }}
                onPointerDown={(ev) => { ev.stopPropagation(); setSel(it.id); setDrag({ kind: 'item', id: it.id }); }}>
                <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x) || depth} height={Math.abs(b.y - a.y) || depth}
                  fill={itemFill(it)} stroke={seld ? C.sel : '#6b6257'} strokeWidth={seld ? 1.8 : 0.8}
                  strokeDasharray={it.zone === 'upper' ? '4,2' : '0'} opacity={it.zone === 'upper' ? 0.85 : 1} />
                <text x={cx} y={cy + 2.4} fontSize={6.4} textAnchor="middle" fill="#3b352d" fontFamily="Helvetica" pointerEvents="none">
                  {(it.sku || it.applianceType || '').replace(/^FC-/, '').slice(0, 12)}
                </text>
                <text x={cx} y={cy + 9.5} fontSize={5.4} textAnchor="middle" fill="#8a8378" fontFamily="Helvetica" pointerEvents="none">{fmtIn(it.width)}</text>
                {it.locked && <text x={cx} y={cy - 5} fontSize={6} textAnchor="middle" fill={C.accent} fontFamily="Helvetica" pointerEvents="none">🔒</text>}
              </g>
            );
          })}
          {/* corner drop targets: diagonal markers, gold when a corner SKU is armed */}
          {!roomOnly && corners.map(c => {
            const f1 = fr[c.idx], f2 = fr[c.idx + 1];
            const a = toWorld(f1, f1.length - 13, 2), b = toWorld(f2, 13, 2);
            const hot = armed?.sku && isCornerSku(armed.sku);
            return (
              <g key={`cn${c.idx}`} pointerEvents="none" opacity={hot ? 1 : 0.45}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? C.accent : '#b9ad99'} strokeWidth={hot ? 1.6 : 0.8} strokeDasharray="3,2" />
                {hot && (() => { const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; return (
                  <text x={m.x} y={m.y - 3} fontSize={6.5} textAnchor="middle" fill={C.accent} fontFamily="Helvetica" fontWeight={700}>corner</text>
                ); })()}
              </g>
            );
          })}
          {/* island: draggable, with live aisle clearances (NKBA 42"/36") */}
          {islandBox && (() => {
            const seld = sel === 'island';
            return (
              <g>
                {islandClear.map((cl, i) => {
                  const col = cl.clear < 36 ? C.danger : cl.clear < 42 ? '#c08a2e' : '#3a7d44';
                  const lx = cl.horiz ? cl.x : (cl.x0 + cl.x1) / 2;
                  const ly = cl.horiz ? (cl.y0 + cl.y1) / 2 : cl.y;
                  return (
                    <g key={i} pointerEvents="none">
                      <line x1={cl.horiz ? cl.x : cl.x0} y1={cl.horiz ? cl.y0 : cl.y} x2={cl.horiz ? cl.x : cl.x1} y2={cl.horiz ? cl.y1 : cl.y}
                        stroke={col} strokeWidth={0.6} strokeDasharray="3,2" />
                      <rect x={lx - 12} y={ly - 5.5} width={24} height={11} rx={2} fill="#fff" stroke={col} strokeWidth={0.6} />
                      <text x={lx} y={ly + 2.6} fontSize={6.2} textAnchor="middle" fill={col} fontFamily="Helvetica">{fmtIn(cl.clear)}</text>
                    </g>
                  );
                })}
                <g style={{ cursor: 'grab' }}
                  onPointerDown={(ev) => { ev.stopPropagation(); setSel('island'); setDrag({ kind: 'island' }); }}>
                  <rect x={islandBox.x} y={islandBox.y} width={islandBox.L} height={islandBox.D}
                    fill={C.base} stroke={seld ? C.sel : '#6b6257'} strokeWidth={seld ? 1.8 : 1} />
                  <text x={islandBox.cx} y={islandBox.cy - 2} fontSize={7} textAnchor="middle" fill="#3b352d" fontFamily="Helvetica" pointerEvents="none">ISLAND</text>
                  {editIsl ? (
                    <foreignObject x={islandBox.cx - 26} y={islandBox.cy + 1} width={52} height={20}>
                      <input autoFocus defaultValue={editIsl === 'length' ? islandBox.L : islandBox.D} style={{ width: '100%', fontSize: 10, textAlign: 'center' }}
                        onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
                        onBlur={(ev) => { const v = parseFloat(ev.target.value); if (v >= 12 && v <= 144) changeIsland({ ...island, [editIsl]: Math.round(v * 2) / 2 }); setEditIsl(null); }}
                        onKeyDown={(ev) => { if (ev.key === 'Enter') ev.target.blur(); if (ev.key === 'Escape') setEditIsl(null); }} />
                    </foreignObject>
                  ) : (
                    <text x={islandBox.cx} y={islandBox.cy + 8} fontSize={6.2} textAnchor="middle" fill="#8a8378" fontFamily="Helvetica" style={{ cursor: 'text' }}
                      onPointerDown={(ev) => ev.stopPropagation()}>
                      <tspan onClick={(ev) => { ev.stopPropagation(); setEditIsl('length'); }}>{fmtIn(islandBox.L)}</tspan>
                      <tspan> × </tspan>
                      <tspan onClick={(ev) => { ev.stopPropagation(); setEditIsl('depth'); }}>{fmtIn(islandBox.D)}</tspan>
                    </text>
                  )}
                </g>
              </g>
            );
          })()}
          {/* gap dimensions — leftover run space; click a chip to fill the gap */}
          {gapDims.filter(g => g.band === 'floor' || (selItem && bandOf(selItem) === 'upper')).map((g, i) => {
            const f = fr[g.wallIdx];
            const perp = g.band === 'floor' ? 2 + BASE_D + 9 : 2 + UPPER_D + 6;
            const mid = toWorld(f, (g.start + g.end) / 2, perp);
            const a = toWorld(f, g.start, perp), b = toWorld(f, g.end, perp);
            const active = fillGap && fillGap.wallIdx === g.wallIdx && fillGap.band === g.band && Math.abs(fillGap.start - g.start) < 0.01;
            return (
              <g key={`gap${i}`} style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setFillGap(active ? null : g); }}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c9b873" strokeWidth={0.5} strokeDasharray="2,2" />
                <rect x={mid.x - 13} y={mid.y - 6} width={26} height={11} rx={2} fill={active ? '#f3e3ad' : '#fffbe9'} stroke={active ? C.accent : '#d8c89a'} strokeWidth={active ? 1 : 0.5} />
                <text x={mid.x} y={mid.y + 2.5} fontSize={6.5} textAnchor="middle" fill="#8a6d1a" fontFamily="Helvetica" pointerEvents="none">{fmtIn(g.end - g.start)}</text>
              </g>
            );
          })}
          {/* auto-advance arrows: butt the armed SKU flush left/right of the anchor */}
          {advance && (() => {
            const { anchor, frame: f, width, remLeft, remRight, zone } = advance;
            const depth = zone === 'upper' ? UPPER_D : BASE_D;
            const mk = (side) => {
              const fits = (side === 'right' ? remRight : remLeft) >= width - 0.01;
              const along = side === 'right' ? anchor.position + anchor.width + 8 : anchor.position - 8;
              const c = toWorld(f, along, 2 + depth / 2);
              const lbl = toWorld(f, along, 2 + depth / 2 + 11);
              const col = fits ? '#2e7d32' : '#bbb';
              return (
                <g key={side} style={{ cursor: fits ? 'pointer' : 'not-allowed' }}
                  onClick={(e) => { e.stopPropagation(); if (fits) placeFlush(side); }}>
                  <circle cx={c.x} cy={c.y} r={6.5} fill="#fff" stroke={col} strokeWidth={1.6} />
                  <text x={c.x} y={c.y + 3} fontSize={8} fontWeight={700} textAnchor="middle" fill={col} fontFamily="Helvetica" pointerEvents="none">{side === 'right' ? '▶' : '◀'}</text>
                  <text x={lbl.x} y={lbl.y + 3} fontSize={6} textAnchor="middle" fill={col} fontFamily="Helvetica" pointerEvents="none">{fmtIn(side === 'right' ? remRight : remLeft)}</text>
                </g>
              );
            };
            return <g>{mk('left')}{mk('right')}</g>;
          })()}
          {/* selected item: clickable offset dims — type a value, the cabinet moves */}
          {selItem && !drag && (() => {
            const f = fr.find(x => x.id === selItem.wall);
            const w = walls.find(x => x.id === selItem.wall);
            if (!f || !w) return null;
            const sibs = items.filter(i => i.id !== selItem.id && i.wall === selItem.wall && bandOf(i) === bandOf(selItem));
            const leftN = sibs.filter(i => i.position + i.width <= selItem.position + 0.01).sort((a, b) => b.position - a.position)[0];
            const rightN = sibs.filter(i => i.position >= selItem.position + selItem.width - 0.01).sort((a, b) => a.position - b.position)[0];
            const leftEdge = leftN ? leftN.position + leftN.width : 0;
            const rightEdge = rightN ? rightN.position : w.length;
            const depth = selItem.zone === 'upper' ? UPPER_D : BASE_D;
            const perp = 2 + depth + 16;
            const apply = (side, v) => {
              if (!(v >= 0)) { setEditGap(null); return; }
              const pos = side === 'left' ? leftEdge + v : rightEdge - v - selItem.width;
              const clamped = Math.max(0, Math.min(Math.round(pos * 8) / 8, w.length - selItem.width));
              changeItems(items.map(i => i.id === selItem.id ? { ...i, position: clamped } : i));
              setEditGap(null);
            };
            const seg = (side, from, to, gap) => {
              const a = toWorld(f, from, perp), b = toWorld(f, to, perp);
              const mid = toWorld(f, (from + to) / 2, perp);
              if (editGap?.itemId === selItem.id && editGap.side === side) {
                return (
                  <foreignObject key={side} x={mid.x - 26} y={mid.y - 11} width={52} height={20}>
                    <input autoFocus defaultValue={Math.round(gap * 8) / 8} style={{ width: '100%', fontSize: 10, textAlign: 'center' }}
                      onClick={e => e.stopPropagation()}
                      onBlur={(ev) => apply(side, parseFloat(ev.target.value))}
                      onKeyDown={(ev) => { if (ev.key === 'Enter') ev.target.blur(); if (ev.key === 'Escape') setEditGap(null); }} />
                  </foreignObject>
                );
              }
              return (
                <g key={side} style={{ cursor: 'text' }} onClick={(e) => { e.stopPropagation(); setEditGap({ itemId: selItem.id, side }); }}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.accent} strokeWidth={0.7} />
                  <rect x={mid.x - 13} y={mid.y - 6.5} width={26} height={12} rx={2} fill="#fff" stroke={C.accent} strokeWidth={0.7} />
                  <text x={mid.x} y={mid.y + 2.6} fontSize={6.8} fontWeight={700} textAnchor="middle" fill={C.accent} fontFamily="Helvetica">{fmtIn(gap)}</text>
                </g>
              );
            };
            return (
              <g>
                {seg('left', leftEdge, selItem.position, selItem.position - leftEdge)}
                {seg('right', selItem.position + selItem.width, rightEdge, rightEdge - selItem.position - selItem.width)}
              </g>
            );
          })()}
          {/* armed ghost: true footprint, green = legal, red = blocked + reason */}
          {ghostPlace && (() => {
            const f = fr[ghostPlace.frameIdx];
            const it = ghostPlace.item;
            const w = walls[ghostPlace.frameIdx];
            const depth = it.zone === 'upper' ? UPPER_D : BASE_D;
            const a = toWorld(f, it.position, 2), b = toWorld(f, it.position + it.width, 2 + depth);
            const bad = ghostPlace.issues.length > 0;
            const col = bad ? C.danger : ghostPlace.shiftPlan ? '#c08a2e' : '#2e7d32';
            const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
            const top = Math.min(a.y, b.y);
            return (
              <g pointerEvents="none">
                <rect x={Math.min(a.x, b.x)} y={top} width={Math.abs(b.x - a.x) || depth} height={Math.abs(b.y - a.y) || depth}
                  fill={col} fillOpacity={0.16} stroke={col} strokeWidth={1.2} strokeDasharray="4,3" />
                <text x={cx} y={cy + 2.4} fontSize={6.4} textAnchor="middle" fill={col} fontFamily="Helvetica">
                  {(it.sku || it.applianceType || '').replace(/^FC-/, '').slice(0, 12)}
                </text>
                <text x={cx} y={cy + 9.5} fontSize={5.6} textAnchor="middle" fill={col} fontFamily="Helvetica">
                  {fmtIn(it.position)} ⟵ {fmtIn(it.width)} ⟶ {fmtIn(Math.max(0, w.length - it.position - it.width))}
                </text>
                {bad && <text x={cx} y={top - 4} fontSize={7} fontWeight={700} textAnchor="middle" fill={C.danger} fontFamily="Helvetica">⚠ {ghostPlace.issues[0]}</text>}
                {!bad && ghostPlace.hint && <text x={cx} y={top - 4} fontSize={7} fontWeight={700} textAnchor="middle" fill={col} fontFamily="Helvetica">✦ {ghostPlace.hint}</text>}
              </g>
            );
          })()}
        </svg>
        {/* issues strip */}
        {checks.filter(c => c.severity === 'error').slice(0, 3).map((c, i) => (
          <div key={i} style={{ padding: '4px 12px', fontSize: 11, color: C.danger, borderTop: '1px solid #f3e0dc', background: '#fdf5f3' }}>⚠ {c.message}</div>
        ))}
        {/* ── elevation strip: synchronized editable view of one wall ── */}
        {elevWall && !roomOnly && (() => {
          const w = walls.find(x => x.id === elevWall);
          if (!w) return null;
          const ceilH = w.ceilingHeight || 96;
          const M = 18;
          const wallItems = items.filter(i => i.wall === w.id);
          const elevFill = (it) => it.zone === 'upper' ? C.upper : it.zone === 'tall' ? C.tall : it.zone === 'appliance' ? C.appliance : C.base;
          return (
            <div style={{ borderTop: '1px solid #eee7dc' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 10px', fontSize: 10.5, color: '#777' }}>
                <b style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Elevation — wall {w.id}</b>
                <span>drag wall cabinets ↑↓ to set mount heights (stacking allowed) · ←→ slides · plan stays in sync</span>
                <label style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                  ceiling
                  <input type="number" min={84} max={144} step={0.5} value={ceilH}
                    onChange={(ev) => { const v = parseFloat(ev.target.value); if (v >= 84 && v <= 144) changeWalls(walls.map(ww => ww.id === w.id ? { ...ww, ceilingHeight: v } : ww)); }}
                    style={{ width: 52, fontSize: 10.5, padding: '1px 4px' }} />
                </label>
                <button onClick={() => setElevWall(null)} style={{ fontSize: 10.5, padding: '2px 8px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: 4, background: '#fff', color: '#888' }}>✕ close</button>
              </div>
              <svg ref={elevRef} viewBox={`0 0 ${w.length + M * 2} ${ceilH + 22}`} style={{ width: '100%', maxHeight: 250, display: 'block', touchAction: 'none' }}>
                <rect x={M} y={8} width={w.length} height={ceilH} fill="#fcfaf6" stroke="#a99" strokeWidth={0.8} />
                {/* openings */}
                {(w.openings || []).map((op, oi) => {
                  const start = op.position ?? op.posFromLeft ?? 0;
                  const isWin = op.type === 'window';
                  const oh = op.height || (isWin ? 36 : 82);
                  const sill = isWin ? (op.sill ?? 42) : 0;
                  return (
                    <g key={oi} pointerEvents="none">
                      <rect x={M + start} y={8 + ceilH - sill - oh} width={op.width || 36} height={oh}
                        fill={isWin ? '#dfe9f5' : '#efe3cd'} stroke={isWin ? C.window : C.door} strokeWidth={0.7} />
                      <text x={M + start + (op.width || 36) / 2} y={8 + ceilH - sill - oh / 2} fontSize={6} textAnchor="middle" fill="#888" fontFamily="Helvetica">{op.type}</text>
                    </g>
                  );
                })}
                {/* 54" datum line */}
                <line x1={M} y1={8 + ceilH - 54} x2={M + w.length} y2={8 + ceilH - 54} stroke="#d9cfc0" strokeWidth={0.5} strokeDasharray="4,3" />
                <text x={M + 2} y={8 + ceilH - 55.5} fontSize={5} fill="#b3a78f" fontFamily="Helvetica">54"</text>
                {/* items */}
                {wallItems.map(it => {
                  const [y0, y1] = yRangeOf(it);
                  const y = 8 + ceilH - y1;
                  const seld = sel === it.id;
                  return (
                    <g key={it.id} style={{ cursor: it.zone === 'upper' ? 'move' : 'ew-resize' }}
                      onPointerDown={(ev) => { ev.stopPropagation(); setSel(it.id); setDrag({ kind: 'elevItem', id: it.id }); }}>
                      <rect x={M + it.position} y={y} width={it.width} height={y1 - y0}
                        fill={elevFill(it)} stroke={seld ? C.sel : '#6b6257'} strokeWidth={seld ? 1.6 : 0.7} />
                      <text x={M + it.position + it.width / 2} y={y + (y1 - y0) / 2 + 2} fontSize={6} textAnchor="middle" fill="#3b352d" fontFamily="Helvetica" pointerEvents="none">
                        {(it.sku || it.applianceType || '').replace(/^FC-/, '').slice(0, 10)}
                      </text>
                      {it.zone === 'upper' && (
                        <text x={M + it.position + it.width / 2} y={y + (y1 - y0) + 6.5} fontSize={5.2} textAnchor="middle" fill={seld ? C.accent : '#8a8378'} fontFamily="Helvetica" pointerEvents="none">
                          @{fmtIn(it.yMount ?? 54)}
                        </text>
                      )}
                    </g>
                  );
                })}
                {/* floor line */}
                <line x1={M - 6} y1={8 + ceilH} x2={M + w.length + 6} y2={8 + ceilH} stroke="#555" strokeWidth={1} />
                <text x={M + w.length + 2} y={16} fontSize={5.5} fill="#999" fontFamily="Helvetica">{fmtIn(ceilH)} clg</text>
              </svg>
            </div>
          );
        })()}
      </div>

      {/* ════ CATALOG BROWSER ════ */}
      {!roomOnly && <div style={{ border: '1px solid #e4ddd2', borderRadius: 8, background: '#faf8f5', maxHeight: 640, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee7dc' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {brand === 'shiloh' ? 'Shiloh' : 'Eclipse'} Catalog
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type a SKU + Enter to place (e.g. B30, SB36)"
            onKeyDown={e => {
              // Winner-style type-to-place: Enter arms the best match
              if (e.key === 'Enter' && list.length) {
                const exact = list.find(r => r.sku.toUpperCase() === search.toUpperCase());
                setArmed({ sku: (exact || list[0]).sku });
              }
            }}
            style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <select value={cat} onChange={e => { setCat(e.target.value); setSearch(''); setFacet(null); }} style={{ flex: 1, fontSize: 11, padding: 4 }}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={widthF} onChange={e => setWidthF(e.target.value)} placeholder="width" type="number"
              style={{ width: 64, fontSize: 11, padding: 4, border: '1px solid #ddd', borderRadius: 4 }} />
          </div>
          {brand !== 'shiloh' && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {FACETS.map(([name]) => (
                <button key={name} onClick={() => { setFacet(facet === name ? null : name); }}
                  style={{ fontSize: 9.5, padding: '2px 7px', cursor: 'pointer', borderRadius: 10,
                    border: `1px solid ${facet === name ? C.accent : '#ddd'}`,
                    background: facet === name ? '#c8a96e22' : '#fff', color: facet === name ? C.accent : '#777', fontWeight: facet === name ? 700 : 400 }}>
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {/* appliances palette */}
          <div style={{ padding: '6px 12px 2px', fontSize: 9.5, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>Appliances (openings)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 12px 8px' }}>
            {APPLIANCE_PALETTE.map((a, i) => (
              <button key={i} onClick={() => setArmed({ applianceType: a.type, width: a.width })}
                style={{ fontSize: 10.5, padding: '3px 8px', cursor: 'pointer', borderRadius: 4, background: armed?.applianceType === a.type && armed?.width === a.width ? '#c8a96e33' : '#fff', border: '1px solid #ddd' }}>
                {a.label}
              </button>
            ))}
          </div>
          <div style={{ padding: '4px 12px 2px', fontSize: 9.5, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Cabinets {search ? `— "${search}"` : `— ${cat}`} ({list.length}{list.length === 60 ? '+' : ''})
          </div>
          {list.map(r => (
            <div key={r.sku} onClick={() => setArmed({ sku: r.sku })}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', cursor: 'pointer', fontSize: 11.5,
                background: armed?.sku === r.sku ? '#c8a96e22' : 'transparent', borderBottom: '1px solid #f1ece4' }}>
              <FrontThumb w={r.w} h={r.h} dc={r.dc || 0} drc={r.drc || 0} zone={r.zone} />
              <span style={{ fontFamily: 'monospace', fontWeight: 600, flex: 1 }}>{r.sku}</span>
              <span style={{ color: '#999', fontSize: 10 }}>{r.w ? `${r.w}w` : ''}{r.h ? `×${r.h}h` : ''}</span>
              <span style={{ color: '#777', fontVariantNumeric: 'tabular-nums' }}
                title={r.approx ? 'Family-resolved price — exact catalog row not found; verify before ordering' : undefined}>
                {r.price != null ? `${r.approx ? '≈' : ''}$${Number(r.price).toLocaleString()}` : '—'}</span>
            </div>
          ))}
          {!list.length && <div style={{ padding: 12, fontSize: 12, color: '#999' }}>No matches — adjust search or category.</div>}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid #eee7dc', fontSize: 10, color: '#999' }}>
          Click a cabinet, then click a wall — the ghost shows exactly where it lands. Drag to move (stops flush at neighbors · Ctrl-drag overlaps for panels) · select an item and click its gold offset dims to type exact distances · Ctrl+Z undoes.
        </div>
      </div>}
    </div>
  );
}
