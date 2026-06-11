import React, { useMemo } from 'react';
import { wallFrames } from './wallGeometry.js';

/**
 * FloorPlanView — Professional Architectural Kitchen Floor Plan (NKBA Ch.3 standards)
 *
 * Construction-document conventions implemented:
 *   • Line-weight HIERARCHY (NKBA Ch.3): walls = heaviest object line; cabinets/fixtures
 *     = medium object line; dimension / extension / center lines = thin; finishes = light.
 *   • Window & door OPENINGS cut into the wall poché with plan symbols
 *     (windows: jambs + glass lines; doors: gap + swing arc; archway: gap + dashed header).
 *   • CENTERLINES (long-short dash + ℄) locating sink, range and window centers, with a
 *     dedicated centerline-dimension tier (NKBA: plumbing/appliances/openings are located
 *     by centerline so trades can rough-in).
 *   • 45° architectural tick marks on every dimension line (NKBA Ch.3): horizontal dims
 *     slash bottom-left→upper-right, vertical dims upper-left→bottom-right.
 *   • Countertop overhang edge shown as a thin visible line ~1" proud of the base face.
 *   • Stacked dimension tiers: cabinet-run widths (inner) → fixture/opening centerlines →
 *     overall wall-to-wall (outer).
 *   • Upper cabinets = long-dash overhead lines; base/under-counter = solid object lines;
 *     toe-kicks & shelving intentionally NOT shown (NKBA Ch.3 cutline at ceiling plane).
 *   • Kitchen scale 1/2" = 1'-0" (NKBA Ch.3 Table 3.3).
 *
 * Data flow:
 *   solverResult.walls       -> [{wallId, cabinets:[...]}]   (base run, source of truth)
 *   solverResult.uppers      -> [{wallId, cabinets:[...]}]
 *   solverResult.talls       -> [{wall, position, width, ...}]
 *   solverResult.corners     -> [{wallA, wallB, sku, size}]
 *   solverResult._inputWalls -> [{id, length, ceilingHeight, openings:[...]}]
 *   solverResult.island      -> {length, depth, ...}
 *   solverResult.peninsula   -> {length, depth, ...}
 *
 *   opening := {posFromLeft|position, width, type:'window'|'door'|'entry'|'archway',
 *               sillHeight, headHeight}
 */

// ─── DIMENSIONS (inches = SVG units, 1:1) ─────────────────────────────
const WALL_T = 6;       // wall thickness
const DOOR_BUMP = 0.875; // 7/8" door + bumper projection past the cabinet box
const BASE_D = 24 + DOOR_BUMP;  // base run depth incl. door & bumper = 24.875"
const UPPER_D = 13 + DOOR_BUMP; // wall run depth incl. door & bumper = 13.875"
const AISLE = 42;       // NKBA min work aisle
const OVERHANG = 1;     // countertop overhang past base face
const TICK = 1.7;       // half-length of a 45° architectural tick

// ─── LINE-WEIGHT HIERARCHY (NKBA Ch.3) ───────────────────────────────
// Heaviest = walls; medium = cabinet/fixture object lines; thin = dimension/
// extension/center; light = finish/hatch. Values are SVG stroke widths at 1:1.
const W = {
  wall:     1.5,   // wall object line (heaviest)
  wallEdge: 0.4,   // wall outline crispening
  cab:      0.6,   // cabinet / fixture object line (medium)
  cabThin:  0.35,  // cabinet internal detail
  upper:    0.45,  // upper cabinet (overhead, dashed)
  counter:  0.45,  // countertop edge (visible surface)
  dim:      0.3,   // dimension line (thin)
  ext:      0.22,  // extension line (thin, lighter)
  tick:     0.4,   // 45° dimension tick
  center:   0.3,   // centerline
  light:    0.3,   // finish / hatch (light)
};
const DASH = {
  upper:  '4,2',     // overhead/upper: long dashes (NKBA 1/4"–3/8")
  hidden: '1.6,1.2', // hidden under-counter: short dashes (NKBA 1/8")
  center: '5,1.5,1,1.5', // long-short-short centerline
  ext:    '1,1',
};

const C = {
  bg:          '#ffffff',
  wallFill:    '#222222',
  wallStroke:  '#111111',
  cabStroke:   '#3a3f47',
  cabFill:     '#fafafa',
  upperFill:   '#fafafa',
  counter:     '#6b7280',
  dimLine:     '#444444',
  dimText:     '#333333',
  centerLine:  '#7a7f87',
  tagFill:     '#ffffff',
  tagStroke:   '#333333',
  islandFill:  '#f0ede8',
  islandStroke:'#888888',
  appStroke:   '#555555',
  blindFill:   '#f0ede8',
};

// ─── HELPERS ──────────────────────────────────────────────────────────

const norm = (s) => (s || '').toUpperCase().replace(/^FC-/, '');
const openPos = (o) => (typeof o.posFromLeft === 'number' ? o.posFromLeft
  : typeof o.position === 'number' ? o.position : 0);

// Architectural depth label, e.g. 24.875 → 24⅞"
const EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
function fmtDepth(v) {
  let whole = Math.floor(v + 1e-6);
  let e = Math.round((v - whole) * 8);
  if (e === 8) { whole += 1; e = 0; }
  return `${whole}${EIGHTHS[e] || ''}"`;
}

// NKBA island clearances (Guideline 5 Traffic / Guideline 6 Work Aisle).
const ISL = {
  workAisle: 42,   // ≥42" between island work face and an opposing run/appliance (1 cook)
  seatSide:  48,   // ≥48" on the seating side (stools + a walkway behind)
  minClear:  36,   // absolute floor (tight walkway)
};

/**
 * Place the island in the renderer's wall-layout coordinates with NKBA clearances.
 * Centers it on wall A, clamped to keep ≥42" to a perpendicular wall (L/U) and,
 * when a far wall bounds the room (U/galley), centered between the two run faces.
 * Returns SVG coords + the actual clearance on each constrained side.
 */
function placeIsland(wp, layoutType, island) {
  const wA = wp[0];
  if (!wA) return null;
  const wB = wp[1], wC = wp[2];
  const iw = island.length || 72;
  const id = island.depth || 36;
  const topFace = wA.y + WALL_T / 2 + BASE_D;          // wall A cabinet front (room side)
  const rightFaceX = (wB && Math.abs((wB.angle || 0) - 90) < 1)
    ? wB.x - WALL_T / 2 - BASE_D : null;               // perpendicular wall B run face
  let bottomFace = null;
  if (wC && Math.abs((wC.angle || 0) - 180) < 1) bottomFace = wC.y - WALL_T / 2 - BASE_D; // U far wall
  else if (wB && Math.abs(wB.angle || 0) < 1) bottomFace = wB.y - WALL_T / 2 - BASE_D;    // galley far wall

  // Horizontal: center on wall A, then clamp to preserve the work aisle to wall B.
  let ix = wA.x + (wA.length - iw) / 2;
  if (rightFaceX != null && ix + iw > rightFaceX - ISL.workAisle) ix = rightFaceX - ISL.workAisle - iw;
  if (ix < wA.x) ix = wA.x;

  // Vertical: open room → 42" off wall A; bounded room → centered between the runs.
  let iy;
  if (bottomFace != null) {
    const span = bottomFace - topFace;
    iy = topFace + Math.max(ISL.workAisle, (span - id) / 2);
    if (iy + id > bottomFace - ISL.workAisle) iy = Math.max(topFace + ISL.minClear, bottomFace - ISL.workAisle - id);
  } else {
    iy = topFace + ISL.workAisle;
  }

  const clTop = iy - topFace;
  const clRight = rightFaceX != null ? rightFaceX - (ix + iw) : null;
  const clBottom = bottomFace != null ? bottomFace - (iy + id) : null;
  const tight = clTop < ISL.minClear ||
    (clRight != null && clRight < ISL.minClear) ||
    (clBottom != null && clBottom < ISL.minClear);
  return { ix, iy, iw, id, topFace, rightFaceX, bottomFace, clTop, clRight, clBottom, tight };
}

