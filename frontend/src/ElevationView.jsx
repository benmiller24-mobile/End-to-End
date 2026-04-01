import React, { useMemo } from 'react';

/**
 * ElevationView - Professional Architectural Kitchen Elevation (NKBA Ch.12)
 *
 * White background, thin black lines, numbered cabinet tags in diamonds,
 * every cabinet width dimensioned, vertical height dims on right side,
 * appliance labels (VENT HOOD, OVEN, DW, REF), proper line weights.
 *
 * Data flow:
 *   solverResult.placements → bases per wall (type=base|appliance, wall=id, position, width)
 *   solverResult.uppers     → [{wallId, cabinets:[{position, width, height, sku, type}]}]
 *   solverResult.talls       → [{wall, position, width, height, sku}]
 *   solverResult.corners     → [{wallA, wallB, sku, size}]
 *   solverResult._inputWalls → [{id, length, ceilingHeight}]
 */

// ─── CONSTANTS ────────────────────────────────────────────────────────
const S = 2.2;                     // SVG px per inch
const TOEKICK  = 4.5;
const BASE_H   = 34.5;             // base box height (without toekick)
const CTR_H    = 1.5;              // countertop slab
const GAP      = 18;               // backsplash gap
const UPPER_H  = 36;               // default upper height
const TALL_H   = 96;

const C = {
  bg:         '#ffffff',
  line:       '#222222',
  thinLine:   '#555555',
  dimLine:    '#444444',
  dimText:    '#333333',
  fill:       '#fafafa',
  ctrFill:    '#e0ddd8',
  toekick:    '#1a1a1a',
  backsplash: '#f0eeeb',
  applFill:   '#f0f0f0',
  hoodFill:   '#e8e6e3',
  tagFill:    '#ffffff',
  tagStroke:  '#333333',
  floor:      '#111111',
};

// ─── HELPERS ──────────────────────────────────────────────────────────

/** Numbered cabinet tag — circle with KD prefix per NKBA Ch.2 convention */
function CabTag({ cx, cy, num, prefix = 'KD' }) {
  const r = 7;
  const label = `${prefix}${num}`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r}
        fill={C.tagFill} stroke={C.tagStroke} strokeWidth={0.5} />
      <text x={cx} y={cy + 1.8} fill={C.dimText}
        fontSize={label.length > 3 ? 3.5 : 4} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="600">{label}</text>
    </g>
  );
}

/** Cabinet front with door/drawer panels */
function CabFront({ x, y, w, h, doors, drawers }) {
  const els = [];
  const p = 2 * S; // panel inset
  els.push(<rect key="o" x={x} y={y} width={w} height={h}
    fill={C.fill} stroke={C.line} strokeWidth={0.5} />);

  const drH = drawers > 0 ? Math.min(h * 0.32, drawers * 7 * S) / drawers : 0;

  // Drawers from top
  for (let i = 0; i < drawers; i++) {
    const dy = y + p + i * drH;
    els.push(<rect key={`dr${i}`} x={x + p} y={dy} width={w - 2 * p} height={drH - 1}
      fill="none" stroke={C.thinLine} strokeWidth={0.3} />);
    els.push(<line key={`drh${i}`} x1={x + w / 2 - 4 * S} y1={dy + drH / 2}
      x2={x + w / 2 + 4 * S} y2={dy + drH / 2}
      stroke={C.thinLine} strokeWidth={0.35} />);
  }

  // Doors below drawers
  const doorY = y + p + drawers * drH + (drawers > 0 ? 1 : 0);
  const doorH = h - 2 * p - drawers * drH - (drawers > 0 ? 1 : 0);
  if (doorH > 4 * S) {
    const dc = Math.max(doors, 1);
    const dw = (w - 2 * p) / dc;
    for (let i = 0; i < dc; i++) {
      const dx = x + p + i * dw;
      // Outer panel
      els.push(<rect key={`d${i}`} x={dx + 0.5} y={doorY} width={dw - 1} height={doorH}
        fill="none" stroke={C.thinLine} strokeWidth={0.35} />);
      // Inner raised panel
      const ip = 1.2 * S;
      if (dw - 1 > 2 * ip + 2 && doorH > 2 * ip + 2) {
        els.push(<rect key={`di${i}`} x={dx + 0.5 + ip} y={doorY + ip}
          width={dw - 1 - 2 * ip} height={doorH - 2 * ip}
          fill="none" stroke={C.thinLine} strokeWidth={0.2} opacity={0.5} />);
      }
    }
  }
  return <>{els}</>;
}

