/**
 * Manual Design Core — the "I'll design it" mode.
 * ================================================
 * A second PRODUCER of placements: the designer places cabinets by hand
 * (2020-style) and this module wraps them into the exact result shape the
 * solver emits, so every downstream consumer — pricing, floor plan,
 * elevations, 3D, order package, readiness — works untouched.
 *
 * Item: { id, sku, wall, position, width, zone:'base'|'upper'|'tall'|'appliance',
 *         height, depth, applianceType? }
 */
import { findOfficial } from '../../eclipse-pricing/src/officialV88.js';
import { findShilohSku } from '../../eclipse-pricing/src/shilohSkuCatalog.js';
import { findSku } from '../../eclipse-pricing/src/skuCatalog.js';

let _id = 1;
export const newId = () => 'mi_' + (_id++) + '_' + Math.random().toString(36).slice(2, 6);

// ── Dimensions & zone for any SKU (official data first, nomenclature fallback) ──
const CAT_ZONE = { B: 'base', BC: 'base', GB: 'base', GBC: 'base', V: 'base', T: 'tall', GT: 'tall', W: 'upper', WC: 'upper', BK: 'tall', GV: 'base' };

export function skuInfo(sku, brand = 'eclipse') {
  const s = String(sku || '').toUpperCase().replace(/^FC-/, '');
  const off = findOfficial(sku);
  if (off && off.w) {
    const zone = CAT_ZONE[off.cat] || (s.startsWith('W') ? 'upper' : 'base');
    return { w: off.w, d: off.d || (zone === 'upper' ? 13 : 24), h: off.h || (zone === 'upper' ? 36 : zone === 'tall' ? 90 : 34.5), zone, official: true };
  }
  // Nomenclature: width digits after the family prefix; W-family encodes WxH.
  let zone = 'base', d = 24, h = 34.5;
  if (/^(RW)/.test(s)) zone = 'upper';
  else if (/^(W|SW)/.test(s) && !/^WND.*BASE/.test(s)) zone = 'upper';
  if (/^(U|UT|O\d|OM|FIO|FIOM|PANT|LIN)/.test(s)) zone = 'tall';
  if (zone === 'upper') { d = 13; h = 36; }
  if (zone === 'tall') { d = 24; h = 93; }
  let w = 24;
  const m = s.match(/^[A-Z/]+?(\d{1,2})(?:\s*1\/2)?(\d{2})?(?:$|[^0-9])/);
  if (m) {
    const a = parseInt(m[1], 10);
    if (m[2] && zone !== 'base') { w = a; h = parseInt(m[2], 10); }       // W3036 → 30w × 36h
    else if (m[2] && a <= 4 && /^B\d D|^B\dD/.test(s)) { w = parseInt(m[2], 10); } // B3D24 → 24
    else w = m[2] && a < 10 ? parseInt(m[1] + m[2], 10) <= 48 ? parseInt(m[1] + m[2], 10) : a : a;
  }
  const m2 = s.match(/(\d{2})(?:-|$)/);
  if ((!m || w < 6 || w > 60) && m2) w = parseInt(m2[1], 10);
  return { w: Math.min(60, Math.max(6, w)), d, h, zone, official: false };
}

export function priceLookup(sku, brand) {
  return brand === 'shiloh' ? findShilohSku(sku) : findSku(sku);
}

/** Corner units (lazy susans, blind corners, diagonal walls) get a dedicated
 *  corner drop target. Official categories first, nomenclature fallback. */
export function isCornerSku(sku) {
  const off = findOfficial(sku);
  if (off && off.cat) return ['BC', 'WC', 'GBC'].includes(off.cat);
  return /^(FC-)?(LS|BLB|BBC|WDC|EZ|CW\d)/i.test(String(sku || ''));
}

