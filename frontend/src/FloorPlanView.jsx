import React, { useMemo } from 'react';

/**
 * FloorPlanView — Professional Architectural Kitchen Floor Plan
 * Shows walls, base cabinets, appliances, island/peninsula, and dimensions
 * in a clean, professional architectural drawing style.
 * Renders at 1 inch = 1 SVG unit, then scales to fit viewport.
 */

const COLORS = {
  // Architectural palette — muted, professional
  wallFill: '#2b2b2b',      // Dark gray wall fill
  wallStroke: '#1a1a1a',    // Nearly black wall outline
  cabinetStroke: '#555555', // Medium gray cabinet outlines
  cabinetFill: '#f5f5f5',   // Light off-white cabinet fill
  cabinetUpperFill: '#fafafa', // Slightly lighter for uppers/tall
  appliance: '#d4af37',     // Warm gold for appliance callouts
  island: '#e8d5b7',        // Warm beige for island
  islandStroke: '#a0826d',  // Warm brown for island outline
  dimensionLine: '#666666', // Medium gray for dimension lines
  dimensionText: '#333333', // Dark gray for numbers
  text: '#1a1a1a',          // Dark gray for labels
  bg: '#f9f9f9',            // Light off-white background
};

// Appliance symbols
const APPLIANCE_SYMBOLS = {
  range: 'drawRange',
  cooktop: 'drawCooktop',
  refrigerator: 'drawFridge',
  dishwasher: 'drawDishwasher',
  sink: 'drawSink',
  wallOven: 'drawWallOven',
};

const WALL_THICKNESS = 6;
const BASE_DEPTH = 24;
const UPPER_DEPTH = 13;

// Get fill color based on cabinet type
function getCabinetFill(type, sku) {
  if (sku && /^[WS]/.test(sku)) return COLORS.cabinetUpperFill;
  if (type === 'tall') return COLORS.cabinetFill;
  return COLORS.cabinetFill;
}

// Draw appliance symbols in plan view
function DrawAppliance({ x, y, w, d, applianceType }) {
  const symbolProps = { x, y, width: w, height: d, fill: COLORS.cabinetFill, stroke: COLORS.cabinetStroke, strokeWidth: 0.6 };

  switch (applianceType) {
    case 'range':
    case 'cooktop':
      // 4 burner circles arranged in a grid
      return (
        <g>
          <rect {...symbolProps} rx={1} />
          <circle cx={x + w / 4} cy={y + d / 4} r={1.5} fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.4} />
          <circle cx={x + 3 * w / 4} cy={y + d / 4} r={1.5} fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.4} />
          <circle cx={x + w / 4} cy={y + 3 * d / 4} r={1.5} fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.4} />
          <circle cx={x + 3 * w / 4} cy={y + 3 * d / 4} r={1.5} fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.4} />
        </g>
      );

    case 'refrigerator':
      // Rectangle with door swing arc
      return (
        <g>
          <rect {...symbolProps} rx={1} />
          {/* Door swing arc */}
          <path d={`M ${x + w} ${y + 2} A ${w - 2} ${w - 2} 0 0 1 ${x + w} ${y + d - 2}`}
            fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.4} opacity={0.6} />
        </g>
      );

    case 'sink':
      // Single or double basin — oval/circular shape
      if (w > d + 5) {
        // Double sink (wider)
        return (
          <g>
            <rect {...symbolProps} rx={1} />
            <ellipse cx={x + w / 3} cy={y + d / 2} rx={w / 6} ry={d / 3} fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.5} />
            <ellipse cx={x + 2 * w / 3} cy={y + d / 2} rx={w / 6} ry={d / 3} fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.5} />
          </g>
        );
      } else {
        // Single sink
        return (
          <g>
            <rect {...symbolProps} rx={1} />
            <ellipse cx={x + w / 2} cy={y + d / 2} rx={w / 3} ry={d / 2.5} fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.5} />
          </g>
        );
      }

    case 'dishwasher':
      // Rectangle with horizontal line (rack indicator)
      return (
        <g>
          <rect {...symbolProps} rx={1} />
          <line x1={x + 1} y1={y + d / 2} x2={x + w - 1} y2={y + d / 2} stroke={COLORS.cabinetStroke} strokeWidth={0.4} opacity={0.6} />
        </g>
      );

    case 'wallOven':
      // Rectangle with thin lines (heating element indicator)
      return (
        <g>
          <rect {...symbolProps} rx={1} />
          <line x1={x + 2} y1={y + d / 3} x2={x + w - 2} y2={y + d / 3} stroke={COLORS.cabinetStroke} strokeWidth={0.3} opacity={0.5} />
          <line x1={x + 2} y1={y + 2 * d / 3} x2={x + w - 2} y2={y + 2 * d / 3} stroke={COLORS.cabinetStroke} strokeWidth={0.3} opacity={0.5} />
        </g>
      );

    default:
      // Generic appliance
      return <rect {...symbolProps} rx={1} />;
  }
}