/** Appliance symbol in elevation */
function ApplianceSym({ x, y, w, h, aType }) {
  const els = [];
  els.push(<rect key="bg" x={x} y={y} width={w} height={h}
    fill={C.applFill} stroke={C.line} strokeWidth={0.5} />);

  if (aType === 'range' || aType === 'cooktop') {
    const m = 3 * S;
    const bw = (w - 2 * m) / 2;
    const bh = (h - 2 * m) / 2;
    const r = Math.min(bw, bh) * 0.35;
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 2; col++)
        els.push(<circle key={`b${row}${col}`}
          cx={x + m + col * bw + bw / 2} cy={y + m + row * bh + bh / 2} r={r}
          fill="none" stroke={C.line} strokeWidth={0.35} />);
  } else if (aType === 'refrigerator') {
    els.push(<line key="div" x1={x + 2 * S} y1={y + h * 0.45}
      x2={x + w - 2 * S} y2={y + h * 0.45} stroke={C.line} strokeWidth={0.35} />);
    els.push(<line key="hdl" x1={x + w - 1.8 * S} y1={y + 4 * S}
      x2={x + w - 1.8 * S} y2={y + h - 4 * S} stroke={C.line} strokeWidth={0.4} />);
  } else if (aType === 'dishwasher') {
    els.push(<line key="l1" x1={x + 2 * S} y1={y + h * 0.3}
      x2={x + w - 2 * S} y2={y + h * 0.3} stroke={C.line} strokeWidth={0.25} />);
    els.push(<line key="l2" x1={x + 2 * S} y1={y + h * 0.5}
      x2={x + w - 2 * S} y2={y + h * 0.5} stroke={C.line} strokeWidth={0.35} />);
    els.push(<line key="hdl" x1={x + w / 2 - 3 * S} y1={y + h - 2.5 * S}
      x2={x + w / 2 + 3 * S} y2={y + h - 2.5 * S} stroke={C.line} strokeWidth={0.4} />);
  } else if (aType === 'wallOven') {
    const d = 2 * S;
    els.push(<rect key="door" x={x + d} y={y + d} width={w - 2 * d} height={h - 2 * d}
      fill="none" stroke={C.line} strokeWidth={0.35} />);
    const wi = 4 * S;
    els.push(<rect key="win" x={x + wi} y={y + wi} width={w - 2 * wi} height={(h - 2 * wi) * 0.55}
      fill="#eaeaea" stroke={C.line} strokeWidth={0.25} />);
  } else if (aType === 'sink') {
    els.push(<ellipse key="basin" cx={x + w / 2} cy={y + h * 0.55}
      rx={w / 2 - 2.5 * S} ry={h * 0.28}
      fill="none" stroke={C.line} strokeWidth={0.4} />);
    els.push(<line key="faucet" x1={x + w / 2} y1={y + h * 0.45}
      x2={x + w / 2} y2={y + 1.5 * S} stroke={C.line} strokeWidth={0.3} />);
  }
  return <>{els}</>;
}

/** Appliance label text */
function appLabel(aType) {
  const m = { range: 'RANGE', cooktop: 'COOKTOP', refrigerator: 'REF',
    dishwasher: 'DW', wallOven: 'OVEN', sink: 'SINK', microwave: 'MW' };
  return m[aType] || (aType || '').toUpperCase().substring(0, 6);
}

// ─── SINGLE WALL ELEVATION ───────────────────────────────────────────

