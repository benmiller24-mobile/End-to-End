import React, { useMemo } from 'react';

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
const BASE_D = 24;      // base cabinet depth
const UPPER_D = 13;     // upper cabinet depth
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
                if (isLazySusan) {
                  return (
                    <>
                      <rect x={x} y={WALL_T / 2} width={w} height={w}
                        fill={C.cabFill} stroke={C.cabStroke} strokeWidth={W.cab} />
                      <circle cx={x + w / 2} cy={WALL_T / 2 + w / 2} r={w * 0.4}
                        fill="none" stroke={C.cabStroke} strokeWidth={W.cabThin}
                        strokeDasharray={DASH.hidden} opacity={0.5} />
                    </>
                  );
                }
                if (isBBC) {
                  const accessW = Math.min(24, w * 0.55);
                  const blindW = w - accessW;
                  return (
                    <>
                      <rect x={x} y={WALL_T / 2} width={accessW} height={24}
                        fill={C.cabFill} stroke={C.cabStroke} strokeWidth={W.cab} />
                      <rect x={x + accessW} y={WALL_T / 2} width={blindW} height={24}
                        fill={C.blindFill} stroke={C.cabStroke} strokeWidth={W.cabThin} />
                      {Array.from({ length: Math.ceil(blindW / 4) }, (_, hi) => {
                        const hx = x + accessW + hi * 4;
                        return (
                          <line key={`bh${hi}`} x1={hx} y1={WALL_T / 2}
                            x2={Math.min(hx + w, x + w)} y2={WALL_T / 2 + Math.min(24, (x + w - hx))}
                            stroke={C.cabStroke} strokeWidth={W.light} opacity={0.5} />
                        );
                      })}
                    </>
                  );
                }
                return (
                  <>
                    <rect x={x} y={WALL_T / 2} width={w} height={w}
                      fill={C.cabFill} stroke={C.cabStroke} strokeWidth={W.cab} />
                    <line x1={x} y1={WALL_T / 2 + w} x2={x + w} y2={WALL_T / 2}
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
              <text x={x + w / 2} y={WALL_T / 2 + (isCorner ? w : d) / 2 + 1.2} fill={C.dimText}
                fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="500">{cab.sku ? `${cab.sku}` : `${w}"`}</text>
            )}
            {cab.sku && w >= 20 && (
              <text x={x + w / 2} y={WALL_T / 2 + (isCorner ? w : d) / 2 + 4.8} fill="#5c6370"
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

export default function FloorPlanView({ solverResult, inputWalls, debug = false }) {
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
      if (!wid) return;
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
    const pos = [];
    const margin = 70;
    if (walls.length === 1) {
      pos.push({ id: walls[0].id, x: margin, y: margin + 56, angle: 0, length: walls[0].length });
    } else if (walls.length === 2) {
      const wA = walls[0], wB = walls[1];
      if (layoutType === 'galley' || layoutType === 'galley-peninsula') {
        pos.push({ id: wA.id, x: margin, y: margin + 56, angle: 0, length: wA.length });
        pos.push({ id: wB.id, x: margin, y: margin + 56 + BASE_D + AISLE + BASE_D + WALL_T, angle: 0, length: wB.length });
      } else {
        pos.push({ id: wA.id, x: margin, y: margin + 56, angle: 0, length: wA.length });
        pos.push({ id: wB.id, x: margin + wA.length, y: margin + 56, angle: 90, length: wB.length });
      }
    } else if (walls.length >= 3) {
      const wA = walls[0], wB = walls[1], wC = walls[2];
      pos.push({ id: wA.id, x: margin, y: margin + 56, angle: 0, length: wA.length });
      pos.push({ id: wB.id, x: margin + wA.length, y: margin + 56, angle: 90, length: wB.length });
      pos.push({ id: wC.id, x: margin + wA.length, y: margin + 56 + wB.length, angle: 180, length: wC.length });
    }
    return pos;
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
    return `0 0 ${Math.max(maxX + 110, 300)} ${Math.max(maxY + 130, 220)}`;
  }, [wallPositions]);

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
    <svg viewBox={viewBox}
      style={{ width: '100%', height: 'auto', maxHeight: 700, background: C.bg, borderRadius: 4 }}
      xmlns="http://www.w3.org/2000/svg">

      <text x="14" y="18" fill={C.dimText} fontSize={11} fontWeight="700"
        fontFamily="Helvetica,Arial,sans-serif" letterSpacing="1">KITCHEN FLOOR PLAN</text>
      <text x="14" y="28" fill="#666" fontSize={5} fontFamily="Helvetica,Arial,sans-serif">
        {layoutType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Layout  |  Scale: 1/2" = 1'-0"  |  NKBA Drawing Standards
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

      {/* ── ISLAND ── */}
      {island && (() => {
        const wA = wallPositions[0];
        if (!wA) return null;
        const iw = island.length || 96;
        const id = island.depth || 42;
        const ix = wA.x + (wA.length - iw) / 2;
        const iy = wA.y + WALL_T / 2 + BASE_D + AISLE;
        return (
          <g>
            <rect x={ix} y={iy} width={iw} height={id}
              fill={C.islandFill} stroke={C.islandStroke} strokeWidth={W.cab} />
            <text x={ix + iw / 2} y={iy + id / 2 + 1.5} fill={C.dimText}
              fontSize={4} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="600">ISLAND</text>
            <HDim x1={ix} x2={ix + iw} y={iy + id + 10} label={`${iw}"`} above={false} />
            <VDim y1={iy} y2={iy + id} x={ix + iw + 10} label={`${id}"`} left={false} />
            <VDim y1={wA.y + WALL_T / 2 + BASE_D} y2={iy} x={ix - 10}
              label={`${AISLE}" aisle`} left={true} />
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
      <g transform={`translate(14, ${parseFloat(viewBox.split(' ')[3]) - 22})`}>
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
    </svg>
  );
}
