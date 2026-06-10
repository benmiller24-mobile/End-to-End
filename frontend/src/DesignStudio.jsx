import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { OFFICIAL_V88 } from '../../eclipse-pricing/src/officialV88.js';
import { SHILOH_CATALOG } from '../../eclipse-pricing/src/shilohSkuCatalog.js';
import { findSku } from '../../eclipse-pricing/src/skuCatalog.js';
import { makeItem, makeAppliance, settleItem, skuInfo, priceLookup, manualChecks } from './manualDesign.js';

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
function frames(walls) {
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
    const price = findSku(sku)?.p ?? null;
    rows.push({ sku, price, w: e.w, h: e.h, zone: ({ W: 'upper', WC: 'upper', T: 'tall', GT: 'tall', BK: 'tall' })[e.cat] || 'base',
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

export default function DesignStudio({ walls, onWallsChange, items, onItemsChange, brand = 'eclipse', ghost = null, mode = 'full' }) {
  const roomOnly = mode === 'room';
  const svgRef = useRef(null);
  const [sel, setSel] = useState(null);             // selected item id | 'op:wallIdx:opIdx'
  const [armed, setArmed] = useState(null);          // {sku} | {applianceType,width} awaiting placement
  const [editDim, setEditDim] = useState(null);      // {wallIdx, value}
  const [drag, setDrag] = useState(null);
  const [cat, setCat] = useState('Base');
  const [search, setSearch] = useState('');
  const [widthF, setWidthF] = useState('');

  const fr = useMemo(() => frames(walls), [walls]);
  const all = useMemo(() => catalogList(brand), [brand]);
  const cats = useMemo(() => [...new Set(all.map(r => r.cat))].sort(), [all]);
  const list = useMemo(() => {
    let rows = all.filter(r => r.cat === cat);
    if (search) { const q = search.toUpperCase(); rows = all.filter(r => r.sku.toUpperCase().includes(q)); }
    if (widthF) rows = rows.filter(r => Math.abs((r.w || 0) - Number(widthF)) < 0.6);
    return rows.slice(0, 60);
  }, [all, cat, search, widthF]);

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
      onWallsChange(ws);
    } else if (drag.kind === 'item') {
      const it = items.find(i => i.id === drag.id); if (!it) return;
      const hit = nearestWall(p); if (!hit) return;
      const wallLen = walls[hit.i].length;
      let next = { ...it, wall: walls[hit.i].id, position: hit.along - it.width / 2 };
      next = settleItem(items, wallLen, next);
      onItemsChange(items.map(i => i.id === it.id ? next : i));
    } else if (drag.kind === 'opening') {
      const w = walls[drag.wallIdx]; const f = fr[drag.wallIdx];
      const ops = [...(w.openings || [])];
      const op = { ...ops[drag.opIdx] };
      const newPos = Math.max(0, Math.min(w.length - (op.width || 36), Math.round((projectOnWall(f, p) - (op.width || 36) / 2) * 2) / 2));
      op.position = newPos; op.posFromLeft = newPos;
      ops[drag.opIdx] = op;
      onWallsChange(walls.map((ww, i) => i === drag.wallIdx ? { ...ww, openings: ops } : ww));
    }
  }, [drag, fr, walls, items, onWallsChange, onItemsChange, svgPoint, projectOnWall, nearestWall]);

  const onPointerUp = useCallback(() => setDrag(null), []);
  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => { window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); };
  }, [onPointerMove, onPointerUp]);

  const onCanvasClick = useCallback((evt) => {
    if (!armed) { setSel(null); return; }
    const p = svgPoint(evt);
    const hit = nearestWall(p);
    if (!hit || hit.dist > 60) return;
    const wallLen = walls[hit.i].length;
    let it = armed.applianceType
      ? makeAppliance(armed.applianceType, walls[hit.i].id, hit.along - (armed.width || 30) / 2, armed.width)
      : makeItem(armed.sku, walls[hit.i].id, hit.along - (skuInfo(armed.sku, brand).w) / 2, brand);
    it = settleItem(items, wallLen, it);
    onItemsChange([...items, it]);
    if (!evt.shiftKey) setArmed(null);   // hold shift to place several
  }, [armed, items, walls, brand, svgPoint, nearestWall, onItemsChange]);

  // delete key
  useEffect(() => {
    const h = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
        onItemsChange(items.filter(i => i.id !== sel)); setSel(null);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [sel, items, onItemsChange]);

  const checks = useMemo(() => manualChecks(walls, items), [walls, items]);

  const addWall = () => onWallsChange([...walls, { id: String.fromCharCode(65 + walls.length), length: 96, role: 'general' }].slice(0, 4));
  const removeWall = () => {
    if (walls.length <= 1) return;
    const gone = walls[walls.length - 1].id;
    onWallsChange(walls.slice(0, -1));
    onItemsChange(items.filter(i => i.wall !== gone));
  };

  // ── render ──
  const itemFill = (it) => it.zone === 'upper' ? C.upper : it.zone === 'tall' ? C.tall : it.zone === 'appliance' ? C.appliance : C.base;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: roomOnly ? '1fr' : '1fr 290px', gap: 14, alignItems: 'start' }}>
      {/* ════ CANVAS ════ */}
      <div style={{ border: '1px solid #e4ddd2', borderRadius: 8, background: C.bg, position: 'relative' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #eee7dc', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Design Studio</span>
          <button onClick={addWall} style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 4, background: '#fff' }}>+ Wall</button>
          <button onClick={removeWall} style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: '1px solid #ddd', borderRadius: 4, background: '#fff' }}>− Wall</button>
          {armed && <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>Placing {armed.sku || armed.applianceType} — click a wall (Shift = place multiple, Esc = cancel)</span>}
          {sel && <button onClick={() => { onItemsChange(items.filter(i => i.id !== sel)); setSel(null); }}
            style={{ fontSize: 11, padding: '3px 9px', cursor: 'pointer', border: `1px solid ${C.danger}`, color: C.danger, borderRadius: 4, background: '#fff' }}>✕ Remove selected</button>}
          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: checks.some(c => c.severity === 'error') ? C.danger : '#7a7'}}>
            {checks.filter(c => c.severity === 'error').length ? `${checks.filter(c => c.severity === 'error').length} issue(s)` : items.length ? '✓ layout clean' : 'drag walls · click dims to type · place cabinets from the catalog →'}
          </span>
        </div>
        <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ width: '100%', height: 'auto', maxHeight: 560, touchAction: 'none', cursor: armed ? 'crosshair' : 'default' }}
          onClick={onCanvasClick} onKeyDown={e => e.key === 'Escape' && setArmed(null)} tabIndex={0}>
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
                      onBlur={(ev) => { const v = parseFloat(ev.target.value); if (v >= 24) onWallsChange(walls.map((ww, i) => i === wi ? { ...ww, length: Math.round(v * 8) / 8 } : ww)); setEditDim(null); }}
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
              <span style={{ color: '#777', fontVariantNumeric: 'tabular-nums' }}>{r.price != null ? `$${Number(r.price).toLocaleString()}` : '—'}</span>
            </div>
          ))}
          {!list.length && <div style={{ padding: 12, fontSize: 12, color: '#999' }}>No matches — adjust search or category.</div>}
        </div>
        <div style={{ padding: '8px 12px', borderTop: '1px solid #eee7dc', fontSize: 10, color: '#999' }}>
          Click a cabinet, then click a wall to place it. Bases/talls share the floor band; wall cabinets (dashed) ride above. Drag to move · Delete key removes.
        </div>
      </div>}
    </div>
  );
}
