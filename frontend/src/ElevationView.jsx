import React, { useMemo } from 'react';

/**
 * ElevationView — Professional kitchen elevation drawing
 * Renders architectural-style front elevations of kitchen walls.
 * Shows cabinet details (door/drawer panels), appliances with recognizable symbols,
 * countertops, trim, and dimension annotations in a professional design studio style.
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

// Standard heights in inches
const TOEKICK_H = 4.5;
const BASE_H = 34.5;
const COUNTER_H = 1.5;
const UPPER_GAP = 18; // gap between counter and upper bottom
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

// Dimension annotation with tick marks (architectural style)
function DimensionLine({ x1, y1, x2, y2, label, position = 'above', offset = 12 }) {
  const isHorizontal = Math.abs(y2 - y1) < 1;
  const isVertical = Math.abs(x2 - x1) < 1;
  const tickSize = 2.5;

  const elements = [];

  // Dimension line
  elements.push(
    <line key="line" x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={COLORS.dimLine} strokeWidth={0.4} />
  );

  // Tick marks at ends
  if (isHorizontal) {
    elements.push(
      <line key="tick1" x1={x1} y1={y1 - tickSize} x2={x1} y2={y1 + tickSize}
        stroke={COLORS.dimLine} strokeWidth={0.4} />
    );
    elements.push(
      <line key="tick2" x1={x2} y1={y2 - tickSize} x2={x2} y2={y2 + tickSize}
        stroke={COLORS.dimLine} strokeWidth={0.4} />
    );
    // Label
    const mid = (x1 + x2) / 2;
    const labelY = position === 'above' ? y1 - offset : y1 + offset;
    elements.push(
      <text key="label" x={mid} y={labelY} fill={COLORS.dimText}
        fontSize={4.5} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle">{label}</text>
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
    // Label
    const mid = (y1 + y2) / 2;
    const labelX = position === 'left' ? x1 - offset : x1 + offset;
    elements.push(
      <text key="label" x={labelX} y={mid + 1.5} fill={COLORS.dimText}
        fontSize={4.5} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" transform={`rotate(-90, ${labelX}, ${mid + 1.5})`}>{label}</text>
    );
  }

  return <>{elements}</>;
}

// Single wall elevation
function WallElevation({ wallId, wallLength, bases, uppers, talls, appliances, hood, trim = {} }) {
  const wallW = wallLength * SCALE;
  const totalH = TALL_H * SCALE + 60;
  const floorY = totalH - 30;

  // Base cabinet Y (from floor up)
  const baseBottomY = floorY;
  const baseTopY = floorY - BASE_H * SCALE;
  const toekickY = floorY - TOEKICK_H * SCALE;
  const counterY = baseTopY - COUNTER_H * SCALE;

  // Upper cabinet Y
  const upperBottomY = counterY - UPPER_GAP * SCALE;
  const upperTopY = upperBottomY - UPPER_H * SCALE;

  // Backsplash area between counter and uppers
  const backsplashTop = counterY - COUNTER_H * SCALE;
  const backsplashBottom = upperBottomY;

  return (
    <svg viewBox={`-40 -20 ${wallW + 100} ${totalH + 40}`} data-pdf="elevation"
      style={{ width: '100%', height: 'auto', maxHeight: 500, background: COLORS.wallBg, borderRadius: 4, marginBottom: 16 }}
      xmlns="http://www.w3.org/2000/svg">

      {/* Wall label - clean, professional typography */}
      <text x={wallW / 2} y={-8} fill={COLORS.dimText} fontSize={9} fontWeight={600}
        fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle">
        Wall {wallId} Elevation
      </text>

      {/* Backsplash fill */}
      {backsplashBottom < backsplashTop && (
        <rect x={0} y={backsplashBottom} width={wallW} height={backsplashTop - backsplashBottom}
          fill={COLORS.backsplash} stroke="none" opacity={0.4} />
      )}

      {/* Floor line */}
      <line x1={-20} y1={floorY} x2={wallW + 20} y2={floorY}
        stroke={COLORS.floor} strokeWidth={1.2} />

      {/* Toe kick - dark recessed band */}
      <rect x={0} y={toekickY} width={wallW} height={TOEKICK_H * SCALE}
        fill={COLORS.toekick} stroke={COLORS.floor} strokeWidth={0.4} />

      {/* Countertop slab - solid with edge profile */}
      {bases.length > 0 && (() => {
        const validBases = bases.filter(b => typeof b.position === 'number');
        if (validBases.length === 0) return null;
        const minX = Math.min(...validBases.map(b => b.position * SCALE));
        const maxX = Math.max(...validBases.map(b => (b.position + b.width) * SCALE));
        return (
          <g key="countertop">
            {/* Countertop slab */}
            <rect x={minX} y={counterY - COUNTER_H * SCALE} width={maxX - minX} height={COUNTER_H * SCALE}
              fill={COLORS.counterFill} stroke={COLORS.counterStroke} strokeWidth={0.5} />
            {/* Overhang shadow */}
            <line x1={minX - 2} y1={counterY} x2={maxX + 2} y2={counterY}
              stroke={COLORS.dimLine} strokeWidth={0.4} />
            {/* Front edge detail */}
            <line x1={minX} y1={counterY} x2={maxX} y2={counterY}
              stroke={COLORS.counterStroke} strokeWidth={0.6} />
          </g>
        );
      })()}

      {/* Base cabinets */}
      {bases.map((cab, i) => {
        if (typeof cab.position !== 'number' || cab.position < 0) return null;
        const x = cab.position * SCALE;
        const w = cab.width * SCALE;
        const h = (cab.height || (BASE_H - TOEKICK_H)) * SCALE;
        const y = baseBottomY - h - TOEKICK_H * SCALE;

        const isApp = cab.type === 'appliance';
        const sku = (cab.sku || cab.applianceType || '').replace(/^FC-/, '');
        const drawerCount = sku.match(/B(\d?)D/) ? parseInt(sku.match(/B(\d?)D/)[1] || '1') : 0;
        const doorCount = sku.match(/^B(\d{2})$/) ? (cab.width > 24 ? 2 : 1) : 0;

        return (
          <g key={`base-${i}`}>
            {isApp ? (
              <ApplianceSymbol x={x} y={y} w={w} h={h} applianceType={cab.applianceType || 'unknown'} />
            ) : (
              <CabinetPanel x={x} y={y} w={w} h={h} doorCount={doorCount} drawerCount={drawerCount} />
            )}
            {/* Subtle SKU label below */}
            {w > 12 * SCALE && (
              <text x={x + w / 2} y={y + h + TOEKICK_H * SCALE + 6} fill={COLORS.dimText}
                fontSize={3.5} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" opacity={0.6}>
                {sku.substring(0, 12)}
              </text>
            )}
            {/* Width dimension above */}
            {w > 18 * SCALE && (
              <DimensionLine x1={x} y1={y - 5 * SCALE} x2={x + w} y2={y - 5 * SCALE}
                label={`${cab.width}"`} position="above" offset={8} />
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
        const sku = (cab.sku || '').replace(/^FC-/, '');
        const doorCount = cab.width > 24 ? 2 : 1;

        return (
          <g key={`upper-${i}`}>
            <CabinetPanel x={x} y={y} w={w} h={h} doorCount={doorCount} drawerCount={0} />
            {/* Subtle SKU label */}
            {w > 12 * SCALE && (
              <text x={x + w / 2} y={y + h + 5} fill={COLORS.dimText}
                fontSize={3.5} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" opacity={0.6}>
                {sku.substring(0, 12)}
              </text>
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
        const sku = (cab.sku || '').replace(/^FC-/, '');
        const doorCount = 1;

        return (
          <g key={`tall-${i}`}>
            <CabinetPanel x={x} y={y} w={w} h={h} doorCount={doorCount} drawerCount={0} />
            {/* Subtle SKU label */}
            {w > 10 * SCALE && (
              <text x={x + w / 2} y={y + h + 5} fill={COLORS.dimText}
                fontSize={3.5} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" opacity={0.6}>
                {sku.substring(0, 12)}
              </text>
            )}
          </g>
        );
      })}

      {/* Range hood - trapezoidal with clean styling */}
      {hood && typeof hood.position === 'number' && (
        (() => {
          const x = hood.position * SCALE;
          const w = (hood.width || 36) * SCALE;
          const h = (hood.height || 24) * SCALE;
          const y = counterY - UPPER_GAP * SCALE - h;
          const taperAmount = Math.min(5 * SCALE, w * 0.08);

          return (
            <g key="hood">
              {/* Trapezoidal hood body with clean lines */}
              <polygon
                points={`${x},${y + h} ${x + taperAmount},${y} ${x + w - taperAmount},${y} ${x + w},${y + h}`}
                fill={COLORS.hoodFill} stroke={COLORS.hoodStroke} strokeWidth={0.6} />
              {/* Subtle hood interior detail */}
              <line x1={x + taperAmount + 2} y1={y + 2} x2={x + w - taperAmount - 2} y2={y + 2}
                stroke={COLORS.hoodStroke} strokeWidth={0.3} opacity={0.4} />
              {/* SKU label on hood */}
              {w > 15 * SCALE && (
                <text x={x + w / 2} y={y + h / 2 + 2} fill={COLORS.hoodStroke}
                  fontSize={4} fontFamily="'Helvetica', 'Arial', sans-serif" textAnchor="middle" opacity={0.7}>
                  HOOD
                </text>
              )}
            </g>
          );
        })()
      )}

      {/* TRIM & MOLDING */}
      {/* Crown molding - elegant profile */}
      {trim.crown && uppers.length > 0 && (() => {
        const upperPositions = uppers.filter(u => typeof u.position === 'number');
        if (upperPositions.length === 0) return null;
        const minX = Math.min(...upperPositions.map(u => u.position * SCALE));
        const maxX = Math.max(...upperPositions.map(u => (u.position + u.width) * SCALE));
        const crownH = 3 * SCALE;
        const crownY = upperTopY - crownH;
        return (
          <g key="crown">
            {/* Crown base */}
            <rect x={minX} y={crownY} width={maxX - minX} height={crownH}
              fill={COLORS.crownFill} stroke={COLORS.crownStroke} strokeWidth={0.5} />
            {/* Molding profile detail */}
            <path d={`M ${minX} ${crownY + crownH * 0.4} Q ${minX + 2} ${crownY + crownH * 0.2}, ${minX + 6} ${crownY}`}
              stroke={COLORS.crownStroke} strokeWidth={0.3} fill="none" opacity={0.5} />
            <line x1={minX} y1={crownY + crownH * 0.65} x2={maxX} y2={crownY + crownH * 0.65}
              stroke={COLORS.crownStroke} strokeWidth={0.3} opacity={0.4} />
          </g>
        );
      })()}

      {/* Light rail - thin elegant strip */}
      {trim.lightRail && uppers.length > 0 && (() => {
        const upperPositions = uppers.filter(u => typeof u.position === 'number');
        if (upperPositions.length === 0) return null;
        const minX = Math.min(...upperPositions.map(u => u.position * SCALE));
        const maxX = Math.max(...upperPositions.map(u => (u.position + u.width) * SCALE));
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

      {/* Traditional trim - subtle accent */}
      {trim.traditionalTrim && bases.length > 0 && (() => {
        const basePositions = bases.filter(b => typeof b.position === 'number');
        if (basePositions.length === 0) return null;
        const minX = Math.min(...basePositions.map(b => b.position * SCALE));
        const maxX = Math.max(...basePositions.map(b => (b.position + b.width) * SCALE));
        const trimH = 1.5 * SCALE;
        return (
          <rect key="traditionalTrim" x={minX} y={counterY - COUNTER_H * SCALE - trimH} width={maxX - minX} height={trimH}
            fill={COLORS.crownFill} stroke={COLORS.crownStroke} strokeWidth={0.35} opacity={0.8} />
        );
      })()}

      {/* HEIGHT DIMENSIONS - Right side with tick marks */}
      <g key="dimensions">
        {/* Base cabinet height */}
        <DimensionLine x1={wallW + 16} y1={baseBottomY} x2={wallW + 16} y2={baseTopY}
          label={`${BASE_H}"`} position="right" offset={12} />

        {/* Counter height AFF */}
        <line x1={wallW + 8} y1={counterY} x2={wallW + 22} y2={counterY}
          stroke={COLORS.dimLine} strokeWidth={0.4} strokeDasharray="1.5,1.5" />
        <text x={wallW + 26} y={counterY + 1.5} fill={COLORS.dimText}
          fontSize={4} fontFamily="'Helvetica', 'Arial', sans-serif">36" AFF</text>

        {/* Upper cabinet bottom AFF */}
        {uppers.length > 0 && (
          <>
            <line x1={wallW + 8} y1={upperBottomY} x2={wallW + 22} y2={upperBottomY}
              stroke={COLORS.dimLine} strokeWidth={0.4} strokeDasharray="1.5,1.5" />
            <text x={wallW + 26} y={upperBottomY + 1.5} fill={COLORS.dimText}
              fontSize={4} fontFamily="'Helvetica', 'Arial', sans-serif">54" AFF</text>
          </>
        )}
      </g>

      {/* Overall width dimension below */}
      <DimensionLine x1={0} y1={floorY + 22} x2={wallW} y2={floorY + 22}
        label={`${wallLength}"`} position="below" offset={10} />
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
