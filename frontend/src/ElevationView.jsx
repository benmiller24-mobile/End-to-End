import React, { useMemo } from 'react';
import { DOORS } from '../../eclipse-pricing/src/doorData.js';
import { MaterialDefs, classifyStone, woodFill, stoneFill, steelFill } from './MaterialDefs.jsx';

// Eclipse 8.8 catalog door geometry by code (panel type + rail width from paf.xml).
const DOOR_BY_CODE = Object.fromEntries(DOORS.map(d => [d.v, d]));

/**
 * ElevationView — Professional Architectural Kitchen Elevation (NKBA Ch.12)
 * =========================================================================
 * Produces Cyncly 2020 / Flex–grade wall elevation drawings:
 *   - Shaker 5-piece door panels with inner raised panel + hardware dots
 *   - Diagonal/blind corner cabinet faces
 *   - Crown molding profile (not flat rect), light rail, LIGHT CONCEAL labels
 *   - 3/4" SCRIBE annotations at wall terminals
 *   - Filler strips visually distinct (hatched)
 *   - REP (Refrigerator End Panel) with label
 *   - NKBA KD-prefix circle tags
 *   - Dimension strings top + bottom, vertical dims right side
 *   - Hood with FIXED PANEL / VENT HOOD labels
 *   - Appliance labels (RANGE, DW, OVEN, REF, SINK)
 *
 * Data contract (from solver):
 *   solverResult.walls    → [{wallId, cabinets:[{position, width, sku, type, role, applianceType, _elev}]}]
 *   solverResult.uppers   → [{wallId, cabinets:[{position, width, height, sku, type, role}]}]
 *   solverResult.talls    → [{wall, position, width, height, sku, type, applianceType}]
 *   solverResult.corners  → [{wallA, wallB, sku, size, type, wallAConsumption, wallBConsumption}]
 *   solverResult._inputWalls → [{id, length, ceilingHeight}]
 */

// ─── SCALE & DIMENSIONS ──────────────────────────────────────────────
const S = 2.2;                      // SVG px per inch
const TOEKICK     = 4.5;            // toekick height
const BASE_BOX    = 30;             // base cabinet box (34.5 - 4.5)
const CTR_THICK   = 1.5;            // countertop slab
const SPLASH_GAP  = 18;             // backsplash gap (counter-top to upper-bottom)
const UPPER_H_DEF = 36;             // default upper cabinet height
const TALL_H_DEF  = 96;             // default tall cabinet height
const CROWN_H     = 3.5;            // crown molding profile height
const LR_H        = 1.75;           // light rail height (1 3/4")
const SCRIBE_W    = 0.75;           // 3/4" scribe strip width
const FILLER_MIN  = 3;              // minimum filler width to show hatching

// Counter AFF: TOEKICK + BASE_BOX + CTR_THICK = 4.5 + 30 + 1.5 = 36"
// Upper bottom AFF: 36 + 18 = 54"

// ─── COLORS ──────────────────────────────────────────────────────────
const C = {
  bg:           '#ffffff',
  line:         '#1a1a1a',           // heavy cabinet outline
  thinLine:     '#444444',           // door/drawer panel lines
  dimLine:      '#333333',           // dimension lines
  dimText:      '#222222',           // dimension text
  fill:         '#fafafa',           // cabinet face fill
  ctrFill:      '#d8d4cf',           // countertop
  toekick:      '#111111',           // toekick (very dark)
  backsplash:   '#f0eeeb',           // subtle backsplash band
  applFill:     '#f2f2f2',           // appliance background
  hoodFill:     '#e6e3df',           // hood body
  tagFill:      '#ffffff',           // circle tag fill
  tagStroke:    '#222222',           // circle tag outline
  floor:        '#000000',           // floor line
  crownFill:    '#e8e5e0',           // crown molding fill
  lrFill:       '#b5afa6',           // light rail fill
  fillerFill:   '#f5f3f0',           // filler strip
  fillerHatch:  '#cccccc',           // filler hatch lines
  scribeColor:  '#888888',           // scribe annotation
  repFill:      '#f0ede8',           // REP panel fill
  annotColor:   '#555555',           // annotation text (LIGHT CONCEAL, etc.)
  hwColor:      '#888888',           // hardware (knob/pull) dots
};

// ─── HELPERS ─────────────────────────────────────────────────────────

/** Format inches as fractional string */
function fmt(inches) {
  if (inches == null) return '';
  const whole = Math.floor(inches);
  const frac = inches - whole;
  if (frac < 0.03) return `${whole}"`;
  const fracs = [
    [0.125, '⅛'], [0.25, '¼'], [0.375, '⅜'], [0.5, '½'],
    [0.625, '⅝'], [0.75, '¾'], [0.875, '⅞'],
  ];
  for (const [v, sym] of fracs) {
    if (Math.abs(frac - v) < 0.03) return whole > 0 ? `${whole}${sym}"` : `${sym}"`;
  }
  return `${Math.round(inches * 100) / 100}"`;
}

/** Detect if a cabinet is a filler or scribe */
function isFiller(cab) {
  const sku = (cab.sku || '').toUpperCase();
  const role = (cab.role || '').toLowerCase();
  return role === 'filler' || role === 'corner-filler' || role === 'scribe'
    || sku.startsWith('BF') || sku.startsWith('QUIKFILL')
    || sku.startsWith('QUIKTRAY') || sku.includes('FILL');
}

/** Detect if cabinet is a REP (Refrigerator End Panel) */
function isREP(cab) {
  const sku = (cab.sku || '').toUpperCase();
  return sku.startsWith('REP') || (cab.role || '') === 'rep';
}

/** Detect if cabinet is an appliance */
function isAppliance(cab) {
  return cab.type === 'appliance' || !!cab.applianceType;
}

/** Appliance label text */
function appLabel(aType) {
  const map = {
    range: 'RANGE', cooktop: 'COOKTOP', refrigerator: 'REF',
    dishwasher: 'DW', wallOven: 'OVEN', speedOven: 'SPEED OVEN',
    steamOven: 'STEAM OVEN', sink: 'SINK', microwave: 'MW',
    warmingDrawer: 'WARM DR', wineCooler: 'WINE', wineColumn: 'WINE COL',
    beverageCenter: 'BEV CTR', iceMaker: 'ICE', freezer: 'FREEZER',
    wine: 'WINE', coffee: 'COFFEE', hood: 'HOOD',
  };
  return map[aType] || (aType || '').toUpperCase().substring(0, 8);
}

/** Parse cabinet height from Cyncly Flex SKU.
 *  Wall cabs: W{width}{height} → W3630 = 30" tall, W3642 = 42" tall
 *  Stacked:   SW{width}{height}
 *  Tall:      UT{width}{height} or OT{width}{height}
 *  Returns null if height can't be parsed (caller uses default). */
function parseSkuHeight(sku) {
  if (!sku) return null;
  const upper = sku.toUpperCase().replace(/^FC-/, '');
  // Wall cabinet: W{2-3 digit width}{2 digit height}[L|R]
  const wMatch = upper.match(/^S?W(\d{2,3})(\d{2})(?:[LR]|-|$)/);
  if (wMatch) {
    const h = parseInt(wMatch[2]);
    if (h >= 12 && h <= 63) return h;
  }
  // WBC: WBC{w}{h}
  const wbcMatch = upper.match(/^WBC(\d{2})(\d{2})$/);
  if (wbcMatch) {
    const h = parseInt(wbcMatch[2]);
    if (h >= 12 && h <= 48) return h;
  }
  // Tall/utility: U or O followed by digits (U36102, O30102)
  if (/^[UO]\d/.test(upper)) {
    const afterPrefix = upper.replace(/^[UO]/, '');
    const digits = afterPrefix.match(/^(\d+)/);
    if (digits) {
      const allDigits = digits[1];
      if (allDigits.length === 5) return parseInt(allDigits.slice(2)); // 36102 → 102
      if (allDigits.length === 4) return parseInt(allDigits.slice(2)); // 3696 → 96
      if (allDigits.length === 3) return parseInt(allDigits.slice(1)); // 384 → 84
    }
  }
  // Legacy UT/OT format
  const tMatch = upper.match(/^[UO]T(\d{2,3})(\d{2,3})(?:-|$)/);
  if (tMatch) {
    const h = parseInt(tMatch[2]);
    if (h >= 72 && h <= 108) return h;
  }
  return null;
}

/** Parse door/drawer count from SKU pattern */
function parseDoorDrawer(sku, width) {
  if (!sku) return { doors: width > 24 ? 2 : 1, drawers: 1 };
  const s = sku.toUpperCase().replace(/^FC-/, '');
  // Full-height door variant: tall single panel, no drawer/false front (check first)
  if (/-FHD/.test(s)) return { doors: width > 24 ? 2 : 1, drawers: 0 };
  // All-drawer bases (catalog: B3D = 3-drawer, B4D = 4-drawer, B2TD = 2 tiered drawers)
  if (/^B3D/.test(s)) return { doors: 0, drawers: 3 };
  if (/^B4D/.test(s)) return { doors: 0, drawers: 4 };
  if (/^B2TD/.test(s)) return { doors: 0, drawers: 2 };
  // Sink bases: catalog SB cabinets have a FALSE drawer front on top + doors below
  // (the -FHD full-height-door variant handled above has none).
  if (/^SB|^BSB|^IWS|^IBS|^DSB/.test(s)) return { doors: width > 24 ? 2 : 1, drawers: 1, falseFront: true };
  // Roll-out tray, pull-out shelf: door only
  if (/-RT/.test(s) || /^BPOS/.test(s)) return { doors: 1, drawers: 0 };
  // Range top base: open frame
  if (/^RTB/.test(s)) return { doors: 0, drawers: 0 };
  // Blind base corner: 1 door, 1 drawer on exposed face
  if (/^BBC/.test(s)) return { doors: 1, drawers: 1 };
  // Lazy Susan: 2 bi-fold doors, no drawer
  if (/^BL\d/.test(s)) return { doors: 2, drawers: 0 };
  // Tray base
  if (/^BTR/.test(s)) return { doors: width > 24 ? 2 : 1, drawers: 1 };
  // Legacy drawer base format
  const dbMatch = s.match(/B(\d?)DB/);
  if (dbMatch) return { doors: 0, drawers: parseInt(dbMatch[1] || '3') };
  // Fillers, panels — no doors or drawers
  if (/^F\d|^OVF|^BEP|^WEP|^REP|^DP$/.test(s)) return { doors: 0, drawers: 0 };
  // Standard base cabinets
  if (width >= 39) return { doors: 2, drawers: 2 };
  if (width > 24) return { doors: 2, drawers: 1 };
  return { doors: 1, drawers: 1 };
}


// ═══════════════════════════════════════════════════════════════════════
// HINGE-SIDE ASSIGNMENT  (which side the hinge goes on; pull = opposite side)
//
// Synthesized from NKBA guidance + kitchen-design industry convention
// (Bradco, Home Decorators/Home Depot, JLC, Cabinet Joint). Rules, by force:
//   1. Swing AWAY from an adjacent appliance (fridge, range, cooktop, DW, oven
//      tower) — the open door parks clear of the appliance and its own door,
//      and the pull lands on the side you stand to work. → hinge on the FAR side.
//   2. Hinge AT a wall / return / end panel / run end — the free (latch) edge
//      then opens away from the wall and the door can't collide with it.
//   3. Sink-flanking single doors hinge AWAY from the sink (reach the bowl
//      without walking around the open door).
//   4. Pairs hinge on the OUTER edges (handled in CabFront, the "X").
//   5. No constraint → hinge toward the nearer run end (traffic-flow default).
// ═══════════════════════════════════════════════════════════════════════