// ── Placement creation & movement ──
export function makeItem(sku, wall, position, brand) {
  const info = skuInfo(sku, brand);
  return { id: newId(), sku, wall, position: Math.max(0, position), width: info.w, depth: info.d, height: info.h, zone: info.zone };
}

export function makeAppliance(applianceType, wall, position, width) {
  const dims = { range: 30, cooktop: 36, dishwasher: 24, refrigerator: 36, sink: 33 }[applianceType] || 30;
  return { id: newId(), sku: null, wall, position: Math.max(0, position), width: width || dims, depth: 24, height: applianceType === 'refrigerator' ? 84 : 34.5, zone: 'appliance', applianceType };
}

/** Panels, fillers, and end treatments legitimately coincide with cabinets/
 *  appliances (they're surrounds) — they ride a non-blocking layer. */
const PANEL_RE = /^(F\d|OVF|SCRIBE|3SRM|REP|BEP|WEP|FWEP|FBEP|VEP|EDG|PNL|DWP|FDP|GRILLE)/i;
export const isPanelItem = (it) => (it.sku && PANEL_RE.test(String(it.sku).replace(/^FC-/, ''))) || (it.width || 0) < 1.6;

/** Zones that compete for the same floor/wall band. */
export const bandOf = (it) => isPanelItem(it) ? 'panel' : (it.zone === 'upper' ? 'upper' : 'floor');

/** Vertical extent — uppers carry a mounting height (default 54" datum). */
export const yRangeOf = (it) => {
  const y0 = it.zone === 'upper' ? (it.yMount ?? 54) : 0;
  return [y0, y0 + (it.height || (it.zone === 'upper' ? 36 : it.zone === 'tall' ? 93 : 34.5))];
};

/** Two items compete for space when they share a band — and, for uppers,
 *  when their mounting heights actually intersect (stacked cabinets don't). */
export const competes = (a, b) => {
  if (bandOf(a) !== bandOf(b)) return false;
  if (bandOf(a) !== 'upper') return true;
  const [a0, a1] = yRangeOf(a), [b0, b1] = yRangeOf(b);
  return a0 < b1 - 0.01 && a1 > b0 + 0.01;
};

/** Snap + clamp a moving item against its wall neighbors (flush-butt under 1.5"). */
export function settleItem(items, wallLen, moving) {
  let pos = Math.max(0, Math.min(moving.position, wallLen - moving.width));
  const others = items.filter(i => i.id !== moving.id && i.wall === moving.wall && competes(i, moving))
    .sort((a, b) => a.position - b.position);
  // snap flush to nearest edges
  for (const o of others) {
    const oEnd = o.position + o.width;
    if (Math.abs(pos - oEnd) < 1.5) pos = oEnd;
    if (Math.abs((pos + moving.width) - o.position) < 1.5) pos = o.position - moving.width;
  }
  pos = Math.round(pos * 2) / 2; // ½" grid
  pos = Math.max(0, Math.min(pos, wallLen - moving.width));
  // resolve remaining overlaps by sliding to the nearest free gap
  const overlaps = (p) => others.some(o => p < o.position + o.width - 0.01 && p + moving.width > o.position + 0.01);
  if (overlaps(pos)) {
    for (let step = 0.5; step <= wallLen; step += 0.5) {
      if (pos + step + moving.width <= wallLen && !overlaps(pos + step)) { pos = pos + step; break; }
      if (pos - step >= 0 && !overlaps(pos - step)) { pos = pos - step; break; }
    }
  }
  return { ...moving, position: pos };
}

/**
 * Bump-and-slide for live dragging: the item stays inside the gap the cursor
 * is over and STOPS flush against neighbors/wall ends instead of jumping —
 * the "professional CAD feel" (2020/Chief Architect collision model).
 * `free` (Ctrl/Cmd held) bypasses neighbor collision but still clamps to the wall.
 */
