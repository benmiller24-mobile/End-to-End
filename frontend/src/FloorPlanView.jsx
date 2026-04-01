import React, { useMemo } from 'react';

/**
 * FloorPlanView - Professional Architectural Kitchen Floor Plan (NKBA Standards)
 *
 * White background, solid thick walls, every cabinet numbered with diamond tags,
 * dimension strings on ALL sides, door swing arcs, dashed lines for upper cabinets,
 * appliance symbols per NKBA plan view standards.
 *
 * Data flow:
 *   solverResult.placements  -> all items with wall, position, width, type, sku, applianceType
 *   solverResult.uppers      -> [{wallId, cabinets:[...]}]
 *   solverResult.corners     -> [{wallA, wallB, sku, size}]
 *   solverResult._inputWalls -> [{id, length, ceilingHeight}]
 *   solverResult.island      -> {length, depth, ...}
 *   solverResult.peninsula   -> {length, depth, ...}
 */

// ─── CONSTANTS ────────────────────────────────────────────────────────
const WALL_T = 6;       // wall thickness (inches = SVG units, 1:1 scale)
const BASE_D = 24;      // base cabinet depth
const UPPER_D = 13;     // upper cabinet depth
const AISLE = 42;       // NKBA min work aisle

const C = {
  bg:        '#ffffff',
  wallFill:  '#222222',
  wallStroke:'#111111',
  cabStroke: '#444444',
  cabFill:   '#fafafa',
  upperFill: '#fafafa',
  dimLine:   '#444444',
  dimText:   '#333333',
  tagFill:   '#ffffff',
  tagStroke: '#333333',
  islandFill:'#f0ede8',
  islandStroke:'#888888',
  appStroke: '#555555',
};

// ─── HELPERS ──────────────────────────────────────────────────────────

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

/** Elevation marker triangle — points at wall to indicate where elevation is cut */
function ElevMarker({ cx, cy, label, angle = 0 }) {
  const sz = 8;
  // Triangle pointing in direction of 'angle'
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

/** Horizontal dimension line with ticks and label */
function HDim({ x1, x2, y, label, above = true }) {
  const len = Math.abs(x2 - x1);
  if (len < 6) return null;
  const ly = above ? y - 3.5 : y + 5;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={C.dimLine} strokeWidth={0.4} />
      <line x1={x1} y1={y - 2} x2={x1} y2={y + 2} stroke={C.dimLine} strokeWidth={0.4} />
      <line x1={x2} y1={y - 2} x2={x2} y2={y + 2} stroke={C.dimLine} strokeWidth={0.4} />
      <text x={(x1 + x2) / 2} y={ly} fill={C.dimText}
        fontSize={4.5} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="500">{label}</text>
    </g>
  );
}

/** Vertical dimension line with ticks and label */
function VDim({ y1, y2, x, label, left = true }) {
  const len = Math.abs(y2 - y1);
  if (len < 6) return null;
  const lx = left ? x - 5 : x + 5;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={C.dimLine} strokeWidth={0.4} />
      <line x1={x - 2} y1={y1} x2={x + 2} y2={y1} stroke={C.dimLine} strokeWidth={0.4} />
      <line x1={x - 2} y1={y2} x2={x + 2} y2={y2} stroke={C.dimLine} strokeWidth={0.4} />
      <text x={lx} y={my + 1.5} fill={C.dimText}
        fontSize={4.2} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="500"
        transform={`rotate(-90, ${lx}, ${my + 1.5})`}>{label}</text>
    </g>
  );
}

