import React, { useMemo } from 'react';

/**
 * FloorPlanView â Professional SVG top-down floor plan
 * Shows walls, base cabinets, appliances, island/peninsula, and dimensions.
 * Renders at 1 inch = 1 SVG unit, then scales to fit viewport.
 */

const COLORS = {
  wall: '#475569',
  wallFill: '#1e293b',
  base: '#3b82f6',
  baseFill: '#1e3a5f',
  upper: '#8b5cf6',
  upperFill: '#2d1f5e',
  tall: '#f59e0b',
  tallFill: '#422006',
  appliance: '#10b981',
  applianceFill: '#064e3b',
  corner: '#ef4444',
  cornerFill: '#451a1a',
  island: '#06b6d4',
  islandFill: '#083344',
  dim: '#94a3b8',
  dimLine: '#475569',
  text: '#f1f5f9',
  bg: '#0f172a',
  grid: '#1e293b',
};

const WALL_THICKNESS = 6;
const BASE_DEPTH = 24;
const UPPER_DEPTH = 13;

function cabinetColor(type, sku) {
  if (type === 'appliance') return { stroke: COLORS.appliance, fill: COLORS.applianceFill };
  if (type === 'corner' || type === 'wall_corner') return { stroke: COLORS.corner, fill: COLORS.cornerFill };
  if (type === 'tall') return { stroke: COLORS.tall, fill: COLORS.tallFill };
  if (sku && /^[WS]/.test(sku)) return { stroke: COLORS.upper, fill: COLORS.upperFill };
  return { stroke: COLORS.base, fill: COLORS.baseFill };
}

// Dimension line with arrows
function DimLine({ x1, y1, x2, y2, label, offset = 20, flip = false }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 10) return null;

  const nx = -dy / len, ny = dx / len;
  const dir = flip ? -1 : 1;
  const ox = nx * offset * dir, oy = ny * offset * dir;

  const sx = x1 + ox, sy = y1 + oy;
  const ex = x2 + ox, ey = y2 + oy;
  const mx = (sx + ex) / 2, my = (sy + ey) / 2;

  const angle = Math.atan2(ey - sy, ex - sx) * 180 / Math.PI;
  const textAngle = angle > 90 || angle < -90 ? angle + 180 : angle;

  return (
    <g>
      {/* Extension lines */}
      <line x1={x1} y1={y1} x2={sx} y2={sy} stroke={COLORS.dimLine} strokeWidth={0.3} strokeDasharray="2,2" />
      <line x1={x2} y1={y2} x2={ex} y2={ey} stroke={COLORS.dimLine} strokeWidth={0.3} strokeDasharray="2,2" />
      {/* Dimension line */}
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={COLORS.dim} strokeWidth={0.5} markerStart="url(#arrowStart)" markerEnd="url(#arrowEnd)" />
      {/* Label */}
      <text x={mx} y={my - 3} fill={COLORS.dim} fontSize={7} fontFamily="Inter, sans-serif" textAnchor="middle"
        transform={`rotate(${textAngle}, ${mx}, ${my - 3})`}>{label}</text>
    </g>
  );
}

