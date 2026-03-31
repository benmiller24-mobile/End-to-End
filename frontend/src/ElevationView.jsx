import React, { useMemo } from 'react';

/**
 * ElevationView — Installer-Grade Kitchen Elevation (NKBA Chapter 12)
 *
 * Professional architectural elevation with COMPREHENSIVE DIMENSIONS:
 * - Every cabinet width labeled
 * - Overall wall length
 * - Ceiling height (CLG line)
 * - All heights: counter, upper bottom, upper top, base height, toe kick
 * - Backsplash zone marked
 * - SKU labels, door/drawer detail, appliance symbols
 *
 * Dimension layout:
 * - Bottom: individual widths + overall length
 * - Right side: vertical dimension string with AFF annotations
 * - Architectural tick marks (NOT arrows)
 */

const COLORS = {
  // Architectural palette - muted, professional
  cabinetStroke: '#333333',    // Dark gray for cabinet lines
  cabinetFill: '#f5f3f0',      // Warm off-white/natural
  drawerLine: '#888888',       // Medium gray for drawer pulls
  appliance: '#4a4a4a',        // Dark gray for appliances
  applFill: '#eeeeee',         // Light gray appliance fill
  counterStroke: '#333333',    // Dark stroke
  counterFill: '#d4ccc4',      // Warm gray countertop
  toekick: '#222222',          // Very dark for toe kick
  backsplash: '#e8e6e3',       // Light warm neutral
  wallBg: '#fafaf8',           // Off-white background
  dimLine: '#555555',          // Dark gray for dimensions
  dimText: '#555555',          // Dark gray text
  crownFill: '#d9cfc6',        // Warm wood tone for crown
  crownStroke: '#8b7f78',      // Darker wood tone
  lightRail: '#9d9590',        // Medium wood tone
  floor: '#333333',            // Dark gray floor
  hoodStroke: '#333333',       // Dark lines
  hoodFill: '#e0ddd9',         // Light warm fill
};

// Standard heights in inches (NKBA standard)
const TOEKICK_H = 4.5;
const BASE_H = 34.5;
const COUNTER_H = 1.5;
const UPPER_GAP = 18; // gap between counter and upper bottom (backsplash zone)
const UPPER_H = 36;
const TALL_H = 96;
const SCALE = 2.2; // SVG pixels per inch