/** Numbered cabinet tag — circle with KD prefix per NKBA Ch.2 */
function Tag({ cx, cy, num, prefix = 'KD' }) {
  const r = 6;
  const label = `${prefix}${num}`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r}
        fill={C.tagFill} stroke={C.tagStroke} strokeWidth={0.45} />
      <text x={cx} y={cy + 1.5} fill={C.dimText}
        fontSize={label.length > 3 ? 3 : 3.5} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="600">{label}</text>
    </g>
  );
}

/** Elevation marker — triangle indicating where the interior elevation is cut */
function ElevMarker({ cx, cy, label, angle = 0 }) {
  const sz = 8;
  const rad = (angle * Math.PI) / 180;
  const tipX = cx + Math.cos(rad) * sz;
  const tipY = cy + Math.sin(rad) * sz;
  const lx = cx + Math.cos(rad + 2.4) * sz * 0.6;
  const ly = cy + Math.sin(rad + 2.4) * sz * 0.6;
  const rx = cx + Math.cos(rad - 2.4) * sz * 0.6;
  const ry = cy + Math.sin(rad - 2.4) * sz * 0.6;
  return (
    <g>
      <polygon points={`${tipX},${tipY} ${lx},${ly} ${rx},${ry}`}
        fill={C.dimText} stroke={C.tagStroke} strokeWidth={0.3} />
      <circle cx={cx} cy={cy} r={sz * 0.55}
        fill={C.tagFill} stroke={C.tagStroke} strokeWidth={0.4} />
      <text x={cx} y={cy + 1.5} fill={C.dimText}
        fontSize={4} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="700">{label}</text>
    </g>
  );
}

/** 45° architectural tick for a horizontal dimension (bottom-left → upper-right). */
function HTick({ x, y, k = TICK }) {
  return <line x1={x - k} y1={y + k} x2={x + k} y2={y - k}
    stroke={C.dimLine} strokeWidth={W.tick} />;
}
/** 45° architectural tick for a vertical dimension (upper-left → bottom-right). */
function VTick({ x, y, k = TICK }) {
  return <line x1={x - k} y1={y - k} x2={x + k} y2={y + k}
    stroke={C.dimLine} strokeWidth={W.tick} />;
}

/** Horizontal dimension line with 45° ticks and centered label. */
function HDim({ x1, x2, y, label, above = true }) {
  const len = Math.abs(x2 - x1);
  if (len < 6) return null;
  const ly = above ? y - 3.5 : y + 5;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.dimLine} strokeWidth={W.dim} />
      <HTick x={x1} y={y} /><HTick x={x2} y={y} />
      <text x={(x1 + x2) / 2} y={ly} fill={C.dimText}
        fontSize={4.5} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="500">{label}</text>
    </g>
  );
}

/** Vertical dimension line with 45° ticks and rotated label. */
function VDim({ y1, y2, x, label, left = true }) {
  const len = Math.abs(y2 - y1);
  if (len < 6) return null;
  const lx = left ? x - 5 : x + 5;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={C.dimLine} strokeWidth={W.dim} />
      <VTick x={x} y={y1} /><VTick x={x} y={y2} />
      <text x={lx} y={my + 1.5} fill={C.dimText}
        fontSize={4.2} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="500"
        transform={`rotate(-90, ${lx}, ${my + 1.5})`}>{label}</text>
    </g>
  );
}

/** ℄ centerline glyph drawn at (cx, cy). */
function CLGlyph({ cx, cy, size = 3 }) {
  const h = size, w = size * 0.62;
  return (
    <g stroke={C.centerLine} strokeWidth={0.35} fill="none">
      <line x1={cx - w} y1={cy} x2={cx + w} y2={cy} />
      <line x1={cx} y1={cy - h} x2={cx} y2={cy + h} />
      <text x={cx} y={cy + 1.1} stroke="none" fill={C.centerLine}
        fontSize={3} fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle">℄</text>
    </g>
  );
}

/** Window plan symbol within a wall band (local coords, band y∈[-WALL_T/2, WALL_T/2]). */
function PlanWindow({ x, w }) {
  const t = WALL_T;
  return (
    <g>
      {/* knock the poché out of the opening */}
      <rect x={x} y={-t / 2} width={w} height={t} fill={C.bg} />
      {/* jambs (object line) */}
      <line x1={x} y1={-t / 2} x2={x} y2={t / 2} stroke={C.wallStroke} strokeWidth={W.cab} />
      <line x1={x + w} y1={-t / 2} x2={x + w} y2={t / 2} stroke={C.wallStroke} strokeWidth={W.cab} />
      {/* glass: three thin parallel lines across the opening */}
      <line x1={x} y1={-t / 5} x2={x + w} y2={-t / 5} stroke={C.cabStroke} strokeWidth={W.dim} />
      <line x1={x} y1={0} x2={x + w} y2={0} stroke={C.cabStroke} strokeWidth={W.center} />
      <line x1={x} y1={t / 5} x2={x + w} y2={t / 5} stroke={C.cabStroke} strokeWidth={W.dim} />
    </g>
  );
}

/**
 * Door / entry / archway plan symbol. Door leaf + quarter-circle swing into the room
 * (room interior is +y on a base-side wall). Archway/pass-through = gap + dashed header.
 */
function PlanDoor({ x, w, type = 'door' }) {
  const t = WALL_T;
  const knockout = <rect x={x} y={-t / 2} width={w} height={t} fill={C.bg} />;
  const jambs = (
    <>
      <line x1={x} y1={-t / 2} x2={x} y2={t / 2} stroke={C.wallStroke} strokeWidth={W.cab} />
      <line x1={x + w} y1={-t / 2} x2={x + w} y2={t / 2} stroke={C.wallStroke} strokeWidth={W.cab} />
    </>
  );
  if (type === 'archway' || type === 'entry') {
    // Pass-through: open jambs + dashed header line across
    return (
      <g>
        {knockout}{jambs}
        <line x1={x} y1={0} x2={x + w} y2={0} stroke={C.cabStroke}
          strokeWidth={W.dim} strokeDasharray={DASH.upper} opacity={0.7} />
      </g>
    );
  }
  // Hinged door: hinge at left jamb, leaf swings down into the room
  const hx = x;
  const top = t / 2;            // inner wall face on room side
  const tipY = top + w;        // leaf fully open, perpendicular into room
  return (
    <g>
      {knockout}{jambs}
      {/* leaf */}
      <line x1={hx} y1={top} x2={hx} y2={tipY} stroke={C.cabStroke} strokeWidth={W.cab} />
      {/* swing arc from leaf tip to the far jamb */}
      <path d={`M ${hx} ${tipY} A ${w} ${w} 0 0 1 ${x + w} ${top}`}
        fill="none" stroke={C.cabStroke} strokeWidth={W.dim} opacity={0.8} />
    </g>
  );
}

