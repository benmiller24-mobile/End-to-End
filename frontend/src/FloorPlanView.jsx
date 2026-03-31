import React, { useMemo } from 'react';

/**
 * FloorPlanView — Installer-Grade Architectural Kitchen Floor Plan (NKBA Standards)
 * Shows walls, base cabinets, upper cabinets, appliances, island/peninsula, and comprehensive dimensions.
 * Professional architectural drawing style with proper corner cabinet positioning at wall junctions.
 * Renders at 1 inch = 1 SVG unit, then scales to fit viewport.
 *
 * KEY FEATURES:
 * - Corner cabinets positioned at actual wall junctions (not floating)
 * - Every cabinet width labeled (NKBA requirement)
 * - Overall wall lengths with dimension lines outside walls
 * - Aisle widths, island clearances, room dimensions
 * - Upper cabinets shown as dashed outlines (architectural convention)
 * - Appliance symbols per NKBA plan view standards
 */

const COLORS = {
  // Warm architectural palette — like a printed drawing
  wallFill: '#2b2b2b',      // Dark charcoal wall fill
  wallStroke: '#1a1a1a',    // Nearly black wall outline
  cabinetStroke: '#555555', // Medium gray cabinet outlines
  cabinetFill: '#f5f5f0',   // Warm off-white cabinet fill
  cabinetUpperFill: '#f5f5f0', // Same for uppers (dashed stroke distinguishes)
  appliance: '#d4af37',     // Warm gold for appliance callouts
  island: '#e8d5b7',        // Warm beige for island
  islandStroke: '#a0826d',  // Warm brown for island outline
  dimensionLine: '#666666', // Medium gray for dimension lines
  dimensionText: '#333333', // Dark gray for numbers
  text: '#1a1a1a',          // Dark gray for labels
  bg: '#fafaf8',            // Warm off-white background (like paper)
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

// Single wall cabinets and uppers rendered in plan view (NKBA architectural style)
function WallCabinets({ wallX, wallY, wallAngle, wallLength, placements, wallId, isVertical = false }) {
  // Separate base/tall/appliance cabinets from uppers
  const baseCabs = placements.filter(p =>
    p.wall === wallId && typeof p.position === 'number' && p.position >= 0 && p.width > 1
    && (p.type === 'base' || p.type === 'tall' || p.type === 'appliance' || (!p.type && p.sku && !/^[WS]/.test(p.sku)))
  );

  const upperCabs = placements.filter(p =>
    p.wall === wallId && typeof p.position === 'number' && p.position >= 0 && p.width > 1
    && p.sku && /^[WS]/.test(p.sku)
  );

  return (
    <g transform={`translate(${wallX}, ${wallY}) rotate(${wallAngle})`}>
      {/* Wall — solid fill with outline */}
      <rect x={0} y={-WALL_THICKNESS / 2} width={wallLength} height={WALL_THICKNESS}
        fill={COLORS.wallFill} stroke={COLORS.wallStroke} strokeWidth={0.5} />

      {/* Base + tall cabinets along wall (drawn below wall = positive Y) */}
      {baseCabs.map((cab, i) => {
        const x = cab.position;
        const w = cab.width;
        const d = cab.depth || (cab.type === 'tall' ? 24 : BASE_DEPTH);
        const fill = getCabinetFill(cab.type, cab.sku);
        const label = (cab.sku || cab.applianceType || '').replace(/^FC-/, '').substring(0, 10);
        const isAppliance = cab.type === 'appliance' || !!cab.applianceType;
        const isTall = cab.type === 'tall' || d > BASE_DEPTH + 2;

        return (
          <g key={`${wallId}-base-${i}`}>
            {isAppliance ? (
              // Appliance symbol with plan view conventions
              <DrawAppliance x={x} y={WALL_THICKNESS / 2} w={w} d={d} applianceType={cab.applianceType} />
            ) : (
              // Cabinet rect with solid outline
              <rect x={x} y={WALL_THICKNESS / 2} width={w} height={d}
                fill={fill} stroke={COLORS.cabinetStroke} strokeWidth={0.6} rx={0.3} />
            )}

            {/* Cabinet width label — inside cabinet if space, otherwise below */}
            {w >= 12 && !isAppliance && (
              <text x={x + w / 2} y={WALL_THICKNESS / 2 + d / 2 + 1.5} fill={COLORS.dimensionText}
                fontSize={4} fontFamily="Arial, sans-serif" textAnchor="middle" fontWeight="500">{w}"</text>
            )}

            {/* Appliance label with callout */}
            {isAppliance && w >= 10 && (
              <g>
                <circle cx={x + w / 2} cy={WALL_THICKNESS / 2 + d + 5} r={2.8} fill={COLORS.appliance} opacity={0.25} />
                <circle cx={x + w / 2} cy={WALL_THICKNESS / 2 + d + 5} r={2.8} fill="none" stroke={COLORS.appliance} strokeWidth={0.35} />
                <text x={x + w / 2} y={WALL_THICKNESS / 2 + d + 5.5} fill={COLORS.appliance}
                  fontSize={3.5} fontFamily="Arial, sans-serif" fontWeight="bold" textAnchor="middle">{label}</text>
              </g>
            )}

            {/* Door swing arc for base cabinets (quarter-circle from hinge side) */}
            {cab.type === 'base' && w >= 15 && !isAppliance && !isTall && (
              <path d={`M ${x + 0.5} ${WALL_THICKNESS / 2 + 0.5} A ${w - 1} ${w - 1} 0 0 1 ${x + w - 0.5} ${WALL_THICKNESS / 2 + 0.5}`}
                fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.25} opacity={0.5} />
            )}

            {/* Mark tall cabinets with label */}
            {isTall && w >= 12 && (
              <text x={x + 0.5} y={WALL_THICKNESS / 2 + 2.5} fill={COLORS.dimensionText}
                fontSize={3} fontFamily="Arial, sans-serif" fontStyle="italic" opacity={0.7}>T</text>
            )}
          </g>
        );
      })}

      {/* Upper cabinets — shown as DASHED outline (architectural convention for elements above plan view) */}
      {upperCabs.map((cab, i) => {
        const x = cab.position;
        const w = cab.width;
        const upperOffsetY = -WALL_THICKNESS / 2 - UPPER_DEPTH - 3; // Behind/above wall
        const fill = getCabinetFill('upper', cab.sku);
        const label = cab.sku.replace(/^[WS]-/, '').substring(0, 8);

        return (
          <g key={`${wallId}-upper-${i}`}>
            {/* Dashed rectangle for upper cabinet */}
            <rect x={x} y={upperOffsetY} width={w} height={UPPER_DEPTH}
              fill={fill} stroke={COLORS.cabinetStroke} strokeWidth={0.5} strokeDasharray="2,2" rx={0.3} />

            {/* Width label for upper */}
            {w >= 12 && (
              <text x={x + w / 2} y={upperOffsetY + UPPER_DEPTH / 2 + 1} fill={COLORS.dimensionText}
                fontSize={3.5} fontFamily="Arial, sans-serif" textAnchor="middle" opacity={0.8}>{w}"</text>
            )}
          </g>
        );
      })}

      {/* Wall dimension line — outside/above wall, with tick marks and label */}
      <DimLine x1={0} y1={-WALL_THICKNESS / 2 - 16} x2={wallLength} y2={-WALL_THICKNESS / 2 - 16}
        label={`${wallLength}"`} offset={0} flip={false} />
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
    const margin = 80;
    const WORK_AISLE_WIDTH = 42; // NKBA minimum work aisle width (inches)

    if (walls.length === 1) {
      // Single wall — horizontal
      positions.push({ id: walls[0].id, x: margin, y: margin + 60, angle: 0, length: walls[0].length });
    } else if (walls.length === 2) {
      const wA = walls[0], wB = walls[1];
      if (layoutType === 'galley' || layoutType === 'galley-peninsula') {
        // Parallel walls: A top, B bottom with work aisle between
        positions.push({ id: wA.id, x: margin, y: margin + 60, angle: 0, length: wA.length });
        positions.push({ id: wB.id, x: margin, y: margin + 60 + BASE_DEPTH + WORK_AISLE_WIDTH + BASE_DEPTH + WALL_THICKNESS, angle: 0, length: wB.length });
      } else {
        // L-shape: A horizontal, B going down from right end of A
        positions.push({ id: wA.id, x: margin, y: margin + 60, angle: 0, length: wA.length });
        positions.push({ id: wB.id, x: margin + wA.length, y: margin + 60, angle: 90, length: wB.length });
      }
    } else if (walls.length >= 3) {
      const wA = walls[0], wB = walls[1], wC = walls[2];
      // U-shape: A horizontal top, B down right, C horizontal bottom
      positions.push({ id: wA.id, x: margin, y: margin + 60, angle: 0, length: wA.length });
      positions.push({ id: wB.id, x: margin + wA.length, y: margin + 60, angle: 90, length: wB.length });
      positions.push({ id: wC.id, x: margin + wA.length, y: margin + 60 + wB.length, angle: 180, length: wC.length });
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

  const corners = solverResult.corners || [];
  const roomWidth = solverResult.roomWidth;
  const roomDepth = solverResult.roomDepth;

  // Helper: Get wall position by ID
  const getWallPosition = (wallId) => wallPositions.find(wp => wp.id === wallId);

  return (
    <svg viewBox={viewBox} style={{ width: '100%', height: 'auto', maxHeight: 700, background: COLORS.bg, borderRadius: 4 }}
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#f0f0f0" strokeWidth="0.1" />
        </pattern>
      </defs>

      {/* Warm background — like a printed architectural drawing */}
      <rect width="100%" height="100%" fill={COLORS.bg} />

      {/* Title and metadata — NKBA standards callout */}
      <text x="14" y="20" fill={COLORS.text} fontSize={13} fontWeight="700" fontFamily="Arial, sans-serif">
        Kitchen Floor Plan — {layoutType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
      </text>
      <text x="14" y="34" fill="#555" fontSize={7} fontFamily="Arial, sans-serif" fontWeight="500">
        NKBA Standards | Scale: 1" = 1 SVG unit | Dimensions in inches (") | {placements.length} cabinets/appliances
      </text>

      {/* Walls + cabinets */}
      {wallPositions.map(wp => (
        <WallCabinets key={wp.id} wallX={wp.x} wallY={wp.y} wallAngle={wp.angle}
          wallLength={wp.length} placements={placements} wallId={wp.id} />
      ))}

      {/* Corner cabinets — positioned at actual wall junctions using corners array */}
      {corners && corners.length > 0 && (
        <g>
          {corners.map((corner, i) => {
            // Find wall positions for wallA and wallB
            const wpA = getWallPosition(corner.wallA);
            const wpB = getWallPosition(corner.wallB);

            if (!wpA || !wpB) return null;

            // Calculate junction point based on wall angles
            let cornerX, cornerY;
            const angleA = wpA.angle % 360;
            const angleB = wpB.angle % 360;

            // L-shape: A is horizontal (0°), B goes down from right end (90°)
            if (angleA === 0 && angleB === 90) {
              cornerX = wpA.x + wpA.length;
              cornerY = wpA.y;
            }
            // U-shape right corner: B down (90°), C horizontal (180°)
            else if (angleB === 90 && angleB !== angleA) {
              cornerX = wpB.x;
              cornerY = wpB.y + wpB.length;
            }
            // Fallback: end of first wall
            else {
              cornerX = wpA.x + Math.cos((wpA.angle * Math.PI) / 180) * wpA.length;
              cornerY = wpA.y + Math.sin((wpA.angle * Math.PI) / 180) * wpA.length;
            }

            const cornerSize = corner.size || 36;
            const label = (corner.sku || 'CORNER').replace(/^FC-/, '').substring(0, 10);

            // Draw corner as square at junction, spanning into both walls
            return (
              <g key={`corner-${i}`}>
                <rect x={cornerX - cornerSize / 2} y={cornerY - cornerSize / 2} width={cornerSize} height={cornerSize}
                  fill={COLORS.cabinetFill} stroke={COLORS.cabinetStroke} strokeWidth={0.7} rx={0.4} />
                {/* Corner SKU label */}
                <text x={cornerX} y={cornerY + 1.5}
                  fill={COLORS.dimensionText} fontSize={3.5} fontFamily="Arial, sans-serif" textAnchor="middle" fontWeight="600">
                  {label}
                </text>
                {/* Size dimension */}
                <text x={cornerX} y={cornerY + 5}
                  fill={COLORS.dimensionText} fontSize={3} fontFamily="Arial, sans-serif" textAnchor="middle" opacity={0.8}>
                  {cornerSize}"
                </text>
              </g>
            );
          })}
        </g>
      )}

      {/* Island — with full NKBA dimensions and clearances */}
      {island && (() => {
        const wA = wallPositions[0];
        if (!wA) return null;
        const ix = wA.x + (wA.length - (island.length || 96)) / 2;
        const iy = wA.y + WALL_THICKNESS / 2 + BASE_DEPTH + 42; // 42" aisle minimum per NKBA
        const iw = island.length || 96;
        const id = island.depth || 42;
        return (
          <g>
            {/* Island rectangle */}
            <rect x={ix} y={iy} width={iw} height={id}
              fill={COLORS.island} stroke={COLORS.islandStroke} strokeWidth={0.7} rx={0.5} />

            {/* Island length dimension */}
            <DimLine x1={ix} y1={iy + id + 8} x2={ix + iw} y2={iy + id + 8} label={`${iw}"`} offset={0} flip={false} />

            {/* Island depth dimension */}
            <DimLine x1={ix + iw + 8} y1={iy} x2={ix + iw + 8} y2={iy + id} label={`${id}"`} offset={0} flip={false} />

            {/* Wall-to-island clearance dimension (work aisle width) */}
            <DimLine x1={ix} y1={iy - 30} x2={ix} y2={wA.y + WALL_THICKNESS / 2 + BASE_DEPTH}
              label={'42" (min)'} offset={-8} flip={true} />
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
              fill={COLORS.island} stroke={COLORS.islandStroke} strokeWidth={0.7} rx={0.5} />
            {/* Peninsula length dimension */}
            <DimLine x1={px} y1={py + pd + 6} x2={px + pw} y2={py + pd + 6} label={`${pw}"`} offset={0} flip={false} />
            {/* Peninsula depth dimension */}
            <DimLine x1={px + pw + 6} y1={py} x2={px + pw + 6} y2={py + pd} label={`${pd}"`} offset={0} flip={false} />
          </g>
        );
      })()}

      {/* Room dimensions (overall footprint) — if provided */}
      {roomWidth && roomDepth && (
        <g opacity={0.8}>
          {/* Overall width (bottom) */}
          <DimLine x1={wallPositions[0]?.x} y1={parseFloat(viewBox.split(' ')[3]) - 20}
            x2={wallPositions[0]?.x + roomWidth} y2={parseFloat(viewBox.split(' ')[3]) - 20}
            label={`${roomWidth}'" Room Width`} offset={0} flip={false} />
          {/* Overall depth (right side) if available */}
          {wallPositions.length >= 2 && (
            <DimLine x1={parseFloat(viewBox.split(' ')[2]) - 16} y1={wallPositions[0]?.y}
              x2={parseFloat(viewBox.split(' ')[2]) - 16} y2={wallPositions[0]?.y + roomDepth}
              label={`${roomDepth}'" Depth`} offset={0} flip={true} />
          )}
        </g>
      )}

      {/* Legend — professional architectural style with all symbol types */}
      <g transform={`translate(14, ${parseFloat(viewBox.split(' ')[3]) - 32})`}>
        {[
          { label: 'Base Cabinet', icon: () => <rect x={0} y={0} width={5} height={5} fill={COLORS.cabinetFill} stroke={COLORS.cabinetStroke} strokeWidth="0.4" rx="0.2" /> },
          { label: 'Upper Cabinet (dashed)', icon: () => <rect x={0} y={0} width={5} height={5} fill={COLORS.cabinetFill} stroke={COLORS.cabinetStroke} strokeWidth="0.35" strokeDasharray="1.5,1.5" rx="0.2" /> },
          { label: 'Appliance', icon: () => <rect x={0} y={0} width={5} height={5} fill={COLORS.appliance} opacity="0.4" stroke={COLORS.appliance} strokeWidth="0.4" rx="0.2" /> },
          { label: 'Island', icon: () => <rect x={0} y={0} width={5} height={5} fill={COLORS.island} stroke={COLORS.islandStroke} strokeWidth="0.4" rx="0.2" /> },
        ].map((item, i) => (
          <g key={i} transform={`translate(${i * 100}, 0)`}>
            {item.icon()}
            <text x={8} y={3.5} fill={COLORS.text} fontSize={4.5} fontFamily="Arial, sans-serif" fontWeight="500">{item.label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