/** Classify a wall neighbor for hinge decisions. */
function hingeNeighborClass(item) {
  if (!item) return 'end';                          // end of run → acts like a wall
  if (isAppliance(item)) return 'appliance';        // fridge/range/cooktop/DW/oven
  const sku  = (item.sku || '').toUpperCase();
  const role = (item.role || '').toLowerCase();
  const zf   = (item.zoneFunction || '').toLowerCase();
  if (/^SB|^BSB|^IWS|^IBS|^DSB/.test(sku) || role.includes('sink')) return 'sink';
  if (isREP(item) || isFiller(item) || item._isCorner || item.isCorner
      || /^BEP|^WEP|^REP|PANEL/.test(sku)) return 'wall';
  return 'cabinet';
}

/** Hinge side ('left'|'right') for a single-door cabinet from its neighbors. */
function computeHingeSide(leftItem, rightItem, isFirst, isLast) {
  const L = isFirst ? 'end' : hingeNeighborClass(leftItem);
  const R = isLast  ? 'end' : hingeNeighborClass(rightItem);
  let left = 0, right = 0;
  // Walls / returns / ends: hinge TOWARD them (rule 2)
  if (L === 'end' || L === 'wall') left  += 2;
  if (R === 'end' || R === 'wall') right += 2;
  // Appliances: hinge AWAY (rule 1) — strongest force
  if (L === 'appliance') right += 3;
  if (R === 'appliance') left  += 3;
  // Sink: hinge AWAY (rule 3)
  if (L === 'sink') right += 1.5;
  if (R === 'sink') left  += 1.5;
  if (left === right) {                              // rule 5: nearer run end
    if (isFirst && !isLast) return 'left';
    if (isLast && !isFirst) return 'right';
    return 'left';
  }
  return left > right ? 'left' : 'right';
}


/** Close small unintended gaps so cabinets in a run sit flush.
 *  The solver can leave sub-inch packing slivers (e.g. a 41.25" cab ending
 *  0.75" short of its neighbor) with no filler occupying them. Snap the left
 *  cabinet's right edge to meet the next so the run reads flush. Large gaps
 *  (appliance removed, window, open run) are preserved. Returns NEW objects so
 *  both the cabinet rects and the dimension chain (which read .position/.width)
 *  stay consistent. */