export function slideItem(items, wallLen, moving, opts = {}) {
  const want = Math.max(0, Math.min(moving.position, wallLen - moving.width));
  if (opts.free || isPanelItem(moving)) {
    return { ...moving, position: Math.round(want * 2) / 2 };
  }
  const others = items.filter(i => i.id !== moving.id && i.wall === moving.wall && competes(i, moving))
    .sort((a, b) => a.position - b.position);
  // Build the free gaps along the wall, then clamp the wanted position into
  // the gap that contains (or is nearest to) the cursor's target center.
  const gaps = [];
  let edge = 0;
  for (const o of others) {
    if (o.position > edge + 0.01) gaps.push([edge, o.position]);
    edge = Math.max(edge, o.position + o.width);
  }
  if (wallLen > edge + 0.01) gaps.push([edge, wallLen]);
  if (!gaps.length) return { ...moving };           // wall solid — stay put
  const center = want + moving.width / 2;
  const nearest = (list) => list.reduce((best, g) => {
    const mid = (g[0] + g[1]) / 2;
    const d = center >= g[0] && center <= g[1] ? 0 : Math.abs(center - mid);
    return !best || d < best.d ? { g, d } : best;
  }, null).g;
  // A cabinet can only occupy a gap it FITS — too-small slots are skipped
  // (2020's collision model), so dragging never creates an overlap.
  const fitGaps = gaps.filter(([s, e]) => e - s >= moving.width - 0.01);
  if (fitGaps.length) {
    const [gs, ge] = nearest(fitGaps);
    let pos = Math.max(gs, Math.min(want, ge - moving.width));
    pos = Math.round(pos * 2) / 2;
    pos = Math.max(gs, Math.min(pos, ge - moving.width));
    return { ...moving, position: pos };
  }
  // Nothing fits anywhere on this band: butt flush to the favored side of the
  // nearest gap and let the checks flag the unavoidable overlap.
  const [gs, ge] = nearest(gaps);
  let pos = (center - gs < ge - center) ? gs : ge - moving.width;
  pos = Math.round(Math.max(0, Math.min(pos, wallLen - moving.width)) * 2) / 2;
  return { ...moving, position: pos };
}

/**
 * Validity report for ONE candidate placement (the live ghost): returns
 * [] when clean, else short human reasons. Mirrors manualChecks' rules.
 */
export function placementIssues(walls, items, cand) {
  const issues = [];
  const w = walls.find(x => x.id === cand.wall);
  if (!w) return ['no wall under cursor'];
  if (cand.width > w.length + 0.01) issues.push(`wider than wall ${w.id} (${w.length}")`);
  else if (cand.position < -0.125 || cand.position + cand.width > w.length + 0.125) issues.push(`extends past wall ${w.id}`);
  if (!isPanelItem(cand)) {
    const clash = items.find(i => i.id !== cand.id && i.wall === cand.wall && competes(i, cand)
      && cand.position < i.position + i.width - 0.01 && cand.position + cand.width > i.position + 0.01);
    if (clash) issues.push(`overlaps ${clash.sku || clash.applianceType}`);
  }
  for (const op of (w.openings || [])) {
    const oStart = op.position ?? op.posFromLeft ?? 0, oEnd = oStart + (op.width || 0);
    const hit = cand.position < oEnd - 0.1 && cand.position + cand.width > oStart + 0.1;
    if (!hit) continue;
    if (op.type !== 'window') issues.push(`sits in the ${op.type} opening`);
    else if (cand.zone === 'upper' || cand.zone === 'tall') issues.push('covers the window');
  }
  return issues;
}

/**
 * Contextual placement snaps (AutoKitchen "other insertions"): sink bases pull
 * to window centers, uppers/hoods pull to the range/cooktop center below.
 * Returns { item, hint } — hint set only when a snap applied.
 */
