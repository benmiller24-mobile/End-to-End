import React, { useMemo } from 'react';

/**
 * ElevationView â Professional SVG front elevation of each wall
 * Shows base cabinets, uppers, tall units, appliances, range hood,
 * with door/drawer detail, dimensions, and SKU labels.
 * Renders each wall as a separate elevation panel.
 */

const COLORS = {
  wall: '#475569',
  wallFill: '#0f172a',
  base: '#3b82f6',
  baseFill: '#1e3a5f',
  baseStroke: '#3b82f6',
  upper: '#8b5cf6',
  upperFill: '#2d1f5e',
  upperStroke: '#8b5cf6',
  tall: '#f59e0b',
  tallFill: '#422006',
  tallStroke: '#f59e0b',
  appliance: '#10b981',
  applianceFill: '#064e3b',
  corner: '#ef4444',
  cornerFill: '#451a1a',
  hood: '#06b6d4',
  hoodFill: '#083344',
  dim: '#94a3b8',
  dimLine: '#475569',
  text: '#f1f5f9',
  bg: '#0f172a',
  floor: '#334155',
  counter: '#f59e0b',
  toekick: '#1e293b',
};

// Standard heights in inches
const TOEKICK_H = 4.5;
const BASE_H = 34.5;
const COUNTER_H = 1.5;
const UPPER_GAP = 18; // gap between counter and upper bottom
const UPPER_H = 36;
const TALL_H = 96;
const SCALE = 2.2; // SVG pixels per inch

function elevColor(type, sku) {
  if (type === 'appliance') return { stroke: COLORS.appliance, fill: COLORS.applianceFill };
  if (type === 'tall') return { stroke: COLORS.tallStroke, fill: COLORS.tallFill };
  if (type === 'rangeHood' || type === 'hood') return { stroke: COLORS.hood, fill: COLORS.hoodFill };
  if (type === 'corner' || type === 'wall_corner') return { stroke: COLORS.corner, fill: COLORS.cornerFill };
  if (sku && /^[WS]/.test(sku) && !/^WSC/.test(sku)) return { stroke: COLORS.upperStroke, fill: COLORS.upperFill };
  return { stroke: COLORS.baseStroke, fill: COLORS.baseFill };
}

// Draw door lines on a cabinet rect
function DoorDetail({ x, y, w, h, doorCount, drawerCount, type }) {
  const lines = [];
  const inset = 2 * SCALE;

  if (type === 'appliance') {
    // X pattern
    lines.push(<line key="x1" x1={x + inset} y1={y + inset} x2={x + w - inset} y2={y + h - inset} stroke={COLORS.appliance} strokeWidth={0.4} opacity={0.4} />);
    lines.push(<line key="x2" x1={x + w - inset} y1={y + inset} x2={x + inset} y2={y + h - inset} stroke={COLORS.appliance} strokeWidth={0.4} opacity={0.4} />);
    return <>{lines}</>;
  }

  if (drawerCount > 0 && h > 20) {
    // Draw drawer lines from top
    const drawerH = Math.min(h * 0.4, drawerCount * 6 * SCALE) / drawerCount;
    for (let i = 0; i < drawerCount; i++) {
      const dy = y + inset + i * drawerH;
      lines.push(<rect key={`dr${i}`} x={x + inset} y={dy} width={w - 2 * inset} height={drawerH - 1}
        fill="none" stroke={COLORS.dim} strokeWidth={0.3} rx={0.5} />);
      // Pull
      lines.push(<line key={`drp${i}`} x1={x + w / 2 - 4} y1={dy + drawerH / 2} x2={x + w / 2 + 4} y2={dy + drawerH / 2}
        stroke={COLORS.dim} strokeWidth={0.6} />);
    }
    // Door(s) below drawers
    const doorY = y + inset + drawerCount * drawerH + 1;
    const doorH = h - inset * 2 - drawerCount * drawerH - 1;
    if (doorH > 5) {
      const dc = doorCount || (w > 30 * SCALE ? 2 : 1);
      const dw = (w - 2 * inset) / dc;
      for (let i = 0; i < dc; i++) {
        lines.push(<rect key={`d${i}`} x={x + inset + i * dw} y={doorY} width={dw - 1} height={doorH}
          fill="none" stroke={COLORS.dim} strokeWidth={0.3} rx={0.5} />);
      }
    }
  } else if (doorCount > 0 || w > 15) {
    // Just doors
    const dc = doorCount || (w > 30 * SCALE ? 2 : 1);
    const dw = (w - 2 * inset) / dc;
    for (let i = 0; i < dc; i++) {
      lines.push(<rect key={`d${i}`} x={x + inset + i * dw} y={y + inset} width={dw - 1} height={h - 2 * inset}
        fill="none" stroke={COLORS.dim} strokeWidth={0.3} rx={0.5} />);
    }
  }

  return <>{lines}</>;
}