// Draw cabinet with raised/recessed panel detail and door/drawer divisions
function CabinetPanel({ x, y, w, h, doorCount, drawerCount }) {
  const elements = [];
  const inset = 3 * SCALE;
  const panelBorder = 0.5 * SCALE;

  // Cabinet main outline
  elements.push(
    <rect key="outline" x={x} y={y} width={w} height={h}
      fill={COLORS.cabinetFill} stroke={COLORS.cabinetStroke} strokeWidth={0.6} />
  );

  // Add shadow on bottom and right for depth
  elements.push(
    <line key="bottomShadow" x1={x} y1={y + h - 0.2} x2={x + w} y2={y + h - 0.2}
      stroke="#cccccc" strokeWidth={0.3} opacity={0.6} />
  );
  elements.push(
    <line key="rightShadow" x1={x + w - 0.2} y1={y} x2={x + w - 0.2} y2={y + h}
      stroke="#cccccc" strokeWidth={0.3} opacity={0.6} />
  );

  // Draw drawers from top
  if (drawerCount > 0 && h > 15 * SCALE) {
    const drawerH = Math.min(h * 0.35, (drawerCount * 8) * SCALE) / drawerCount;
    for (let i = 0; i < drawerCount; i++) {
      const dy = y + inset + i * drawerH;
      // Drawer panel outline
      elements.push(
        <rect key={`dr-bg${i}`} x={x + inset} y={dy} width={w - 2 * inset} height={drawerH - 1}
          fill="none" stroke={COLORS.drawerLine} strokeWidth={0.3} />
      );
      // Horizontal pull handle - centered
      const pullY = dy + drawerH / 2;
      elements.push(
        <line key={`drp${i}`} x1={x + w / 2 - 6 * SCALE} y1={pullY} x2={x + w / 2 + 6 * SCALE} y2={pullY}
          stroke={COLORS.drawerLine} strokeWidth={0.5} />
      );
    }

    // Door panel(s) below drawers
    const doorY = y + inset + drawerCount * drawerH + 1;
    const doorH = h - inset * 2 - drawerCount * drawerH - 1;
    if (doorH > 5 * SCALE) {
      const dc = Math.max(doorCount, 1);
      const dw = (w - 2 * inset) / dc;
      for (let i = 0; i < dc; i++) {
        const dx = x + inset + i * dw;
        // Panel outline
        elements.push(
          <rect key={`d${i}`} x={dx} y={doorY} width={dw - 1} height={doorH}
            fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.4} />
        );
        // Inner panel border (raised/recessed effect)
        elements.push(
          <rect key={`d-inner${i}`} x={dx + panelBorder} y={doorY + panelBorder}
            width={dw - 1 - 2 * panelBorder} height={doorH - 2 * panelBorder}
            fill="none" stroke={COLORS.drawerLine} strokeWidth={0.25} opacity={0.5} />
        );
      }
    }
  } else if (h > 15 * SCALE) {
    // Just door panels, no drawers
    const dc = Math.max(doorCount, 1);
    const dw = (w - 2 * inset) / dc;
    for (let i = 0; i < dc; i++) {
      const dx = x + inset + i * dw;
      // Panel outline
      elements.push(
        <rect key={`d${i}`} x={dx} y={y + inset} width={dw - 1} height={h - 2 * inset}
          fill="none" stroke={COLORS.cabinetStroke} strokeWidth={0.4} />
      );
      // Inner panel border (raised/recessed effect)
      elements.push(
        <rect key={`d-inner${i}`} x={dx + panelBorder} y={y + inset + panelBorder}
          width={dw - 1 - 2 * panelBorder} height={h - 2 * inset - 2 * panelBorder}
          fill="none" stroke={COLORS.drawerLine} strokeWidth={0.25} opacity={0.5} />
      );
    }
  }

  return <>{elements}</>;
}