export function contextSnap(walls, items, it) {
  const w = walls.find(x => x.id === it.wall);
  if (!w) return { item: it };
  const center = it.position + it.width / 2;
  const clampPos = (pos) => Math.max(0, Math.min(Math.round(pos * 2) / 2, w.length - it.width));
  const sku = String(it.sku || '').replace(/^FC-/, '');
  const isSink = it.applianceType === 'sink' || /^(VSB|SB\d|SBA|FSB|GSB)/i.test(sku);
  if (isSink) {
    for (const op of (w.openings || [])) {
      if (op.type !== 'window') continue;
      const oc = (op.position ?? op.posFromLeft ?? 0) + (op.width || 36) / 2;
      if (Math.abs(center - oc) < 15) {
        return { item: { ...it, position: clampPos(oc - it.width / 2) }, hint: 'centered on window' };
      }
    }
  }
  if (it.zone === 'upper') {
    const stove = items.find(i => i.wall === it.wall && (i.applianceType === 'range' || i.applianceType === 'cooktop'));
    if (stove) {
      const sc = stove.position + stove.width / 2;
      if (Math.abs(center - sc) < 15) {
        return { item: { ...it, position: clampPos(sc - it.width / 2) }, hint: 'centered over range' };
      }
    }
  }
  return { item: it };
}

/**
 * Insert-between with neighbor shift (no kitchen tool does this well): when a
 * cabinet doesn't fit the gap under the cursor but the RUN has slack, ripple
 * the neighbors outward — right side first — to open exactly enough room.
 * Returns { items, position, shifted } or null when impossible/unneeded.
 */
export function insertWithShift(items, wallLen, cand) {
  const others = items.filter(i => i.id !== cand.id && i.wall === cand.wall && competes(i, cand))
    .sort((a, b) => a.position - b.position);
  if (!others.length) return null;
  const center = cand.position + cand.width / 2;
  const left = others.filter(o => o.position + o.width / 2 <= center);
  const right = others.filter(o => o.position + o.width / 2 > center);
  const leftEdge = left.length ? left[left.length - 1].position + left[left.length - 1].width : 0;
  const rightEdge = right.length ? right[0].position : wallLen;
  const deficit = cand.width - (rightEdge - leftEdge);
  if (deficit <= 0.01) return null;                       // already fits — no shift needed
  const rightSlackMax = (wallLen - right.reduce((s, o) => s + o.width, 0)) - rightEdge;
  const leftSlackMax = leftEdge - left.reduce((s, o) => s + o.width, 0);
  if (deficit > rightSlackMax + leftSlackMax + 0.01) return null;   // run is physically full
  const pushR = Math.min(deficit, rightSlackMax);
  const pushL = deficit - pushR;
  const moved = new Map();
  // ripple the right chain rightward: only items that must move, move
  let edge = rightEdge + pushR;
  for (const o of right) {
    const np = Math.max(o.position, edge);
    if (np !== o.position) moved.set(o.id, np);
    edge = np + o.width;
  }
  // ripple the left chain leftward
  edge = leftEdge - pushL;
  for (let i = left.length - 1; i >= 0; i--) {
    const o = left[i];
    const np = Math.min(o.position, edge - o.width);
    if (np !== o.position) moved.set(o.id, np);
    edge = np;
  }
  const position = Math.round((leftEdge - pushL) * 2) / 2;
  const shifted = moved.size;
  if (!shifted) return null;
  return {
    items: items.map(i => moved.has(i.id) ? { ...i, position: moved.get(i.id) } : i),
    position, shifted,
  };
}