/** Plan view appliance symbol */
function PlanAppliance({ x, y, w, d, aType }) {
  const props = { x, y, width: w, height: d, fill: C.cabFill, stroke: C.cabStroke, strokeWidth: 0.5 };

  if (aType === 'range' || aType === 'cooktop') {
    return (
      <g>
        <rect {...props} />
        <circle cx={x + w * 0.3} cy={y + d * 0.3} r={Math.min(w, d) * 0.1} fill="none" stroke={C.appStroke} strokeWidth={0.35} />
        <circle cx={x + w * 0.7} cy={y + d * 0.3} r={Math.min(w, d) * 0.1} fill="none" stroke={C.appStroke} strokeWidth={0.35} />
        <circle cx={x + w * 0.3} cy={y + d * 0.7} r={Math.min(w, d) * 0.1} fill="none" stroke={C.appStroke} strokeWidth={0.35} />
        <circle cx={x + w * 0.7} cy={y + d * 0.7} r={Math.min(w, d) * 0.1} fill="none" stroke={C.appStroke} strokeWidth={0.35} />
      </g>
    );
  }
  if (aType === 'refrigerator') {
    return (
      <g>
        <rect {...props} />
        <path d={`M ${x + w} ${y + 2} A ${w - 2} ${w - 2} 0 0 1 ${x + w} ${y + d - 2}`}
          fill="none" stroke={C.appStroke} strokeWidth={0.3} opacity={0.5} />
      </g>
    );
  }
  if (aType === 'sink') {
    return (
      <g>
        <rect {...props} />
        {w > d + 4 ? (
          <>
            <ellipse cx={x + w / 3} cy={y + d / 2} rx={w / 7} ry={d / 3} fill="none" stroke={C.appStroke} strokeWidth={0.4} />
            <ellipse cx={x + 2 * w / 3} cy={y + d / 2} rx={w / 7} ry={d / 3} fill="none" stroke={C.appStroke} strokeWidth={0.4} />
          </>
        ) : (
          <ellipse cx={x + w / 2} cy={y + d / 2} rx={w / 3} ry={d / 2.8} fill="none" stroke={C.appStroke} strokeWidth={0.4} />
        )}
      </g>
    );
  }
  if (aType === 'dishwasher') {
    return (
      <g>
        <rect {...props} />
        <line x1={x + 1} y1={y + d / 2} x2={x + w - 1} y2={y + d / 2}
          stroke={C.appStroke} strokeWidth={0.3} opacity={0.5} />
      </g>
    );
  }
  return <rect {...props} />;
}

/** Door swing arc (quarter circle from hinge point) */
function DoorSwing({ x, y, w, d }) {
  if (w < 12) return null;
  // Arc from bottom-left corner outward
  return (
    <path d={`M ${x + 0.5} ${y + d} A ${w - 1} ${w - 1} 0 0 0 ${x + w - 0.5} ${y + d}`}
      fill="none" stroke={C.cabStroke} strokeWidth={0.2} opacity={0.4} />
  );
}

// ─── WALL SEGMENT RENDERER ───────────────────────────────────────────