// Dimension line with tick marks (architectural style, no arrows)
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

  // Tick mark size
  const tickSize = 2;
  const tickX1 = -nx * tickSize, tickY1 = -ny * tickSize;

  return (
    <g>
      {/* Extension lines */}
      <line x1={x1} y1={y1} x2={sx} y2={sy} stroke={COLORS.dimensionLine} strokeWidth={0.3} opacity={0.7} />
      <line x1={x2} y1={y2} x2={ex} y2={ey} stroke={COLORS.dimensionLine} strokeWidth={0.3} opacity={0.7} />
      {/* Dimension line */}
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={COLORS.dimensionLine} strokeWidth={0.4} />
      {/* Tick marks at ends */}
      <line x1={sx + tickX1} y1={sy + tickY1} x2={sx - tickX1} y2={sy - tickY1} stroke={COLORS.dimensionLine} strokeWidth={0.3} />
      <line x1={ex + tickX1} y1={ey + tickY1} x2={ex - tickX1} y2={ey - tickY1} stroke={COLORS.dimensionLine} strokeWidth={0.3} />
      {/* Label */}
      <text x={mx} y={my - 3} fill={COLORS.dimensionText} fontSize={6} fontFamily="Arial, sans-serif" textAnchor="middle"
        transform={`rotate(${textAngle}, ${mx}, ${my - 3})`}>{label}</text>
    </g>
  );
}