// Single wall elevation
function WallElevation({ wallId, wallLength, bases, uppers, talls, appliances, hood, trim = {} }) {
  const wallW = wallLength * SCALE;
  const totalH = TALL_H * SCALE + 20;
  const floorY = totalH - 10;

  // Base cabinet Y (from floor up)
  const baseBottomY = floorY;
  const baseTopY = floorY - BASE_H * SCALE;
  const toekickY = floorY - TOEKICK_H * SCALE;
  const counterY = baseTopY - COUNTER_H * SCALE;

  // Upper cabinet Y
  const upperBottomY = counterY - UPPER_GAP * SCALE;
  const upperTopY = upperBottomY - UPPER_H * SCALE;

  return (
    <svg viewBox={`-20 -10 ${wallW + 50} ${totalH + 20}`} data-pdf="elevation"
      style={{ width: '100%', height: 'auto', maxHeight: 400, background: COLORS.bg, borderRadius: 6, marginBottom: 12 }}
      xmlns="http://www.w3.org/2000/svg">

      {/* Wall label */}
      <text x={wallW / 2} y={0} fill={COLORS.text} fontSize={10} fontWeight="bold"
        fontFamily="Inter, sans-serif" textAnchor="middle">
        Wall {wallId} Elevation â {wallLength}"
      </text>

      {/* Back wall */}
      <rect x={0} y={upperTopY - 5} width={wallW} height={floorY - upperTopY + 5}
        fill={COLORS.wallFill} stroke={COLORS.wall} strokeWidth={0.5} />

      {/* Floor line */}
      <line x1={-10} y1={floorY} x2={wallW + 10} y2={floorY} stroke={COLORS.floor} strokeWidth={1.5} />

      {/* Toekick zone */}
      <rect x={0} y={toekickY} width={wallW} height={TOEKICK_H * SCALE}
        fill={COLORS.toekick} stroke="none" opacity={0.5} />

      {/* Counter line (where countertop sits) */}
      {bases.length > 0 && (() => {
        const minX = Math.min(...bases.filter(b => typeof b.position === 'number').map(b => b.position * SCALE));
        const maxX = Math.max(...bases.filter(b => typeof b.position === 'number').map(b => (b.position + b.width) * SCALE));
        return (
          <line x1={minX} y1={counterY} x2={maxX} y2={counterY}
            stroke={COLORS.counter} strokeWidth={1.5} />
        );
      })()}

      {/* Base cabinets */}
      {bases.map((cab, i) => {
        if (typeof cab.position !== 'number' || cab.position < 0) return null;
        const x = cab.position * SCALE;
        const w = cab.width * SCALE;
        const h = (cab.height || (BASE_H - TOEKICK_H)) * SCALE;
        const y = baseBottomY - h - TOEKICK_H * SCALE;
        const { stroke, fill } = elevColor(cab.type, cab.sku);

        const isApp = cab.type === 'appliance';
        const sku = (cab.sku || cab.applianceType || '').replace(/^FC-/, '');
        const drawerCount = sku.match(/B(\d?)D/) ? parseInt(sku.match(/B(\d?)D/)[1] || '1') : 0;
        const doorCount = sku.match(/^B(\d{2})$/) ? (cab.width > 24 ? 2 : 1) : 0;

        return (
          <g key={`base-${i}`}>
            <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={0.8} rx={1} />
            <DoorDetail x={x} y={y} w={w} h={h} doorCount={doorCount} drawerCount={drawerCount} type={cab.type} />
            {/* SKU label */}
            {w > 12 * SCALE && (
              <text x={x + w / 2} y={y + h + TOEKICK_H * SCALE + 8} fill={COLORS.dim}
                fontSize={5} fontFamily="monospace" textAnchor="middle" transform={`rotate(-90, ${x + w / 2}, ${y + h + TOEKICK_H * SCALE + 8})`}>
                {sku.substring(0, 10)}
              </text>
            )}
            {/* Width dim */}
            {w > 15 * SCALE && (
              <text x={x + w / 2} y={baseBottomY + 9} fill={COLORS.dim}
                fontSize={5} fontFamily="Inter, sans-serif" textAnchor="middle">{cab.width}"</text>
            )}
          </g>
        );
      })}

      {/* Upper cabinets */}
      {uppers.map((cab, i) => {
        if (typeof cab.position !== 'number' || cab.position < 0) return null;
        const x = cab.position * SCALE;
        const w = cab.width * SCALE;
        const h = (cab.height || UPPER_H) * SCALE;
        const y = upperBottomY - h;
        if (cab.type === 'end_panel' || cab.width < 1) return null;
        const { stroke, fill } = elevColor(cab.type || 'wall', cab.sku);
        const sku = (cab.sku || '').replace(/^FC-/, '');

        return (
          <g key={`upper-${i}`}>
            <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={0.8} rx={1} />
            {/* Door detail */}
            <DoorDetail x={x} y={y} w={w} h={h} doorCount={cab.width > 24 ? 2 : 1} drawerCount={0} type={cab.type} />
            {w > 12 * SCALE && (
              <text x={x + w / 2} y={y + h / 2 + 2} fill={COLORS.text}
                fontSize={5} fontFamily="monospace" textAnchor="middle">{sku.substring(0, 8)}</text>
            )}
          </g>
        );
      })}

      {/* Tall units */}
      {talls.map((cab, i) => {
        const x = (cab.position || 0) * SCALE;
        const w = (cab.width || 18) * SCALE;
        const h = (cab.height || TALL_H) * SCALE;
        const y = floorY - h;
        const { stroke, fill } = elevColor('tall', cab.sku);
        const sku = (cab.sku || '').replace(/^FC-/, '');

        return (
          <g key={`tall-${i}`}>
            <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth={0.8} rx={1} />
            <text x={x + w / 2} y={y + h / 2 + 2} fill={COLORS.text}
              fontSize={5} fontFamily="monospace" textAnchor="middle" writingMode="vertical-rl">{sku.substring(0, 12)}</text>
          </g>
        );
      })}

      {/* Range hood */}
      {hood && typeof hood.position === 'number' && (
        (() => {
          const x = hood.position * SCALE;
          const w = (hood.width || 36) * SCALE;
          const h = (hood.height || 24) * SCALE;
          const y = counterY - UPPER_GAP * SCALE - h;
          return (
            <g>
              {/* Trapezoidal hood shape */}
              <polygon
                points={`${x},${y + h} ${x + 4},${y} ${x + w - 4},${y} ${x + w},${y + h}`}
                fill={COLORS.hoodFill} stroke={COLORS.hood} strokeWidth={0.8} />
              <text x={x + w / 2} y={y + h / 2 + 2} fill={COLORS.hood}
                fontSize={5} fontFamily="monospace" textAnchor="middle">HOOD</text>
            </g>
          );
        })()
      )}

      {/* ââ TRIM & MOLDING ââ */}
      {/* Crown molding â decorative strip at top of uppers */}
      {trim.crown && uppers.length > 0 && (() => {
        const upperPositions = uppers.filter(u => typeof u.position === 'number');
        if (upperPositions.length === 0) return null;
        const minX = Math.min(...upperPositions.map(u => u.position * SCALE));
        const maxX = Math.max(...upperPositions.map(u => (u.position + u.width) * SCALE));
        const crownH = 3.5 * SCALE;
        const crownY = upperTopY - crownH;
        return (
          <g>
            <rect x={minX - 1} y={crownY} width={maxX - minX + 2} height={crownH}
              fill="#c8b090" stroke="#a89870" strokeWidth={0.5} />
            {/* Profile lines */}
            <line x1={minX - 1} y1={crownY + crownH * 0.3} x2={maxX + 1} y2={crownY + crownH * 0.3}
              stroke="#b8a080" strokeWidth={0.3} />
            <line x1={minX - 1} y1={crownY + crownH * 0.65} x2={maxX + 1} y2={crownY + crownH * 0.65}
              stroke="#b8a080" strokeWidth={0.3} />
            <text x={maxX + 6} y={crownY + crownH / 2 + 1.5} fill={COLORS.dim}
              fontSize={4} fontFamily="Inter, sans-serif">Crown</text>
          </g>
        );
      })()}

      {/* Light rail â thin strip under upper cabinets */}
      {trim.lightRail && uppers.length > 0 && (() => {
        const upperPositions = uppers.filter(u => typeof u.position === 'number');
        if (upperPositions.length === 0) return null;
        const minX = Math.min(...upperPositions.map(u => u.position * SCALE));
        const maxX = Math.max(...upperPositions.map(u => (u.position + u.width) * SCALE));
        const lrH = 1.75 * SCALE;
        return (
          <g>
            <rect x={minX} y={upperBottomY} width={maxX - minX} height={lrH}
              fill="#a89870" stroke="#907848" strokeWidth={0.4} />
            <text x={maxX + 6} y={upperBottomY + lrH / 2 + 1.5} fill={COLORS.dim}
              fontSize={4} fontFamily="Inter, sans-serif">LR</text>
          </g>
        );
      })()}

      {/* Traditional trim â red accent line at counter level */}
      {trim.traditionalTrim && bases.length > 0 && (() => {
        const basePositions = bases.filter(b => typeof b.position === 'number');
        if (basePositions.length === 0) return null;
        const minX = Math.min(...basePositions.map(b => b.position * SCALE));
        const maxX = Math.max(...basePositions.map(b => (b.position + b.width) * SCALE));
        const trimH = 0.875 * SCALE;
        return (
          <rect x={minX} y={counterY - COUNTER_H * SCALE - trimH} width={maxX - minX} height={trimH}
            fill="#c44" stroke="none" />
        );
      })()}

      {/* Height dimensions (right side) */}
      <g>
        {/* Base height */}
        <line x1={wallW + 8} y1={baseBottomY} x2={wallW + 8} y2={baseTopY} stroke={COLORS.dimLine} strokeWidth={0.5} />
        <text x={wallW + 12} y={(baseBottomY + baseTopY) / 2 + 2} fill={COLORS.dim}
          fontSize={5} fontFamily="Inter, sans-serif">{BASE_H}"</text>

        {/* Counter */}
        <line x1={wallW + 4} y1={counterY} x2={wallW + 18} y2={counterY} stroke={COLORS.counter} strokeWidth={0.3} strokeDasharray="2,2" />
        <text x={wallW + 12} y={counterY - 2} fill={COLORS.counter}
          fontSize={4} fontFamily="Inter, sans-serif">36" AFF</text>

        {/* Upper bottom line */}
        {uppers.length > 0 && (
          <>
            <line x1={wallW + 4} y1={upperBottomY} x2={wallW + 18} y2={upperBottomY} stroke={COLORS.dimLine} strokeWidth={0.3} strokeDasharray="2,2" />
            <text x={wallW + 12} y={upperBottomY - 2} fill={COLORS.dim}
              fontSize={4} fontFamily="Inter, sans-serif">54" AFF</text>
          </>
        )}
      </g>

      {/* Overall width dimension below */}
      <line x1={0} y1={floorY + 16} x2={wallW} y2={floorY + 16} stroke={COLORS.dim} strokeWidth={0.5} />
      <text x={wallW / 2} y={floorY + 24} fill={COLORS.dim}
        fontSize={6} fontFamily="Inter, sans-serif" textAnchor="middle">{wallLength}"</text>
    </svg>
  );
}

