import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { OFFICIAL_V88 } from '../../eclipse-pricing/src/officialV88.js';
import { SHILOH_CATALOG } from '../../eclipse-pricing/src/shilohSkuCatalog.js';
import { findSku } from '../../eclipse-pricing/src/skuCatalog.js';
import { setPricingBrand, findSkuNormalized } from './skuResolver.js';
import { makeItem, makeAppliance, settleItem, slideItem, placementIssues, bandOf, skuInfo, priceLookup, manualChecks } from './manualDesign.js';

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
    rows.push({ sku, w: e.w, h: e.h, zone: ({ W: 'upper', WC: 'upper', T: 'tall', GT: 'tall', BK: 'tall' })[e.cat] || 'base',
      cat: ({ B: 'Base', BC: 'Base Corner', T: 'Tall', W: 'Wall', WC: 'Wall Corner', V: 'Vanity', BK: 'Bookcase', GB: 'Gola Base', GBC: 'Gola Corner', GT: 'Gola Tall', GV: 'Gola Vanity' })[e.cat] || 'Other',
      sub: e.sub || '' });
  }
  return rows;
}

const APPLIANCE_PALETTE = [
  { type: 'range', label: 'Range 30"', width: 30 }, { type: 'range', label: 'Range 36"', width: 36 },
  { type: 'range', label: 'Range 48"', width: 48 }, { type: 'cooktop', label: 'Cooktop 36"', width: 36 },
  { type: 'dishwasher', label: 'Dishwasher 24"', width: 24 }, { type: 'refrigerator', label: 'Refrigerator 36"', width: 36 },
];