// ── Validation (flag, never auto-fix — a pro may break a rule deliberately) ──
export function manualChecks(walls, items) {
  const v = [];
  const push = (severity, rule, message, wall) => v.push({ severity, rule, message, wall, manual: true });
  for (const w of walls) {
    const wallItems = items.filter(i => i.wall === w.id);
    for (const band of ['floor', 'upper']) {   // 'panel' band intentionally unchecked
      const list = wallItems.filter(i => bandOf(i) === band).sort((a, b) => a.position - b.position);
      for (let i = 1; i < list.length; i++) {
        for (let j = 0; j < i; j++) {
          if (!competes(list[i], list[j])) continue;   // stacked uppers at different heights coexist
          const gap = list[i].position - (list[j].position + list[j].width);
          if (gap < -0.125) push('error', 'manual_overlap', `Wall ${w.id}: ${list[i].sku || list[i].applianceType} overlaps ${list[j].sku || list[j].applianceType} by ${(-gap).toFixed(2)}"`, w.id);
        }
      }
      const last = list[list.length - 1];
      if (last && last.position + last.width > w.length + 0.125) push('error', 'manual_overflow', `Wall ${w.id}: run extends ${(last.position + last.width - w.length).toFixed(2)}" past the wall`, w.id);
    }
    // openings: doors/archways block everything; windows block uppers/talls
    for (const op of (w.openings || [])) {
      const oStart = op.position ?? op.posFromLeft ?? 0, oEnd = oStart + (op.width || 0);
      for (const it of wallItems) {
        const hit = it.position < oEnd - 0.1 && it.position + it.width > oStart + 0.1;
        if (!hit) continue;
        if (op.type !== 'window') push('error', 'manual_opening_conflict', `Wall ${w.id}: ${it.sku || it.applianceType} sits in the ${op.type} opening`, w.id);
        else if (it.zone === 'upper' || it.zone === 'tall') push('error', 'manual_window_conflict', `Wall ${w.id}: ${it.sku} covers the window`, w.id);
      }
    }
  }
  // advisory: DW adjacent to sink
  const sink = items.find(i => i.applianceType === 'sink' || /^SB|^VSB|^SBA/.test(i.sku || ''));
  const dw = items.find(i => i.applianceType === 'dishwasher');
  if (sink && dw && (sink.wall !== dw.wall || Math.abs((dw.position + dw.width / 2) - (sink.position + sink.width / 2)) > 60)) {
    push('warning', 'manual_dw_sink', 'Dishwasher is not adjacent to the sink (NKBA: within reach of the sink).', dw.wall);
  }
  return v;
}

// ── Adapter: wrap manual items into the solver-result shape every view consumes ──
export function buildManualResult({ walls, items, island, roomType = 'kitchen', layoutType }) {
  const lt = layoutType || (walls.length >= 3 ? 'u-shape' : walls.length === 2 ? 'l-shape' : 'single-wall');
  const toCab = (it) => ({
    sku: it.sku, width: it.width, position: it.position,
    type: it.zone === 'appliance' ? 'appliance' : it.zone === 'tall' ? 'tall' : 'base',
    applianceType: it.applianceType,
    _manualId: it.id,
    _elev: it.zone === 'upper'
      ? { zone: 'UPPER', yMount: it.yMount ?? 54, height: it.height || 36, depth: it.depth || 13, depthSetback: 11, yTop: (it.yMount ?? 54) + (it.height || 36) }
      : it.zone === 'tall'
        ? { zone: 'TALL', yMount: 0, height: it.height || 93, depth: it.depth || 24, yTop: it.height || 93 }
        : { zone: it.zone === 'appliance' ? 'APPLIANCE' : 'BASE', yMount: 0, height: it.height || 34.5, depth: it.depth || 24, yTop: it.height || 34.5 },
  });
  const wallLayouts = walls.map(w => ({
    wallId: w.id, id: w.id, length: w.length, wallLength: w.length, turn: w.turn,
    cabinets: items.filter(i => i.wall === w.id && (i.zone === 'base' || i.zone === 'appliance')).map(toCab),
  }));
  const uppers = walls.map(w => ({
    wallId: w.id,
    cabinets: items.filter(i => i.wall === w.id && i.zone === 'upper').map(toCab),
  }));
  const talls = items.filter(i => i.zone === 'tall').map(it => ({ ...toCab(it), wall: it.wall, height: it.height || 93 }));
  const placements = items.map(it => ({ ...toCab(it), wall: it.wall, qty: 1 }));
  const totalCabinets = items.filter(i => i.zone !== 'appliance').length;
  return {
    layoutType: lt, roomType,
    walls: wallLayouts, uppers, upperCorners: [], talls,
    island: island && island.length ? { length: island.length, depth: island.depth || 42, overhang: island.overhang || 12 } : null,
    peninsula: null, corners: [], accessories: [],
    placements,
    validation: manualChecks(walls, items),
    _inputWalls: walls,
    metadata: { totalCabinets, manual: true },
    applianceRecommendation: null,
    _manual: true,
  };
}