export default function ElevationView({ solverResult, trim = {} }) {
  if (!solverResult) return null;

  const placements = solverResult.placements || [];
  const upperData = solverResult.uppers || [];
  const inputWalls = solverResult._inputWalls || [];

  // Group placements by wall
  const wallData = useMemo(() => {
    const data = {};
    inputWalls.forEach(w => {
      data[w.id] = {
        id: w.id,
        length: w.length,
        bases: [],
        uppers: [],
        talls: [],
        appliances: [],
        hood: null,
      };
    });

    // Base-level placements
    placements.forEach(p => {
      const wid = p.wall;
      if (!wid || !data[wid]) return;
      if (p.type === 'tall') data[wid].talls.push(p);
      else if (p.type === 'appliance') { data[wid].bases.push(p); data[wid].appliances.push(p); }
      else if (p.type === 'base' && typeof p.position === 'number') data[wid].bases.push(p);
    });

    // Upper-level placements from solver uppers array
    upperData.forEach(uw => {
      const wid = uw.wallId;
      if (!wid || !data[wid]) return;
      (uw.cabinets || []).forEach(c => {
        if (c.type === 'rangeHood') {
          data[wid].hood = c;
        } else {
          data[wid].uppers.push(c);
        }
      });
    });

    return Object.values(data);
  }, [placements, upperData, inputWalls]);

  return (
    <div>
      {wallData.map(wd => (
        <WallElevation key={wd.id} wallId={wd.id} wallLength={wd.length}
          bases={wd.bases} uppers={wd.uppers} talls={wd.talls}
          appliances={wd.appliances} hood={wd.hood} trim={trim} />
      ))}
    </div>
  );
}