// Draw appliance symbols for different types
function ApplianceSymbol({ x, y, w, h, applianceType }) {
  const elements = [];
  const cx = x + w / 2;
  const cy = y + h / 2;
  const inset = 3 * SCALE;

  // Main appliance box
  elements.push(
    <rect key="bg" x={x} y={y} width={w} height={h}
      fill={COLORS.applFill} stroke={COLORS.appliance} strokeWidth={0.6} />
  );

  if (applianceType === 'range' || applianceType === 'cooktop') {
    // Cooktop burners - 4 circles
    const margin = 4 * SCALE;
    const bw = (w - 2 * margin) / 2;
    const bh = (h - 2 * margin) / 2;
    const r = Math.min(bw, bh) * 0.35;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const bx = x + margin + col * bw + bw / 2;
        const by = y + margin + row * bh + bh / 2;
        elements.push(
          <circle key={`burner-${row}-${col}`} cx={bx} cy={by} r={r}
            fill="none" stroke={COLORS.appliance} strokeWidth={0.4} />
        );
      }
    }
  } else if (applianceType === 'refrigerator') {
    // Tall fridge - vertical rectangle with handle and divider line
    elements.push(
      <line key="divider" x1={x + inset} y1={y + h * 0.5} x2={x + w - inset} y2={y + h * 0.5}
        stroke={COLORS.appliance} strokeWidth={0.4} />
    );
    // Handle line on right side
    elements.push(
      <line key="handle" x1={x + w - 2 * SCALE} y1={y + 5 * SCALE} x2={x + w - 2 * SCALE} y2={y + h - 5 * SCALE}
        stroke={COLORS.appliance} strokeWidth={0.5} />
    );
  } else if (applianceType === 'dishwasher') {
    // Dishwasher - horizontal lines pattern + handle
    elements.push(
      <line key="line1" x1={x + inset} y1={y + h * 0.25} x2={x + w - inset} y2={y + h * 0.25}
        stroke={COLORS.appliance} strokeWidth={0.3} />
    );
    elements.push(
      <line key="line2" x1={x + inset} y1={y + h * 0.35} x2={x + w - inset} y2={y + h * 0.35}
        stroke={COLORS.appliance} strokeWidth={0.3} />
    );
    elements.push(
      <line key="line3" x1={x + inset} y1={y + h * 0.5} x2={x + w - inset} y2={y + h * 0.5}
        stroke={COLORS.appliance} strokeWidth={0.4} />
    );
    // Handle
    elements.push(
      <line key="handle" x1={x + w / 2 - 3 * SCALE} y1={y + h - 3 * SCALE} x2={x + w / 2 + 3 * SCALE} y2={y + h - 3 * SCALE}
        stroke={COLORS.appliance} strokeWidth={0.5} />
    );
  } else if (applianceType === 'wallOven') {
    // Wall oven - oven door with window
    const doorInset = 2 * SCALE;
    elements.push(
      <rect key="door" x={x + doorInset} y={y + doorInset} width={w - 2 * doorInset} height={h - 2 * doorInset}
        fill="none" stroke={COLORS.appliance} strokeWidth={0.4} />
    );
    // Window - smaller rectangle
    const winInset = 5 * SCALE;
    elements.push(
      <rect key="window" x={x + winInset} y={y + winInset} width={w - 2 * winInset} height={(h - 2 * winInset) * 0.6}
        fill="#e8e8e8" stroke={COLORS.appliance} strokeWidth={0.3} />
    );
    // Handle
    elements.push(
      <line key="handle" x1={x + w - 2 * SCALE} y1={y + h / 2 - 3 * SCALE} x2={x + w - 2 * SCALE} y2={y + h / 2 + 3 * SCALE}
        stroke={COLORS.appliance} strokeWidth={0.5} />
    );
  } else if (applianceType === 'sink') {
    // Sink - basin outline (rounded rectangle)
    const sinkInset = 3 * SCALE;
    elements.push(
      <ellipse key="basin" cx={cx} cy={y + h * 0.6} rx={w / 2 - sinkInset} ry={h * 0.3}
        fill="none" stroke={COLORS.appliance} strokeWidth={0.5} />
    );
    // Faucet (simple line)
    elements.push(
      <line key="faucet" x1={cx} y1={y + h * 0.5} x2={cx} y2={y + 2 * SCALE}
        stroke={COLORS.appliance} strokeWidth={0.4} />
    );
  } else {
    // Generic appliance - simple grid
    const gridSize = 3 * SCALE;
    for (let i = 0; i < h / gridSize; i++) {
      elements.push(
        <line key={`grid-h${i}`} x1={x + inset} y1={y + inset + i * gridSize} x2={x + w - inset} y2={y + inset + i * gridSize}
          stroke={COLORS.appliance} strokeWidth={0.2} opacity={0.4} />
      );
    }
  }

  return <>{elements}</>;
}

/**
 * Architectural dimension line with tick marks (perpendicular lines, NOT arrows)
 */
function DimensionLine({ x1, y1, x2, y2, label, position = 'above', offset = 12 }) {
  const isHorizontal = Math.abs(y2 - y1) < 1;
  const isVertical = Math.abs(x2 - x1) < 1;
  const tickSize = 2.5;

  const elements = [];

  // Main dimension line
  elements.push(
    <line key="line" x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={COLORS.dimLine} strokeWidth={0.4} />
  );

  // Perpendicular tick marks at ends (architectural style)
  if (isHorizontal) {
    elements.push(
      <line key="tick1" x1={x1} y1={y1 - tickSize} x2={x1} y2={y1 + tickSize}
        stroke={COLORS.dimLine} strokeWidth={0.4} />
    );
    elements.push(
      <line key="tick2" x1={x2} y1={y2 - tickSize} x2={x2} y2={y2 + tickSize}
        stroke={COLORS.dimLine} strokeWidth={0.4} />
    );
    // Dimension label
    const mid = (x1 + x2) / 2;
    const labelY = position === 'above' ? y1 - offset : y1 + offset;
    elements.push(
      <text key="label" x={mid} y={labelY} fill={COLORS.dimText}
        fontSize={4.5} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" fontWeight={500}>{label}</text>
    );
  } else if (isVertical) {
    elements.push(
      <line key="tick1" x1={x1 - tickSize} y1={y1} x2={x1 + tickSize} y2={y1}
        stroke={COLORS.dimLine} strokeWidth={0.4} />
    );
    elements.push(
      <line key="tick2" x1={x2 - tickSize} y1={y2} x2={x2 + tickSize} y2={y2}
        stroke={COLORS.dimLine} strokeWidth={0.4} />
    );
    // Dimension label
    const mid = (y1 + y2) / 2;
    const labelX = position === 'left' ? x1 - offset : x1 + offset;
    elements.push(
      <text key="label" x={labelX} y={mid + 1.5} fill={COLORS.dimText}
        fontSize={4.5} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle"
        transform={`rotate(-90, ${labelX}, ${mid + 1.5})`} fontWeight={500}>{label}</text>
    );
  }

  return <>{elements}</>;
}