const SNAP_MAX_GAP = 2.0;   // inches — close gaps up to this; keep bigger ones
function snapRunFlush(items) {
  if (!items || items.length < 2) return items;
  const out = items.map(c => ({ ...c }));
  for (let i = 0; i < out.length - 1; i++) {
    const gap = out[i + 1].position - (out[i].position + out[i].width);
    if (Math.abs(gap) < 0.01 || Math.abs(gap) > SNAP_MAX_GAP) continue;
    if (!isAppliance(out[i])) {
      out[i].width += gap;                 // grow/trim left cab to meet next
    } else {
      out[i + 1].position -= gap;          // left side is an appliance — grow
      out[i + 1].width    += gap;          // the right cab leftward instead
    }
  }
  return out;
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: CabTag — NKBA KD-prefix numbered circle tag
// ═══════════════════════════════════════════════════════════════════════

function CabTag({ cx, cy, num, prefix = 'KD' }) {
  const r = 8;
  const label = `${prefix}${num}`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r}
        fill={C.tagFill} stroke={C.tagStroke} strokeWidth={0.7} />
      {/* Horizontal leader line stub */}
      <line x1={cx - r} y1={cy} x2={cx - r - 4} y2={cy}
        stroke={C.tagStroke} strokeWidth={0.4} />
      <text x={cx} y={cy + 1.8} fill={C.dimText}
        fontSize={label.length > 4 ? 3.2 : label.length > 3 ? 3.6 : 4.2}
        fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="700">{label}</text>
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: CabFront — Shaker 5-piece door with raised inner panel
// ═══════════════════════════════════════════════════════════════════════

// Map an Eclipse door-style code to a render spec (catalog door-style section B1-B4).
//  slab (Metropolitan): flat door, no inner panel
//  flat (Shaker/Hanover/Arch-Flat/Crown-Flat): recessed flat panel
//  raised (Arch/Crown Raised Panel): panel with a bevel field
//  Arch/Crown styles carry a 4 1/2" top rail (others 2 1/2")
function doorStyleSpec(code) {
  // Catalog-driven: look the style up in the Eclipse 8.8 door table for its real
  // panel type (flat | raised | slab | mitered | applied | reeded | mullion) and
  // rail width. Falls back to a heuristic for any unknown code.
  const d = DOOR_BY_CODE[code] || DOOR_BY_CODE[(code || '').toUpperCase()];
  if (d && d.panel) {
    const arch = /^A(FP|RP)/.test(d.v) || /Arch/i.test(d.l || '');
    return { panel: d.panel, topRail: d.rail || 2.5, arch };
  }
  const c = (code || '').toUpperCase();
  if (/MET|SLAB/.test(c)) return { panel: 'slab', topRail: 2.5 };
  const archCrown = /^(A|C)(FP|RP|GFD)/.test(c) || /ARCH|CROWN/.test(c);
  const raised = /RP/.test(c) && !/FP/.test(c);
  return { panel: raised ? 'raised' : 'flat', topRail: archCrown ? 4.5 : 2.5, arch: archCrown };
}

// Draw the recessed panel + door-style marks for ONE face, honoring the
// selected door style (slab = nothing). Shared by CabFront and the sink-base
// branch of ApplianceSym so every front follows the chosen Eclipse door style.
function pushStylePanel(els, key, fx, fy, fw, fh, styleSpec = { panel: 'flat', topRail: 2.5 }, isDoor = false) {
  const REVEAL = 0.094 * S, RAIL = 2.5 * S;
  const ax = fx + REVEAL, ay = fy + REVEAL, aw = fw - 2 * REVEAL, ah = fh - 2 * REVEAL;
  const topRail = (isDoor ? (styleSpec.topRail || 2.5) : 2.5) * S;
  const px = fx + RAIL, py = fy + topRail, pw = fw - 2 * RAIL, ph = fh - topRail - RAIL;
  if (styleSpec.panel === 'slab' || pw <= 3 || ph <= 3) return;
  const pt = styleSpec.panel;
  els.push(<rect key={`${key}p`} x={px} y={py} width={pw} height={ph}
    fill="#000000" fillOpacity={0.06} stroke={C.thinLine} strokeOpacity={0.45} strokeWidth={0.22} rx={0.2} />);
  // soft inner shadow (top/left) + highlight (bottom/right) for recess depth
  els.push(<line key={`${key}sh`} x1={px} y1={py} x2={px + pw} y2={py} stroke="#000" strokeWidth={0.3} opacity={0.12} />);
  els.push(<line key={`${key}hl`} x1={px} y1={py + ph} x2={px + pw} y2={py + ph} stroke="#fff" strokeWidth={0.3} opacity={0.18} />);
  if (pt === 'raised' && pw > 6 && ph > 6) {
    const b = 1.1 * S;
    // raised field: lighter than the recess, with a bevel highlight on top/left
    els.push(<rect key={`${key}pr`} x={px + b} y={py + b} width={pw - 2 * b} height={ph - 2 * b}
      fill="#ffffff" fillOpacity={0.10} stroke={C.thinLine} strokeOpacity={0.35} strokeWidth={0.18} rx={0.2} />);
    els.push(<line key={`${key}bv`} x1={px + b} y1={py + ph - b} x2={px + pw - b} y2={py + ph - b} stroke="#000" strokeWidth={0.25} opacity={0.12} />);
  } else if (pt === 'mitered') {
    [[ax, ay, px, py], [ax + aw, ay, px + pw, py],
     [ax, ay + ah, px, py + ph], [ax + aw, ay + ah, px + pw, py + ph]]
      .forEach(([x1, y1, x2, y2], k) => els.push(
        <line key={`${key}mt${k}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={C.thinLine} strokeWidth={0.18} opacity={0.45} />));
  } else if (pt === 'applied' && pw > 5 && ph > 5) {
    const m = 0.9 * S;
    els.push(<rect key={`${key}am`} x={px + m} y={py + m} width={pw - 2 * m} height={ph - 2 * m}
      fill="none" stroke={C.thinLine} strokeWidth={0.2} opacity={0.4} rx={0.15} />);
  } else if (pt === 'reeded') {
    const n = Math.max(3, Math.floor(pw / (1.6 * S)));
    for (let i = 1; i < n; i++) {
      const rx = px + (pw * i) / n;
      els.push(<line key={`${key}rd${i}`} x1={rx} y1={py} x2={rx} y2={py + ph}
        stroke={C.thinLine} strokeWidth={0.16} opacity={0.35} />);
    }
  }
}

function CabFront({ x, y, w, h, doors, drawers, isCorner, cornerSide, isUpper, hinge = 'left', falseFront = false, styleSpec = { panel: 'flat', topRail: 2.5 }, frontFill = C.fill }) {
  const els = [];
  const pad = 1.8 * S;   // stile/rail width (visual inset from cabinet edge to door panel)

  // Outer cabinet box
  els.push(
    <rect key="box" x={x} y={y} width={w} height={h}
      fill={frontFill} stroke={C.line} strokeWidth={0.7} />
  );

  // For corner cabinets in elevation, draw diagonal line indicating corner angle
  if (isCorner) {
    if (cornerSide === 'left') {
      // Diagonal from top-left to some offset point — indicates blind left
      els.push(
        <line key="diag" x1={x} y1={y} x2={x + Math.min(w * 0.35, 8 * S)} y2={y + h}
          stroke={C.thinLine} strokeWidth={0.5} strokeDasharray="3,2" />
      );
    } else if (cornerSide === 'right') {
      els.push(
        <line key="diag" x1={x + w} y1={y} x2={x + w - Math.min(w * 0.35, 8 * S)} y2={y + h}
          stroke={C.thinLine} strokeWidth={0.5} strokeDasharray="3,2" />
      );
    }
  }

  // ── FRONTS (Eclipse 8.8.0 spec: frameless full-overlay, 3/32" reveals,
  //    2 1/2" shaker rails, catalog drawer-face heights from page H3/I1) ──
  const REVEAL = 0.094 * S;        // 3/32" reveal around every front (full overlay)
  const RAIL   = 2.5 * S;          // 2 1/2" shaker frame rail width
  const innerH = h - 2 * REVEAL;
  const boxIn  = h / S;            // box height in inches
  const isDrawerStack = doors === 0 && drawers > 0;

  // Catalog drawer-face proportions:
  //   3-drawer base → 6" top, 10 3/4" x2 ;  4-drawer base → 6" x3, 8 3/4" bottom
  const drawerFacesIn = (n) => {
    if (n === 3) return [6, 10.75, 10.75];
    if (n === 4) return [6, 6, 6, 8.75];
    if (n === 2) return [6, Math.max(6, boxIn - 6)];   // B2TD: small top, large bottom (catalog I13)
    return Array.from({ length: n }, () => boxIn / n);
  };

  // Draw one full-overlay front. Panel style per door style:
  //  slab → no inner panel; flat → recessed panel; raised → panel + bevel field.
  //  Doors carry the style's top rail (2 1/2" or 4 1/2" arch/crown); drawers use 2 1/2".
  const drawFront = (key, fx, fy, fw, fh, pull, isDoor = false) => {
    const ax = fx + REVEAL, ay = fy + REVEAL, aw = fw - 2 * REVEAL, ah = fh - 2 * REVEAL;
    if (aw <= 0 || ah <= 0) return;
    els.push(<rect key={key} x={ax} y={ay} width={aw} height={ah}
      fill="none" stroke={C.thinLine} strokeWidth={0.4} rx={0.3} />);
    pushStylePanel(els, key, fx, fy, fw, fh, styleSpec, isDoor);
    if (pull === 'bar') {
      const pw2 = Math.min(aw * 0.28, 5 * S);
      els.push(<line key={`${key}h`} x1={ax + aw / 2 - pw2 / 2} y1={ay + ah / 2}
        x2={ax + aw / 2 + pw2 / 2} y2={ay + ah / 2}
        stroke={C.hwColor} strokeWidth={0.5} strokeLinecap="round" />);
    }
  };

  // Cells tile the box exactly; each front insets REVEAL → 3/32" at box edges,
  // 3/16" between adjacent fronts (full-overlay reveals).
  // DRAWERS — stack fills the box (catalog proportions); drawer-over-door = 6" top band
  let cursorY = y;
  if (drawers > 0) {
    if (isDrawerStack) {
      const faces = drawerFacesIn(drawers);
      const total = faces.reduce((a, b) => a + b, 0);
      faces.forEach((f, i) => {
        const fh = (f / total) * h;
        drawFront(`dr${i}`, x, cursorY, w, fh, 'bar');
        cursorY += fh;
      });
    } else {
      // single 6" top drawer; cabinets over 36" wide get 2 side-by-side drawers.
      // A sink-base false front is one full-width panel with no pull.
      const fh = 6 * S;
      const splits = (!falseFront && (w / S) > 36) ? 2 : 1;
      for (let s = 0; s < splits; s++) drawFront(`dr0_${s}`, x + s * (w / splits), cursorY, w / splits, fh, falseFront ? null : 'bar');
      cursorY += fh;
    }
  }

  // DOORS — fill remaining height below the drawer band
  const doorY = cursorY;
  const doorH = (y + h) - cursorY;
  if (doors > 0 && doorH > 3 * S) {
    const dc = doors;
    const dw = w / dc;
    for (let i = 0; i < dc; i++) {
      const dx = x + i * dw;
      drawFront(`d${i}`, dx, doorY, dw, doorH, null, true);
      // door-swing notation over the visible (full-overlay) door panel
      const ix = dx + REVEAL, iw = dw - 2 * REVEAL, iy = doorY + REVEAL, ih = doorH - 2 * REVEAL;
      const hingeLeft = dc === 2 ? (i === 0) : (hinge !== 'right');
      const apexX = hingeLeft ? ix : ix + iw;
      const latchX = hingeLeft ? ix + iw : ix;
      const apexY = iy + ih / 2;
      els.push(<line key={`sw1${i}`} x1={latchX} y1={iy} x2={apexX} y2={apexY}
        stroke={C.thinLine} strokeWidth={0.3} opacity={0.55} />);
      els.push(<line key={`sw2${i}`} x1={latchX} y1={iy + ih} x2={apexX} y2={apexY}
        stroke={C.thinLine} strokeWidth={0.3} opacity={0.55} />);
      const knobX = hingeLeft ? ix + iw - 1.4 * S : ix + 1.4 * S;
      const knobY = isUpper ? iy + ih - 3 * S : iy + 3 * S;
      els.push(<circle key={`k${i}`} cx={knobX} cy={knobY} r={0.8} fill={C.hwColor} stroke="none" />);
    }
  }

  return <>{els}</>;
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: FillerStrip — Hatched filler visualization
// ═══════════════════════════════════════════════════════════════════════

function FillerStrip({ x, y, w, h, label }) {
  const id = `fh_${Math.round(x)}_${Math.round(y)}`;
  return (
    <g>
      <defs>
        <pattern id={id} width={3} height={3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={3} stroke={C.fillerHatch} strokeWidth={0.3} />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h}
        fill={C.fillerFill} stroke={C.line} strokeWidth={0.5} />
      <rect x={x} y={y} width={w} height={h}
        fill={`url(#${id})`} stroke="none" />
      {label && w > 3 * S && (
        <text x={x + w / 2} y={y + h / 2 + 1.5} fill={C.annotColor}
          fontSize={3} fontFamily="Helvetica,Arial,sans-serif"
          textAnchor="middle" fontWeight="500" writingMode="tb"
          transform={`rotate(-90, ${x + w / 2}, ${y + h / 2})`}>
          {label}
        </text>
      )}
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: REPPanel — Refrigerator End Panel visualization
// ═══════════════════════════════════════════════════════════════════════

function REPPanel({ x, y, w, h }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill={C.repFill} stroke={C.line} strokeWidth={0.6} />
      {/* Vertical grain lines */}
      {Array.from({ length: Math.floor(w / (1.5 * S)) }, (_, i) => {
        const lx = x + (i + 1) * 1.5 * S;
        return lx < x + w - 1 ? (
          <line key={`g${i}`} x1={lx} y1={y + 2} x2={lx} y2={y + h - 2}
            stroke={C.fillerHatch} strokeWidth={0.15} opacity={0.35} />
        ) : null;
      })}
      <text x={x + w / 2} y={y + h / 2 + 1.5} fill={C.annotColor}
        fontSize={3.2} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="600"
        transform={h > 40 * S ? `rotate(-90, ${x + w / 2}, ${y + h / 2})` : undefined}>
        REP
      </text>
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: ApplianceSym — Appliance symbol in elevation
// ═══════════════════════════════════════════════════════════════════════

function ApplianceSym({ x, y, w, h, aType, styleSpec = { panel: 'flat', topRail: 2.5 }, steelFill = '#e9ecef', frontFill = C.applFill }) {
  const els = [];
  const STEEL = new Set(['range','refrigerator','freezer','dishwasher','wallOven','speedOven','steamOven','warmingDrawer','microwave','coffee','wine']);
  const WOODCAB = new Set(['sink','cooktop']);
  const faceFill = WOODCAB.has(aType) ? frontFill : (STEEL.has(aType) ? steelFill : C.applFill);
  els.push(
    <rect key="bg" x={x} y={y} width={w} height={h}
      fill={faceFill} stroke={C.line} strokeWidth={0.6} />
  );

  const m = 3 * S;

  if (aType === 'range') {
    // FRONT elevation of a slide-in/freestanding range: a control rail at the
    // top, then a large oven door with a handle and glass window.
    const ctrlH = 3.5 * S;
    els.push(
      <rect key="ctrl" x={x + 1 * S} y={y + 1 * S} width={w - 2 * S} height={ctrlH}
        fill="none" stroke={C.line} strokeWidth={0.4} />
    );
    const nk = Math.max(2, Math.min(5, Math.round(w / (6 * S))));
    for (let i = 0; i < nk; i++) {
      els.push(
        <circle key={`kn${i}`} cx={x + (i + 0.5) * (w / nk)} cy={y + 1 * S + ctrlH / 2} r={0.9}
          fill="none" stroke={C.line} strokeWidth={0.35} />
      );
    }
    const doorY = y + 1 * S + ctrlH + 1 * S;
    const doorH = (y + h - 1.5 * S) - doorY;
    els.push(
      <rect key="door" x={x + 1.5 * S} y={doorY} width={w - 3 * S} height={doorH}
        fill="none" stroke={C.line} strokeWidth={0.5} rx={0.4} />
    );
    els.push(
      <line key="hdl" x1={x + 2.5 * S} y1={doorY + 1.6 * S} x2={x + w - 2.5 * S} y2={doorY + 1.6 * S}
        stroke={C.line} strokeWidth={0.7} strokeLinecap="round" />
    );
    els.push(
      <rect key="win" x={x + 3.5 * S} y={doorY + 3.5 * S}
        width={w - 7 * S} height={Math.max(0, doorH - 6 * S)}
        fill="#33383d" stroke={C.line} strokeWidth={0.3} rx={0.4} />
    );
    // glass reflection streak
    els.push(
      <line key="refl" x1={x + 4.5 * S} y1={doorY + 4.5 * S}
        x2={x + 4.5 * S} y2={doorY + Math.max(0, doorH - 3 * S)}
        stroke="#ffffff" strokeWidth={0.5} opacity={0.18} strokeLinecap="round" />
    );
  } else if (aType === 'cooktop') {
    // A cooktop drops into the counter, so the FRONT shows the base cabinet
    // (drawers) below it — not burners viewed from above.
    const rows = 2;
    const dh = (h - 2 * S) / rows;
    for (let r2 = 0; r2 < rows; r2++) {
      const dy = y + 1 * S + r2 * dh;
      els.push(
        <rect key={`dr${r2}`} x={x + 1.5 * S} y={dy + 0.4} width={w - 3 * S} height={dh - 0.8}
          fill="none" stroke={C.thinLine} strokeWidth={0.4} rx={0.3} />
      );
      const pullW = Math.min((w - 3 * S) * 0.25, 5 * S);
      els.push(
        <line key={`p${r2}`} x1={x + w / 2 - pullW / 2} y1={dy + dh / 2}
          x2={x + w / 2 + pullW / 2} y2={dy + dh / 2}
          stroke={C.hwColor} strokeWidth={0.5} strokeLinecap="round" />
      );
    }
  } else if (aType === 'refrigerator' || aType === 'freezer') {
    // French door split
    els.push(
      <line key="vsplit" x1={x + w / 2} y1={y + 2 * S}
        x2={x + w / 2} y2={y + h * 0.58}
        stroke={C.line} strokeWidth={0.35} />
    );
    // Horizontal divider (upper/lower)
    els.push(
      <line key="hsplit" x1={x + 2 * S} y1={y + h * 0.6}
        x2={x + w - 2 * S} y2={y + h * 0.6}
        stroke={C.line} strokeWidth={0.4} />
    );
    // Left handle
    els.push(
      <line key="hdlL" x1={x + w / 2 - 2 * S} y1={y + 6 * S}
        x2={x + w / 2 - 2 * S} y2={y + h * 0.55}
        stroke={C.line} strokeWidth={0.45} />
    );
    // Right handle
    els.push(
      <line key="hdlR" x1={x + w / 2 + 2 * S} y1={y + 6 * S}
        x2={x + w / 2 + 2 * S} y2={y + h * 0.55}
        stroke={C.line} strokeWidth={0.45} />
    );
    // Bottom drawer handle
    els.push(
      <line key="hdlB" x1={x + w * 0.3} y1={y + h * 0.72}
        x2={x + w * 0.7} y2={y + h * 0.72}
        stroke={C.line} strokeWidth={0.45} />
    );
  } else if (aType === 'wine') {
    // Wine column: glass door with horizontal rack slats + vertical handle
    els.push(
      <rect key="glass" x={x + 1.5 * S} y={y + 2 * S} width={w - 3 * S} height={h - 4 * S}
        fill="#cdd9e4" stroke={C.line} strokeWidth={0.4} opacity={0.5} rx={0.4} />
    );
    const slats = Math.max(4, Math.floor((h - 4 * S) / (3.5 * S)));
    for (let i = 1; i < slats; i++) {
      const sy = y + 2 * S + i * (h - 4 * S) / slats;
      els.push(<line key={`rack${i}`} x1={x + 1.5 * S} y1={sy} x2={x + w - 1.5 * S} y2={sy}
        stroke={C.thinLine} strokeWidth={0.3} opacity={0.6} />);
    }
    els.push(<line key="whdl" x1={x + w - 2.5 * S} y1={y + 5 * S} x2={x + w - 2.5 * S} y2={y + h * 0.5}
      stroke={C.line} strokeWidth={0.5} strokeLinecap="round" />);
  } else if (aType === 'coffee') {
    // Built-in coffee machine: control strip, central dispenser, two spouts
    els.push(<rect key="panel" x={x + 1.5 * S} y={y + 1.5 * S} width={w - 3 * S} height={2.2 * S}
      fill="#e8e8e8" stroke={C.line} strokeWidth={0.3} rx={0.3} />);
    els.push(<rect key="disp" x={x + w * 0.32} y={y + 4.5 * S} width={w * 0.36} height={h - 8 * S}
      fill="#d8d8d8" stroke={C.line} strokeWidth={0.35} rx={0.3} />);
    els.push(<line key="sp1" x1={x + w * 0.44} y1={y + h - 4 * S} x2={x + w * 0.44} y2={y + h - 2.5 * S} stroke={C.line} strokeWidth={0.5} />);
    els.push(<line key="sp2" x1={x + w * 0.56} y1={y + h - 4 * S} x2={x + w * 0.56} y2={y + h - 2.5 * S} stroke={C.line} strokeWidth={0.5} />);
  } else if (aType === 'dishwasher') {
    // Handle bar — at the TOP only (just below the counter). Dishwashers have a
    // single top-mounted handle / control strip; there is no handle at the bottom.
    els.push(
      <line key="hdl" x1={x + w * 0.18} y1={y + 2.2 * S}
        x2={x + w * 0.82} y2={y + 2.2 * S}
        stroke={C.line} strokeWidth={0.6} strokeLinecap="round" />
    );
    // Recessed door panel below the handle, down to the toe kick.
    els.push(
      <rect key="door" x={x + 2.5 * S} y={y + 4 * S}
        width={w - 5 * S} height={h - 5.5 * S}
        fill="none" stroke={C.thinLine} strokeWidth={0.35} rx={0.3} />
    );
  } else if (aType === 'wallOven' || aType === 'speedOven' || aType === 'steamOven') {
    const d = 2 * S;
    // Oven door outline
    els.push(
      <rect key="door" x={x + d} y={y + d} width={w - 2 * d} height={h - 2 * d}
        fill="none" stroke={C.line} strokeWidth={0.4} />
    );
    // Glass window
    const wi = 4 * S;
    els.push(
      <rect key="win" x={x + wi} y={y + wi}
        width={w - 2 * wi} height={(h - 2 * wi) * 0.5}
        fill="#e8e8e8" stroke={C.line} strokeWidth={0.3} rx={0.5} />
    );
    // Handle
    els.push(
      <line key="hdl" x1={x + wi} y1={y + h - d - 2 * S}
        x2={x + w - wi} y2={y + h - d - 2 * S}
        stroke={C.line} strokeWidth={0.5} strokeLinecap="round" />
    );
  } else if (aType === 'sink') {
    // FRONT elevation of a sink BASE cabinet: a tilt-out false drawer front at
    // the top (no real drawer — the bowl is behind it) over two doors below.
    // The bowl/faucet are NOT visible in a front elevation (they're on top).
    const falseH = 4.5 * S;                      // tilt-out false-front band
    els.push(
      <rect key="ff" x={x + 1.5 * S} y={y + 1 * S} width={w - 3 * S} height={falseH}
        fill="none" stroke={C.thinLine} strokeWidth={0.4} rx={0.3} />
    );
    pushStylePanel(els, "ff", x + 1.5 * S, y + 1 * S, w - 3 * S, falseH, styleSpec, false);
    // Two doors below
    const doorY = y + 1 * S + falseH + 1 * S;
    const doorH = (y + h - 1.5 * S) - doorY;
    if (doorH > 2 * S) {
      const gap = 0.8;
      const dw = (w - 3 * S - gap) / 2;
      for (let i = 0; i < 2; i++) {
        const dx = x + 1.5 * S + i * (dw + gap);
        els.push(
          <rect key={`d${i}`} x={dx} y={doorY} width={dw} height={doorH}
            fill="none" stroke={C.thinLine} strokeWidth={0.4} rx={0.3} />
        );
        pushStylePanel(els, `d${i}`, dx, doorY, dw, doorH, styleSpec, true);
        // Knob near the TOP inner corner (base doors)
        const knobX = i === 0 ? dx + dw - 2.5 * S : dx + 2.5 * S;
        els.push(
          <circle key={`k${i}`} cx={knobX} cy={doorY + 2.5 * S} r={0.8} fill={C.hwColor} stroke="none" />
        );
      }
    }
  } else if (aType === 'warmingDrawer') {
    els.push(
      <rect key="face" x={x + 2 * S} y={y + 2 * S}
        width={w - 4 * S} height={h - 4 * S}
        fill="none" stroke={C.thinLine} strokeWidth={0.35} rx={0.3} />
    );
    els.push(
      <line key="hdl" x1={x + w * 0.3} y1={y + h / 2}
        x2={x + w * 0.7} y2={y + h / 2}
        stroke={C.line} strokeWidth={0.5} strokeLinecap="round" />
    );
  }

  return <>{els}</>;
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: ScribeAnnotation — 3/4" SCRIBE label at wall terminals
// ═══════════════════════════════════════════════════════════════════════

function ScribeAnnotation({ x, y1, y2, side = 'left' }) {
  const sw = SCRIBE_W * S;
  const xPos = side === 'left' ? x : x - sw;
  const midY = (y1 + y2) / 2;
  return (
    <g>
      {/* Scribe strip */}
      <rect x={xPos} y={y1} width={sw} height={y2 - y1}
        fill={C.fillerFill} stroke={C.scribeColor} strokeWidth={0.3}
        strokeDasharray="1.5,1" />
      {/* Annotation line + text */}
      <line x1={side === 'left' ? xPos - 2 : xPos + sw + 2} y1={midY}
        x2={side === 'left' ? xPos - 14 : xPos + sw + 14} y2={midY}
        stroke={C.scribeColor} strokeWidth={0.3} />
      <text x={side === 'left' ? xPos - 15 : xPos + sw + 15} y={midY + 1.2}
        fill={C.scribeColor}
        fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor={side === 'left' ? 'end' : 'start'} fontWeight="500">
        ¾" SCRIBE
      </text>
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: CrownProfile — Crown molding cross-section profile
// ═══════════════════════════════════════════════════════════════════════

function CrownSegment({ x1, x2, y, height }) {
  const h = height != null ? height : CROWN_H * S;
  // Profile: bottom-left, cove curve up, ogee top, straight to right, mirror
  const w = x2 - x1;
  return (
    <g>
      {/* Main crown body */}
      <path d={`M ${x1} ${y + h}
        L ${x1} ${y + h * 0.4}
        Q ${x1} ${y} ${x1 + h * 0.5} ${y}
        L ${x2 - h * 0.5} ${y}
        Q ${x2} ${y} ${x2} ${y + h * 0.4}
        L ${x2} ${y + h}
        Z`}
        fill={C.crownFill} stroke={C.line} strokeWidth={0.4} />
      {/* Detail line (cove profile step) */}
      <line x1={x1 + 1} y1={y + h * 0.6} x2={x2 - 1} y2={y + h * 0.6}
        stroke={C.thinLine} strokeWidth={0.2} opacity={0.5} />
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: LightRailSegment — Light rail under upper cabinets
// ═══════════════════════════════════════════════════════════════════════

function LightRailSegment({ x1, x2, y }) {
  const h = LR_H * S;
  return (
    <g>
      <rect x={x1} y={y} width={x2 - x1} height={h}
        fill={C.lrFill} stroke={C.line} strokeWidth={0.35} />
      {/* Small detail bead at bottom edge */}
      <line x1={x1} y1={y + h - 0.5} x2={x2} y2={y + h - 0.5}
        stroke={C.thinLine} strokeWidth={0.25} opacity={0.6} />
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// SINGLE WALL ELEVATION RENDERER
// ═══════════════════════════════════════════════════════════════════════

function WallElev({ wallId, wallLen, ceilH = 96, bases, uppers, talls, hood, openings = [], trim = {}, tagStart = 1, debug = false, styleSpec = { panel: 'flat', topRail: 2.5 }, species = 'White Oak', stone = null }) {
  const sfx = String(wallId).replace(/[^A-Za-z0-9]/g, '') || 'w';
  const frontFill = woodFill(sfx);
  const steel = steelFill(sfx);
  const ctrPat = stone ? stoneFill(sfx) : C.ctrFill;
  const wW = wallLen * S;
  const cH = ceilH * S;
  const topMargin = 45;         // space above ceiling for dims
  const botDim = 65;            // space below floor for dims
  const rightDim = 120;         // space right for vertical dims
  const leftMargin = 65;        // space left for scribe annotations
  const floorY = cH + topMargin;

  // ── Y POSITIONS (measured from floor up) ──
  const tkTopY   = floorY - TOEKICK * S;                            // top of toekick
  const baseTopY = floorY - (TOEKICK + BASE_BOX) * S;               // top of base box
  const ctrTopY  = baseTopY - CTR_THICK * S;                        // top of countertop
  const upBotY   = floorY - (TOEKICK + BASE_BOX + CTR_THICK + SPLASH_GAP) * S; // bottom of uppers = 54" AFF
  const ceilY    = topMargin;                                        // ceiling line
  // upperTopY (the common top datum) is computed below, after talls are sorted.

  // ── FILTER VALID PLACEMENTS ──
  const validBases  = bases.filter(b => typeof b.position === 'number' && b.position >= 0 && b.width > 0);
  const validUppers = uppers.filter(u => typeof u.position === 'number' && u.position >= 0 && u.width > 0 && u.type !== 'end_panel');
  const validTalls  = talls.filter(t => typeof t.position === 'number' && t.position >= 0 && t.width > 0
    // Over-tall wall cabinets (above the fridge) belong to the upper pass, not here.
    && !(t._elev?.zone === 'ABOVE_TALL' || (t._elev?.yMount || 0) > 60));

  // Sort by position
  const sortedBases  = snapRunFlush([...validBases].sort((a, b) => a.position - b.position));
  const sortedUppers = snapRunFlush([...validUppers].sort((a, b) => a.position - b.position));
  const sortedTalls  = snapRunFlush([...validTalls].sort((a, b) => a.position - b.position));

  // ══════════ COMMON UPPER-TOP DATUM ══════════
  // STRUCTURAL: every wall cabinet — and the tops of tall cabinets and refrigerator
  // end panels — aligns to ONE top line, the way a real shop drawing reads. We
  // anchor uppers by their TOP (not their bottom), so cabinets of differing heights
  // (a standard upper, a short over-fridge cabinet, a tall pantry) share a top edge.
  // The line sits at the tallest real CABINET top present (tall units / REP fridge
  // surrounds), or the standard upper top (54" + default height) when there are none,
  // capped at the ceiling. Over-appliance cabinets do NOT drive the line up — they
  // clamp down to it — so a to-ceiling over-fridge cabinet can't stretch the whole
  // run of wall cabinets to the ceiling; instead it aligns with them.
  const _tallTops = sortedTalls.map(t => (t._elev?.height || t.height || TALL_H_DEF));
  const upperTopAFF = Math.min(ceilH, Math.max(54 + UPPER_H_DEF, ..._tallTops));
  const upperTopY = floorY - upperTopAFF * S;   // common top line (screen y)
  const upTopY = upperTopY;                       // alias used by crown fallback

  // ── TAG NUMBERING (sequential: talls → bases → uppers) ──
  let tagNum = tagStart;
  const taggedItems = [];
  sortedTalls.forEach(c => taggedItems.push({ ...c, _tag: tagNum++, _zone: 'tall' }));
  sortedBases.forEach(c => taggedItems.push({ ...c, _tag: tagNum++, _zone: 'base' }));
  sortedUppers.forEach(c => taggedItems.push({ ...c, _tag: tagNum++, _zone: 'upper' }));

  // ── BUILD UPPER SEGMENTS (for crown/light rail that skip hoods) ──
  function buildUpperSegments() {
    const allU = [...validUppers];
    if (hood) allU.push({ ...hood, _isHood: true });
    const sorted = allU
      .filter(c => typeof c.position === 'number' && c.width > 0)
      .sort((a, b) => a.position - b.position);

    const segs = [];
    let segS = null, segE = null, segTopY = null;
    for (const cab of sorted) {
      const skip = cab._isHood || cab.role === 'range_hood' || cab.type === 'rangeHood'
        || (cab.applianceType || '') === 'microwave'
        // Over-tall cabinets (above the fridge) mount near the ceiling — the
        // light rail / crown band must NOT run across them.
        || cab._elev?.zone === 'ABOVE_TALL' || (cab._elev?.yMount || 0) > 60;
      if (skip) {
        if (segS !== null) { segs.push({ s: segS, e: segE, topY: segTopY }); segS = null; }
        continue;
      }
      const cs = cab.position;
      const ce = cab.position + (cab.width || 0);
      const topY = upperTopY;   // all run uppers share the common top datum
      if (segS === null) { segS = cs; segE = ce; segTopY = topY; }
      else if (cs <= segE + 0.5) { segE = Math.max(segE, ce); segTopY = Math.min(segTopY, topY); }
      else { segs.push({ s: segS, e: segE, topY: segTopY }); segS = cs; segE = ce; segTopY = topY; }
    }
    if (segS !== null) segs.push({ s: segS, e: segE, topY: segTopY });
    return segs;
  }

  const upperSegs = buildUpperSegments();
  const totalH = cH + topMargin + botDim + 25;
  const totalW = wW + rightDim + leftMargin + 10;

  return (
    <svg viewBox={`${-leftMargin} -25 ${totalW} ${totalH + 30}`} data-pdf="elevation"
      style={{ width: '100%', height: 'auto', maxHeight: 620, background: C.bg, borderRadius: 4, marginBottom: 20 }}
      xmlns="http://www.w3.org/2000/svg">

      <MaterialDefs sfx={sfx} species={species} stone={stone} />

      {/* ══════════ TITLE BLOCK (NKBA Ch.2 Fig 2.2 style) ══════════ */}
      <g>
        <text x={wW / 2} y={-8} fill={C.dimText} fontSize={10} fontWeight="700"
          fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle">
          WALL {wallId} — ELEVATION
        </text>
        <line x1={0} y1={totalH + 16} x2={Math.min(wW, 200)} y2={totalH + 16}
          stroke={C.line} strokeWidth={0.6} />
        <text x={0} y={totalH + 13} fill={C.dimText} fontSize={4.5} fontWeight="700"
          fontFamily="Helvetica,Arial,sans-serif">
          ELEV. — KITCHEN WALL {wallId}
        </text>
        <text x={0} y={totalH + 22} fill={C.dimText} fontSize={3.5}
          fontFamily="Helvetica,Arial,sans-serif" opacity={0.6}>
          Scale: ½" = 1'-0" (approx)  |  Eclipse C3 Frameless
        </text>
      </g>

      {/* ══════════ STRUCTURAL LINES ══════════ */}
      {/* Ceiling (dashed) */}
      <line x1={-8} y1={ceilY} x2={wW + 8} y2={ceilY}
        stroke={C.dimLine} strokeWidth={0.5} strokeDasharray="5,2.5" />
      <text x={-12} y={ceilY + 1.5} fill={C.annotColor} fontSize={3}
        fontFamily="Helvetica,Arial,sans-serif" textAnchor="end">CLG</text>

      {/* Backsplash zone fill (stone tint if a countertop is selected) */}
      <rect x={0} y={upBotY} width={wW} height={ctrTopY - upBotY}
        fill={stone ? ctrPat : C.backsplash} stroke="none" opacity={stone ? 0.5 : 0.2} />

      {/* Floor line (heavy) */}
      <line x1={-30} y1={floorY} x2={wW + 30} y2={floorY}
        stroke={C.floor} strokeWidth={2} />

      {/* Wall edge lines */}
      <line x1={0} y1={ceilY} x2={0} y2={floorY}
        stroke={C.line} strokeWidth={0.8} />
      <line x1={wW} y1={ceilY} x2={wW} y2={floorY}
        stroke={C.line} strokeWidth={0.8} />

      {/* ══════════ WINDOWS & DOORS (openings on this wall) ══════════ */}
      {openings.filter(o => (o.width || 0) > 0).map((op, i) => {
        const ox = (op.posFromLeft || 0) * S;
        const ow = op.width * S;
        if (op.type === 'door') {
          const headAFF = op.headHeight || 80;
          const yTop = floorY - headAFF * S;
          return (
            <g key={`op${i}`}>
              <rect x={ox} y={yTop} width={ow} height={floorY - yTop}
                fill="#fbfbfb" stroke={C.line} strokeWidth={0.7} />
              <line x1={ox + ow / 2} y1={yTop} x2={ox + ow / 2} y2={floorY}
                stroke={C.thinLine} strokeWidth={0.3} opacity={0.5} />
              <text x={ox + ow / 2} y={yTop - 2} fill={C.dimText} fontSize={3.5}
                fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle" fontWeight="600">DOOR</text>
            </g>
          );
        }
        // Window: sill above the counter (~40") up to a head below the uppers.
        const sillAFF = op.sillHeight || 40;
        const headAFF = op.headHeight || Math.min(ceilH - 14, 80);
        const yTop = floorY - headAFF * S;
        const yBot = floorY - sillAFF * S;
        if (yBot - yTop <= 0) return null;
        const cols = Math.max(1, Math.round(op.width / 24));   // ~24" lites
        const rows = 2;
        return (
          <g key={`op${i}`}>
            {/* Outer frame */}
            <rect x={ox} y={yTop} width={ow} height={yBot - yTop}
              fill="#dfe7ee" stroke={C.line} strokeWidth={0.9} />
            {/* Glass inset */}
            <rect x={ox + 1.2} y={yTop + 1.2} width={ow - 2.4} height={yBot - yTop - 2.4}
              fill="#cdd9e4" stroke="none" />
            {/* True-divided-light mullions */}
            {Array.from({ length: cols - 1 }, (_, c) => (
              <line key={`mv${c}`} x1={ox + (c + 1) * ow / cols} y1={yTop}
                x2={ox + (c + 1) * ow / cols} y2={yBot} stroke="#ffffff" strokeWidth={0.7} />
            ))}
            {Array.from({ length: rows - 1 }, (_, r) => (
              <line key={`mh${r}`} x1={ox} y1={yTop + (r + 1) * (yBot - yTop) / rows}
                x2={ox + ow} y2={yTop + (r + 1) * (yBot - yTop) / rows} stroke="#ffffff" strokeWidth={0.7} />
            ))}
            {/* Sill */}
            <rect x={ox - 1.5} y={yBot} width={ow + 3} height={1.6} fill={C.ctrFill} stroke={C.line} strokeWidth={0.4} />
          </g>
        );
      })}

      {/* ══════════ TOEKICK BAND ══════════ */}
      {validBases.length > 0 && (() => {
        const minX = Math.min(...sortedBases.map(b => b.position));
        const maxX = Math.max(...sortedBases.map(b => b.position + b.width));
        return (
          <rect x={minX * S} y={tkTopY} width={(maxX - minX) * S} height={TOEKICK * S}
            fill={C.toekick} stroke={C.floor} strokeWidth={0.4} />
        );
      })()}

      {/* ══════════ COUNTERTOP ══════════ */}
      {validBases.length > 0 && (() => {
        const minX = Math.min(...sortedBases.map(b => b.position));
        const maxX = Math.max(...sortedBases.map(b => b.position + b.width));
        return (
          <g>
            <rect x={minX * S} y={ctrTopY} width={(maxX - minX) * S} height={CTR_THICK * S}
              fill={ctrPat} stroke={C.line} strokeWidth={0.5} />
            {/* Countertop edge detail */}
            <line x1={minX * S} y1={baseTopY} x2={(maxX) * S} y2={baseTopY}
              stroke={C.line} strokeWidth={0.6} />
          </g>
        );
      })()}

      {/* ══════════ BASE CABINETS ══════════ */}
      {sortedBases.map((cab, i) => {
        const x = cab.position * S;
        const w = cab.width * S;
        const isApp = isAppliance(cab);
        const sku = cab.sku || '';
        const isCornerCab = cab.type === 'corner';
        const isFill = isFiller(cab);
        const isRepPanel = isREP(cab);

        // Vertical position
        const elev = cab._elev || {};
        let h, y;
        if (elev.yMount === 0 && elev.height) {
          h = elev.height * S;
          y = floorY - h;
        } else {
          h = BASE_BOX * S;
          y = tkTopY - h;
        }

        const { doors, drawers, falseFront } = parseDoorDrawer(sku, cab.width);
        const hinge = doors === 1
          ? computeHingeSide(sortedBases[i - 1], sortedBases[i + 1], i === 0, i === sortedBases.length - 1)
          : 'left';

        return (
          <g key={`b${i}`}>
            {isRepPanel ? (
              <REPPanel x={x} y={y} w={w} h={h} />
            ) : isFill ? (
              <FillerStrip x={x} y={y} w={w} h={h} label={cab.width <= FILLER_MIN ? '' : sku} />
            ) : isApp ? (
              <ApplianceSym x={x} y={y} w={w} h={h} aType={cab.applianceType || 'unknown'} styleSpec={styleSpec} steelFill={steel} frontFill={frontFill} />
            ) : (
              <CabFront x={x} y={y} w={w} h={h} doors={doors} drawers={drawers} hinge={hinge}
                falseFront={falseFront} isCorner={isCornerCab} cornerSide={cab._cornerSide} styleSpec={styleSpec} frontFill={frontFill} />
            )}
            {/* Appliance label ABOVE cabinet */}
            {isApp && (
              <text x={x + w / 2} y={y - 5} fill={C.dimText}
                fontSize={4.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="700" fontStyle="italic">
                {appLabel(cab.applianceType)}
              </text>
            )}
          </g>
        );
      })}

      {/* ══════════ CENTERLINE MARKERS (CL at sinks/ranges) ══════════ */}
      {sortedBases.filter(cab => {
        const at = (cab.applianceType || '').toLowerCase();
        return at === 'sink' || at === 'range' || at === 'cooktop';
      }).map((cab, i) => {
        const clX = (cab.position + cab.width / 2) * S;
        return (
          <g key={`cl${i}`}>
            <line x1={clX} y1={ctrTopY} x2={clX} y2={floorY + 8}
              stroke="#666666" strokeWidth={0.3} strokeDasharray="3,2" />
            <text x={clX} y={floorY + 14} textAnchor="middle"
              fontSize={4} fill="#666666" fontFamily="Helvetica,Arial,sans-serif"
              fontWeight="600">CL</text>
          </g>
        );
      })}

      {/* ══════════ UPPER CABINETS ══════════ */}
      {sortedUppers.map((cab, i) => {
        const x = cab.position * S;
        const w = cab.width * S;
        // Over-tall wall cabinets (over the fridge) mount on top of the tall unit
        // at their real AFF (e.g. 84"→ceiling), NOT at the standard upper band.
        const elev = cab._elev || {};
        const aboveTall = elev.zone === 'ABOVE_TALL' || (elev.yMount || 0) > 60;
        // STRUCTURAL: every upper's TOP sits on the common datum (upperTopY).
        //   • standard run upper → bottom at 54" AFF (upBotY)
        //   • over-fridge upper  → bottom at the fridge top (yMount), so it tucks
        //     between the fridge and the top line and the REP can't cross it.
        let uH, y;
        y = upperTopY;
        if (aboveTall) {
          const mountAFF = elev.yMount || 0;
          uH = Math.max(6 * S, (floorY - mountAFF * S) - upperTopY);
        } else {
          uH = upBotY - upperTopY;
        }
        const isFill = isFiller(cab);
        const isRepPanel = isREP(cab);
        const doors = cab.width > 24 ? 2 : 1;
        const hinge = doors === 1
          ? computeHingeSide(sortedUppers[i - 1], sortedUppers[i + 1], i === 0, i === sortedUppers.length - 1)
          : 'left';

        return (
          <g key={`u${i}`}>
            {isRepPanel ? (
              <REPPanel x={x} y={y} w={w} h={uH} />
            ) : isFill ? (
              <FillerStrip x={x} y={y} w={w} h={uH} />
            ) : (
              <CabFront x={x} y={y} w={w} h={uH} doors={doors} drawers={0} isUpper hinge={hinge} styleSpec={styleSpec} frontFill={frontFill} />
            )}
          </g>
        );
      })}

      {/* ══════════ TALL CABINETS & TALL APPLIANCES ══════════ */}
      {sortedTalls.map((cab, i) => {
        // Over-tall wall cabinets (above the fridge) are rendered in the UPPER
        // pass at their true mount height — skip the floor-anchored duplicate here.
        if (cab._elev?.zone === 'ABOVE_TALL' || (cab._elev?.yMount || 0) > 60) return null;
        const x = (cab.position || 0) * S;
        const w = (cab.width || 18) * S;
        const isApp = isAppliance(cab);
        const isRepPanel = isREP(cab);
        // STRUCTURAL: tall cabinets and REP surrounds snap their TOP to the common
        // datum (upperTopY) so they align with the wall cabinets. A tall APPLIANCE
        // (fridge) keeps its real height, leaving the over-fridge cabinet its space.
        const realTopAFF = (cab._elev?.height || cab.height || TALL_H_DEF);
        const topAFF = isApp ? realTopAFF : upperTopAFF;
        const tH = topAFF * S;
        const y = floorY - tH;
        const doors = cab.width > 24 ? 2 : 1;
        const hinge = doors === 1
          ? computeHingeSide(sortedTalls[i - 1], sortedTalls[i + 1], i === 0, i === sortedTalls.length - 1)
          : 'left';

        return (
          <g key={`t${i}`}>
            {isRepPanel ? (
              <REPPanel x={x} y={y} w={w} h={tH} />
            ) : isApp ? (
              <ApplianceSym x={x} y={y} w={w} h={tH} aType={cab.applianceType || 'unknown'} styleSpec={styleSpec} steelFill={steel} frontFill={frontFill} />
            ) : (() => {
              const upperSku = (cab.sku || '').toUpperCase();
              const isOven = /^O\d/.test(upperSku);
              const isFHD = upperSku.includes('FHD');
              if (isOven) {
                // Oven cabinet: door below, oven cutout above
                const ovenH = tH * 0.4;
                const doorH = tH * 0.45;
                const gapH = tH * 0.15;
                return (
                  <g>
                    <rect x={x} y={y} width={w} height={tH} fill={C.fill} stroke={C.line} strokeWidth={0.7} />
                    {/* Oven cutout */}
                    <rect x={x + 3 * S} y={y + gapH * 0.3} width={w - 6 * S} height={ovenH}
                      fill="#e8e8e8" stroke={C.line} strokeWidth={0.4} rx={0.5} />
                    {/* Oven glass window */}
                    <rect x={x + 5 * S} y={y + gapH * 0.3 + 2 * S} width={w - 10 * S} height={ovenH * 0.45}
                      fill="#d8d8d8" stroke={C.line} strokeWidth={0.3} rx={0.3} />
                    {/* Oven handle */}
                    <line x1={x + 5 * S} y1={y + gapH * 0.3 + ovenH - 2 * S}
                      x2={x + w - 5 * S} y2={y + gapH * 0.3 + ovenH - 2 * S}
                      stroke={C.line} strokeWidth={0.5} strokeLinecap="round" />
                    {/* Door panel below */}
                    <CabFront x={x} y={y + ovenH + gapH} w={w} h={doorH} doors={doors} drawers={0} hinge={hinge} styleSpec={styleSpec} frontFill={frontFill} />
                  </g>
                );
              }
              if (isFHD) {
                return <CabFront x={x} y={y} w={w} h={tH} doors={doors} drawers={0} hinge={hinge} styleSpec={styleSpec} frontFill={frontFill} />;
              }
              // Standard utility: show shelf lines
              const shelfCount = Math.floor(tH / (20 * S));
              return (
                <g>
                  <CabFront x={x} y={y} w={w} h={tH} doors={doors} drawers={0} hinge={hinge} styleSpec={styleSpec} frontFill={frontFill} />
                  {Array.from({ length: Math.min(shelfCount, 4) }, (_, si) => {
                    const sy = y + (si + 1) * tH / (Math.min(shelfCount, 4) + 1);
                    return (
                      <line key={`shelf${si}`} x1={x + 2} y1={sy} x2={x + w - 2} y2={sy}
                        stroke={C.thinLine} strokeWidth={0.2} opacity={0.3} strokeDasharray="2,1.5" />
                    );
                  })}
                </g>
              );
            })()}
            {/* Appliance label */}
            {isApp && (
              <text x={x + w / 2} y={y - 5} fill={C.dimText}
                fontSize={4.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="700" fontStyle="italic">
                {appLabel(cab.applianceType)}
              </text>
            )}
            {/* Height label for talls */}
            {!isApp && (
              <text x={x + w / 2} y={y - 3} fill={C.annotColor}
                fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="500">
                {fmt(cab._elev?.height || cab.height || TALL_H_DEF)} H
              </text>
            )}
          </g>
        );
      })}

      {/* ══════════ RANGE HOOD ══════════ */}
      {hood && typeof hood.position === 'number' && (() => {
        const x = hood.position * S;
        const w = (hood.width || 36) * S;
        // The hood BOTTOM hangs ~30" above the cooking surface. Cooktop sits at
        // the counter (36" AFF), so the hood bottom is ~66" AFF — clamp to a sane
        // 60–72" range regardless of any stale mount value from the solver.
        const COUNTER_AFF = TOEKICK + BASE_BOX + CTR_THICK;   // 36"
        const rawBottom = hood._hoodMountAFF || (COUNTER_AFF + 30);
        const bottomAFF = Math.max(COUNTER_AFF + 24, Math.min(72, rawBottom));
        const canopyH = Math.max(10, Math.min(18, hood.height || 14)); // canopy body height
        const yBottom = floorY - bottomAFF * S;               // wide bottom edge
        const yTop = yBottom - canopyH * S;                   // narrow top edge
        const taper = Math.min(6 * S, w * 0.18);
        const flueTopY = ceilY;                               // flue runs up to ceiling
        const flueW = Math.min(w * 0.4, 10 * S);
        return (
          <g>
            {/* Flue / chimney from the canopy top up to the ceiling */}
            <rect x={x + w / 2 - flueW / 2} y={flueTopY} width={flueW} height={yTop - flueTopY}
              fill={steel} stroke={C.line} strokeWidth={0.5} />
            {/* Canopy body (wide at the bottom over the cooktop, tapering up) */}
            <polygon
              points={`${x},${yBottom} ${x + taper},${yTop} ${x + w - taper},${yTop} ${x + w},${yBottom}`}
              fill={steel} stroke={C.line} strokeWidth={0.7} />
            {/* brushed-steel highlight streak on the canopy */}
            <line x1={x + taper + 1.5} y1={yTop + 1.5} x2={x + 3} y2={yBottom - 1.5}
              stroke="#ffffff" strokeWidth={0.6} opacity={0.25} strokeLinecap="round" />
            {/* Capture-rail line along the bottom edge */}
            <line x1={x} y1={yBottom} x2={x + w} y2={yBottom} stroke={C.line} strokeWidth={0.8} />
            {/* VENT HOOD label */}
            <text x={x + w / 2} y={(yTop + yBottom) / 2 + 1.5} fill={C.dimText}
              fontSize={3.6} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="700">HOOD</text>
            {/* Clearance dimension note (hood bottom above counter) */}
            <text x={x + w + 2} y={yBottom - (canopyH * S) / 2}
              fill={C.annotColor} fontSize={3}
              fontFamily="Helvetica,Arial,sans-serif" textAnchor="start">
              {fmt(bottomAFF - COUNTER_AFF)} over counter
            </text>
          </g>
        );
      })()}

      {/* ══════════ CEILING TREATMENT ══════════ */}
      {/* Three strategies (research: DreamLine / Toulmin / Main Line Kitchen Design):
          • 'crown'  — crown molding on the cabinet top, stopping ~1/4" below the
                       ceiling (NKBA: crown never touches the ceiling). Omitted for
                       slab/modern door styles.
          • 'fitted' — cabinets FITTED to the ceiling: a flat riser/filler panel
                       bridges the gap from the cabinet top up to the ceiling, with a
                       thin scribe at the ceiling line to absorb out-of-level. No gap.
          • 'open'   — UNFITTED: open reveal above the cabinets (storage/display gap),
                       no crown, no panel. */}
      {(() => {
        const fit = trim.ceilingFit || (trim.crown ? 'crown' : 'open');

        if (fit === 'crown' && styleSpec.panel !== 'slab') {
          return upperSegs.map((seg, i) => {
            const ceilGapY = ceilY + 0.25 * S;                 // 1/4" below the ceiling line
            const crownBotY = seg.topY != null ? seg.topY : (upTopY);
            const crownTopY = Math.max(ceilGapY, crownBotY - CROWN_H * S);
            const h = crownBotY - crownTopY;
            if (h < 1) return null;
            return <CrownSegment key={`cr${i}`} x1={seg.s * S} x2={seg.e * S} y={crownTopY} height={h} />;
          });
        }

        if (fit === 'fitted') {
          return upperSegs.map((seg, i) => {
            const panelBotY = seg.topY != null ? seg.topY : upTopY;  // cabinet top
            const panelTopY = ceilY;                                  // up to the ceiling
            const h = panelBotY - panelTopY;
            if (h < 2) return null;
            const x = seg.s * S, w = (seg.e - seg.s) * S;
            return (
              <g key={`fit${i}`}>
                {/* flat riser / filler panel to the ceiling */}
                <rect x={x} y={panelTopY} width={w} height={h}
                  fill={C.fillerFill} stroke={C.line} strokeWidth={0.5} />
                {/* scribe line tight to the ceiling (absorbs out-of-level) */}
                <line x1={x} y1={panelTopY + 0.5} x2={x + w} y2={panelTopY + 0.5}
                  stroke={C.scribeColor} strokeWidth={0.4} strokeDasharray="2,1" opacity={0.7} />
                {w > 26 && (
                  <text x={x + w / 2} y={(panelTopY + panelBotY) / 2 + 1.2} fill={C.annotColor}
                    fontSize={3} fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle"
                    fontStyle="italic" opacity={0.75}>FILLER PANEL TO CLG</text>
                )}
              </g>
            );
          });
        }

        // 'open' (unfitted): a faint reveal line above each run; no panel, no crown.
        return upperSegs.map((seg, i) => {
          const topY = seg.topY != null ? seg.topY : upTopY;
          const x = seg.s * S, w = (seg.e - seg.s) * S;
          if (w < 20) return null;
          return (
            <text key={`open${i}`} x={x + w / 2} y={topY - 2} fill={C.annotColor}
              fontSize={2.8} fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle"
              fontStyle="italic" opacity={0.55}>OPEN ABOVE</text>
          );
        });
      })()}

      {/* ══════════ LIGHT RAIL (skips hoods) ══════════ */}
      {trim.lightRail && upperSegs.map((seg, i) => (
        <LightRailSegment key={`lr${i}`} x1={seg.s * S} x2={seg.e * S} y={upBotY} />
      ))}

      {/* ══════════ LIGHT CONCEAL ANNOTATION ══════════ */}
      {trim.lightRail && upperSegs.length > 0 && upperSegs.map((seg, i) => (
        <text key={`lca${i}`} x={(seg.s + seg.e) / 2 * S} y={upBotY + LR_H * S + 5}
          fill={C.annotColor} fontSize={3.2}
          fontFamily="Helvetica,Arial,sans-serif"
          textAnchor="middle" fontWeight="500" fontStyle="italic">
          LIGHT CONCEAL
        </text>
      ))}

      {/* ══════════ SCRIBE ANNOTATIONS (wall terminals) ══════════ */}
      {/* Left wall scribe */}
      {validBases.length > 0 && (() => {
        const firstBase = sortedBases[0];
        if (firstBase && firstBase.position > 0 && firstBase.position <= 3) {
          return <ScribeAnnotation x={firstBase.position * S} y1={tkTopY - BASE_BOX * S} y2={tkTopY} side="left" />;
        }
        return <ScribeAnnotation x={0} y1={ceilY} y2={floorY} side="left" />;
      })()}
      {/* Right wall scribe */}
      {validBases.length > 0 && (() => {
        const lastBase = sortedBases[sortedBases.length - 1];
        const lastEnd = (lastBase.position + lastBase.width);
        if (lastEnd < wallLen && wallLen - lastEnd <= 3) {
          return <ScribeAnnotation x={lastEnd * S} y1={tkTopY - BASE_BOX * S} y2={tkTopY} side="right" />;
        }
        return <ScribeAnnotation x={wW} y1={ceilY} y2={floorY} side="right" />;
      })()}

      {/* ══════════ NKBA KD-PREFIX CIRCLE TAGS ══════════ */}
      {taggedItems.map((item, i) => {
        const cx = (item.position || 0) * S + (item.width || 0) * S / 2;
        let cy;
        if (item._zone === 'tall') cy = floorY - (item._elev?.height || item.height || TALL_H_DEF) * S - 14;
        else if (item._zone === 'upper') cy = upperTopY - 14;
        else cy = floorY + 46;
        return <CabTag key={`tag${i}`} cx={cx} cy={cy} num={item._tag} />;
      })}

      {/* ══════════ BOTTOM DIMENSION STRINGS ══════════ */}
      <g>
        {(() => {
          const allCabs = [...sortedBases, ...sortedTalls]
            .filter(c => typeof c.position === 'number' && c.width > 0)
            .sort((a, b) => a.position - b.position);
          if (allCabs.length === 0) return null;

          const els = [];
          const dimY1 = floorY + 20;   // per-cabinet dims
          const dimY2 = floorY + 36;   // overall wall dim

          // ── Per-cabinet dimension tick marks + labels ──
          allCabs.forEach((cab, i) => {
            const lx = cab.position * S;
            const rx = (cab.position + cab.width) * S;
            // Extension lines
            els.push(
              <line key={`eL${i}`} x1={lx} y1={floorY + 2} x2={lx} y2={dimY1 + 3}
                stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
            );
            els.push(
              <line key={`eR${i}`} x1={rx} y1={floorY + 2} x2={rx} y2={dimY1 + 3}
                stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
            );
            // Tick marks (diagonal slashes)
            els.push(
              <line key={`tL${i}`} x1={lx - 1.5} y1={dimY1 + 1.5} x2={lx + 1.5} y2={dimY1 - 1.5}
                stroke={C.dimLine} strokeWidth={0.5} />
            );
            if (i === allCabs.length - 1) {
              els.push(
                <line key={`tR${i}`} x1={rx - 1.5} y1={dimY1 + 1.5} x2={rx + 1.5} y2={dimY1 - 1.5}
                  stroke={C.dimLine} strokeWidth={0.5} />
              );
            }
            // Dimension line segment
            els.push(
              <line key={`dl${i}`} x1={lx} y1={dimY1} x2={rx} y2={dimY1}
                stroke={C.dimLine} strokeWidth={0.4} />
            );
            // Width label
            els.push(
              <text key={`w${i}`} x={(lx + rx) / 2} y={dimY1 - 4} fill={C.dimText}
                fontSize={4.2} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="600">{fmt(cab.width)}</text>
            );
          });

          // ── Overall wall length (second line below) ──
          els.push(
            <line key="owL" x1={0} y1={floorY + 2} x2={0} y2={dimY2 + 3}
              stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
          );
          els.push(
            <line key="owR" x1={wW} y1={floorY + 2} x2={wW} y2={dimY2 + 3}
              stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
          );
          els.push(
            <line key="owd" x1={0} y1={dimY2} x2={wW} y2={dimY2}
              stroke={C.dimLine} strokeWidth={0.55} />
          );
          els.push(
            <line key="owTL" x1={-1.5} y1={dimY2 + 1.5} x2={1.5} y2={dimY2 - 1.5}
              stroke={C.dimLine} strokeWidth={0.5} />
          );
          els.push(
            <line key="owTR" x1={wW - 1.5} y1={dimY2 + 1.5} x2={wW + 1.5} y2={dimY2 - 1.5}
              stroke={C.dimLine} strokeWidth={0.5} />
          );
          els.push(
            <text key="owTxt" x={wW / 2} y={dimY2 - 4} fill={C.dimText}
              fontSize={5} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="700">{fmt(wallLen)}</text>
          );

          return els;
        })()}

        {/* ── Upper cabinet dimension string (top) ── */}
        {sortedUppers.length > 0 && (() => {
          const els = [];
          const dimY = ceilY - 14;
          sortedUppers.forEach((cab, i) => {
            const lx = cab.position * S;
            const rx = (cab.position + cab.width) * S;
            const uTop = upperTopY;
            // Extension lines from upper cabinet tops to dim line
            els.push(
              <line key={`ueL${i}`} x1={lx} y1={uTop} x2={lx} y2={dimY + 3}
                stroke={C.dimLine} strokeWidth={0.2} strokeDasharray="1.5,1" />
            );
            els.push(
              <line key={`ueR${i}`} x1={rx} y1={uTop} x2={rx} y2={dimY + 3}
                stroke={C.dimLine} strokeWidth={0.2} strokeDasharray="1.5,1" />
            );
            els.push(
              <line key={`utL${i}`} x1={lx - 1} y1={dimY + 1} x2={lx + 1} y2={dimY - 1}
                stroke={C.dimLine} strokeWidth={0.4} />
            );
            els.push(
              <line key={`ud${i}`} x1={lx} y1={dimY} x2={rx} y2={dimY}
                stroke={C.dimLine} strokeWidth={0.35} />
            );
            if (i === sortedUppers.length - 1) {
              els.push(
                <line key={`utR${i}`} x1={rx - 1} y1={dimY + 1} x2={rx + 1} y2={dimY - 1}
                  stroke={C.dimLine} strokeWidth={0.4} />
              );
            }
            els.push(
              <text key={`uw${i}`} x={(lx + rx) / 2} y={dimY - 3.5} fill={C.dimText}
                fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="500">{fmt(cab.width)}</text>
            );
          });
          return els;
        })()}
      </g>

      {/* ══════════ RIGHT-SIDE VERTICAL DIMENSIONS ══════════ */}
      <g>
        {/* Toekick dim */}
        <line x1={wW + 14} y1={floorY} x2={wW + 14} y2={tkTopY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={wW + 12} y1={floorY} x2={wW + 16} y2={floorY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={wW + 12} y1={tkTopY} x2={wW + 16} y2={tkTopY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <text x={wW + 20} y={(floorY + tkTopY) / 2 + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif">{fmt(TOEKICK)}</text>

        {/* Base box dim */}
        <line x1={wW + 14} y1={tkTopY} x2={wW + 14} y2={baseTopY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={wW + 12} y1={baseTopY} x2={wW + 16} y2={baseTopY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <text x={wW + 20} y={(tkTopY + baseTopY) / 2 + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif">{fmt(BASE_BOX)}</text>

        {/* Counter height AFF callout */}
        <line x1={wW + 10} y1={ctrTopY} x2={wW + 38} y2={ctrTopY}
          stroke={C.dimLine} strokeWidth={0.3} strokeDasharray="2,1.5" />
        <text x={wW + 40} y={ctrTopY + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif" fontWeight="600">36" AFF</text>

        {/* Upper bottom callout */}
        {validUppers.length > 0 && (
          <>
            <line x1={wW + 10} y1={upBotY} x2={wW + 38} y2={upBotY}
              stroke={C.dimLine} strokeWidth={0.3} strokeDasharray="2,1.5" />
            <text x={wW + 40} y={upBotY + 1.5} fill={C.dimText}
              fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif" fontWeight="600">54" AFF</text>
          </>
        )}

        {/* Backsplash gap dim */}
        {validUppers.length > 0 && (
          <>
            <line x1={wW + 26} y1={ctrTopY} x2={wW + 26} y2={upBotY}
              stroke={C.dimLine} strokeWidth={0.4} />
            <line x1={wW + 24} y1={ctrTopY} x2={wW + 28} y2={ctrTopY}
              stroke={C.dimLine} strokeWidth={0.4} />
            <line x1={wW + 24} y1={upBotY} x2={wW + 28} y2={upBotY}
              stroke={C.dimLine} strokeWidth={0.4} />
            <text x={wW + 32} y={(ctrTopY + upBotY) / 2 + 1.5} fill={C.dimText}
              fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif">{fmt(SPLASH_GAP)}</text>
          </>
        )}

        {/* Upper height dim */}
        {validUppers.length > 0 && (() => {
          const uH = validUppers[0].height || UPPER_H_DEF;
          return (
            <>
              <line x1={wW + 14} y1={upBotY} x2={wW + 14} y2={upTopY}
                stroke={C.dimLine} strokeWidth={0.4} />
              <line x1={wW + 12} y1={upBotY} x2={wW + 16} y2={upBotY}
                stroke={C.dimLine} strokeWidth={0.4} />
              <line x1={wW + 12} y1={upTopY} x2={wW + 16} y2={upTopY}
                stroke={C.dimLine} strokeWidth={0.4} />
              <text x={wW + 20} y={(upBotY + upTopY) / 2 + 1.5} fill={C.dimText}
                fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif">{fmt(uH)}</text>
            </>
          );
        })()}

        {/* Ceiling height callout */}
        <line x1={wW + 10} y1={ceilY} x2={wW + 38} y2={ceilY}
          stroke={C.dimLine} strokeWidth={0.3} strokeDasharray="2,1.5" />
        <text x={wW + 40} y={ceilY + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif" fontWeight="600">{fmt(ceilH)} CLG</text>

        {/* Full floor-to-ceiling dim (far right) */}
        <line x1={wW + 50} y1={floorY} x2={wW + 50} y2={ceilY}
          stroke={C.dimLine} strokeWidth={0.5} />
        <line x1={wW + 48} y1={floorY} x2={wW + 52} y2={floorY}
          stroke={C.dimLine} strokeWidth={0.45} />
        <line x1={wW + 48} y1={ceilY} x2={wW + 52} y2={ceilY}
          stroke={C.dimLine} strokeWidth={0.45} />
        <text x={wW + 56} y={(floorY + ceilY) / 2 + 1.5} fill={C.dimText}
          fontSize={4.2} fontFamily="Helvetica,Arial,sans-serif" fontWeight="700">{fmt(ceilH)}</text>
      </g>

      {/* ══════════ LEFT-SIDE VERTICAL DIMENSIONS ══════════ */}
      <g>
        {/* Toekick */}
        <line x1={-14} y1={floorY} x2={-14} y2={tkTopY} stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={-16} y1={floorY} x2={-12} y2={floorY} stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={-16} y1={tkTopY} x2={-12} y2={tkTopY} stroke={C.dimLine} strokeWidth={0.4} />
        <text x={-20} y={(floorY + tkTopY) / 2 + 1.5} fill={C.dimText}
          fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif" textAnchor="end">{fmt(TOEKICK)}</text>

        {/* Base box */}
        <line x1={-14} y1={tkTopY} x2={-14} y2={baseTopY} stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={-16} y1={baseTopY} x2={-12} y2={baseTopY} stroke={C.dimLine} strokeWidth={0.4} />
        <text x={-20} y={(tkTopY + baseTopY) / 2 + 1.5} fill={C.dimText}
          fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif" textAnchor="end">{fmt(BASE_BOX)}</text>

        {/* Countertop */}
        <line x1={-14} y1={baseTopY} x2={-14} y2={ctrTopY} stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={-16} y1={ctrTopY} x2={-12} y2={ctrTopY} stroke={C.dimLine} strokeWidth={0.4} />
        <text x={-20} y={(baseTopY + ctrTopY) / 2 + 1.5} fill={C.dimText}
          fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif" textAnchor="end">{fmt(CTR_THICK)}</text>

        {/* Backsplash */}
        {validUppers.length > 0 && (
          <>
            <line x1={-14} y1={ctrTopY} x2={-14} y2={upBotY} stroke={C.dimLine} strokeWidth={0.4} />
            <line x1={-16} y1={upBotY} x2={-12} y2={upBotY} stroke={C.dimLine} strokeWidth={0.4} />
            <text x={-20} y={(ctrTopY + upBotY) / 2 + 1.5} fill={C.dimText}
              fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif" textAnchor="end">{fmt(SPLASH_GAP)}</text>

            {/* Upper height */}
            <line x1={-14} y1={upBotY} x2={-14} y2={upTopY} stroke={C.dimLine} strokeWidth={0.4} />
            <line x1={-16} y1={upTopY} x2={-12} y2={upTopY} stroke={C.dimLine} strokeWidth={0.4} />
            <text x={-20} y={(upBotY + upTopY) / 2 + 1.5} fill={C.dimText}
              fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif" textAnchor="end">{fmt(validUppers[0]?.height || UPPER_H_DEF)}</text>

            {/* Upper to ceiling */}
            <line x1={-14} y1={upTopY} x2={-14} y2={ceilY} stroke={C.dimLine} strokeWidth={0.4} />
            <line x1={-16} y1={ceilY} x2={-12} y2={ceilY} stroke={C.dimLine} strokeWidth={0.4} />
            <text x={-20} y={(upTopY + ceilY) / 2 + 1.5} fill={C.dimText}
              fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif" textAnchor="end">
              {fmt(ceilH - (TOEKICK + BASE_BOX + CTR_THICK + SPLASH_GAP + (validUppers[0]?.height || UPPER_H_DEF)))}
            </text>
          </>
        )}
      </g>

      {/* ══════════ DEBUG OVERLAY ══════════ */}
      {debug && (
        <g className="debug-overlay" opacity={0.7}>
          <rect x={0} y={baseTopY} width={wW} height={BASE_BOX * S}
            fill="rgba(66,133,244,0.08)" stroke="none" />
          <rect x={0} y={ceilY} width={wW} height={(ceilH - 54) * S}
            fill="rgba(52,168,83,0.08)" stroke="none" />
          <text x={-50} y={(tkTopY + baseTopY) / 2}
            fill="#4285F4" fontSize={3.5} fontFamily="monospace" fontWeight="700">BASE</text>
          <text x={-50} y={(upBotY + upTopY) / 2}
            fill="#34A853" fontSize={3.5} fontFamily="monospace" fontWeight="700">UPPER</text>

          {validBases.map((cab, i) => {
            const cx = cab.position * S;
            const cw = cab.width * S;
            return (
              <g key={`db${i}`}>
                <line x1={cx} y1={floorY + 2} x2={cx} y2={floorY + 14}
                  stroke="#E91E63" strokeWidth={0.4} />
                <text x={cx + 1} y={floorY + 10} fill="#E91E63"
                  fontSize={2.8} fontFamily="monospace">{cab.position}"</text>
                <line x1={cx + cw} y1={floorY + 2} x2={cx + cw} y2={floorY + 14}
                  stroke="#E91E63" strokeWidth={0.4} />
                <text x={cx + cw / 2} y={floorY + 20} fill="#333"
                  fontSize={2.5} fontFamily="monospace" textAnchor="middle">
                  {cab._elev?.zone || '?'} {cab.sku || cab.applianceType || ''}
                </text>
              </g>
            );
          })}

          <text x={0} y={totalH + 28} fill="#666" fontSize={3.5} fontFamily="monospace">
            DEBUG: {validBases.length} bases, {validUppers.length} uppers, {validTalls.length} talls | Wall {wallId}: {wallLen}"
          </text>
        </g>
      )}
    </svg>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════

export default function ElevationView({ solverResult, trim = {}, debug = false, doorStyle = 'MET-V', species = 'White Oak', countertopColor = null }) {
  const styleSpec = doorStyleSpec(doorStyle);
  const stone = classifyStone(countertopColor);
  if (!solverResult) return null;

  const wallLayouts  = solverResult.walls || [];
  const upperLayouts = solverResult.uppers || [];
  const tallCabs     = solverResult.talls || [];
  const corners      = solverResult.corners || [];
  const inputWalls   = solverResult._inputWalls || [];

  const wallData = useMemo(() => {
    const data = {};
    inputWalls.forEach(w => {
      data[w.id] = {
        id: w.id, length: w.length,
        ceilingHeight: w.ceilingHeight || 96,
        openings: w.openings || [],
        bases: [], uppers: [], talls: [], hood: null,
      };
    });

    // 1. Base cabinets + appliances from wallLayouts
    wallLayouts.forEach(wl => {
      const wid = wl.wallId;
      if (!wid || !data[wid]) return;
      (wl.cabinets || []).forEach(cab => {
        if (typeof cab.position !== 'number' || isNaN(cab.position)) return;
        if (!cab.width || cab.width <= 0) return;

        const appType = (cab.applianceType || '').toLowerCase();
        const isTall = cab._elev?.zone === 'TALL' || appType === 'refrigerator'
          || appType === 'freezer' || appType === 'winecolumn';

        if (isTall) {
          data[wid].talls.push(cab);
        } else {
          data[wid].bases.push(cab);
        }
      });
    });

    // 2. Corner cabinets → assign to wallA
    corners.forEach(corner => {
      const wid = corner.wallA;
      if (!wid || !data[wid]) return;
      const wl = wallLayouts.find(w => w.wallId === wid);
      const pos = wl ? wl.wallLength - corner.size : 0;
      data[wid].bases.push({
        sku: corner.sku,
        type: 'corner',
        width: corner.size,
        position: Math.max(0, pos),
        _elev: corner._elev || { zone: 'BASE', yMount: 4.5, height: 30 },
        _cornerSide: 'right',  // corner is at end of wallA = right side
      });
    });

    // 3. Tall cabinets
    tallCabs.forEach(tall => {
      const wid = tall.wall;
      if (!wid || !data[wid]) return;
      if (typeof tall.position !== 'number' || isNaN(tall.position)) return;
      data[wid].talls.push(tall);
    });

    // 4. Upper cabinets + hood
    upperLayouts.forEach(ul => {
      const wid = ul.wallId;
      if (!wid || !data[wid]) return;
      (ul.cabinets || []).forEach(cab => {
        if (typeof cab.position !== 'number' || isNaN(cab.position)) return;
        if (!cab.width || cab.width <= 0) return;
        if (cab.type === 'rangeHood' || cab.role === 'range_hood'
          || (cab.applianceType || '').toLowerCase() === 'hood') {
          data[wid].hood = cab;
        } else {
          data[wid].uppers.push(cab);
        }
      });
    });

    return Object.values(data);
  }, [wallLayouts, upperLayouts, tallCabs, corners, inputWalls]);

  // Sequential tag numbers across all walls
  let globalTag = 1;

  return (
    <div>
      {wallData.map(wd => {
        const start = globalTag;
        const tallCount  = wd.talls.filter(t => typeof t.position === 'number' && t.width > 0).length;
        const baseCount  = wd.bases.filter(b => typeof b.position === 'number' && b.width > 0).length;
        const upperCount = wd.uppers.filter(u => typeof u.position === 'number' && u.width > 0 && u.type !== 'end_panel').length;
        globalTag += tallCount + baseCount + upperCount;

        return (
          <WallElev
            key={wd.id}
            wallId={wd.id}
            wallLen={wd.length}
            ceilH={wd.ceilingHeight}
            bases={wd.bases}
            uppers={wd.uppers}
            talls={wd.talls}
            hood={wd.hood}
            openings={wd.openings}
            trim={trim}
            tagStart={start}
            debug={debug}
            styleSpec={styleSpec}
            species={species}
            stone={stone}
          />
        );
      })}
    </div>
  );
}