export default function DesignStudio({ walls, onWallsChange, items, onItemsChange, brand = 'eclipse', ghost = null, mode = 'full', layoutType = '', onApplyShape = null }) {
  const roomOnly = mode === 'room';
  const svgRef = useRef(null);
  const [sel, setSel] = useState(null);             // selected item id | 'op:wallIdx:opIdx'
  const [armed, setArmed] = useState(null);          // {sku} | {applianceType,width} awaiting placement
  const [editDim, setEditDim] = useState(null);      // {wallIdx, value}
  const [editGap, setEditGap] = useState(null);      // {itemId, side:'left'|'right'} typing an offset
  const [hoverPt, setHoverPt] = useState(null);      // cursor world point while armed (ghost preview)
  const [drag, setDrag] = useState(null);
  const [cat, setCat] = useState('Base');
  const [search, setSearch] = useState('');
  const [widthF, setWidthF] = useState('');

  // ── Undo/redo: coalesced snapshots of {walls, items}. A burst of changes
  // (one drag) records once; Ctrl+Z walks back whole gestures. ──
  const histRef = useRef({ past: [], future: [], stamp: 0 });
  const presentRef = useRef({ walls, items });
  useEffect(() => { presentRef.current = { walls, items }; }, [walls, items]);
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
  const undo = useCallback(() => {
    const h = histRef.current; if (!h.past.length) return;
    h.future.push(JSON.parse(JSON.stringify(presentRef.current)));
    const prev = h.past.pop(); h.stamp = 0;
    onWallsChange(prev.walls); onItemsChange(prev.items);
  }, [onWallsChange, onItemsChange]);
  const redo = useCallback(() => {
    const h = histRef.current; if (!h.future.length) return;
    h.past.push(JSON.parse(JSON.stringify(presentRef.current)));
    const next = h.future.pop(); h.stamp = 0;
    onWallsChange(next.walls); onItemsChange(next.items);
  }, [onWallsChange, onItemsChange]);

  const fr = useMemo(() => frames(walls, layoutType), [walls, layoutType]);
  const all = useMemo(() => catalogList(brand), [brand]);
  const cats = useMemo(() => [...new Set(all.map(r => r.cat))].sort(), [all]);
  const list = useMemo(() => {
    let rows = all.filter(r => r.cat === cat);
    if (search) { const q = search.toUpperCase(); rows = all.filter(r => r.sku.toUpperCase().includes(q)); }
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
  }, [all, cat, search, widthF, brand]);

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
    }
  }, [drag, fr, walls, items, changeWalls, changeItems, svgPoint, projectOnWall, nearestWall]);

  const onPointerUp = useCallback(() => setDrag(null), []);
  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => { window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); };
  }, [onPointerMove, onPointerUp]);

  // Live ghost while a SKU/appliance is armed: true footprint, settled into
  // place, tinted green (legal) or red (blocked, with the first reason).
  const ghostPlace = useMemo(() => {
    if (!armed || !hoverPt || drag) return null;
    const hit = nearestWall(hoverPt);
    if (!hit || hit.dist > 60) return null;
    const w = walls[hit.i];
    const proto = armed.applianceType
      ? makeAppliance(armed.applianceType, w.id, 0, armed.width)
      : makeItem(armed.sku, w.id, 0, brand);
    proto.id = '_ghost';
    proto.position = hit.along - proto.width / 2;
    const settled = settleItem(items, w.length, proto);
    return { item: settled, frameIdx: hit.i, issues: placementIssues(walls, items, settled) };
  }, [armed, hoverPt, drag, walls, items, brand, nearestWall]);

  const onCanvasClick = useCallback((evt) => {
    if (!armed) { setSel(null); setEditGap(null); return; }
    const p = svgPoint(evt);
    const hit = nearestWall(p);
    if (!hit || hit.dist > 60) return;
    const wallLen = walls[hit.i].length;
    let it = armed.applianceType
      ? makeAppliance(armed.applianceType, walls[hit.i].id, hit.along - (armed.width || 30) / 2, armed.width)
      : makeItem(armed.sku, walls[hit.i].id, hit.along - (skuInfo(armed.sku, brand).w) / 2, brand);
    it = settleItem(items, wallLen, it);
    // Red ghost = blocked drop (door opening, window, no room). Alt-click forces.
    if (placementIssues(walls, items, it).length && !evt.altKey) return;
    changeItems([...items, it]);
    setSel(it.id);
    if (!evt.shiftKey) setArmed(null);   // hold shift to place several
  }, [armed, items, walls, brand, svgPoint, nearestWall, changeItems]);

  // keyboard: delete, undo/redo, escape
  useEffect(() => {
    const h = (e) => {
      const inField = /input|textarea|select/i.test(document.activeElement?.tagName || '');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault(); (e.shiftKey ? redo : undo)(); return;
      }
      if (e.key === 'Escape') { setArmed(null); setEditGap(null); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !inField) {
        changeItems(items.filter(i => i.id !== sel)); setSel(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sel, items, changeItems, undo, redo]);

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
          {armed && <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>Placing {armed.sku || armed.applianceType} — green = drop, red = blocked (Alt forces) · Shift = multiple · Esc cancels</span>}
          {sel && <button onClick={() => { changeItems(items.filter(i => i.id !== sel)); setSel(null); }}
            style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: `1px solid ${C.danger}`, color: C.danger, borderRadius: 4, background: '#fff' }}>✕ Remove selected</button>}
          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: checks.some(c => c.severity === 'error') ? C.danger : '#7a7'}}>
            {checks.filter(c => c.severity === 'error').length ? `${checks.filter(c => c.severity === 'error').length} issue(s)` : items.length ? '✓ layout clean' : 'drag walls · click dims to type · place cabinets from the catalog →'}
          </span>
        </div>
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
                <line x1={f.x} y1={f.y} x2={e.x} y2={e.y} stroke={C.wall} strokeWidth={WALL_T} strokeLinecap="square" />
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
              </g>
            );
          })}
          {/* gap dimensions — leftover run space (floor band always; upper band when an upper is selected) */}
          {gapDims.filter(g => g.band === 'floor' || (selItem && bandOf(selItem) === 'upper')).map((g, i) => {
            const f = fr[g.wallIdx];
            const perp = g.band === 'floor' ? 2 + BASE_D + 9 : 2 + UPPER_D + 6;
            const mid = toWorld(f, (g.start + g.end) / 2, perp);
            const a = toWorld(f, g.start, perp), b = toWorld(f, g.end, perp);
            return (
              <g key={`gap${i}`} pointerEvents="none">
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#c9b873" strokeWidth={0.5} strokeDasharray="2,2" />
                <rect x={mid.x - 13} y={mid.y - 6} width={26} height={11} rx={2} fill="#fffbe9" stroke="#d8c89a" strokeWidth={0.5} />
                <text x={mid.x} y={mid.y + 2.5} fontSize={6.5} textAnchor="middle" fill="#8a6d1a" fontFamily="Helvetica">{fmtIn(g.end - g.start)}</text>
              </g>
            );
          })}
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
            const col = bad ? C.danger : '#2e7d32';
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
              </g>
            );
          })()}
        </svg>
        {/* issues strip */}
        {checks.filter(c => c.severity === 'error').slice(0, 3).map((c, i) => (
          <div key={i} style={{ padding: '4px 12px', fontSize: 11, color: C.danger, borderTop: '1px solid #f3e0dc', background: '#fdf5f3' }}>⚠ {c.message}</div>
        ))}
      </div>

      {/* ════ CATALOG BROWSER ════ */}
      {!roomOnly && <div style={{ border: '1px solid #e4ddd2', borderRadius: 8, background: '#faf8f5', maxHeight: 640, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #eee7dc' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
            {brand === 'shiloh' ? 'Shiloh' : 'Eclipse'} Catalog
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search SKU… (e.g. B24, SB36, W3036)"
            style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <select value={cat} onChange={e => { setCat(e.target.value); setSearch(''); }} style={{ flex: 1, fontSize: 11, padding: 4 }}>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={widthF} onChange={e => setWidthF(e.target.value)} placeholder="width" type="number"
              style={{ width: 64, fontSize: 11, padding: 4, border: '1px solid #ddd', borderRadius: 4 }} />
          </div>
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
              style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 11.5,
                background: armed?.sku === r.sku ? '#c8a96e22' : 'transparent', borderBottom: '1px solid #f1ece4' }}>
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