/**
 * Extension line helper (dashed line from cabinet edge to dimension string)
 */
function ExtensionLine({ x, y1, y2 }) {
  return <line x1={x} y1={y1} x2={x} y2={y2}
    stroke={COLORS.dimLine} strokeWidth={0.3} strokeDasharray="1,1" opacity={0.6} />;
}

/**
 * Single wall elevation — NKBA installer-grade drawing
 * Includes all required dimensions per Chapter 12
 */
function WallElevation({ wallId, wallLength, ceilingHeight = 96, bases, uppers, talls, appliances, hood, trim = {} }) {
  const wallW = wallLength * SCALE;
  const ceilH = ceilingHeight * SCALE;

  // Layout spacing
  const bottomDimSpace = 50;     // Space for bottom dimension strings
  const rightDimSpace = 90;      // Space for right-side dimensions
  const topSpace = 30;           // Space above ceiling line
  const totalH = ceilH + topSpace + bottomDimSpace + 20;

  // Y coordinates (from top)
  const ceilingY = topSpace;
  const floorY = ceilH + topSpace;

  // Base cabinet Y (from floor up)
  const baseBottomY = floorY;
  const baseTopY = floorY - BASE_H * SCALE;
  const toekickY = floorY - TOEKICK_H * SCALE;
  const counterY = baseTopY - COUNTER_H * SCALE;

  // Upper cabinet Y
  const upperBottomY = counterY - UPPER_GAP * SCALE;
  const upperTopY = upperBottomY - UPPER_H * SCALE;

  // Backsplash zone (18" between counter and uppers)
  const backsplashTop = counterY;
  const backsplashBottom = upperBottomY;

  // Collect all base cabinet positions for dimension string
  const baseCabinets = bases.filter(b => typeof b.position === 'number' && b.position >= 0);
  const upperCabinets = uppers.filter(u => typeof u.position === 'number' && u.position >= 0);

  return (
    <svg viewBox={`-50 -20 ${wallW + rightDimSpace + 60} ${totalH + 40}`} data-pdf="elevation"
      style={{ width: '100%', height: 'auto', maxHeight: 550, background: COLORS.wallBg, borderRadius: 4, marginBottom: 16 }}
      xmlns="http://www.w3.org/2000/svg">

      {/* Wall header */}
      <text x={wallW / 2} y={-8} fill={COLORS.dimText} fontSize={9} fontWeight={700}
        fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle">
        Wall {wallId} Elevation
      </text>

      {/* CEILING LINE — dashed at top with height annotation */}
      <line x1={0} y1={ceilingY} x2={wallW} y2={ceilingY}
        stroke={COLORS.dimLine} strokeWidth={0.5} strokeDasharray="3,2" />
      <text x={wallW + 8} y={ceilingY + 2} fill={COLORS.dimText}
        fontSize={4} fontFamily="'Helvetica', 'Arial', sans-serif">{ceilingHeight}" CLG</text>

      {/* Backsplash fill (18" zone) */}
      {backsplashBottom < backsplashTop && (
        <rect x={0} y={backsplashBottom} width={wallW} height={backsplashTop - backsplashBottom}
          fill={COLORS.backsplash} stroke="none" opacity={0.3} />
      )}

      {/* Backsplash zone annotation (right side) */}
      {backsplashBottom < backsplashTop && (
        <>
          <line x1={wallW + 8} y1={backsplashTop} x2={wallW + 22} y2={backsplashTop}
            stroke={COLORS.dimLine} strokeWidth={0.3} strokeDasharray="1,1" />
          <line x1={wallW + 8} y1={backsplashBottom} x2={wallW + 22} y2={backsplashBottom}
            stroke={COLORS.dimLine} strokeWidth={0.3} strokeDasharray="1,1" />
          <text x={wallW + 28} y={(backsplashTop + backsplashBottom) / 2 + 1.5} fill={COLORS.dimText}
            fontSize={3.5} fontFamily="'Helvetica', 'Arial', sans-serif" fontStyle="italic" opacity={0.7}>
            Backsplash
          </text>
        </>
      )}

      {/* FLOOR LINE — solid dark line */}
      <line x1={-20} y1={floorY} x2={wallW + 20} y2={floorY}
        stroke={COLORS.floor} strokeWidth={1.2} />

      {/* TOE KICK — dark band at floor (4.5" height) */}
      <rect x={0} y={toekickY} width={wallW} height={TOEKICK_H * SCALE}
        fill={COLORS.toekick} stroke={COLORS.floor} strokeWidth={0.4} />

      {/* COUNTERTOP SLAB — solid with edge profile */}
      {baseCabinets.length > 0 && (() => {
        const minX = Math.min(...baseCabinets.map(b => b.position * SCALE));
        const maxX = Math.max(...baseCabinets.map(b => (b.position + b.width) * SCALE));
        return (
          <g key="countertop">
            {/* Countertop surface */}
            <rect x={minX} y={counterY - COUNTER_H * SCALE} width={maxX - minX} height={COUNTER_H * SCALE}
              fill={COLORS.counterFill} stroke={COLORS.counterStroke} strokeWidth={0.5} />
            {/* Front edge line */}
            <line x1={minX} y1={counterY} x2={maxX} y2={counterY}
              stroke={COLORS.counterStroke} strokeWidth={0.6} />
          </g>
        );
      })()}

      {/* BASE CABINETS — with drawer/door detail and SKU labels */}
      {baseCabinets.map((cab, i) => {
        const x = cab.position * SCALE;
        const w = cab.width * SCALE;
        const h = (cab.height || (BASE_H - TOEKICK_H)) * SCALE;
        const y = baseBottomY - h - TOEKICK_H * SCALE;

        const isApp = cab.type === 'appliance';
        const sku = (cab.sku || cab.applianceType || '').replace(/^FC-/, '');
        const drawerCount = sku.match(/B(\d?)D/) ? parseInt(sku.match(/B(\d?)D/)[1] || '1') : 0;
        const doorCount = sku.match(/^B(\d{2})$/) ? (cab.width > 24 ? 2 : 1) : (cab.width > 24 ? 2 : 1);

        return (
          <g key={`base-${i}`}>
            {isApp ? (
              <ApplianceSymbol x={x} y={y} w={w} h={h} applianceType={cab.applianceType || 'unknown'} />
            ) : (
              <CabinetPanel x={x} y={y} w={w} h={h} doorCount={doorCount} drawerCount={drawerCount} />
            )}
            {/* SKU label inside cabinet */}
            {w > 12 * SCALE && (
              <text x={x + w / 2} y={y + h / 2 + 1} fill={COLORS.dimText}
                fontSize={3} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" opacity={0.5}>
                {sku.substring(0, 10)}
              </text>
            )}
          </g>
        );
      })}

      {/* UPPER CABINETS — mounted at 54" AFF bottom, 18" backsplash gap */}
      {upperCabinets.map((cab, i) => {
        if (cab.type === 'end_panel' || cab.width < 1) return null;
        const x = cab.position * SCALE;
        const w = cab.width * SCALE;
        const h = (cab.height || UPPER_H) * SCALE;
        const y = upperBottomY - h;
        const sku = (cab.sku || '').replace(/^FC-/, '');
        const doorCount = cab.width > 24 ? 2 : 1;

        return (
          <g key={`upper-${i}`}>
            <CabinetPanel x={x} y={y} w={w} h={h} doorCount={doorCount} drawerCount={0} />
            {/* SKU label inside */}
            {w > 12 * SCALE && (
              <text x={x + w / 2} y={y + h / 2 + 1} fill={COLORS.dimText}
                fontSize={3} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" opacity={0.5}>
                {sku.substring(0, 10)}
              </text>
            )}
          </g>
        );
      })}

      {/* TALL UNITS — full height from floor to near ceiling */}
      {talls.map((cab, i) => {
        const x = (cab.position || 0) * SCALE;
        const w = (cab.width || 18) * SCALE;
        const h = (cab.height || TALL_H) * SCALE;
        const y = floorY - h;
        const sku = (cab.sku || '').replace(/^FC-/, '');
        const doorCount = 1;

        return (
          <g key={`tall-${i}`}>
            <CabinetPanel x={x} y={y} w={w} h={h} doorCount={doorCount} drawerCount={0} />
            {/* SKU label inside */}
            {w > 10 * SCALE && (
              <text x={x + w / 2} y={y + h / 2 + 1} fill={COLORS.dimText}
                fontSize={3} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" opacity={0.5}>
                {sku.substring(0, 10)}
              </text>
            )}
          </g>
        );
      })}

      {/* RANGE HOOD — trapezoidal shape above range */}
      {hood && typeof hood.position === 'number' && (
        (() => {
          const x = hood.position * SCALE;
          const w = (hood.width || 36) * SCALE;
          const h = (hood.height || 24) * SCALE;
          const y = upperBottomY - h;
          const taperAmount = Math.min(5 * SCALE, w * 0.1);

          return (
            <g key="hood">
              {/* Trapezoidal hood body */}
              <polygon
                points={`${x},${y + h} ${x + taperAmount},${y} ${x + w - taperAmount},${y} ${x + w},${y + h}`}
                fill={COLORS.hoodFill} stroke={COLORS.hoodStroke} strokeWidth={0.6} />
              {/* Interior detail line */}
              <line x1={x + taperAmount + 2} y1={y + 2} x2={x + w - taperAmount - 2} y2={y + 2}
                stroke={COLORS.hoodStroke} strokeWidth={0.3} opacity={0.4} />
              {/* Hood label */}
              {w > 15 * SCALE && (
                <text x={x + w / 2} y={y + h / 2 + 1.5} fill={COLORS.hoodStroke}
                  fontSize={3.5} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" opacity={0.7}>
                  HOOD
                </text>
              )}
            </g>
          );
        })()
      )}

      {/* TRIM & MOLDING */}
      {trim.crown && upperCabinets.length > 0 && (() => {
        const minX = Math.min(...upperCabinets.map(u => u.position * SCALE));
        const maxX = Math.max(...upperCabinets.map(u => (u.position + u.width) * SCALE));
        const crownH = 3 * SCALE;
        const crownY = upperTopY - crownH;
        return (
          <g key="crown">
            {/* Crown molding body */}
            <rect x={minX} y={crownY} width={maxX - minX} height={crownH}
              fill={COLORS.crownFill} stroke={COLORS.crownStroke} strokeWidth={0.5} />
            {/* Molding profile detail line */}
            <line x1={minX} y1={crownY + crownH * 0.4} x2={maxX} y2={crownY + crownH * 0.4}
              stroke={COLORS.crownStroke} strokeWidth={0.3} opacity={0.5} />
          </g>
        );
      })()}

      {trim.lightRail && upperCabinets.length > 0 && (() => {
        const minX = Math.min(...upperCabinets.map(u => u.position * SCALE));
        const maxX = Math.max(...upperCabinets.map(u => (u.position + u.width) * SCALE));
        const lrH = 1.2 * SCALE;
        return (
          <g key="lightRail">
            <rect x={minX} y={upperBottomY} width={maxX - minX} height={lrH}
              fill={COLORS.lightRail} stroke={COLORS.crownStroke} strokeWidth={0.35} />
            <line x1={minX} y1={upperBottomY + lrH * 0.5} x2={maxX} y2={upperBottomY + lrH * 0.5}
              stroke={COLORS.crownStroke} strokeWidth={0.2} opacity={0.5} />
          </g>
        );
      })()}

      {trim.traditionalTrim && baseCabinets.length > 0 && (() => {
        const minX = Math.min(...baseCabinets.map(b => b.position * SCALE));
        const maxX = Math.max(...baseCabinets.map(b => (b.position + b.width) * SCALE));
        const trimH = 1.5 * SCALE;
        return (
          <rect key="traditionalTrim" x={minX} y={counterY - COUNTER_H * SCALE - trimH} width={maxX - minX} height={trimH}
            fill={COLORS.crownFill} stroke={COLORS.crownStroke} strokeWidth={0.35} opacity={0.8} />
        );
      })()}

      {/* ============ DIMENSION ANNOTATIONS — NKBA Chapter 12 ============ */}

      {/* RIGHT SIDE VERTICAL DIMENSIONS — AFF (Above Finished Floor) */}
      <g key="rightDimensions">
        {/* Floor reference line */}
        <line x1={wallW + 10} y1={floorY} x2={wallW + 20} y2={floorY}
          stroke={COLORS.dimLine} strokeWidth={0.4} />

        {/* Toe kick height — 4.5" */}
        <DimensionLine x1={wallW + 16} y1={toekickY} x2={wallW + 16} y2={floorY}
          label={`${TOEKICK_H}"`} position="right" offset={12} />

        {/* Base cabinet height — 34.5" */}
        <DimensionLine x1={wallW + 16} y1={baseTopY} x2={wallW + 16} y2={toekickY}
          label={`${BASE_H}"`} position="right" offset={12} />

        {/* Counter height — 36" AFF (with dash line) */}
        <line x1={wallW + 8} y1={counterY} x2={wallW + 28} y2={counterY}
          stroke={COLORS.dimLine} strokeWidth={0.35} strokeDasharray="2,1.5" />
        <text x={wallW + 32} y={counterY + 1.5} fill={COLORS.dimText}
          fontSize={4} fontFamily="'Helvetica', 'Arial', sans-serif" fontWeight={500}>
          36" AFF
        </text>

        {/* Backsplash zone — 18" */}
        {upperCabinets.length > 0 && (
          <DimensionLine x1={wallW + 16} y1={counterY} x2={wallW + 16} y2={upperBottomY}
            label={`${UPPER_GAP}"`} position="right" offset={12} />
        )}

        {/* Upper cabinet bottom — 54" AFF (with dash line) */}
        {upperCabinets.length > 0 && (
          <>
            <line x1={wallW + 8} y1={upperBottomY} x2={wallW + 28} y2={upperBottomY}
              stroke={COLORS.dimLine} strokeWidth={0.35} strokeDasharray="2,1.5" />
            <text x={wallW + 32} y={upperBottomY + 1.5} fill={COLORS.dimText}
              fontSize={4} fontFamily="'Helvetica', 'Arial', sans-serif" fontWeight={500}>
              54" AFF
            </text>
          </>
        )}

        {/* Upper cabinet height — measured value */}
        {upperCabinets.length > 0 && (() => {
          const upperHeight = upperCabinets.length > 0 ? (upperCabinets[0].height || UPPER_H) : UPPER_H;
          return (
            <DimensionLine x1={wallW + 16} y1={upperTopY} x2={wallW + 16} y2={upperBottomY}
              label={`${upperHeight}"`} position="right" offset={12} />
          );
        })()}

        {/* Ceiling line — with height annotation */}
        <line x1={wallW + 8} y1={ceilingY} x2={wallW + 28} y2={ceilingY}
          stroke={COLORS.dimLine} strokeWidth={0.35} strokeDasharray="2,1.5" />
        <text x={wallW + 32} y={ceilingY + 1.5} fill={COLORS.dimText}
          fontSize={4} fontFamily="'Helvetica', 'Arial', sans-serif" fontWeight={500}>
          {ceilingHeight}" CLG
        </text>
      </g>

      {/* BOTTOM DIMENSION STRING — Individual cabinet widths + overall wall length */}
      <g key="bottomDimensions">
        {/* Extension lines from each cabinet edge + dimension ticks */}
        {baseCabinets.length > 0 && (() => {
          const minX = Math.min(...baseCabinets.map(b => b.position * SCALE));
          const maxX = Math.max(...baseCabinets.map(b => (b.position + b.width) * SCALE));

          const elements = [];

          // Extension lines at each cabinet edge
          baseCabinets.forEach(cab => {
            const x = cab.position * SCALE;
            elements.push(
              <ExtensionLine key={`ext-left-${cab.position}`} x={x} y1={floorY} y2={floorY + 12} />
            );
            const xRight = (cab.position + cab.width) * SCALE;
            elements.push(
              <ExtensionLine key={`ext-right-${cab.position}`} x={xRight} y1={floorY} y2={floorY + 12} />
            );
          });

          // Wall edge extension lines
          elements.push(
            <ExtensionLine key="ext-left-wall" x={0} y1={floorY} y2={floorY + 12} />
          );
          elements.push(
            <ExtensionLine key="ext-right-wall" x={wallW} y1={floorY} y2={floorY + 12} />
          );

          // First dimension line (individual cabinet widths)
          elements.push(
            <line key="dimLine1" x1={0} y1={floorY + 12} x2={wallW} y2={floorY + 12}
              stroke={COLORS.dimLine} strokeWidth={0.4} />
          );

          // Individual cabinet width labels
          baseCabinets.forEach(cab => {
            const x = cab.position * SCALE;
            const w = cab.width * SCALE;
            const mid = x + w / 2;
            elements.push(
              <text key={`dim-width-${cab.position}`} x={mid} y={floorY + 12 - 2} fill={COLORS.dimText}
                fontSize={4} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" fontWeight={500}>
                {cab.width}"
              </text>
            );
          });

          // Second dimension line (overall wall length)
          elements.push(
            <line key="dimLine2" x1={0} y1={floorY + 28} x2={wallW} y2={floorY + 28}
              stroke={COLORS.dimLine} strokeWidth={0.45} />
          );

          // Tick marks at wall edges for overall dimension
          elements.push(
            <line key="dimTick1" x1={0} y1={floorY + 26} x2={0} y2={floorY + 30}
              stroke={COLORS.dimLine} strokeWidth={0.4} />
          );
          elements.push(
            <line key="dimTick2" x1={wallW} y1={floorY + 26} x2={wallW} y2={floorY + 30}
              stroke={COLORS.dimLine} strokeWidth={0.4} />
          );

          // Overall wall length label
          elements.push(
            <text key="dim-overall" x={wallW / 2} y={floorY + 28 - 2} fill={COLORS.dimText}
              fontSize={4.5} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" fontWeight={700}>
              {wallLength}"
            </text>
          );

          return elements;
        })()}
      </g>
    </svg>
  );
}