/** Plan-view appliance symbol */
function PlanAppliance({ x, y, w, d, aType }) {
  const props = { x, y, width: w, height: d, fill: C.cabFill, stroke: C.cabStroke, strokeWidth: W.cab };

  if (aType === 'range' || aType === 'cooktop') {
    const r = Math.min(w, d) * 0.1;
    return (
      <g>
        <rect {...props} />
        <circle cx={x + w * 0.3} cy={y + d * 0.3} r={r} fill="none" stroke={C.appStroke} strokeWidth={W.cabThin} />
        <circle cx={x + w * 0.7} cy={y + d * 0.3} r={r} fill="none" stroke={C.appStroke} strokeWidth={W.cabThin} />
        <circle cx={x + w * 0.3} cy={y + d * 0.7} r={r} fill="none" stroke={C.appStroke} strokeWidth={W.cabThin} />
        <circle cx={x + w * 0.7} cy={y + d * 0.7} r={r} fill="none" stroke={C.appStroke} strokeWidth={W.cabThin} />
      </g>
    );
  }
  if (aType === 'refrigerator') {
    return (
      <g>
        <rect {...props} />
        <path d={`M ${x + w} ${y + 2} A ${w - 2} ${w - 2} 0 0 1 ${x + w} ${y + d - 2}`}
          fill="none" stroke={C.appStroke} strokeWidth={W.cabThin} opacity={0.8} />
      </g>
    );
  }
  if (aType === 'sink') {
    return (
      <g>
        <rect {...props} />
        {w > d + 4 ? (
          <>
            <ellipse cx={x + w / 3} cy={y + d / 2} rx={w / 7} ry={d / 3} fill="none" stroke={C.appStroke} strokeWidth={W.cabThin} />
            <ellipse cx={x + 2 * w / 3} cy={y + d / 2} rx={w / 7} ry={d / 3} fill="none" stroke={C.appStroke} strokeWidth={W.cabThin} />
          </>
        ) : (
          <ellipse cx={x + w / 2} cy={y + d / 2} rx={w / 3} ry={d / 2.8} fill="none" stroke={C.appStroke} strokeWidth={W.cabThin} opacity={0.8} />
        )}
      </g>
    );
  }
  if (aType === 'dishwasher') {
    return (
      <g>
        <rect {...props} />
        <line x1={x + 1} y1={y + d / 2} x2={x + w - 1} y2={y + d / 2}
          stroke={C.appStroke} strokeWidth={W.cabThin} opacity={0.8} />
      </g>
    );
  }
  return <rect {...props} />;
}

/** Door swing / front indication for a base cabinet (hinge-aware). */
function DoorSwing({ x, y, w, d, hingeSide, sku }) {
  if (w < 9) return null;
  const s = norm(sku);

  // Drawer bases: parallel horizontal lines
  if (/^B[34]D/.test(s)) {
    const numDrawers = parseInt(s[1]) || 3;
    const lines = [];
    for (let i = 1; i <= numDrawers; i++) {
      const ly = y + (d * i / (numDrawers + 1));
      lines.push(<line key={`drawer-${i}`} x1={x + 1} y1={ly} x2={x + w - 1} y2={ly}
        stroke={C.cabStroke} strokeWidth={W.cabThin} opacity={0.8} />);
    }
    return <g>{lines}</g>;
  }
  // Lazy Susan inscribed circle
  if (/^BL\d/.test(s) && s.includes('SS')) {
    return <circle cx={x + w / 2} cy={y + d / 2} r={Math.min(w, d) * 0.4}
      fill="none" stroke={C.cabStroke} strokeWidth={W.cabThin} strokeDasharray={DASH.hidden} opacity={0.8} />;
  }
  // Double-door: two arcs meeting at center
  if (w > 24 || hingeSide === 'B') {
    const half = w / 2;
    const r = Math.min(half - 0.5, d);
    return (
      <g>
        <path d={`M ${x + 0.5} ${y + d} A ${r} ${r} 0 0 0 ${x + half} ${y + d - r}`}
          fill="none" stroke={C.cabStroke} strokeWidth={W.cabThin} opacity={0.8} />
        <path d={`M ${x + w - 0.5} ${y + d} A ${r} ${r} 0 0 1 ${x + half} ${y + d - r}`}
          fill="none" stroke={C.cabStroke} strokeWidth={W.cabThin} opacity={0.8} />
      </g>
    );
  }
  // Single door arc from hinge side
  const r = Math.min(w - 1, d);
  if (hingeSide === 'L') {
    return <path d={`M ${x + 0.5} ${y + d} A ${r} ${r} 0 0 0 ${x + 0.5 + r} ${y + d}`}
      fill="none" stroke={C.cabStroke} strokeWidth={W.cabThin} opacity={0.8} />;
  }
  return <path d={`M ${x + w - 0.5} ${y + d} A ${r} ${r} 0 0 1 ${x + w - 0.5 - r} ${y + d}`}
    fill="none" stroke={C.cabStroke} strokeWidth={W.cabThin} opacity={0.8} />;
}

// ─── WALL SEGMENT RENDERER ───────────────────────────────────────────