function WallElev({ wallId, wallLen, ceilH = 96, bases, uppers, talls, hood, trim = {}, tagStart = 1, debug = false }) {
  const wW = wallLen * S;
  const cH = ceilH * S;
  const top = 35;
  const botDim = 55;
  const rightDim = 100;
  const floorY = cH + top;

  // Y positions
  const tkY     = floorY - TOEKICK * S;
  const baseTopY = floorY - (TOEKICK + BASE_H - TOEKICK) * S;  // base box top
  const baseBoxH = (BASE_H - TOEKICK) * S;
  const ctrY    = floorY - BASE_H * S - CTR_H * S;
  const upBotY  = ctrY - GAP * S;
  const upTopY  = upBotY - UPPER_H * S;
  const ceilY   = top;

  // Filter valid placements
  const validBases = bases.filter(b => typeof b.position === 'number' && b.position >= 0 && b.width > 0);
  const validUppers = uppers.filter(u => typeof u.position === 'number' && u.position >= 0 && u.width > 0 && u.type !== 'end_panel');
  const validTalls = talls.filter(t => typeof t.position === 'number' && t.position >= 0 && t.width > 0);

  // Build sequential tag numbers
  let tagNum = tagStart;
  const allItems = [];
  // Talls first (leftmost), then bases, then uppers
  const sortedTalls = [...validTalls].sort((a, b) => a.position - b.position);
  const sortedBases = [...validBases].sort((a, b) => a.position - b.position);
  const sortedUppers = [...validUppers].sort((a, b) => a.position - b.position);

  sortedTalls.forEach(c => { allItems.push({ ...c, _tag: tagNum++, _zone: 'tall' }); });
  sortedBases.forEach(c => { allItems.push({ ...c, _tag: tagNum++, _zone: 'base' }); });
  sortedUppers.forEach(c => { allItems.push({ ...c, _tag: tagNum++, _zone: 'upper' }); });

  const totalH = cH + top + botDim + 20;

  return (
    <svg viewBox={`-55 -20 ${wW + rightDim + 65} ${totalH + 40}`} data-pdf="elevation"
      style={{ width: '100%', height: 'auto', maxHeight: 580, background: C.bg, borderRadius: 4, marginBottom: 16 }}
      xmlns="http://www.w3.org/2000/svg">

      {/* ── TITLE BLOCK (NKBA Ch.2 Fig 2.2 style) ── */}
      <g>
        {/* Title line */}
        <line x1={-40} y1={totalH + 22} x2={80} y2={totalH + 22}
          stroke={C.line} strokeWidth={0.6} />
        <text x={-40} y={totalH + 18} fill={C.dimText} fontSize={5.5} fontWeight="700"
          fontFamily="Helvetica,Arial,sans-serif">
          ELEV. - KITCHEN WALL {wallId}
        </text>
        <text x={-40} y={totalH + 28} fill={C.dimText} fontSize={3.8}
          fontFamily="Helvetica,Arial,sans-serif" opacity={0.7}>
          Scale: 1/2" = 1'-0" (approx)
        </text>
      </g>

      {/* Wall ID Header */}
      <text x={wW / 2} y={-6} fill={C.dimText} fontSize={9} fontWeight="700"
        fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle">
        Wall {wallId} Elevation
      </text>

      {/* ── CEILING LINE (dashed) ── */}
      <line x1={0} y1={ceilY} x2={wW} y2={ceilY}
        stroke={C.dimLine} strokeWidth={0.45} strokeDasharray="4,2" />

      {/* ── BACKSPLASH FILL ── */}
      <rect x={0} y={upBotY} width={wW} height={ctrY - upBotY}
        fill={C.backsplash} stroke="none" opacity={0.25} />

      {/* ── FLOOR LINE ── */}
      <line x1={-25} y1={floorY} x2={wW + 25} y2={floorY}
        stroke={C.floor} strokeWidth={1.5} />

      {/* ── TOEKICK BAND ── */}
      <rect x={0} y={tkY} width={wW} height={TOEKICK * S}
        fill={C.toekick} stroke={C.floor} strokeWidth={0.3} />

      {/* ── COUNTERTOP (spans base cabs only, not fridge/talls) ── */}
      {validBases.length > 0 && (() => {
        const minX = Math.min(...validBases.map(b => b.position * S));
        const maxX = Math.max(...validBases.map(b => (b.position + b.width) * S));
        return (
          <g>
            <rect x={minX} y={ctrY} width={maxX - minX} height={CTR_H * S}
              fill={C.ctrFill} stroke={C.line} strokeWidth={0.45} />
            <line x1={minX} y1={ctrY + CTR_H * S} x2={maxX} y2={ctrY + CTR_H * S}
              stroke={C.line} strokeWidth={0.5} />
          </g>
        );
      })()}

      {/* ── BASE CABINETS ── */}
      {sortedBases.map((cab, i) => {
        const x = cab.position * S;
        const w = cab.width * S;
        const isApp = cab.type === 'appliance' || !!cab.applianceType;
        const sku = cab.sku || '';
        const drMatch = sku.match(/B(\d?)D/);
        const drawers = drMatch ? parseInt(drMatch[1] || '1') : 0;
        const doors = cab.width > 24 ? 2 : 1;

        // Use _elev data for vertical positioning when available
        const elev = cab._elev || {};
        let h, y;
        if (elev.yMount === 0 && elev.height) {
          // Items starting from floor (range/cooktop sits on floor)
          h = elev.height * S;
          y = floorY - h;
        } else {
          // Standard base cabs sit on toekick
          h = baseBoxH;
          y = floorY - TOEKICK * S - h;
        }

        return (
          <g key={`b${i}`}>
            {isApp ? (
              <ApplianceSym x={x} y={y} w={w} h={h} aType={cab.applianceType || 'unknown'} />
            ) : (
              <CabFront x={x} y={y} w={w} h={h} doors={doors} drawers={drawers} />
            )}
            {/* Appliance label above cabinet */}
            {isApp && (
              <text x={x + w / 2} y={y - 4} fill={C.dimText}
                fontSize={4} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="600" fontStyle="italic">
                {appLabel(cab.applianceType)}
              </text>
            )}
            {/* SKU label on cabinet face */}
            {!isApp && sku && w >= 10 * S && (
              <text x={x + w / 2} y={y + h - 3} fill="#5c6370"
                fontSize={Math.min(3.2, (w / S) * 0.13)} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="400" opacity={0.75}>
                {sku}
              </text>
            )}
          </g>
        );
      })}

      {/* ── UPPER CABINETS ── */}
      {sortedUppers.map((cab, i) => {
        const x = cab.position * S;
        const w = cab.width * S;
        const uH = (cab.height || UPPER_H) * S;
        const y = upBotY - uH;
        const doors = cab.width > 24 ? 2 : 1;
        return (
          <g key={`u${i}`}>
            <CabFront x={x} y={y} w={w} h={uH} doors={doors} drawers={0} />
            {/* SKU label on upper cabinet */}
            {cab.sku && w >= 10 * S && (
              <text x={x + w / 2} y={y + uH - 3} fill="#5c6370"
                fontSize={Math.min(3.2, (w / S) * 0.13)} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="400" opacity={0.75}>
                {cab.sku}
              </text>
            )}
          </g>
        );
      })}

      {/* ── TALL CABINETS & TALL APPLIANCES (fridge, wine column) ── */}
      {sortedTalls.map((cab, i) => {
        const x = (cab.position || 0) * S;
        const w = (cab.width || 18) * S;
        const tH = (cab._elev?.height || cab.height || TALL_H) * S;
        const y = floorY - tH;
        const isApp = cab.type === 'appliance' || !!cab.applianceType;
        const doors = cab.width > 24 ? 2 : 1;
        return (
          <g key={`t${i}`}>
            {isApp ? (
              <ApplianceSym x={x} y={y} w={w} h={tH} aType={cab.applianceType || 'unknown'} />
            ) : (
              <CabFront x={x} y={y} w={w} h={tH} doors={doors} drawers={0} />
            )}
            {isApp && (
              <text x={x + w / 2} y={y - 4} fill={C.dimText}
                fontSize={4} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="600" fontStyle="italic">
                {appLabel(cab.applianceType)}
              </text>
            )}
            {/* SKU label on tall cabinet */}
            {!isApp && cab.sku && w >= 6 * S && (
              <text x={x + w / 2} y={y + tH / 2} fill="#5c6370"
                fontSize={Math.min(3, (w / S) * 0.12)} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="400" opacity={0.7}>
                {cab.sku}
              </text>
            )}
          </g>
        );
      })}

      {/* ── RANGE HOOD ── */}
      {hood && typeof hood.position === 'number' && (() => {
        const x = hood.position * S;
        const w = (hood.width || 36) * S;
        const hH = (hood.height || 24) * S;
        const y = upBotY - hH;
        const taper = Math.min(4 * S, w * 0.08);
        return (
          <g>
            <polygon
              points={`${x},${y + hH} ${x + taper},${y} ${x + w - taper},${y} ${x + w},${y + hH}`}
              fill={C.hoodFill} stroke={C.line} strokeWidth={0.5} />
            <text x={x + w / 2} y={y + hH / 2 + 1.5} fill={C.dimText}
              fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="600">VENT HOOD</text>
          </g>
        );
      })()}

      {/* ── TRIM: CROWN MOLDING (path-based — skips hoods/appliances) ── */}
      {trim.crown && validUppers.length > 0 && (() => {
        // Build path segments that skip hood/microwave zones
        const allUpperCabs = [...validUppers];
        if (hood) allUpperCabs.push({ ...hood, _isHood: true, role: 'range_hood' });
        const sorted = allUpperCabs
          .filter(c => typeof c.position === 'number' && c.width > 0)
          .sort((a, b) => a.position - b.position);

        // Segment builder: continuous runs that skip hoods
        const segments = [];
        let segStart = null, segEnd = null;
        for (const cab of sorted) {
          const isSkip = cab._isHood || cab.role === 'range_hood' || cab.role === 'rangeHood'
            || cab.type === 'rangeHood' || (cab.applianceType || '') === 'microwave';
          if (isSkip) {
            if (segStart !== null) { segments.push({ s: segStart, e: segEnd }); segStart = null; }
            continue;
          }
          const cs = cab.position;
          const ce = cab.position + (cab.width || 0);
          if (segStart === null) { segStart = cs; segEnd = ce; }
          else if (cs <= segEnd + 0.5) { segEnd = Math.max(segEnd, ce); }
          else { segments.push({ s: segStart, e: segEnd }); segStart = cs; segEnd = ce; }
        }
        if (segStart !== null) segments.push({ s: segStart, e: segEnd });

        const crH = 3 * S;
        // Crown offset: sits ON TOP of cabinet exterior face, not inside box
        // Z = CabinetTop, Y = CabinetDepth (front face)
        return segments.map((seg, i) => (
          <rect key={`cr${i}`} x={seg.s * S} y={upTopY - crH}
            width={(seg.e - seg.s) * S} height={crH}
            fill={C.ctrFill} stroke={C.line} strokeWidth={0.4} />
        ));
      })()}

      {/* ── TRIM: LIGHT RAIL (path-based — skips hoods/appliances) ── */}
      {trim.lightRail && validUppers.length > 0 && (() => {
        // Same segment logic — light rail runs under wall cabs only
        const allUpperCabs = [...validUppers];
        if (hood) allUpperCabs.push({ ...hood, _isHood: true, role: 'range_hood' });
        const sorted = allUpperCabs
          .filter(c => typeof c.position === 'number' && c.width > 0)
          .sort((a, b) => a.position - b.position);

        const segments = [];
        let segStart = null, segEnd = null;
        for (const cab of sorted) {
          const isSkip = cab._isHood || cab.role === 'range_hood' || cab.role === 'rangeHood'
            || cab.type === 'rangeHood' || (cab.applianceType || '') === 'microwave';
          if (isSkip) {
            if (segStart !== null) { segments.push({ s: segStart, e: segEnd }); segStart = null; }
            continue;
          }
          const cs = cab.position;
          const ce = cab.position + (cab.width || 0);
          if (segStart === null) { segStart = cs; segEnd = ce; }
          else if (cs <= segEnd + 0.5) { segEnd = Math.max(segEnd, ce); }
          else { segments.push({ s: segStart, e: segEnd }); segStart = cs; segEnd = ce; }
        }
        if (segStart !== null) segments.push({ s: segStart, e: segEnd });

        // Light rail offset: hangs BELOW cabinet bottom on exterior face
        // Z = CabinetBottom, pushed to front face (not inside box)
        const lrH = 1.2 * S;
        return segments.map((seg, i) => (
          <rect key={`lr${i}`} x={seg.s * S} y={upBotY}
            width={(seg.e - seg.s) * S} height={lrH}
            fill="#b0a89e" stroke={C.line} strokeWidth={0.3} />
        ));
      })()}

      {/* ══════════ NUMBERED DIAMOND TAGS ══════════ */}
      {allItems.map((item, i) => {
        const x = (item.position || 0) * S + (item.width || 0) * S / 2;
        let y;
        if (item._zone === 'tall') y = floorY - (item.height || TALL_H) * S - 10;
        else if (item._zone === 'upper') y = upBotY - (item.height || UPPER_H) * S - 10;
        else y = floorY + 42; // below floor for bases
        return <CabTag key={`tag${i}`} cx={x} cy={y} num={item._tag} />;
      })}

      {/* ══════════ BOTTOM DIMENSION STRINGS ══════════ */}
      <g>
        {/* Combine all wall items (bases + talls) for dimension strings */}
        {(() => {
          const allCabs = [...sortedBases, ...sortedTalls]
            .filter(c => typeof c.position === 'number' && c.width > 0)
            .sort((a, b) => a.position - b.position);
          if (allCabs.length === 0) return null;

          const els = [];
          // Extension lines from every cabinet edge
          allCabs.forEach((cab, i) => {
            const lx = cab.position * S;
            const rx = (cab.position + cab.width) * S;
            els.push(
              <line key={`extL${i}`} x1={lx} y1={floorY + 1} x2={lx} y2={floorY + 18}
                stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
            );
            els.push(
              <line key={`extR${i}`} x1={rx} y1={floorY + 1} x2={rx} y2={floorY + 18}
                stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
            );
          });

          // Continuous dimension line
          const first = allCabs[0].position * S;
          const lastCab = allCabs[allCabs.length - 1];
          const end = (lastCab.position + lastCab.width) * S;
          const dimY = floorY + 16;
          els.push(<line key="dl" x1={first} y1={dimY} x2={end} y2={dimY}
            stroke={C.dimLine} strokeWidth={0.4} />);

          // Tick + width label per cabinet
          allCabs.forEach((cab, i) => {
            const lx = cab.position * S;
            const rx = (cab.position + cab.width) * S;
            els.push(<line key={`t${i}l`} x1={lx} y1={dimY - 2.5} x2={lx} y2={dimY + 2.5}
              stroke={C.dimLine} strokeWidth={0.4} />);
            if (i === allCabs.length - 1) {
              els.push(<line key={`t${i}r`} x1={rx} y1={dimY - 2.5} x2={rx} y2={dimY + 2.5}
                stroke={C.dimLine} strokeWidth={0.4} />);
            }
            els.push(
              <text key={`w${i}`} x={(lx + rx) / 2} y={dimY - 3.5} fill={C.dimText}
                fontSize={4.2} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="500">{cab.width}"</text>
            );
          });
          return els;
        })()}

        {/* Overall wall length dimension (second line below) */}
        <line x1={0} y1={floorY + 30} x2={wW} y2={floorY + 30}
          stroke={C.dimLine} strokeWidth={0.5} />
        <line x1={0} y1={floorY + 28} x2={0} y2={floorY + 32}
          stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={wW} y1={floorY + 28} x2={wW} y2={floorY + 32}
          stroke={C.dimLine} strokeWidth={0.4} />
        {/* Extension lines to wall edges */}
        <line x1={0} y1={floorY + 1} x2={0} y2={floorY + 32}
          stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
        <line x1={wW} y1={floorY + 1} x2={wW} y2={floorY + 32}
          stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
        <text x={wW / 2} y={floorY + 29} fill={C.dimText}
          fontSize={4.8} fontFamily="Helvetica,Arial,sans-serif"
          textAnchor="middle" fontWeight="700">{wallLen}"</text>
      </g>

      {/* ══════════ RIGHT-SIDE VERTICAL DIMENSIONS ══════════ */}
      <g>
        {/* Floor to toekick */}
        <line x1={wW + 12} y1={floorY} x2={wW + 12} y2={tkY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={wW + 10} y1={floorY} x2={wW + 14} y2={floorY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={wW + 10} y1={tkY} x2={wW + 14} y2={tkY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <text x={wW + 18} y={(floorY + tkY) / 2 + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif">{TOEKICK}"</text>

        {/* Counter height - 36" AFF */}
        <line x1={wW + 8} y1={ctrY} x2={wW + 30} y2={ctrY}
          stroke={C.dimLine} strokeWidth={0.3} strokeDasharray="2,1.5" />
        <text x={wW + 34} y={ctrY + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif" fontWeight="500">36" AFF</text>

        {/* Upper bottom - 54" AFF */}
        {validUppers.length > 0 && (
          <>
            <line x1={wW + 8} y1={upBotY} x2={wW + 30} y2={upBotY}
              stroke={C.dimLine} strokeWidth={0.3} strokeDasharray="2,1.5" />
            <text x={wW + 34} y={upBotY + 1.5} fill={C.dimText}
              fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif" fontWeight="500">54" AFF</text>
          </>
        )}

        {/* Backsplash gap dim */}
        {validUppers.length > 0 && (
          <>
            <line x1={wW + 22} y1={ctrY} x2={wW + 22} y2={upBotY}
              stroke={C.dimLine} strokeWidth={0.4} />
            <line x1={wW + 20} y1={ctrY} x2={wW + 24} y2={ctrY}
              stroke={C.dimLine} strokeWidth={0.4} />
            <line x1={wW + 20} y1={upBotY} x2={wW + 24} y2={upBotY}
              stroke={C.dimLine} strokeWidth={0.4} />
            <text x={wW + 28} y={(ctrY + upBotY) / 2 + 1} fill={C.dimText}
              fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif">{GAP}"</text>
          </>
        )}

        {/* Upper height */}
        {validUppers.length > 0 && (() => {
          const uH = validUppers[0].height || UPPER_H;
          return (
            <>
              <line x1={wW + 12} y1={upBotY} x2={wW + 12} y2={upTopY}
                stroke={C.dimLine} strokeWidth={0.4} />
              <line x1={wW + 10} y1={upBotY} x2={wW + 14} y2={upBotY}
                stroke={C.dimLine} strokeWidth={0.4} />
              <line x1={wW + 10} y1={upTopY} x2={wW + 14} y2={upTopY}
                stroke={C.dimLine} strokeWidth={0.4} />
              <text x={wW + 18} y={(upBotY + upTopY) / 2 + 1.5} fill={C.dimText}
                fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif">{uH}"</text>
            </>
          );
        })()}

        {/* Ceiling height */}
        <line x1={wW + 8} y1={ceilY} x2={wW + 30} y2={ceilY}
          stroke={C.dimLine} strokeWidth={0.3} strokeDasharray="2,1.5" />
        <text x={wW + 34} y={ceilY + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif" fontWeight="500">{ceilH}" CLG</text>

        {/* Full floor-to-ceiling dim (far right) */}
        <line x1={wW + 40} y1={floorY} x2={wW + 40} y2={ceilY}
          stroke={C.dimLine} strokeWidth={0.45} />
        <line x1={wW + 38} y1={floorY} x2={wW + 42} y2={floorY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={wW + 38} y1={ceilY} x2={wW + 42} y2={ceilY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <text x={wW + 46} y={(floorY + ceilY) / 2 + 1.5} fill={C.dimText}
          fontSize={4} fontFamily="Helvetica,Arial,sans-serif" fontWeight="600">{ceilH}"</text>
      </g>

      {/* ── LEFT SIDE: wall edge line ── */}
      <line x1={0} y1={ceilY} x2={0} y2={floorY}
        stroke={C.line} strokeWidth={0.6} />
      <line x1={wW} y1={ceilY} x2={wW} y2={floorY}
        stroke={C.line} strokeWidth={0.6} />

      {/* ── DEBUG OVERLAY ── */}
      {debug && (
        <g className="debug-overlay" opacity={0.7}>
          {/* Zone color bands */}
          <rect x={0} y={floorY - (TOEKICK + BASE_H) * S} width={wW} height={BASE_H * S}
            fill="rgba(66,133,244,0.08)" stroke="none" />
          <rect x={0} y={ceilY} width={wW} height={(ceilH - 54) * S}
            fill="rgba(52,168,83,0.08)" stroke="none" />
          <text x={-50} y={floorY - TOEKICK * S - BASE_H * S / 2}
            fill="#4285F4" fontSize={3.5} fontFamily="monospace" fontWeight="700">BASE</text>
          <text x={-50} y={ceilY + (ceilH - 54) * S / 2}
            fill="#34A853" fontSize={3.5} fontFamily="monospace" fontWeight="700">UPPER</text>

          {/* Position markers for each base cabinet */}
          {validBases.map((cab, i) => {
            const cx = cab.position * S;
            const cw = cab.width * S;
            const endPos = cab.position + cab.width;
            return (
              <g key={`db${i}`}>
                {/* Position tick */}
                <line x1={cx} y1={floorY + 2} x2={cx} y2={floorY + 14}
                  stroke="#E91E63" strokeWidth={0.4} />
                <text x={cx + 1} y={floorY + 10} fill="#E91E63"
                  fontSize={2.8} fontFamily="monospace">{cab.position}"</text>
                {/* End tick */}
                <line x1={cx + cw} y1={floorY + 2} x2={cx + cw} y2={floorY + 14}
                  stroke="#E91E63" strokeWidth={0.4} />
                {/* Zone label */}
                <text x={cx + cw / 2} y={floorY + 20} fill="#333"
                  fontSize={2.5} fontFamily="monospace" textAnchor="middle">
                  {cab._elev?.zone || '?'} {cab.sku || cab.applianceType || ''}
                </text>
              </g>
            );
          })}

          {/* Position markers for uppers */}
          {validUppers.map((cab, i) => {
            const cx = cab.position * S;
            const cw = cab.width * S;
            return (
              <g key={`du${i}`}>
                <line x1={cx} y1={ceilY - 2} x2={cx} y2={ceilY - 10}
                  stroke="#34A853" strokeWidth={0.4} />
                <text x={cx + 1} y={ceilY - 4} fill="#34A853"
                  fontSize={2.5} fontFamily="monospace">{cab.position}" {cab._elev?.zone}</text>
              </g>
            );
          })}

          {/* Hood zone highlight */}
          {hood && (
            <rect x={hood.position * S} y={ceilY}
              width={hood.width * S} height={(ceilH - (hood._hoodMountAFF || 60)) * S}
              fill="rgba(255,152,0,0.15)" stroke="#FF9800" strokeWidth={0.5} strokeDasharray="3,2" />
          )}

          {/* Overlap warnings */}
          {(() => {
            const warnings = [];
            const sorted = [...validBases].sort((a, b) => a.position - b.position);
            for (let i = 1; i < sorted.length; i++) {
              const prev = sorted[i - 1];
              const curr = sorted[i];
              const prevEnd = prev.position + prev.width;
              if (curr.position < prevEnd) {
                const cx = curr.position * S;
                warnings.push(
                  <g key={`ow${i}`}>
                    <rect x={cx} y={floorY - (TOEKICK + BASE_H) * S - 4}
                      width={(prevEnd - curr.position) * S} height={BASE_H * S + 8}
                      fill="rgba(244,67,54,0.2)" stroke="#F44336" strokeWidth={0.8} />
                    <text x={cx + 2} y={floorY - (TOEKICK + BASE_H) * S - 6}
                      fill="#F44336" fontSize={3} fontFamily="monospace" fontWeight="700">
                      OVERLAP {(prevEnd - curr.position).toFixed(1)}"
                    </text>
                  </g>
                );
              }
            }
            return warnings;
          })()}

          {/* Validation summary */}
          <text x={0} y={totalH + 34} fill="#666" fontSize={3.5} fontFamily="monospace">
            DEBUG: {validBases.length} bases, {validUppers.length} uppers, {validTalls.length} talls | Wall {wallId}: {wallLen}"
          </text>
        </g>
      )}
    </svg>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────

export default function ElevationView({ solverResult, trim = {}, debug = false }) {
  if (!solverResult) return null;

  // Use SOURCE arrays (walls, uppers, talls, corners) — NOT placements.
  // Source arrays have correct _elev data from assignElevToSourceObjects.
  // The flat placements array has _elev from assignSpatialData which misclassifies some types.
  const wallLayouts = solverResult.walls || [];
  const upperLayouts = solverResult.uppers || [];
  const tallCabs = solverResult.talls || [];
  const corners = solverResult.corners || [];
  const inputWalls = solverResult._inputWalls || [];

  const wallData = useMemo(() => {
    const data = {};
    inputWalls.forEach(w => {
      data[w.id] = {
        id: w.id, length: w.length,
        ceilingHeight: w.ceilingHeight || 96,
        bases: [], uppers: [], talls: [], hood: null,
      };
    });

    // 1. Base cabinets + appliances from wallLayouts (source of truth)
    wallLayouts.forEach(wl => {
      const wid = wl.wallId;
      if (!wid || !data[wid]) return;
      (wl.cabinets || []).forEach(cab => {
        if (typeof cab.position !== 'number' || isNaN(cab.position)) return;
        if (!cab.width || cab.width <= 0) return;

        const appType = (cab.applianceType || '').toLowerCase();
        const isTall = cab._elev?.zone === 'TALL' || appType === 'refrigerator' ||
          appType === 'freezer' || appType === 'winecolumn';

        if (isTall) {
          data[wid].talls.push(cab);
        } else {
          data[wid].bases.push(cab);
        }
      });
    });

    // 2. Corner cabinets → assign to wallA at their position
    corners.forEach(corner => {
      const wid = corner.wallA;
      if (!wid || !data[wid]) return;
      // Corner sits at the end of wallA
      const wl = wallLayouts.find(w => w.wallId === wid);
      const pos = wl ? wl.wallLength - corner.size : 0;
      data[wid].bases.push({
        sku: corner.sku,
        type: 'corner',
        width: corner.size,
        position: pos,
        _elev: corner._elev || { zone: 'BASE', yMount: 4.5, height: 30 },
      });
    });

    // 3. Tall cabinets (oven towers, pantry towers, fridge panels)
    tallCabs.forEach(tall => {
      const wid = tall.wall;
      if (!wid || !data[wid]) return;
      if (typeof tall.position !== 'number' || isNaN(tall.position)) return;
      data[wid].talls.push(tall);
    });

    // 4. Upper cabinets + hood from upperLayouts (source of truth)
    upperLayouts.forEach(ul => {
      const wid = ul.wallId;
      if (!wid || !data[wid]) return;
      (ul.cabinets || []).forEach(cab => {
        if (typeof cab.position !== 'number' || isNaN(cab.position)) return;
        if (!cab.width || cab.width <= 0) return;
        if (cab.type === 'rangeHood' || cab.role === 'range_hood' ||
            (cab.applianceType || '').toLowerCase() === 'hood') {
          data[wid].hood = cab;
        } else {
          data[wid].uppers.push(cab);
        }
      });
    });

    return Object.values(data);
  }, [wallLayouts, upperLayouts, tallCabs, corners, inputWalls]);

  // Assign sequential tag numbers across all walls
  let globalTag = 1;

  return (
    <div>
      {wallData.map(wd => {
        const start = globalTag;
        // Count items for this wall
        const tallCount = wd.talls.filter(t => typeof t.position === 'number' && t.width > 0).length;
        const baseCount = wd.bases.filter(b => typeof b.position === 'number' && b.width > 0).length;
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
            trim={trim}
            tagStart={start}
            debug={debug}
          />
        );
      })}
    </div>
  );
}