export default function ElevationView({ solverResult, trim = {} }) {
  if (!solverResult) return null;

  const placements = solverResult.placements || [];
  const upperData = solverResult.uppers || [];
  const inputWalls = solverResult._inputWalls || [];

  // Build wall data with ceiling heights
  const wallData = useMemo(() => {
    const data = {};

    // Initialize walls with length and ceiling height
    inputWalls.forEach(w => {
      data[w.id] = {
        id: w.id,
        length: w.length,
        ceilingHeight: w.ceilingHeight || 96, // Default to standard 96" ceiling
        bases: [],
        uppers: [],
        talls: [],
        appliances: [],
        hood: null,
      };
    });

    // Base-level placements (cabinets, appliances)
    placements.forEach(p => {
      const wid = p.wall;
      if (!wid || !data[wid]) return;
      if (p.type === 'tall') data[wid].talls.push(p);
      else if (p.type === 'appliance') {
        data[wid].bases.push(p);
        data[wid].appliances.push(p);
      }
      else if (p.type === 'base' && typeof p.position === 'number') data[wid].bases.push(p);
    });

    // Upper cabinets and hood from solver uppers array
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
        <WallElevation
          key={wd.id}
          wallId={wd.id}
          wallLength={wd.length}
          ceilingHeight={wd.ceilingHeight}
          bases={wd.bases}
          uppers={wd.uppers}
          talls={wd.talls}
          appliances={wd.appliances}
          hood={wd.hood}
          trim={trim}
        />
      ))}
    </div>
  );
}