function WallSegment({ wx, wy, angle, length, baseCabs, upperCabs, openings, wallId }) {
  const bases = (baseCabs || [])
    .filter(p => typeof p.position === 'number' && !isNaN(p.position) && p.width > 0)
    .sort((a, b) => a.position - b.position);
  const uppers = (upperCabs || [])
    .filter(u => typeof u.position === 'number' && u.position >= 0 && u.width > 0)
    .sort((a, b) => a.position - b.position);
  const ops = (openings || []).filter(o => (o.width || 0) > 0);

  const isFridgeType = (cab) => {
    const at = (cab.applianceType || '').toLowerCase();
    return at === 'refrigerator' || at === 'freezer' || at === 'winecolumn';
  };

  // Countertop run: contiguous span over non-fridge base cabinets.
  const counterBases = bases.filter(c => !isFridgeType(c) && c.type !== 'corner');
  const ctMin = counterBases.length ? Math.min(...counterBases.map(c => c.position)) : 0;
  const ctMax = counterBases.length ? Math.max(...counterBases.map(c => c.position + c.width)) : 0;

  // Fixtures to locate by centerline (NKBA: plumbing + cooking rough-ins).
  const fixtures = bases.map(c => {
    const at = (c.applianceType || '').toLowerCase();
    const sk = norm(c.sku);
    const isSink = at === 'sink' || /^SB|^BSB|^IWS|^IBS|^DSB/.test(sk);
    const isRange = at === 'range' || at === 'cooktop' || /^RTB/.test(sk);
    if (!isSink && !isRange) return null;
    return { center: c.position + c.width / 2, kind: isSink ? 'sink' : 'range' };
  }).filter(Boolean).sort((a, b) => a.center - b.center);

  // Dimension tiers. Cabinet-run widths sit on the room side (closest to the run,
  // as in 2020 Design plans); centerline locations + overall length stack OUTBOARD
  // of the wall so the room interior stays clean (NKBA Ch.3 line hierarchy).
  const dimRunY  = WALL_T / 2 + BASE_D + 9;   // cabinet-run width string (room side, above tags)
  const clTierY  = -WALL_T / 2 - UPPER_D - 12; // fixture + window centerline locations
  const overallY = -WALL_T / 2 - UPPER_D - 24; // overall wall length (outermost)

  return (
    <g transform={`translate(${wx}, ${wy}) rotate(${angle})`}>
      {/* ── WALL ── heaviest object line, solid poché ── */}
      <rect x={0} y={-WALL_T / 2} width={length} height={WALL_T}
        fill={C.wallFill} stroke={C.wallStroke} strokeWidth={W.wallEdge} />

      {/* ── OPENINGS ── cut into the wall, with plan symbols ── */}
      {ops.map((op, i) => {
        const ox = openPos(op);
        const ow = op.width;
        const ty = (op.type || 'window').toLowerCase();
        return (
          <g key={`op-${i}`}>
            {ty === 'window'
              ? <PlanWindow x={ox} w={ow} />
              : <PlanDoor x={ox} w={ow} type={ty} />}
            <text x={ox + ow / 2} y={-WALL_T / 2 - 2} fill={C.dimText}
              fontSize={2.8} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="600" letterSpacing="0.3">
              {ty === 'window' ? `WDW ${ow}"` : ty === 'door' ? 'DOOR' : ty.toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* ── BASE CABINETS ── medium object line ── */}
      {bases.map((cab, i) => {
        const x = cab.position;
        const w = cab.width;
        const isFridge = isFridgeType(cab);
        const d = cab.depth || cab._elev?.depth || (cab.type === 'tall' || isFridge ? 27 : BASE_D);
        const isApp = cab.type === 'appliance' || !!cab.applianceType;
        const isTall = cab.type === 'tall' || isFridge || cab._elev?.zone === 'TALL';
        const isCorner = cab.type === 'corner';

        return (
          <g key={`base-${i}`}>
            {isCorner ? (
              (() => {
                const cornerSku = norm(cab.sku);
                const isLazySusan = cornerSku.includes('BL') && cornerSku.includes('SS');
                const isBBC = cornerSku.includes('BBC');
                // Door-aware corner depth = the run depth (box + door/bumper). The corner
                // abuts the perpendicular wall at the run's far end, so inset that end by
                // half the wall thickness — the unit stops at the inner face, not the
                // wall centerline, and forms a clean L with the adjoining run.
                const cd = Math.max(BASE_D, cab.depth || 0);
                const atFarEnd = (x + w) >= length - 0.6;
                const rightInset = atFarEnd ? WALL_T / 2 : 0;
                const innerW = w - rightInset;

                if (isLazySusan) {
                  const sq = Math.min(w, innerW);
                  return (
                    <>
                      <rect x={x} y={WALL_T / 2} width={innerW} height={sq}
                        fill={C.cabFill} stroke={C.cabStroke} strokeWidth={W.cab} />
                      <circle cx={x + innerW / 2} cy={WALL_T / 2 + sq / 2} r={Math.min(innerW, sq) * 0.42}
                        fill="none" stroke={C.cabStroke} strokeWidth={W.cabThin}
                        strokeDasharray={DASH.hidden} opacity={0.6} />
                    </>
                  );
                }
                if (isBBC) {
                  // Blind (in-corner) portion sized to the perpendicular run depth so the
                  // adjoining run butts cleanly against it; access door on the near side.
                  const blindW = Math.min(Math.max(cd, 12), innerW - 9);
                  const accessW = innerW - blindW;
                  return (
                    <>
                      <rect x={x} y={WALL_T / 2} width={accessW} height={cd}
                        fill={C.cabFill} stroke={C.cabStroke} strokeWidth={W.cab} />
                      <DoorSwing x={x} y={WALL_T / 2} w={accessW} d={cd} hingeSide="L" sku="" />
                      <rect x={x + accessW} y={WALL_T / 2} width={blindW} height={cd}
                        fill={C.blindFill} stroke={C.cabStroke} strokeWidth={W.cabThin} />
                      {Array.from({ length: Math.ceil(blindW / 4) }, (_, hi) => {
                        const hx = x + accessW + hi * 4;
                        return (
                          <line key={`bh${hi}`} x1={hx} y1={WALL_T / 2}
                            x2={Math.min(hx + cd, x + accessW + blindW)} y2={WALL_T / 2 + Math.min(cd, x + accessW + blindW - hx)}
                            stroke={C.cabStroke} strokeWidth={W.light} opacity={0.5} />
                        );
                      })}
                    </>
                  );
                }
                // Diagonal corner unit (depth-aware square, chamfered front).
                return (
                  <>
                    <rect x={x} y={WALL_T / 2} width={innerW} height={cd}
                      fill={C.cabFill} stroke={C.cabStroke} strokeWidth={W.cab} />
                    <line x1={x} y1={WALL_T / 2 + cd} x2={x + innerW} y2={WALL_T / 2}
                      stroke={C.cabStroke} strokeWidth={W.light} opacity={0.4} />
                  </>
                );
              })()
            ) : isApp ? (
              <PlanAppliance x={x} y={WALL_T / 2} w={w} d={d} aType={cab.applianceType} />
            ) : (() => {
              const cabSku = norm(cab.sku);
              const isSinkBase = /^SB|^BSB|^IWS|^IBS|^DSB/.test(cabSku);
              const isRangeBase = /^RTB/.test(cabSku);
              if (isSinkBase) return <PlanAppliance x={x} y={WALL_T / 2} w={w} d={d} aType="sink" />;
              if (isRangeBase) return <PlanAppliance x={x} y={WALL_T / 2} w={w} d={d} aType="cooktop" />;
              return (
                <>
                  <rect x={x} y={WALL_T / 2} width={w} height={d}
                    fill={C.cabFill} stroke={C.cabStroke} strokeWidth={W.cab} />
                  {!isTall && <DoorSwing x={x} y={WALL_T / 2} w={w} d={d} hingeSide={cab.hingeSide} sku={cab.sku} />}
                </>
              );
            })()}

            {/* SKU / width labels */}
            {w >= 12 && (
              <text x={x + w / 2} y={WALL_T / 2 + (isCorner ? BASE_D : d) / 2 + 1.2} fill={C.dimText}
                fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="500">{cab.sku ? `${cab.sku}` : `${w}"`}</text>
            )}
            {cab.sku && w >= 20 && (
              <text x={x + w / 2} y={WALL_T / 2 + (isCorner ? BASE_D : d) / 2 + 4.8} fill="#5c6370"
                fontSize={2.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="400" opacity={0.65}>{w}"</text>
            )}
            {isTall && !isApp && (
              <text x={x + 1} y={WALL_T / 2 + 4} fill={C.dimText}
                fontSize={2.8} fontFamily="Helvetica,Arial,sans-serif"
                fontStyle="italic" opacity={0.6}>TALL</text>
            )}
            {isApp && w >= 15 && (
              <text x={x + w / 2} y={WALL_T / 2 + d / 2 - 2} fill={C.dimText}
                fontSize={2.8} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontStyle="italic" opacity={0.7}>
                {(() => { const at = (cab.applianceType || '').toLowerCase();
                  return at === 'range' ? 'RANGE' : at === 'refrigerator' ? 'REF'
                    : at === 'dishwasher' ? 'DW' : at === 'sink' ? 'SINK'
                    : at.toUpperCase().substring(0, 6); })()}
              </text>
            )}
          </g>
        );
      })}

      {/* ── COUNTERTOP OVERHANG EDGE ── visible surface, ~1" proud of base face ── */}
      {counterBases.length > 0 && (
        <g>
          <line x1={ctMin} y1={WALL_T / 2 + BASE_D + OVERHANG} x2={ctMax} y2={WALL_T / 2 + BASE_D + OVERHANG}
            stroke={C.counter} strokeWidth={W.counter} />
          <line x1={ctMin} y1={WALL_T / 2} x2={ctMin} y2={WALL_T / 2 + BASE_D + OVERHANG}
            stroke={C.counter} strokeWidth={W.counter} opacity={0.8} />
          <line x1={ctMax} y1={WALL_T / 2} x2={ctMax} y2={WALL_T / 2 + BASE_D + OVERHANG}
            stroke={C.counter} strokeWidth={W.counter} opacity={0.8} />
        </g>
      )}

      {/* ── UPPER CABINETS ── overhead, long-dash ── */}
      {uppers.map((cab, i) => {
        const x = cab.position;
        const w = cab.width;
        const uy = -WALL_T / 2 - UPPER_D - 2;
        return (
          <g key={`upper-${i}`}>
            <rect x={x} y={uy} width={w} height={UPPER_D}
              fill={C.upperFill} stroke={C.cabStroke} strokeWidth={W.upper}
              strokeDasharray={DASH.upper} opacity={0.9} />
            {w >= 12 && (
              <text x={x + w / 2} y={uy + UPPER_D / 2 + 1} fill={C.dimText}
                fontSize={3} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" opacity={0.6}>{w}"</text>
            )}
          </g>
        );
      })}

      {/* ── RUN DEPTH CALLOUTS ── base run (24⅞") room-side, wall run (13⅞") wall-side ── */}
      {bases.length > 0 && (() => {
        const bx = bases[0].position - 7;     // just left of the run start
        const y0 = WALL_T / 2, y1 = WALL_T / 2 + BASE_D;
        const my = (y0 + y1) / 2;
        return (
          <g>
            <line x1={bx} y1={y0} x2={bx} y2={y1} stroke={C.dimLine} strokeWidth={W.dim} />
            <VTick x={bx} y={y0} /><VTick x={bx} y={y1} />
            <line x1={bx} y1={y0} x2={bases[0].position} y2={y0} stroke={C.dimLine}
              strokeWidth={W.ext} strokeDasharray={DASH.ext} opacity={0.45} />
            <line x1={bx} y1={y1} x2={bases[0].position} y2={y1} stroke={C.dimLine}
              strokeWidth={W.ext} strokeDasharray={DASH.ext} opacity={0.45} />
            <text x={bx - 2.5} y={my} fill={C.dimText} fontSize={3.6}
              fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle" fontWeight="600"
              transform={`rotate(-90, ${bx - 2.5}, ${my})`}>{fmtDepth(BASE_D)}</text>
          </g>
        );
      })()}
      {uppers.length > 0 && (() => {
        const ux = uppers[0].position - 7;
        const uTop = -WALL_T / 2 - UPPER_D - 2, uBot = -WALL_T / 2 - 2;
        const my = (uTop + uBot) / 2;
        return (
          <g>
            <line x1={ux} y1={uTop} x2={ux} y2={uBot} stroke={C.dimLine} strokeWidth={W.dim} />
            <VTick x={ux} y={uTop} /><VTick x={ux} y={uBot} />
            <line x1={ux} y1={uTop} x2={uppers[0].position} y2={uTop} stroke={C.dimLine}
              strokeWidth={W.ext} strokeDasharray={DASH.ext} opacity={0.45} />
            <line x1={ux} y1={uBot} x2={uppers[0].position} y2={uBot} stroke={C.dimLine}
              strokeWidth={W.ext} strokeDasharray={DASH.ext} opacity={0.45} />
            <text x={ux - 2.5} y={my} fill={C.dimText} fontSize={3.4}
              fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle" fontWeight="600"
              transform={`rotate(-90, ${ux - 2.5}, ${my})`}>{fmtDepth(UPPER_D)}</text>
          </g>
        );
      })()}

      {/* ── OVERALL WALL DIMENSION ── outermost, above ── */}
      <HDim x1={0} x2={length} y={overallY} label={`${length}"`} above={true} />

      {/* ── CENTERLINE LOCATIONS (fixtures + windows) — single outboard tier ── */}
      {(fixtures.length > 0 || ops.some(o => (o.type || 'window').toLowerCase() === 'window')) && (() => {
        const wins = ops.filter(o => (o.type || 'window').toLowerCase() === 'window')
          .map(o => ({ c: openPos(o) + o.width / 2, src: 'win' }));
        const fix = fixtures.map(f => ({ c: f.center, src: f.kind }));
        const marks = [...wins, ...fix].sort((a, b) => a.c - b.c);
        const els = [];
        // long-short dash centerlines: windows rise from the wall, fixtures rise
        // from the base run up across the wall to the tier (locates the rough-in).
        marks.forEach((m, i) => {
          const yFrom = m.src === 'win' ? -WALL_T / 2 : WALL_T / 2 + BASE_D;
          els.push(<line key={`cl${i}`} x1={m.c} y1={yFrom} x2={m.c} y2={clTierY + 2}
            stroke={C.centerLine} strokeWidth={W.center} strokeDasharray={DASH.center} opacity={0.85} />);
          els.push(<g key={`clg${i}`}><CLGlyph cx={m.c} cy={clTierY - 2.5} /></g>);
        });
        // CL dimension string: wall corner → each CL → far corner
        const stops = [0, ...marks.map(m => m.c), length];
        els.push(<line key="cll" x1={0} y1={clTierY} x2={length} y2={clTierY}
          stroke={C.dimLine} strokeWidth={W.dim} />);
        stops.forEach((sx, i) => {
          els.push(<HTick key={`ct${i}`} x={sx} y={clTierY} />);
          if (i > 0) {
            const a = stops[i - 1], b = sx;
            if (b - a > 6) els.push(
              <text key={`ct-l${i}`} x={(a + b) / 2} y={clTierY - 2.6} fill={C.dimText}
                fontSize={3.4} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="500">{Math.round(b - a)}"</text>
            );
          }
        });
        return <g>{els}</g>;
      })()}

      {/* ── CABINET-RUN WIDTH STRING (inner, room side below cabinets) ── */}
      {bases.length > 0 && (() => {
        const els = [];
        const first = bases[0].position;
        const lastCab = bases[bases.length - 1];
        const end = lastCab.position + lastCab.width;
        els.push(<line key="cl" x1={first} y1={dimRunY} x2={end} y2={dimRunY}
          stroke={C.dimLine} strokeWidth={W.dim} />);
        bases.forEach((cab, i) => {
          const lx = cab.position;
          const rx = cab.position + cab.width;
          els.push(<HTick key={`tl${i}`} x={lx} y={dimRunY} />);
          if (i === bases.length - 1) els.push(<HTick key={`tr${i}`} x={rx} y={dimRunY} />);
          els.push(<line key={`el${i}`} x1={lx} y1={WALL_T / 2 + (cab.depth || BASE_D)}
            x2={lx} y2={dimRunY + 2} stroke={C.dimLine} strokeWidth={W.ext}
            strokeDasharray={DASH.ext} opacity={0.5} />);
          if (i === bases.length - 1) els.push(<line key={`er${i}`} x1={rx} y1={WALL_T / 2 + (cab.depth || BASE_D)}
            x2={rx} y2={dimRunY + 2} stroke={C.dimLine} strokeWidth={W.ext}
            strokeDasharray={DASH.ext} opacity={0.5} />);
          if (cab.width >= 8) els.push(
            <text key={`wl${i}`} x={(lx + rx) / 2} y={dimRunY - 3} fill={C.dimText}
              fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="500">{cab.width}"</text>
          );
        });
        return els;
      })()}
    </g>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────

export default function FloorPlanView({ solverResult, inputWalls, debug = false, titleBlock = {} }) {
  if (!solverResult) return null;

  const walls = inputWalls || solverResult._inputWalls || [];
  const wallLayouts = solverResult.walls || [];
  const upperLayouts = solverResult.uppers || [];
  const tallCabs = solverResult.talls || [];
  const layoutType = solverResult.layoutType || 'single-wall';
  const island = solverResult.island;
  const peninsula = solverResult.peninsula;
  const corners = solverResult.corners || [];

  const basesByWall = useMemo(() => {
    const m = {};
    wallLayouts.forEach(wl => {
      m[wl.wallId] = (wl.cabinets || []).filter(c =>
        typeof c.position === 'number' && !isNaN(c.position) && c.width > 0);
    });
    tallCabs.forEach(t => {
      if (t.wall && typeof t.position === 'number' && !isNaN(t.position) && t.width > 0) {
        if (!m[t.wall]) m[t.wall] = [];
        m[t.wall].push(t);
      }
    });
    corners.forEach(corner => {
      const wid = corner.wallA;
      if (!wid || !corner.sku) return;   // open corner (angled junction): nothing to draw
      const wl = wallLayouts.find(w => w.wallId === wid);
      const pos = wl ? wl.wallLength - corner.size : 0;
      if (!m[wid]) m[wid] = [];
      m[wid].push({ sku: corner.sku, type: 'corner', width: corner.size, position: pos, _elev: corner._elev });
    });
    return m;
  }, [wallLayouts, tallCabs, corners]);

  const uppersByWall = useMemo(() => {
    const m = {};
    upperLayouts.forEach(u => {
      m[u.wallId] = (u.cabinets || []).filter(c =>
        typeof c.position === 'number' && !isNaN(c.position) && c.width > 0);
    });
    return m;
  }, [upperLayouts]);

  const openingsByWall = useMemo(() => {
    const m = {};
    walls.forEach(w => { m[w.id] = (w.openings || []); });
    return m;
  }, [walls]);

  const wallPositions = useMemo(() => {
    // Shared chain geometry (wallGeometry.js) — same frames the Design Studio
    // canvas and the 3D view use, so this drawing can never disagree with
    // them. Honors per-wall `turn` (45/135 = angled wall) and draws ALL walls
    // in the chain (G-shape's 4th wall included). Normalized so back-tracking
    // chains never clip off the sheet.
    const margin = 70;
    return wallFrames(walls, layoutType, { x0: margin, y0: margin + 56, normalize: true });
  }, [walls, layoutType]);

  const viewBox = useMemo(() => {
    let maxX = 0, maxY = 0;
    wallPositions.forEach(wp => {
      const rad = (wp.angle * Math.PI) / 180;
      const ex = wp.x + Math.cos(rad) * wp.length;
      const ey = wp.y + Math.sin(rad) * wp.length;
      maxX = Math.max(maxX, wp.x, ex);
      maxY = Math.max(maxY, wp.y, ey);
    });
    // Extend to include the island (slab + seating overhang + stool row + caption).
    if (island) {
      const pl = placeIsland(wallPositions, layoutType, island);
      if (pl) {
        const ohD = island.overhang && island.overhang.depth ? island.overhang.depth : 0;
        maxX = Math.max(maxX, pl.ix + pl.iw);
        maxY = Math.max(maxY, pl.iy + pl.id + ohD + 16);
      }
    }
    // Reserve room at the bottom for the title block + scale bar strip.
    const vw = Math.max(maxX + 110, 300);
    const vh = Math.max(maxY + 130, 220) + 64;
    return { str: `0 0 ${vw} ${vh}`, w: vw, h: vh };
  }, [wallPositions, island, layoutType]);

  const tagAssignments = useMemo(() => {
    const tags = [];
    let num = 1;
    wallPositions.forEach(wp => {
      const wallItems = (basesByWall[wp.id] || [])
        .filter(p => typeof p.position === 'number' && !isNaN(p.position) && p.width > 0)
        .sort((a, b) => a.position - b.position);
      wallItems.forEach(item => {
        const appType = (item.applianceType || '').toLowerCase();
        const isTall = item._elev?.zone === 'TALL' || item.type === 'tall' || item.type === 'panel' ||
          appType === 'refrigerator' || appType === 'freezer';
        tags.push({
          wallId: wp.id, position: item.position, width: item.width,
          depth: item.depth || item._elev?.depth || (isTall ? 27 : BASE_D),
          num: num++, sku: item.sku || item.applianceType || '',
          isAppliance: item.type === 'appliance', isTall,
        });
      });
      const uppers = (uppersByWall[wp.id] || [])
        .filter(u => typeof u.position === 'number' && !isNaN(u.position) && u.width > 0)
        .sort((a, b) => a.position - b.position);
      uppers.forEach(item => {
        tags.push({ wallId: wp.id, position: item.position, width: item.width,
          depth: UPPER_D, num: num++, sku: item.sku || '', isUpper: true });
      });
    });
    return tags;
  }, [wallPositions, basesByWall, uppersByWall]);

  const getWP = (id) => wallPositions.find(wp => wp.id === id);

  return (
    <svg viewBox={viewBox.str}
      style={{ width: '100%', height: 'auto', maxHeight: 700, background: C.bg, borderRadius: 4 }}
      xmlns="http://www.w3.org/2000/svg">

      <text x="14" y="18" fill={C.dimText} fontSize={11} fontWeight="700"
        fontFamily="Helvetica,Arial,sans-serif" letterSpacing="1">KITCHEN FLOOR PLAN</text>
      <text x="14" y="28" fill="#666" fontSize={5} fontFamily="Helvetica,Arial,sans-serif">
        {layoutType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Layout  |  Scale: 1/2" = 1'-0"  |  Base run {fmtDepth(BASE_D)} deep · Wall run {fmtDepth(UPPER_D)} deep  |  NKBA Drawing Standards
      </text>

      {/* ── WALLS + CABINETS + OPENINGS ── */}
      {wallPositions.map(wp => (
        <WallSegment key={wp.id} wx={wp.x} wy={wp.y} angle={wp.angle}
          length={wp.length} baseCabs={basesByWall[wp.id] || []}
          upperCabs={uppersByWall[wp.id] || []} openings={openingsByWall[wp.id] || []}
          wallId={wp.id} />
      ))}

      {/* ── NUMBERED TAGS ── */}
      {tagAssignments.map((tag, i) => {
        const wp = getWP(tag.wallId);
        if (!wp) return null;
        const rad = (wp.angle * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const along = tag.position + tag.width / 2;
        const perpDist = tag.isUpper
          ? -(WALL_T / 2 + UPPER_D + 10)
          : (WALL_T / 2 + (tag.depth || BASE_D) + 18);
        const cx = wp.x + cos * along - sin * perpDist;
        const cy = wp.y + sin * along + cos * perpDist;
        return <Tag key={`tag${i}`} cx={cx} cy={cy} num={tag.num} />;
      })}

      {/* ── ISLAND ── NKBA-clearance placement + real cabinetry ── */}
      {island && (() => {
        const pl = placeIsland(wallPositions, layoutType, island);
        if (!pl) return null;
        const { ix, iy, iw, id, topFace, rightFaceX, bottomFace, clTop, clRight, clBottom, tight } = pl;
        const work = island.workSide || [];
        const back = island.backSide || [];
        const oh = island.overhang || null;
        const ohD = oh && oh.depth ? oh.depth : 0;
        const backDepth = back.length ? (back[0].depth || 13.875) : 0;
        const workDepth = 24;

        // One island cabinet: box + role-appropriate symbol + small sku label.
        const islCab = (c, x, y, w, d, key) => {
          const sk = norm(c.sku);
          const role = (c.role || '').toLowerCase();
          const isSink = role.includes('sink') || /^SB|^BSB|^DSB/.test(sk);
          const isWaste = role.includes('waste') || /WDM|BWD/.test(sk);
          const isDrawer = /^B[234]D/.test(sk) || role.includes('drawer');
          return (
            <g key={key}>
              <rect x={x} y={y} width={w} height={d}
                fill={C.cabFill} stroke={C.cabStroke} strokeWidth={W.cab} />
              {isSink && (
                <ellipse cx={x + w / 2} cy={y + d / 2} rx={w * 0.3} ry={d * 0.3}
                  fill="none" stroke={C.appStroke} strokeWidth={W.cabThin} opacity={0.8} />
              )}
              {isWaste && (
                <line x1={x + 2} y1={y + 2} x2={x + w - 2} y2={y + d - 2}
                  stroke={C.cabStroke} strokeWidth={W.cabThin} opacity={0.5} />
              )}
              {isDrawer && !isSink && Array.from({ length: 3 }, (_, k) => (
                <line key={k} x1={x + 1.5} y1={y + d * (k + 1) / 4} x2={x + w - 1.5} y2={y + d * (k + 1) / 4}
                  stroke={C.cabStroke} strokeWidth={W.cabThin} opacity={0.7} />
              ))}
              {w >= 14 && (
                <text x={x + w / 2} y={y + d / 2 + 1} fill={C.dimText}
                  fontSize={2.6} fontFamily="Helvetica,Arial,sans-serif"
                  textAnchor="middle" opacity={0.85}>{c.sku}</text>
              )}
            </g>
          );
        };

        return (
          <g>
            {/* slab footprint */}
            <rect x={ix} y={iy} width={iw} height={id}
              fill={C.islandFill} stroke={C.islandStroke} strokeWidth={W.cab} />

            {/* work side (faces wall A): base cabinets, sink / waste / drawers */}
            {work.map((c, i) => islCab(c, ix + (c.position || 0), iy, c.width, workDepth, `iw${i}`))}

            {/* back side (seating): shallow cabinets along the far long edge */}
            {back.map((c, i) => islCab(c, ix + (c.position || 0), iy + id - backDepth, c.width, backDepth, `ib${i}`))}

            {/* seating overhang + stools projecting past the seating edge */}
            {ohD > 0 && (() => {
              const oy = iy + id;
              const stools = Math.max(1, Math.floor(iw / 24));
              return (
                <g>
                  <line x1={ix} y1={oy + ohD} x2={ix + iw} y2={oy + ohD}
                    stroke={C.counter} strokeWidth={W.counter} strokeDasharray={DASH.hidden} />
                  <line x1={ix} y1={oy} x2={ix} y2={oy + ohD} stroke={C.counter} strokeWidth={W.counter} opacity={0.6} />
                  <line x1={ix + iw} y1={oy} x2={ix + iw} y2={oy + ohD} stroke={C.counter} strokeWidth={W.counter} opacity={0.6} />
                  {Array.from({ length: stools }, (_, s) => {
                    const sx = ix + (s + 0.5) * (iw / stools);
                    return <circle key={s} cx={sx} cy={oy + ohD - 3} r={4.5}
                      fill="none" stroke={C.appStroke} strokeWidth={W.cabThin} opacity={0.7} />;
                  })}
                  <text x={ix + iw / 2} y={oy + ohD + 5} fill={C.dimText}
                    fontSize={3} fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle"
                    opacity={0.7}>{stools} SEATS · {ohD}" OVERHANG</text>
                </g>
              );
            })()}

            {/* end panels */}
            {(island.endPanels || []).map((p, i) => (
              <rect key={`ep${i}`} x={i === 0 ? ix - 0.8 : ix + iw - 0.8} y={iy}
                width={1.6} height={id} fill={C.islandStroke} opacity={0.5} />
            ))}

            {/* caption (in the slab core, between the two cabinet rows) */}
            <text x={ix + iw / 2} y={iy + workDepth + 4} fill={C.dimText}
              fontSize={3.4} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="600" letterSpacing="0.5" opacity={0.8}>
              ISLAND {iw}"×{id}"{island.hasSink ? ' · SINK' : ''}{island.hasRange ? ' · RANGE' : ''}
            </text>

            {/* size dimensions */}
            <HDim x1={ix} x2={ix + iw} y={iy + id + (ohD > 0 ? ohD + 9 : 9)} label={`${iw}"`} above={false} />
            <VDim y1={iy} y2={iy + id} x={ix + iw + 9} label={`${id}"`} left={false} />

            {/* clearance dimensions (NKBA work aisle / seating side) */}
            <VDim y1={topFace} y2={iy} x={ix - 9} label={`${Math.round(clTop)}" aisle`} left={true} />
            {clRight != null && (
              <HDim x1={ix + iw} x2={rightFaceX} y={iy + id / 2} label={`${Math.round(clRight)}"`} above={false} />
            )}
            {clBottom != null && (
              <VDim y1={iy + id} y2={bottomFace} x={ix + iw + 20} label={`${Math.round(clBottom)}"`} left={false} />
            )}

            {tight && (
              <text x={ix + iw / 2} y={iy - 4} fill="#c0392b"
                fontSize={3.6} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="700">
                ⚠ clearance below 36" NKBA min — reduce island size
              </text>
            )}
          </g>
        );
      })()}

      {/* ── PENINSULA ── */}
      {peninsula && (() => {
        const wA = wallPositions[0];
        if (!wA) return null;
        const pw = peninsula.length || 60;
        const pd = peninsula.depth || 24;
        const px = wA.x + wA.length - pw;
        const py = wA.y + WALL_T / 2 + BASE_D;
        return (
          <g>
            <rect x={px} y={py} width={pw} height={pd}
              fill={C.islandFill} stroke={C.islandStroke} strokeWidth={W.cab} />
            <HDim x1={px} x2={px + pw} y={py + pd + 8} label={`${pw}"`} above={false} />
            <VDim y1={py} y2={py + pd} x={px + pw + 8} label={`${pd}"`} left={false} />
          </g>
        );
      })()}

      {/* ── ELEVATION MARKERS ── */}
      {wallPositions.map((wp, i) => {
        const rad = (wp.angle * Math.PI) / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const midAlong = wp.length / 2;
        const perpDist = WALL_T / 2 + BASE_D + 55;
        const mx = wp.x + cos * midAlong + sin * perpDist;
        const my = wp.y + sin * midAlong - cos * perpDist;
        const markerAngle = wp.angle - 90;
        return <ElevMarker key={`em-${i}`} cx={mx} cy={my} label={`E${i + 1}`} angle={markerAngle} />;
      })}

      {/* ── ROOM NAME (in open floor area, clear of tag row) ── */}
      {(() => {
        const wA = wallPositions[0];
        if (!wA) return null;
        const cx = wA.x + wA.length / 2;
        const cy = wA.y + WALL_T / 2 + BASE_D + (island ? AISLE - 7 : 70);
        return (
          <text x={cx} y={cy} fill={C.dimText}
            fontSize={7} fontFamily="Helvetica,Arial,sans-serif"
            textAnchor="middle" fontWeight="700" letterSpacing="2" opacity={0.85}>KITCHEN</text>
        );
      })()}

      {/* ── WORK TRIANGLE OVERLAY (analysis aid; debug only) ── */}
      {debug && (() => {
        const findAppCenter = (type) => {
          for (const wp of wallPositions) {
            const cabs = basesByWall[wp.id] || [];
            const app = cabs.find(c => {
              const at = (c.applianceType || '').toLowerCase();
              const sk = norm(c.sku);
              if (type === 'sink') return at === 'sink' || /^SB|^BSB|^IWS|^IBS|^DSB/.test(sk);
              if (type === 'range') return at === 'range' || at === 'cooktop' || /^RTB/.test(sk);
              if (type === 'fridge') return at === 'refrigerator' || at === 'freezer';
              return false;
            });
            if (app) {
              const rad = (wp.angle * Math.PI) / 180;
              const cos = Math.cos(rad), sin = Math.sin(rad);
              const along = app.position + app.width / 2;
              const perpDist = WALL_T / 2 + (app.depth || BASE_D) / 2;
              return { x: wp.x + cos * along + sin * perpDist, y: wp.y + sin * along - cos * perpDist };
            }
          }
          return null;
        };
        const sink = findAppCenter('sink');
        const range = findAppCenter('range');
        const fridge = findAppCenter('fridge');
        if (!sink || !range || !fridge) return null;
        const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        const legSR = dist(sink, range), legRF = dist(range, fridge), legFS = dist(fridge, sink);
        const total = legSR + legRF + legFS;
        const legOk = (l) => l >= 48 && l <= 108;
        const allOk = legOk(legSR) && legOk(legRF) && legOk(legFS) && total >= 144 && total <= 312;
        const color = allOk ? '#22c55e' : (total <= 360 ? '#f59e0b' : '#ef4444');
        const fmtFt = (inches) => {
          const ft = Math.floor(inches / 12), rem = Math.round(inches % 12);
          return rem > 0 ? `${ft}'-${rem}"` : `${ft}'-0"`;
        };
        const midPt = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        return (
          <g opacity={0.85}>
            <line x1={sink.x} y1={sink.y} x2={range.x} y2={range.y} stroke="#c0392b" strokeWidth={1.0} strokeDasharray="4,3" />
            <line x1={range.x} y1={range.y} x2={fridge.x} y2={fridge.y} stroke="#c0392b" strokeWidth={1.0} strokeDasharray="4,3" />
            <line x1={fridge.x} y1={fridge.y} x2={sink.x} y2={sink.y} stroke="#c0392b" strokeWidth={1.0} strokeDasharray="4,3" />
            <text x={midPt(sink, range).x} y={midPt(sink, range).y - 3} fill={color} fontSize={3.5}
              fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle" fontWeight="600">{fmtFt(legSR)}</text>
            <text x={midPt(range, fridge).x + 4} y={midPt(range, fridge).y} fill={color} fontSize={3.5}
              fontFamily="Helvetica,Arial,sans-serif" textAnchor="start" fontWeight="600">{fmtFt(legRF)}</text>
            <text x={midPt(fridge, sink).x - 4} y={midPt(fridge, sink).y} fill={color} fontSize={3.5}
              fontFamily="Helvetica,Arial,sans-serif" textAnchor="end" fontWeight="600">{fmtFt(legFS)}</text>
            <text x={sink.x} y={sink.y + 10} fill={color} fontSize={3}
              fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle" fontWeight="500">
              ▲ Total: {fmtFt(total)} {allOk ? '✓' : '⚠'}
            </text>
          </g>
        );
      })()}

      {/* ── LEGEND ── */}
      <g transform={`translate(14, ${viewBox.h - 22})`}>
        {[
          { label: 'Base Cabinet', dash: false, fill: C.cabFill },
          { label: 'Upper (overhead)', dash: true, fill: C.upperFill },
          { label: 'Appliance', dash: false, fill: '#eee' },
          { label: 'Island/Peninsula', dash: false, fill: C.islandFill },
          { label: '℄ Centerline', dash: false, fill: '#fff', cl: true },
        ].map((item, i) => (
          <g key={i} transform={`translate(${i * 78}, 0)`}>
            {item.cl ? (
              <line x1={0} y1={2.5} x2={5} y2={2.5} stroke={C.centerLine}
                strokeWidth={0.5} strokeDasharray={DASH.center} />
            ) : (
              <rect x={0} y={0} width={5} height={5} fill={item.fill}
                stroke={C.cabStroke} strokeWidth={0.35}
                strokeDasharray={item.dash ? DASH.upper : 'none'} />
            )}
            <text x={7} y={3.5} fill={C.dimText}
              fontSize={4} fontFamily="Helvetica,Arial,sans-serif" fontWeight="500">{item.label}</text>
          </g>
        ))}
      </g>

      {/* ── SHEET FOOTER: graphic scale bar + bordered title block ── */}
      {(() => {
        const tbW = 210, tbH = 48;
        const tbX = viewBox.w - tbW - 14, tbY = viewBox.h - tbH - 10;
        const rows = [
          ['PROJECT', titleBlock.project || 'Kitchen Floor Plan'],
          ['CLIENT', titleBlock.client || '—'],
          ['DESIGNER / DATE', `${titleBlock.designer || 'Eclipse Kitchen Designer'}  ·  ${titleBlock.date || new Date().toLocaleDateString('en-US')}`],
        ];
        const rowH = tbH / 3;
        // Graphic scale: plan units are 1 SVG unit = 1 inch, so 12 units = 1 ft.
        const ft = 12, sbX = tbX - 4 - 4 * ft, sbY = tbY + tbH - 8;
        return (
          <g>
            <text x={sbX} y={sbY - 3} fill={C.dimText} fontSize={4}
              fontFamily="Helvetica,Arial,sans-serif">SCALE — each band = 1'-0"</text>
            {[0, 1, 2, 3].map(k => (
              <rect key={`sb${k}`} x={sbX + k * ft} y={sbY} width={ft} height={3.4}
                fill={k % 2 ? '#ffffff' : C.dimText} stroke={C.dimText} strokeWidth={0.4} />
            ))}
            <rect x={tbX} y={tbY} width={tbW} height={tbH} fill="#ffffff" stroke={C.dimText} strokeWidth={0.9} />
            {rows.map(([label, value], i) => (
              <g key={`tbr${i}`}>
                {i > 0 && <line x1={tbX} y1={tbY + rowH * i} x2={tbX + tbW} y2={tbY + rowH * i} stroke={C.dimText} strokeWidth={0.4} />}
                <text x={tbX + 4} y={tbY + rowH * i + 5.5} fill="#888" fontSize={3.2}
                  fontFamily="Helvetica,Arial,sans-serif" letterSpacing={0.6}>{label}</text>
                <text x={tbX + 4} y={tbY + rowH * i + rowH - 3} fill={C.dimText} fontSize={4.6} fontWeight="700"
                  fontFamily="Helvetica,Arial,sans-serif">{String(value).slice(0, 52)}</text>
              </g>
            ))}
            <line x1={tbX + tbW - 38} y1={tbY + rowH * 2} x2={tbX + tbW - 38} y2={tbY + tbH} stroke={C.dimText} strokeWidth={0.4} />
            <text x={tbX + tbW - 34} y={tbY + rowH * 2 + 5.5} fill="#888" fontSize={3.2}
              fontFamily="Helvetica,Arial,sans-serif" letterSpacing={0.6}>SHEET</text>
            <text x={tbX + tbW - 34} y={tbY + tbH - 3} fill={C.dimText} fontSize={5.4} fontWeight="700"
              fontFamily="Helvetica,Arial,sans-serif">FP-1</text>
          </g>
        );
      })()}
    </svg>
  );
}