// Single wall cabinets rendered in plan view
function WallCabinets({ wallX, wallY, wallAngle, wallLength, placements, wallId }) {
  const baseCabs = placements.filter(p =>
    p.wall === wallId && typeof p.position === 'number' && p.position >= 0 && p.width > 1
    && (p.type === 'base' || p.type === 'tall' || p.type === 'appliance' || (!p.type && p.sku))
  );

  return (
    <g transform={`translate(${wallX}, ${wallY}) rotate(${wallAngle})`}>
      {/* Wall line */}
      <rect x={0} y={-WALL_THICKNESS / 2} width={wallLength} height={WALL_THICKNESS}
        fill={COLORS.wallFill} stroke={COLORS.wall} strokeWidth={1} />

      {/* Base cabinets along wall (drawn below wall = positive Y) */}
      {baseCabs.map((cab, i) => {
        const x = cab.position;
        const w = cab.width;
        const d = cab.depth || (cab.type === 'tall' ? 24 : BASE_DEPTH);
        const { stroke, fill } = cabinetColor(cab.type, cab.sku);
        const label = (cab.sku || cab.applianceType || '').replace(/^FC-/, '').substring(0, 8);
        return (
          <g key={`${wallId}-${i}`}>
            <rect x={x} y={WALL_THICKNESS / 2} width={w} height={d}
              fill={fill} stroke={stroke} strokeWidth={0.8} rx={1} />
            {w >= 12 && (
              <text x={x + w / 2} y={WALL_THICKNESS / 2 + d / 2 + 2} fill={COLORS.text}
                fontSize={w > 24 ? 6 : 5} fontFamily="monospace" textAnchor="middle">{label}</text>
            )}
            {/* Width label */}
            {w >= 15 && (
              <text x={x + w / 2} y={WALL_THICKNESS / 2 + d - 3} fill={COLORS.dim}
                fontSize={4} fontFamily="Inter, sans-serif" textAnchor="middle">{w}"</text>
            )}
            {/* Door/drawer lines for detail */}
            {cab.type === 'base' && w >= 18 && (
              <>
                {/* Center line for double door */}
                <line x1={x + w / 2} y1={WALL_THICKNESS / 2 + 2} x2={x + w / 2} y2={WALL_THICKNESS / 2 + d - 2}
                  stroke={stroke} strokeWidth={0.3} opacity={0.4} />
              </>
            )}
            {/* Appliance X pattern */}
            {cab.type === 'appliance' && (
              <>
                <line x1={x + 2} y1={WALL_THICKNESS / 2 + 2} x2={x + w - 2} y2={WALL_THICKNESS / 2 + d - 2} stroke={COLORS.appliance} strokeWidth={0.4} opacity={0.5} />
                <line x1={x + w - 2} y1={WALL_THICKNESS / 2 + 2} x2={x + 2} y2={WALL_THICKNESS / 2 + d - 2} stroke={COLORS.appliance} strokeWidth={0.4} opacity={0.5} />
              </>
            )}
          </g>
        );
      })}

      {/* Wall dimension */}
      <DimLine x1={0} y1={0} x2={wallLength} y2={0} label={`${wallLength}"`} offset={-16} />

      {/* Wall label */}
      <text x={wallLength / 2} y={-22} fill={COLORS.text} fontSize={8} fontWeight="bold"
        fontFamily="Inter, sans-serif" textAnchor="middle">Wall {wallId}</text>
    </g>
  );
}