function WallSegment({ wx, wy, angle, length, placements, upperCabs, wallId }) {
  // Resolve compound wall IDs (corner cabs: "wallA-wallB")
  const matchesWall = (pWall) => {
    if (pWall === wallId) return true;
    if (pWall && pWall.includes('-')) {
      const parts = pWall.split('-');
      return parts[0] === wallId || parts[1] === wallId;
    }
    return false;
  };

  // Filter ALL wall-assigned cabs (bases, talls, appliances, corners, fillers, end panels)
  const bases = placements.filter(p =>
    matchesWall(p.wall) && typeof p.position === 'number' && p.position >= 0 && p.width > 0
    && p.type !== 'upper' && p._elev?.zone !== 'UPPER'
    && !(p.wall && p.wall.startsWith('island'))
    && p.wall !== 'peninsula'
  ).sort((a, b) => a.position - b.position);

  // Filter upper cabs for this wall
  const uppers = (upperCabs || []).filter(u =>
    typeof u.position === 'number' && u.position >= 0 && u.width > 0
  ).sort((a, b) => a.position - b.position);

  return (
    <g transform={`translate(${wx}, ${wy}) rotate(${angle})`}>
      {/* ── WALL ── thick solid fill */}
      <rect x={0} y={-WALL_T / 2} width={length} height={WALL_T}
        fill={C.wallFill} stroke={C.wallStroke} strokeWidth={0.5} />

      {/* ── BASE CABINETS ── solid outline, below wall */}
      {bases.map((cab, i) => {
        const x = cab.position;
        const w = cab.width;
        const appType = (cab.applianceType || '').toLowerCase();
        const isFridge = appType === 'refrigerator' || appType === 'freezer' || appType === 'winecolumn';
        const d = cab.depth || cab._elev?.depth || (cab.type === 'tall' || isFridge ? 27 : BASE_D);
        const isApp = cab.type === 'appliance' || !!cab.applianceType;
        const isTall = cab.type === 'tall' || isFridge || cab._elev?.zone === 'TALL';
        const isCorner = cab.type === 'corner';

        return (
          <g key={`base-${i}`}>
            {isCorner ? (
              <>
                <rect x={x} y={WALL_T / 2} width={w} height={w}
                  fill={C.cabFill} stroke={C.cabStroke} strokeWidth={0.6} />
                <line x1={x} y1={WALL_T / 2 + w} x2={x + w} y2={WALL_T / 2}
                  stroke={C.cabStroke} strokeWidth={0.3} opacity={0.4} />
              </>
            ) : isApp ? (
              <PlanAppliance x={x} y={WALL_T / 2} w={w} d={d} aType={cab.applianceType} />
            ) : (
              <>
                <rect x={x} y={WALL_T / 2} width={w} height={d}
                  fill={C.cabFill} stroke={C.cabStroke} strokeWidth={0.5} />
                {/* Door swing arc for regular base cabs */}
                {!isTall && <DoorSwing x={x} y={WALL_T / 2} w={w} d={d} />}
              </>
            )}

            {/* Width label inside */}
            {w >= 12 && (
              <text x={x + w / 2} y={WALL_T / 2 + (isCorner ? w : d) / 2 + 1.2} fill={C.dimText}
                fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="500">{w}"</text>
            )}

            {/* Tall marker */}
            {isTall && !isApp && (
              <text x={x + 1} y={WALL_T / 2 + 4} fill={C.dimText}
                fontSize={2.8} fontFamily="Helvetica,Arial,sans-serif"
                fontStyle="italic" opacity={0.6}>TALL</text>
            )}

            {/* Appliance label in plan */}
            {isApp && w >= 15 && (
              <text x={x + w / 2} y={WALL_T / 2 + d / 2 - 2} fill={C.dimText}
                fontSize={2.8} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontStyle="italic" opacity={0.7}>
                {appType === 'range' ? 'RANGE' : appType === 'refrigerator' ? 'REF' :
                 appType === 'dishwasher' ? 'DW' : appType === 'sink' ? 'SINK' :
                 (appType || '').toUpperCase().substring(0, 6)}
              </text>
            )}
          </g>
        );
      })}

      {/* ── UPPER CABINETS ── dashed outline, behind wall */}
      {uppers.map((cab, i) => {
        const x = cab.position;
        const w = cab.width;
        const uy = -WALL_T / 2 - UPPER_D - 2;
        return (
          <g key={`upper-${i}`}>
            <rect x={x} y={uy} width={w} height={UPPER_D}
              fill={C.upperFill} stroke={C.cabStroke} strokeWidth={0.4}
              strokeDasharray="2.5,2" />
            {w >= 12 && (
              <text x={x + w / 2} y={uy + UPPER_D / 2 + 1} fill={C.dimText}
                fontSize={3} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" opacity={0.6}>{w}"</text>
            )}
          </g>
        );
      })}

      {/* ── WALL DIMENSION ── above wall */}
      <HDim x1={0} x2={length} y={-WALL_T / 2 - UPPER_D - 14} label={`${length}"`} above={true} />

      {/* ── INDIVIDUAL CABINET WIDTHS ── dimension string below cabinets */}
      {bases.length > 0 && (() => {
        const dimY = WALL_T / 2 + BASE_D + 10;
        const els = [];
        const first = bases[0].position;
        const lastCab = bases[bases.length - 1];
        const end = lastCab.position + lastCab.width;

        // Continuous line
        els.push(<line key="cl" x1={first} y1={dimY} x2={end} y2={dimY}
          stroke={C.dimLine} strokeWidth={0.35} />);

        bases.forEach((cab, i) => {
          const lx = cab.position;
          const rx = cab.position + cab.width;
          // Ticks
          els.push(<line key={`tl${i}`} x1={lx} y1={dimY - 2} x2={lx} y2={dimY + 2}
            stroke={C.dimLine} strokeWidth={0.35} />);
          if (i === bases.length - 1) {
            els.push(<line key={`tr${i}`} x1={rx} y1={dimY - 2} x2={rx} y2={dimY + 2}
              stroke={C.dimLine} strokeWidth={0.35} />);
          }
          // Extension lines
          els.push(<line key={`el${i}`} x1={lx} y1={WALL_T / 2 + (cab.depth || BASE_D)}
            x2={lx} y2={dimY + 2} stroke={C.dimLine} strokeWidth={0.2} strokeDasharray="1,1" opacity={0.5} />);
          if (i === bases.length - 1) {
            els.push(<line key={`er${i}`} x1={rx} y1={WALL_T / 2 + (cab.depth || BASE_D)}
              x2={rx} y2={dimY + 2} stroke={C.dimLine} strokeWidth={0.2} strokeDasharray="1,1" opacity={0.5} />);
          }
          // Width label
          if (cab.width >= 8) {
            els.push(
              <text key={`wl${i}`} x={(lx + rx) / 2} y={dimY - 3} fill={C.dimText}
                fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="500">{cab.width}"</text>
            );
          }
        });
        return els;
      })()}
    </g>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────

export default function FloorPlanView({ solverResult, inputWalls }) {
  if (!solverResult) return null;

  const walls = inputWalls || solverResult._inputWalls || [];
  const placements = solverResult.placements || [];
  const upperData = solverResult.uppers || [];
  const layoutType = solverResult.layoutType || 'single-wall';
  const island = solverResult.island;
  const peninsula = solverResult.peninsula;
  const corners = solverResult.corners || [];

  // Build upper cabs lookup by wallId
  const uppersByWall = useMemo(() => {
    const m = {};
    upperData.forEach(u => { m[u.wallId] = u.cabinets || []; });
    return m;
  }, [upperData]);

  // Calculate wall positions based on layout
  const wallPositions = useMemo(() => {
    const pos = [];
    const margin = 70;

    if (walls.length === 1) {
      pos.push({ id: walls[0].id, x: margin, y: margin + 50, angle: 0, length: walls[0].length });
    } else if (walls.length === 2) {
      const wA = walls[0], wB = walls[1];
      if (layoutType === 'galley' || layoutType === 'galley-peninsula') {
        pos.push({ id: wA.id, x: margin, y: margin + 50, angle: 0, length: wA.length });
        pos.push({ id: wB.id, x: margin, y: margin + 50 + BASE_D + AISLE + BASE_D + WALL_T, angle: 0, length: wB.length });
      } else {
        // L-shape
        pos.push({ id: wA.id, x: margin, y: margin + 50, angle: 0, length: wA.length });
        pos.push({ id: wB.id, x: margin + wA.length, y: margin + 50, angle: 90, length: wB.length });
      }
    } else if (walls.length >= 3) {
      const wA = walls[0], wB = walls[1], wC = walls[2];
      // U-shape
      pos.push({ id: wA.id, x: margin, y: margin + 50, angle: 0, length: wA.length });
      pos.push({ id: wB.id, x: margin + wA.length, y: margin + 50, angle: 90, length: wB.length });
      pos.push({ id: wC.id, x: margin + wA.length, y: margin + 50 + wB.length, angle: 180, length: wC.length });
    }
    return pos;
  }, [walls, layoutType]);

  // Calculate viewBox
  const viewBox = useMemo(() => {
    let maxX = 0, maxY = 0;
    wallPositions.forEach(wp => {
      const rad = (wp.angle * Math.PI) / 180;
      const ex = wp.x + Math.cos(rad) * wp.length;
      const ey = wp.y + Math.sin(rad) * wp.length;
      maxX = Math.max(maxX, wp.x, ex);
      maxY = Math.max(maxY, wp.y, ey);
    });
    return `0 0 ${Math.max(maxX + 100, 300)} ${Math.max(maxY + 120, 220)}`;
  }, [wallPositions]);

  // Resolve compound wall IDs
  const resolveWallId = (pWall) => {
    if (!pWall) return null;
    const wp = wallPositions.find(w => w.id === pWall);
    if (wp) return pWall;
    if (pWall.includes('-')) {
      const parts = pWall.split('-');
      if (wallPositions.find(w => w.id === parts[0])) return parts[0];
      if (wallPositions.find(w => w.id === parts[1])) return parts[1];
    }
    return null;
  };

  // Assign numbered tags to all cabinets across walls
  const tagAssignments = useMemo(() => {
    const tags = [];
    let num = 1;

    wallPositions.forEach(wp => {
      // All non-upper items on this wall (bases, talls, appliances, corners, fillers)
      const wallItems = placements.filter(p => {
        const resolved = resolveWallId(p.wall);
        return resolved === wp.id && typeof p.position === 'number' && p.position >= 0 && p.width > 0
          && p.type !== 'upper' && p._elev?.zone !== 'UPPER'
          && !(p.wall && p.wall.startsWith('island'))
          && p.wall !== 'peninsula';
      }).sort((a, b) => a.position - b.position);

      wallItems.forEach(item => {
        const appType = (item.applianceType || '').toLowerCase();
        const isFridge = appType === 'refrigerator' || appType === 'freezer';
        tags.push({
          wallId: wp.id,
          position: item.position,
          width: item.width,
          depth: item.depth || item._elev?.depth || (isFridge ? 27 : BASE_D),
          num: num++,
          sku: item.sku || item.applianceType || '',
          isAppliance: item.type === 'appliance',
          isTall: item.type === 'tall' || isFridge || item._elev?.zone === 'TALL',
        });
      });

      // Upper cabs on this wall
      const uppers = (uppersByWall[wp.id] || []).filter(u =>
        typeof u.position === 'number' && u.position >= 0 && u.width > 0
      ).sort((a, b) => a.position - b.position);

      uppers.forEach(item => {
        tags.push({
          wallId: wp.id,
          position: item.position,
          width: item.width,
          depth: UPPER_D,
          num: num++,
          sku: item.sku || '',
          isUpper: true,
        });
      });
    });

    return tags;
  }, [wallPositions, placements, uppersByWall]);

  const getWP = (id) => wallPositions.find(wp => wp.id === id);

  return (
    <svg viewBox={viewBox}
      style={{ width: '100%', height: 'auto', maxHeight: 700, background: C.bg, borderRadius: 4 }}
      xmlns="http://www.w3.org/2000/svg">

      {/* Title */}
      <text x="14" y="18" fill={C.dimText} fontSize={11} fontWeight="700"
        fontFamily="Helvetica,Arial,sans-serif">
        Kitchen Floor Plan - {layoutType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
      </text>
      <text x="14" y="30" fill="#666" fontSize={5.5} fontFamily="Helvetica,Arial,sans-serif">
        NKBA Standards | Scale: 1" = 1 unit | {placements.length} items | Dashed = upper cabinets
      </text>

      {/* ── WALLS + CABINETS ── */}
      {wallPositions.map(wp => (
        <WallSegment key={wp.id} wx={wp.x} wy={wp.y} angle={wp.angle}
          length={wp.length} placements={placements}
          upperCabs={uppersByWall[wp.id] || []} wallId={wp.id} />
      ))}

      {/* ── CORNER CABINETS at wall junctions ── */}
      {corners.map((corner, i) => {
        const wpA = getWP(corner.wallA);
        const wpB = getWP(corner.wallB);
        if (!wpA || !wpB) return null;

        let cx, cy;
        const aA = wpA.angle % 360;
        const aB = wpB.angle % 360;

        if (aA === 0 && aB === 90) {
          cx = wpA.x + wpA.length;
          cy = wpA.y;
        } else if (aB === 90) {
          cx = wpB.x;
          cy = wpB.y + wpB.length;
        } else {
          cx = wpA.x + Math.cos((wpA.angle * Math.PI) / 180) * wpA.length;
          cy = wpA.y + Math.sin((wpA.angle * Math.PI) / 180) * wpA.length;
        }

        const sz = corner.size || 36;
        return (
          <g key={`corner-${i}`}>
            <rect x={cx - sz / 2} y={cy - sz / 2 + WALL_T / 2} width={sz} height={sz}
              fill={C.cabFill} stroke={C.cabStroke} strokeWidth={0.6} />
            {/* Diagonal line (corner cabinet convention) */}
            <line x1={cx - sz / 2} y1={cy + sz / 2 + WALL_T / 2}
              x2={cx + sz / 2} y2={cy - sz / 2 + WALL_T / 2}
              stroke={C.cabStroke} strokeWidth={0.3} opacity={0.4} />
            <text x={cx} y={cy + WALL_T / 2 + 1} fill={C.dimText}
              fontSize={3.2} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="600">
              {(corner.sku || 'CORNER').replace(/^FC-/, '').substring(0, 8)}
            </text>
            <text x={cx} y={cy + WALL_T / 2 + 5} fill={C.dimText}
              fontSize={2.8} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" opacity={0.7}>{sz}"</text>
          </g>
        );
      })}

      {/* ── NUMBERED DIAMOND TAGS ── */}
      {tagAssignments.map((tag, i) => {
        const wp = getWP(tag.wallId);
        if (!wp) return null;

        const rad = (wp.angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Center of cabinet along wall
        const along = tag.position + tag.width / 2;
        // Offset perpendicular to wall
        const perpDist = tag.isUpper
          ? -(WALL_T / 2 + UPPER_D + 10)  // above wall for uppers
          : (WALL_T / 2 + (tag.depth || BASE_D) + 8);  // below wall for bases

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
              fill={C.islandFill} stroke={C.islandStroke} strokeWidth={0.6} />
            <text x={ix + iw / 2} y={iy + id / 2 + 1.5} fill={C.dimText}
              fontSize={4} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="600">ISLAND</text>
            {/* Island dimensions */}
            <HDim x1={ix} x2={ix + iw} y={iy + id + 10} label={`${iw}"`} above={false} />
            <VDim y1={iy} y2={iy + id} x={ix + iw + 10} label={`${id}"`} left={false} />
            {/* Aisle clearance */}
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
              fill={C.islandFill} stroke={C.islandStroke} strokeWidth={0.6} />
            <HDim x1={px} x2={px + pw} y={py + pd + 8} label={`${pw}"`} above={false} />
            <VDim y1={py} y2={py + pd} x={px + pw + 8} label={`${pd}"`} left={false} />
          </g>
        );
      })()}

      {/* ── ELEVATION MARKERS (NKBA Ch.2 Fig 2.1 — triangles pointing at walls) ── */}
      {wallPositions.map((wp, i) => {
        const rad = (wp.angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        // Place marker at midpoint of wall, offset toward the room interior
        const midAlong = wp.length / 2;
        const perpDist = WALL_T / 2 + BASE_D + 55; // well inside the room
        const mx = wp.x + cos * midAlong + sin * perpDist;
        const my = wp.y + sin * midAlong - cos * perpDist;
        // Triangle points toward wall (opposite of perpDist direction)
        const markerAngle = wp.angle - 90;
        return (
          <ElevMarker key={`em-${i}`} cx={mx} cy={my}
            label={`E${i + 1}`} angle={markerAngle} />
        );
      })}

      {/* ── ROOM LABEL (centered in room per NKBA Ch.2) ── */}
      {(() => {
        // Find center of kitchen space
        const wA = wallPositions[0];
        if (!wA) return null;
        const cx = wA.x + wA.length / 2;
        const cy = wA.y + WALL_T / 2 + BASE_D + (island ? AISLE / 2 : 40);
        return (
          <g>
            <text x={cx} y={cy} fill={C.dimText}
              fontSize={8} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="700" letterSpacing="2">KITCHEN</text>
            <text x={cx} y={cy + 10} fill={C.dimText}
              fontSize={4} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" opacity={0.6}>
              NKBA Standards | Scale: 1/2" = 1'-0"
            </text>
          </g>
        );
      })()}

      {/* ── LEGEND ── */}
      <g transform={`translate(14, ${parseFloat(viewBox.split(' ')[3]) - 22})`}>
        {[
          { label: 'Base Cabinet', dash: false, fill: C.cabFill },
          { label: 'Upper (dashed)', dash: true, fill: C.upperFill },
          { label: 'Appliance', dash: false, fill: '#eee' },
          { label: 'Island/Peninsula', dash: false, fill: C.islandFill },
        ].map((item, i) => (
          <g key={i} transform={`translate(${i * 90}, 0)`}>
            <rect x={0} y={0} width={5} height={5} fill={item.fill}
              stroke={C.cabStroke} strokeWidth={0.35}
              strokeDasharray={item.dash ? '1.5,1.5' : 'none'} />
            <text x={7} y={3.5} fill={C.dimText}
              fontSize={4} fontFamily="Helvetica,Arial,sans-serif" fontWeight="500">{item.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