// Single wall cabinets rendered in plan view (professional architectural style)
function WallCabinets({ wallX, wallY, wallAngle, wallLength, placements, wallId }) {
  const baseCabs = placements.filter(p =>
    p.wall === wallId && typeof p.position === 'number' && p.position >= 0 && p.width > 1
    && (p.type === 'base' || p.type === 'tall' || p.type === 'appliance' || (!p.type && p.sku))
  );

  return (
    <g transform={`translate(${wallX}, ${wallY}) rotate(${wallAngle})`}>
      {/* Wall — solid fill with outline */}
      <rect x={0} y={-WALL_THICKNESS / 2} width={wallLength} height={WALL_THICKNESS}
        fill={COLORS.wallFill} stroke={COLORS.wallStroke} strokeWidth={0.5} />

      {/* Base cabinets along wall (drawn below wall = positive Y) */}
      {baseCabs.map((cab, i) => {
        const x = cab.position;
        const w = cab.width;
        const d = cab.depth || (cab.type === 'tall' ? 24 : BASE_DEPTH);
        const fill = getCabinetFill(cab.type, cab.sku);
        const label = (cab.sku || cab.applianceType || '').replace(/^FC-/, '').substring(0, 8);
        const isAppliance = cab.type === 'appliance' || !!cab.applianceType;

        return (
          <g key={`${wallId}-${i}`}>
            {isAppliance ? (
              // Draw appliance symbol
              <DrawAppliance x={x} y={WALL_THICKNESS / 2} w={w} d={d} applianceType={cab.applianceType} />
            ) : (
              // Regular cabinet
              <rect x={x} y={WALL_THICKNESS / 2} width={w} height={d}
                fill={fill} stroke={COLORS.cabinetStroke} strokeWidth={0.6} rx={0.5} />
            )}

            {/* Appliance label with gold callout */}
            {isAppliance && w >= 10 && (
              <g>
                {/* Small circle callout */}
                <circle cx={x + w / 2} cy={WALL_THICKNESS / 2 + d + 4} r={2.5} fill={COLORS.appliance} opacity={0.3} />
                <circle cx={x + w / 2} cy={WALL_THICKNESS / 2 + d + 4} r={2.5} fill="none" stroke={COLORS.appliance} strokeWidth={0.3} />
                <text x={x + w / 2} y={WALL_THICKNESS / 2 + d + 4.5} fill={COLORS.appliance}
                  fontSize={4} fontFamily="Arial, sans-serif" fontWeight="bold" textAnchor="middle">{label}</text>
              </g>
            )}

            {/* Cabinet width dimension */}
            {w >= 18 && !isAppliance && (
              <text x={x + w / 2} y={WALL_THICKNESS / 2 + d + 5} fill={COLORS.dimensionText}
                fontSize={5} fontFamily="Arial, sans-serif" textAnchor="middle">{w}"</text>
            )}

            {/* Door swing arc for base cabinets */}
            {cab.type === 'base' && w >= 15 && !isAppliance && (
              <path d={`M ${x + 1} ${WALL_THICKNESS / 2 + 1} A ${w - 2} ${w - 2} 0 0 1 ${x + w - 1} ${WALL_THICKNESS / 2 + 1}`}
                fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.3} opacity={0.4} />
            )}
          </g>
        );
      })}

      {/* Wall dimension line — outside/above wall */}
      <DimLine x1={0} y1={0} x2={wallLength} y2={0} label={`${wallLength}"`} offset={-14} />
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
      // Single wall — horizontal
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
    <svg viewBox={viewBox} style={{ width: '100%', height: 'auto', maxHeight: 600, background: COLORS.bg, borderRadius: 4 }}
      xmlns="http://www.w3.org/2000/svg">
      {/* Defs — no arrows needed for professional style */}
      <defs>
        {/* Optional subtle grid pattern */}
        <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#efefef" strokeWidth="0.1" />
        </pattern>
      </defs>

      {/* Subtle background grid */}
      <rect width="100%" height="100%" fill={COLORS.bg} />

      {/* Title and metadata */}
      <text x="12" y="18" fill={COLORS.text} fontSize={11} fontWeight="600" fontFamily="Arial, sans-serif">
        Kitchen Floor Plan - {layoutType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
      </text>
      <text x="12" y="30" fill="#666666" fontSize={6} fontFamily="Arial, sans-serif">
        {placements.length} total items | Scale: 1" = 1 unit | Dimensions in inches
      </text>

      {/* Walls + cabinets */}
      {wallPositions.map(wp => (
        <WallCabinets key={wp.id} wallX={wp.x} wallY={wp.y} wallAngle={wp.angle}
          wallLength={wp.length} placements={placements} wallId={wp.id} />
      ))}

      {/* Corner cabinets */}
      {cornerPlacements.length > 0 && wallPositions.length >= 2 && (
        <g>
          {cornerPlacements.map((cp, i) => {
            // Draw corner at junction of walls
            const wp = wallPositions[wallPositions.length > 1 ? 1 : 0];
            const cornerSize = cp.width || 36;
            const cx = wp.x - cornerSize / 2;
            const cy = wp.y - cornerSize / 2;
            return (
              <g key={i}>
                <rect x={cx} y={cy} width={cornerSize} height={cornerSize}
                  fill={COLORS.cabinetFill} stroke={COLORS.cabinetStroke} strokeWidth={0.6} rx={0.5} />
                <text x={cx + cornerSize / 2} y={cy + cornerSize / 2 + 2}
                  fill={COLORS.cabinetStroke} fontSize={4} fontFamily="Arial, sans-serif" textAnchor="middle" fontWeight="500">
                  {(cp.sku || 'CORNER').substring(0, 10)}
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Island — professional treatment */}
      {island && (() => {
        const wA = wallPositions[0];
        if (!wA) return null;
        const ix = wA.x + (wA.length - (island.length || 96)) / 2;
        const iy = wA.y + WALL_THICKNESS / 2 + BASE_DEPTH + 42; // 42" aisle
        const iw = island.length || 96;
        const id = island.depth || 42;
        return (
          <g>
            {/* Island with subtle fill and clean outline */}
            <rect x={ix} y={iy} width={iw} height={id}
              fill={COLORS.island} stroke={COLORS.islandStroke} strokeWidth={0.6} rx={0.5} />
            {/* Dimension line */}
            <DimLine x1={ix} y1={iy + id + 6} x2={ix + iw} y2={iy + id + 6} label={`${iw}"`} offset={8} flip={false} />
            {/* Depth label */}
            <DimLine x1={ix + iw + 6} y1={iy} x2={ix + iw + 6} y2={iy + id} label={`${id}"`} offset={8} />
          </g>
        );
      })()}

      {/* Peninsula — same treatment as island */}
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
              fill={COLORS.island} stroke={COLORS.islandStroke} strokeWidth={0.6} rx={0.5} />
            {/* Dimension line */}
            <DimLine x1={px} y1={py + pd + 6} x2={px + pw} y2={py + pd + 6} label={`${pw}"`} offset={8} flip={false} />
          </g>
        );
      })()}

      {/* Legend — clean and minimal */}
      <g transform={`translate(12, ${parseFloat(viewBox.split(' ')[3]) - 28})`}>
        {[
          { label: 'Base Cabinet', icon: () => <rect x={0} y={0} width={6} height={6} fill={COLORS.cabinetFill} stroke={COLORS.cabinetStroke} strokeWidth="0.4" rx="0.3" /> },
          { label: 'Appliance', icon: () => <circle cx={3} cy={3} r={2} fill="none" stroke={COLORS.appliance} strokeWidth="0.5" /> },
          { label: 'Island', icon: () => <rect x={0} y={0} width={6} height={6} fill={COLORS.island} stroke={COLORS.islandStroke} strokeWidth="0.4" rx="0.3" /> },
        ].map((item, i) => (
          <g key={i} transform={`translate(${i * 80}, 0)`}>
            {item.icon()}
            <text x={10} y={5} fill={COLORS.text} fontSize={5} fontFamily="Arial, sans-serif">{item.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