export default function FloorPlanView({ solverResult, inputWalls }) {
  if (!solverResult) return null;

  const walls = inputWalls || solverResult._inputWalls || [];
  const placements = solverResult.placements || [];
  const layoutType = solverResult.layoutType || 'single-wall';
  const island = solverResult.island;
  const peninsula = solverResult.peninsula;

  // Calculate wall positions based on layout type
  const wallPositions = useMemo(() => {
    const positions = [];
    const margin = 60;

    if (walls.length === 1) {
      // Single wall â horizontal
      positions.push({ id: walls[0].id, x: margin, y: margin + 40, angle: 0, length: walls[0].length });
    } else if (walls.length === 2) {
      const wA = walls[0], wB = walls[1];
      if (layoutType === 'galley' || layoutType === 'galley-peninsula') {
        // Parallel walls
        positions.push({ id: wA.id, x: margin, y: margin + 40, angle: 0, length: wA.length });
        positions.push({ id: wB.id, x: margin, y: margin + 40 + BASE_DEPTH + 48 + BASE_DEPTH + WALL_THICKNESS, angle: 0, length: wB.length });
      } else {
        // L-shape: A horizontal, B going down from right end of A
        positions.push({ id: wA.id, x: margin, y: margin + 40, angle: 0, length: wA.length });
        positions.push({ id: wB.id, x: margin + wA.length, y: margin + 40, angle: 90, length: wB.length });
      }
    } else if (walls.length >= 3) {
      const wA = walls[0], wB = walls[1], wC = walls[2];
      // U-shape: A horizontal top, B down right, C horizontal bottom going left
      positions.push({ id: wA.id, x: margin, y: margin + 40, angle: 0, length: wA.length });
      positions.push({ id: wB.id, x: margin + wA.length, y: margin + 40, angle: 90, length: wB.length });
      positions.push({ id: wC.id, x: margin + wA.length, y: margin + 40 + wB.length, angle: 180, length: wC.length });
    }

    return positions;
  }, [walls, layoutType]);

  // Calculate SVG viewBox
  const viewBox = useMemo(() => {
    let maxX = 0, maxY = 0;
    wallPositions.forEach(wp => {
      const rad = (wp.angle * Math.PI) / 180;
      const ex = wp.x + Math.cos(rad) * wp.length;
      const ey = wp.y + Math.sin(rad) * wp.length;
      maxX = Math.max(maxX, wp.x, ex);
      maxY = Math.max(maxY, wp.y, ey);
    });
    // Add room for cabinets + dimensions
    return `0 0 ${Math.max(maxX + 80, 300)} ${Math.max(maxY + 100, 200)}`;
  }, [wallPositions]);

  // Corner cabinets
  const cornerPlacements = placements.filter(p => p.type === 'corner' || p.type === 'wall_corner');

  return (
    <svg viewBox={viewBox} style={{ width: '100%', height: 'auto', maxHeight: 600, background: COLORS.bg, borderRadius: 8 }}
      xmlns="http://www.w3.org/2000/svg">
      {/* Defs */}
      <defs>
        <marker id="arrowEnd" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <path d="M0,0 L6,2 L0,4" fill={COLORS.dim} />
        </marker>
        <marker id="arrowStart" markerWidth="6" markerHeight="4" refX="1" refY="2" orient="auto">
          <path d="M6,0 L0,2 L6,4" fill={COLORS.dim} />
        </marker>
      </defs>

      {/* Title */}
      <text x="10" y="16" fill={COLORS.text} fontSize={10} fontWeight="bold" fontFamily="Inter, sans-serif">
        Floor Plan â {layoutType.toUpperCase()} {solverResult.roomType ? `(${solverResult.roomType})` : ''}
      </text>
      <text x="10" y="28" fill={COLORS.dim} fontSize={7} fontFamily="Inter, sans-serif">
        {placements.filter(p => p.type !== 'appliance').length} cabinets / {placements.filter(p => p.type === 'appliance').length} appliances / Scale: 1" = 1 unit
      </text>

      {/* Walls + cabinets */}
      {wallPositions.map(wp => (
        <WallCabinets key={wp.id} wallX={wp.x} wallY={wp.y} wallAngle={wp.angle}
          wallLength={wp.length} placements={placements} wallId={wp.id} />
      ))}

      {/* Corner indicator */}
      {cornerPlacements.length > 0 && wallPositions.length >= 2 && (
        <g>
          {cornerPlacements.map((cp, i) => {
            // Draw corner at junction of walls
            const wp = wallPositions[wallPositions.length > 1 ? 1 : 0];
            const cx = wp.x - 2, cy = wp.y - 2;
            return (
              <g key={i}>
                <rect x={cx - 20} y={cy} width={cp.width || 36} height={cp.width || 36}
                  fill={COLORS.cornerFill} stroke={COLORS.corner} strokeWidth={0.8} rx={2} />
                <text x={cx - 20 + (cp.width || 36) / 2} y={cy + (cp.width || 36) / 2 + 2}
                  fill={COLORS.corner} fontSize={5} fontFamily="monospace" textAnchor="middle">
                  {(cp.sku || 'CORNER').substring(0, 10)}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Island */}
      {island && (() => {
        const wA = wallPositions[0];
        if (!wA) return null;
        const ix = wA.x + (wA.length - (island.length || 96)) / 2;
        const iy = wA.y + WALL_THICKNESS / 2 + BASE_DEPTH + 42; // 42" aisle
        const iw = island.length || 96;
        const id = island.depth || 42;
        return (
          <g>
            <rect x={ix} y={iy} width={iw} height={id}
              fill={COLORS.islandFill} stroke={COLORS.island} strokeWidth={1.2} rx={2} />
            <text x={ix + iw / 2} y={iy + id / 2 + 2} fill={COLORS.island}
              fontSize={7} fontFamily="Inter, sans-serif" fontWeight="bold" textAnchor="middle">
              ISLAND {iw}" x {id}"
            </text>
            <DimLine x1={ix} y1={iy + id} x2={ix + iw} y2={iy + id} label={`${iw}"`} offset={12} />
          </g>
        );
      })()}

      {/* Peninsula */}
      {peninsula && (() => {
        const wA = wallPositions[0];
        if (!wA) return null;
        const px = wA.x + wA.length - (peninsula.length || 60);
        const py = wA.y + WALL_THICKNESS / 2 + BASE_DEPTH;
        const pw = peninsula.length || 60;
        const pd = peninsula.depth || 24;
        return (
          <g>
            <rect x={px} y={py} width={pw} height={pd}
              fill={COLORS.islandFill} stroke={COLORS.island} strokeWidth={1} rx={2} />
            <text x={px + pw / 2} y={py + pd / 2 + 2} fill={COLORS.island}
              fontSize={6} fontFamily="Inter, sans-serif" fontWeight="bold" textAnchor="middle">
              PENINSULA {pw}" x {pd}"
            </text>
          </g>
        );
      })()}

      {/* Legend */}
      <g transform={`translate(10, ${parseFloat(viewBox.split(' ')[3]) - 30})`}>
        {[
          { label: 'Base', color: COLORS.base },
          { label: 'Upper', color: COLORS.upper },
          { label: 'Tall', color: COLORS.tall },
          { label: 'Appliance', color: COLORS.appliance },
          { label: 'Corner', color: COLORS.corner },
          { label: 'Island/Pen.', color: COLORS.island },
        ].map((item, i) => (
          <g key={i} transform={`translate(${i * 60}, 0)`}>
            <rect x={0} y={0} width={8} height={8} fill={item.color} rx={1} />
            <text x={11} y={7} fill={COLORS.dim} fontSize={6} fontFamily="Inter, sans-serif">{item.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