/** Seed manual items from a solved result (the hybrid "edit what the solver made"). */
export function seedFromSolverResult(result) {
  const items = [];
  const seen = new Set();
  const dedupe = (it) => {
    // Over-fridge RW cabinets can be emitted by two solver paths with
    // different height codes (RW3612-27 in uppers, RW3621 in talls) at the
    // same spot — dedupe the family by position, not the exact code.
    const fam = /^RW/i.test(String(it.sku || '').replace(/^FC-/, '')) ? 'RW' : it.sku;
    const k = `${it.wall}|${fam}|${Math.round((it.position || 0) * 2)}`;
    if (it.sku && seen.has(k)) return false;
    seen.add(k); return true;
  };
  for (const wl of (result.walls || [])) {
    for (const c of (wl.cabinets || [])) {
      if (typeof c.position !== 'number' || !(c.width > 0)) continue;
      const isApp = c.type === 'appliance' || !!c.applianceType;
      const cand = ({
        id: newId(), sku: c.sku || null, wall: wl.wallId || wl.id,
        position: c.position, width: c.width,
        depth: c._elev?.depth || 24, height: c._elev?.height || (c.type === 'tall' ? 93 : 34.5),
        zone: isApp && !c.sku ? 'appliance' : (c._elev?.zone === 'TALL' || c.type === 'tall') ? 'tall' : 'base',
        applianceType: c.applianceType,
      });
      if (dedupe(cand)) items.push(cand);
    }
  }
  for (const ul of (result.uppers || [])) {
    for (const c of (ul.cabinets || [])) {
      if (typeof c.position !== 'number' || !(c.width > 0)) continue;
      const cand = ({
        id: newId(), sku: c.sku, wall: ul.wallId || ul.id,
        position: c.position, width: c.width,
        depth: c._elev?.depth || 13, height: c._elev?.height || c.height || 36,
        yMount: c._elev?.yMount ?? 54,
        zone: 'upper',
      });
      if (dedupe(cand)) items.push(cand);
    }
  }
  for (const t of (result.talls || [])) {
    if (typeof t.position !== 'number') continue;
    const cand = ({
      id: newId(), sku: t.sku, wall: t.wall || t.wallId,
      position: t.position, width: t.width || 24,
      depth: t._elev?.depth || 24, height: t._elev?.height || t.height || 93,
      zone: (t._elev?.zone === 'ABOVE_TALL' || (t._elev?.yMount || 0) > 60) ? 'upper' : 'tall',
      yMount: t._elev?.yMount,
    });
    if (dedupe(cand)) items.push(cand);
  }
  // Corner units (lazy susans, blind corners) live in result.corners — seed
  // them anchored at the end of their wallA run.
  for (const c of (result.corners || [])) {
    if (!c.sku || !c.wallA) continue;
    const wallLen = (result.walls || []).find(w => (w.wallId || w.id) === c.wallA)?.wallLength || 0;
    const size = c.wallAConsumption || c.size || 36;
    items.push({
      id: newId(), sku: c.sku, wall: c.wallA,
      position: Math.max(0, wallLen - size), width: size,
      depth: 24, height: 34.5, zone: 'base',
    });
  }
  return items;
}
