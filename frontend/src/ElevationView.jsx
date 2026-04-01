import React, { useMemo } from 'react';

/**
 * ElevationView — Professional Architectural Kitchen Elevation (NKBA Ch.12)
 * =========================================================================
 * Produces Cyncly 2020 / Flex–grade wall elevation drawings:
 *   - Shaker 5-piece door panels with inner raised panel + hardware dots
 *   - Diagonal/blind corner cabinet faces
 *   - Crown molding profile (not flat rect), light rail, LIGHT CONCEAL labels
 *   - 3/4" SCRIBE annotations at wall terminals
 *   - Filler strips visually distinct (hatched)
 *   - REP (Refrigerator End Panel) with label
 *   - NKBA KD-prefix circle tags
 *   - Dimension strings top + bottom, vertical dims right side
 *   - Hood with FIXED PANEL / VENT HOOD labels
 *   - Appliance labels (RANGE, DW, OVEN, REF, SINK)
 *
 * Data contract (from solver):
 *   solverResult.walls    → [{wallId, cabinets:[{position, width, sku, type, role, applianceType, _elev}]}]
 *   solverResult.uppers   → [{wallId, cabinets:[{position, width, height, sku, type, role}]}]
 *   solverResult.talls    → [{wall, position, width, height, sku, type, applianceType}]
 *   solverResult.corners  → [{wallA, wallB, sku, size, type, wallAConsumption, wallBConsumption}]
 *   solverResult._inputWalls → [{id, length, ceilingHeight}]
 */

// ─── SCALE & DIMENSIONS ──────────────────────────────────────────────
const S = 2.2;                      // SVG px per inch
const TOEKICK     = 4.5;            // toekick height
const BASE_BOX    = 30;             // base cabinet box (34.5 - 4.5)
const CTR_THICK   = 1.5;            // countertop slab
const SPLASH_GAP  = 18;             // backsplash gap (counter-top to upper-bottom)
const UPPER_H_DEF = 36;             // default upper cabinet height
const TALL_H_DEF  = 96;             // default tall cabinet height
const CROWN_H     = 3.5;            // crown molding profile height
const LR_H        = 1.75;           // light rail height (1 3/4")
const SCRIBE_W    = 0.75;           // 3/4" scribe strip width
const FILLER_MIN  = 3;              // minimum filler width to show hatching

// Counter AFF: TOEKICK + BASE_BOX + CTR_THICK = 4.5 + 30 + 1.5 = 36"
// Upper bottom AFF: 36 + 18 = 54"

// ─── COLORS ──────────────────────────────────────────────────────────
const C = {
  bg:           '#ffffff',
  line:         '#1a1a1a',           // heavy cabinet outline
  thinLine:     '#444444',           // door/drawer panel lines
  dimLine:      '#333333',           // dimension lines
  dimText:      '#222222',           // dimension text
  fill:         '#fafafa',           // cabinet face fill
  ctrFill:      '#d8d4cf',           // countertop
  toekick:      '#111111',           // toekick (very dark)
  backsplash:   '#f0eeeb',           // subtle backsplash band
  applFill:     '#f2f2f2',           // appliance background
  hoodFill:     '#e6e3df',           // hood body
  tagFill:      '#ffffff',           // circle tag fill
  tagStroke:    '#222222',           // circle tag outline
  floor:        '#000000',           // floor line
  crownFill:    '#e8e5e0',           // crown molding fill
  lrFill:       '#b5afa6',           // light rail fill
  fillerFill:   '#f5f3f0',           // filler strip
  fillerHatch:  '#cccccc',           // filler hatch lines
  scribeColor:  '#888888',           // scribe annotation
  repFill:      '#f0ede8',           // REP panel fill
  annotColor:   '#555555',           // annotation text (LIGHT CONCEAL, etc.)
  hwColor:      '#888888',           // hardware (knob/pull) dots
};

// ─── HELPERS ─────────────────────────────────────────────────────────

/** Format inches as fractional string */
function fmt(inches) {
  if (inches == null) return '';
  const whole = Math.floor(inches);
  const frac = inches - whole;
  if (frac < 0.03) return `${whole}"`;
  const fracs = [
    [0.125, '⅛'], [0.25, '¼'], [0.375, '⅜'], [0.5, '½'],
    [0.625, '⅝'], [0.75, '¾'], [0.875, '⅞'],
  ];
  for (const [v, sym] of fracs) {
    if (Math.abs(frac - v) < 0.03) return whole > 0 ? `${whole}${sym}"` : `${sym}"`;
  }
  return `${Math.round(inches * 100) / 100}"`;
}

/** Detect if a cabinet is a filler or scribe */
function isFiller(cab) {
  const sku = (cab.sku || '').toUpperCase();
  const role = (cab.role || '').toLowerCase();
  return role === 'filler' || role === 'corner-filler' || role === 'scribe'
    || sku.startsWith('BF') || sku.startsWith('QUIKFILL')
    || sku.startsWith('QUIKTRAY') || sku.includes('FILL');
}

/** Detect if cabinet is a REP (Refrigerator End Panel) */
function isREP(cab) {
  const sku = (cab.sku || '').toUpperCase();
  return sku.startsWith('REP') || (cab.role || '') === 'rep';
}

/** Detect if cabinet is an appliance */
function isAppliance(cab) {
  return cab.type === 'appliance' || !!cab.applianceType;
}

/** Appliance label text */
function appLabel(aType) {
  const map = {
    range: 'RANGE', cooktop: 'COOKTOP', refrigerator: 'REF',
    dishwasher: 'DW', wallOven: 'OVEN', speedOven: 'SPEED OVEN',
    steamOven: 'STEAM OVEN', sink: 'SINK', microwave: 'MW',
    warmingDrawer: 'WARM DR', wineCooler: 'WINE', wineColumn: 'WINE COL',
    beverageCenter: 'BEV CTR', iceMaker: 'ICE', freezer: 'FREEZER',
  };
  return map[aType] || (aType || '').toUpperCase().substring(0, 8);
}

/** Parse door/drawer count from SKU pattern */
function parseDoorDrawer(sku, width) {
  if (!sku) return { doors: width > 24 ? 2 : 1, drawers: 0 };
  const upper = sku.toUpperCase();
  // Drawer-only bases: BxDB (x drawers)
  const dbMatch = upper.match(/B(\d?)DB/);
  if (dbMatch) return { doors: 0, drawers: parseInt(dbMatch[1] || '3') };
  // Door+drawer combos: BxD (x drawers + door below)
  const dMatch = upper.match(/B(\d?)D(?!B)/);
  if (dMatch) return { doors: width > 24 ? 2 : 1, drawers: parseInt(dMatch[1] || '1') };
  // Sink base or blind: no drawers
  if (upper.includes('BSB') || upper.includes('BBC')) return { doors: 2, drawers: 0 };
  // Tray base
  if (upper.includes('BTR')) return { doors: width > 24 ? 2 : 1, drawers: 1 };
  // Default: 1 drawer + doors
  return { doors: width > 24 ? 2 : 1, drawers: 1 };
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: CabTag — NKBA KD-prefix numbered circle tag
// ═══════════════════════════════════════════════════════════════════════

function CabTag({ cx, cy, num, prefix = 'KD' }) {
  const r = 8;
  const label = `${prefix}${num}`;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r}
        fill={C.tagFill} stroke={C.tagStroke} strokeWidth={0.7} />
      {/* Horizontal leader line stub */}
      <line x1={cx - r} y1={cy} x2={cx - r - 4} y2={cy}
        stroke={C.tagStroke} strokeWidth={0.4} />
      <text x={cx} y={cy + 1.8} fill={C.dimText}
        fontSize={label.length > 4 ? 3.2 : label.length > 3 ? 3.6 : 4.2}
        fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="700">{label}</text>
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: CabFront — Shaker 5-piece door with raised inner panel
// ═══════════════════════════════════════════════════════════════════════

function CabFront({ x, y, w, h, doors, drawers, isCorner, cornerSide }) {
  const els = [];
  const pad = 1.8 * S;   // stile/rail width (visual inset from cabinet edge to door panel)

  // Outer cabinet box
  els.push(
    <rect key="box" x={x} y={y} width={w} height={h}
      fill={C.fill} stroke={C.line} strokeWidth={0.7} />
  );

  // For corner cabinets in elevation, draw diagonal line indicating corner angle
  if (isCorner) {
    if (cornerSide === 'left') {
      // Diagonal from top-left to some offset point — indicates blind left
      els.push(
        <line key="diag" x1={x} y1={y} x2={x + Math.min(w * 0.35, 8 * S)} y2={y + h}
          stroke={C.thinLine} strokeWidth={0.5} strokeDasharray="3,2" />
      );
    } else if (cornerSide === 'right') {
      els.push(
        <line key="diag" x1={x + w} y1={y} x2={x + w - Math.min(w * 0.35, 8 * S)} y2={y + h}
          stroke={C.thinLine} strokeWidth={0.5} strokeDasharray="3,2" />
      );
    }
  }

  // ── DRAWERS (from top of box) ──
  const maxDrawerZone = h * 0.35;
  const drH = drawers > 0 ? Math.min(maxDrawerZone / drawers, 7 * S) : 0;

  for (let i = 0; i < drawers; i++) {
    const dy = y + pad + i * drH;
    const dw = w - 2 * pad;
    // Drawer panel outline
    els.push(
      <rect key={`dr${i}`} x={x + pad} y={dy} width={dw} height={drH - 0.8}
        fill="none" stroke={C.thinLine} strokeWidth={0.4} rx={0.3} />
    );
    // Inner raised panel (smaller inset)
    const ip = 1.5 * S;
    if (dw > 2 * ip + 2 && drH - 0.8 > 2 * ip) {
      els.push(
        <rect key={`dri${i}`} x={x + pad + ip} y={dy + ip * 0.6}
          width={dw - 2 * ip} height={drH - 0.8 - ip * 1.2}
          fill="none" stroke={C.thinLine} strokeWidth={0.2} opacity={0.45} rx={0.2} />
      );
    }
    // Pull (horizontal bar)
    const pullW = Math.min(dw * 0.25, 5 * S);
    els.push(
      <line key={`drp${i}`}
        x1={x + w / 2 - pullW / 2} y1={dy + drH / 2}
        x2={x + w / 2 + pullW / 2} y2={dy + drH / 2}
        stroke={C.hwColor} strokeWidth={0.5} strokeLinecap="round" />
    );
  }

  // ── DOORS (below drawers) ──
  const doorY = y + pad + drawers * drH + (drawers > 0 ? 1.2 : 0);
  const doorH = h - pad * 2 - drawers * drH - (drawers > 0 ? 1.2 : 0);

  if (doorH > 3 * S) {
    const dc = Math.max(doors, 1);
    const gapBetween = dc > 1 ? 0.8 : 0;
    const dw = (w - 2 * pad - gapBetween * (dc - 1)) / dc;

    for (let i = 0; i < dc; i++) {
      const dx = x + pad + i * (dw + gapBetween);

      // Door panel outer (stile & rail frame)
      els.push(
        <rect key={`d${i}`} x={dx} y={doorY} width={dw} height={doorH}
          fill="none" stroke={C.thinLine} strokeWidth={0.4} rx={0.3} />
      );

      // Inner raised panel (5-piece shaker center panel)
      const ip = 2 * S;
      if (dw > 2 * ip + 2 && doorH > 2 * ip + 2) {
        els.push(
          <rect key={`di${i}`} x={dx + ip} y={doorY + ip}
            width={dw - 2 * ip} height={doorH - 2 * ip}
            fill="none" stroke={C.thinLine} strokeWidth={0.25} opacity={0.4} rx={0.2} />
        );
      }

      // Knob (small circle) — positioned at upper corner of door, hinge-side opposite
      const knobX = i === 0 ? dx + dw - 2.5 * S : dx + 2.5 * S;
      const knobY = doorY + 3 * S;
      els.push(
        <circle key={`k${i}`} cx={knobX} cy={knobY} r={0.8}
          fill={C.hwColor} stroke="none" />
      );
    }
  }

  return <>{els}</>;
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: FillerStrip — Hatched filler visualization
// ═══════════════════════════════════════════════════════════════════════

function FillerStrip({ x, y, w, h, label }) {
  const id = `fh_${Math.round(x)}_${Math.round(y)}`;
  return (
    <g>
      <defs>
        <pattern id={id} width={3} height={3} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={3} stroke={C.fillerHatch} strokeWidth={0.3} />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h}
        fill={C.fillerFill} stroke={C.line} strokeWidth={0.5} />
      <rect x={x} y={y} width={w} height={h}
        fill={`url(#${id})`} stroke="none" />
      {label && w > 3 * S && (
        <text x={x + w / 2} y={y + h / 2 + 1.5} fill={C.annotColor}
          fontSize={3} fontFamily="Helvetica,Arial,sans-serif"
          textAnchor="middle" fontWeight="500" writingMode="tb"
          transform={`rotate(-90, ${x + w / 2}, ${y + h / 2})`}>
          {label}
        </text>
      )}
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: REPPanel — Refrigerator End Panel visualization
// ═══════════════════════════════════════════════════════════════════════

function REPPanel({ x, y, w, h }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill={C.repFill} stroke={C.line} strokeWidth={0.6} />
      {/* Vertical grain lines */}
      {Array.from({ length: Math.floor(w / (1.5 * S)) }, (_, i) => {
        const lx = x + (i + 1) * 1.5 * S;
        return lx < x + w - 1 ? (
          <line key={`g${i}`} x1={lx} y1={y + 2} x2={lx} y2={y + h - 2}
            stroke={C.fillerHatch} strokeWidth={0.15} opacity={0.35} />
        ) : null;
      })}
      <text x={x + w / 2} y={y + h / 2 + 1.5} fill={C.annotColor}
        fontSize={3.2} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor="middle" fontWeight="600"
        transform={h > 40 * S ? `rotate(-90, ${x + w / 2}, ${y + h / 2})` : undefined}>
        REP
      </text>
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: ApplianceSym — Appliance symbol in elevation
// ═══════════════════════════════════════════════════════════════════════

function ApplianceSym({ x, y, w, h, aType }) {
  const els = [];
  els.push(
    <rect key="bg" x={x} y={y} width={w} height={h}
      fill={C.applFill} stroke={C.line} strokeWidth={0.6} />
  );

  const m = 3 * S;

  if (aType === 'range' || aType === 'cooktop') {
    // 4 burner circles (2×2 grid)
    const bw = (w - 2 * m) / 2;
    const bh = (h - 2 * m) / 2;
    const r = Math.min(bw, bh) * 0.35;
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 2; col++)
        els.push(
          <circle key={`b${row}${col}`}
            cx={x + m + col * bw + bw / 2} cy={y + m + row * bh + bh / 2} r={r}
            fill="none" stroke={C.line} strokeWidth={0.4} />
        );
    // Handle bar at top
    els.push(
      <line key="hdl" x1={x + m} y1={y + 2 * S} x2={x + w - m} y2={y + 2 * S}
        stroke={C.line} strokeWidth={0.5} />
    );
  } else if (aType === 'refrigerator' || aType === 'freezer') {
    // French door split
    els.push(
      <line key="vsplit" x1={x + w / 2} y1={y + 2 * S}
        x2={x + w / 2} y2={y + h * 0.58}
        stroke={C.line} strokeWidth={0.35} />
    );
    // Horizontal divider (upper/lower)
    els.push(
      <line key="hsplit" x1={x + 2 * S} y1={y + h * 0.6}
        x2={x + w - 2 * S} y2={y + h * 0.6}
        stroke={C.line} strokeWidth={0.4} />
    );
    // Left handle
    els.push(
      <line key="hdlL" x1={x + w / 2 - 2 * S} y1={y + 6 * S}
        x2={x + w / 2 - 2 * S} y2={y + h * 0.55}
        stroke={C.line} strokeWidth={0.45} />
    );
    // Right handle
    els.push(
      <line key="hdlR" x1={x + w / 2 + 2 * S} y1={y + 6 * S}
        x2={x + w / 2 + 2 * S} y2={y + h * 0.55}
        stroke={C.line} strokeWidth={0.45} />
    );
    // Bottom drawer handle
    els.push(
      <line key="hdlB" x1={x + w * 0.3} y1={y + h * 0.72}
        x2={x + w * 0.7} y2={y + h * 0.72}
        stroke={C.line} strokeWidth={0.45} />
    );
  } else if (aType === 'dishwasher') {
    // Top control panel line
    els.push(
      <line key="ctrl" x1={x + 2 * S} y1={y + 3 * S}
        x2={x + w - 2 * S} y2={y + 3 * S}
        stroke={C.line} strokeWidth={0.35} />
    );
    // Door panel (recessed)
    els.push(
      <rect key="door" x={x + 2.5 * S} y={y + 4.5 * S}
        width={w - 5 * S} height={h - 6.5 * S}
        fill="none" stroke={C.thinLine} strokeWidth={0.35} rx={0.3} />
    );
    // Handle bar
    els.push(
      <line key="hdl" x1={x + w * 0.28} y1={y + h - 2.5 * S}
        x2={x + w * 0.72} y2={y + h - 2.5 * S}
        stroke={C.line} strokeWidth={0.5} strokeLinecap="round" />
    );
  } else if (aType === 'wallOven' || aType === 'speedOven' || aType === 'steamOven') {
    const d = 2 * S;
    // Oven door outline
    els.push(
      <rect key="door" x={x + d} y={y + d} width={w - 2 * d} height={h - 2 * d}
        fill="none" stroke={C.line} strokeWidth={0.4} />
    );
    // Glass window
    const wi = 4 * S;
    els.push(
      <rect key="win" x={x + wi} y={y + wi}
        width={w - 2 * wi} height={(h - 2 * wi) * 0.5}
        fill="#e8e8e8" stroke={C.line} strokeWidth={0.3} rx={0.5} />
    );
    // Handle
    els.push(
      <line key="hdl" x1={x + wi} y1={y + h - d - 2 * S}
        x2={x + w - wi} y2={y + h - d - 2 * S}
        stroke={C.line} strokeWidth={0.5} strokeLinecap="round" />
    );
  } else if (aType === 'sink') {
    // Double basin sink
    const bw = (w - 4 * S) / 2;
    const bh = h * 0.45;
    const by = y + h * 0.35;
    // Left basin
    els.push(
      <rect key="bl" x={x + 1.5 * S} y={by} width={bw} height={bh}
        fill="none" stroke={C.line} strokeWidth={0.35} rx={1.5} />
    );
    // Right basin
    els.push(
      <rect key="br" x={x + 2.5 * S + bw} y={by} width={bw} height={bh}
        fill="none" stroke={C.line} strokeWidth={0.35} rx={1.5} />
    );
    // Faucet
    els.push(
      <line key="faucet" x1={x + w / 2} y1={by - 1 * S}
        x2={x + w / 2} y2={y + 2 * S}
        stroke={C.line} strokeWidth={0.5} />
    );
    els.push(
      <circle key="knob" cx={x + w / 2} cy={y + 1.5 * S} r={1}
        fill="none" stroke={C.line} strokeWidth={0.35} />
    );
  } else if (aType === 'warmingDrawer') {
    els.push(
      <rect key="face" x={x + 2 * S} y={y + 2 * S}
        width={w - 4 * S} height={h - 4 * S}
        fill="none" stroke={C.thinLine} strokeWidth={0.35} rx={0.3} />
    );
    els.push(
      <line key="hdl" x1={x + w * 0.3} y1={y + h / 2}
        x2={x + w * 0.7} y2={y + h / 2}
        stroke={C.line} strokeWidth={0.5} strokeLinecap="round" />
    );
  }

  return <>{els}</>;
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: ScribeAnnotation — 3/4" SCRIBE label at wall terminals
// ═══════════════════════════════════════════════════════════════════════

function ScribeAnnotation({ x, y1, y2, side = 'left' }) {
  const sw = SCRIBE_W * S;
  const xPos = side === 'left' ? x : x - sw;
  const midY = (y1 + y2) / 2;
  return (
    <g>
      {/* Scribe strip */}
      <rect x={xPos} y={y1} width={sw} height={y2 - y1}
        fill={C.fillerFill} stroke={C.scribeColor} strokeWidth={0.3}
        strokeDasharray="1.5,1" />
      {/* Annotation line + text */}
      <line x1={side === 'left' ? xPos - 2 : xPos + sw + 2} y1={midY}
        x2={side === 'left' ? xPos - 14 : xPos + sw + 14} y2={midY}
        stroke={C.scribeColor} strokeWidth={0.3} />
      <text x={side === 'left' ? xPos - 15 : xPos + sw + 15} y={midY + 1.2}
        fill={C.scribeColor}
        fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif"
        textAnchor={side === 'left' ? 'end' : 'start'} fontWeight="500">
        ¾" SCRIBE
      </text>
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: CrownProfile — Crown molding cross-section profile
// ═══════════════════════════════════════════════════════════════════════

function CrownSegment({ x1, x2, y }) {
  const h = CROWN_H * S;
  // Profile: bottom-left, cove curve up, ogee top, straight to right, mirror
  const w = x2 - x1;
  return (
    <g>
      {/* Main crown body */}
      <path d={`M ${x1} ${y + h}
        L ${x1} ${y + h * 0.4}
        Q ${x1} ${y} ${x1 + h * 0.5} ${y}
        L ${x2 - h * 0.5} ${y}
        Q ${x2} ${y} ${x2} ${y + h * 0.4}
        L ${x2} ${y + h}
        Z`}
        fill={C.crownFill} stroke={C.line} strokeWidth={0.4} />
      {/* Detail line (cove profile step) */}
      <line x1={x1 + 1} y1={y + h * 0.6} x2={x2 - 1} y2={y + h * 0.6}
        stroke={C.thinLine} strokeWidth={0.2} opacity={0.5} />
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// COMPONENT: LightRailSegment — Light rail under upper cabinets
// ═══════════════════════════════════════════════════════════════════════

function LightRailSegment({ x1, x2, y }) {
  const h = LR_H * S;
  return (
    <g>
      <rect x={x1} y={y} width={x2 - x1} height={h}
        fill={C.lrFill} stroke={C.line} strokeWidth={0.35} />
      {/* Small detail bead at bottom edge */}
      <line x1={x1} y1={y + h - 0.5} x2={x2} y2={y + h - 0.5}
        stroke={C.thinLine} strokeWidth={0.25} opacity={0.6} />
    </g>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// SINGLE WALL ELEVATION RENDERER
// ═══════════════════════════════════════════════════════════════════════

function WallElev({ wallId, wallLen, ceilH = 96, bases, uppers, talls, hood, trim = {}, tagStart = 1, debug = false }) {
  const wW = wallLen * S;
  const cH = ceilH * S;
  const topMargin = 45;         // space above ceiling for dims
  const botDim = 65;            // space below floor for dims
  const rightDim = 120;         // space right for vertical dims
  const leftMargin = 65;        // space left for scribe annotations
  const floorY = cH + topMargin;

  // ── Y POSITIONS (measured from floor up) ──
  const tkTopY   = floorY - TOEKICK * S;                            // top of toekick
  const baseTopY = floorY - (TOEKICK + BASE_BOX) * S;               // top of base box
  const ctrTopY  = baseTopY - CTR_THICK * S;                        // top of countertop
  const upBotY   = floorY - (TOEKICK + BASE_BOX + CTR_THICK + SPLASH_GAP) * S; // bottom of uppers = 54" AFF
  const upTopY   = upBotY - UPPER_H_DEF * S;                        // top of default uppers
  const ceilY    = topMargin;                                        // ceiling line

  // ── FILTER VALID PLACEMENTS ──
  const validBases  = bases.filter(b => typeof b.position === 'number' && b.position >= 0 && b.width > 0);
  const validUppers = uppers.filter(u => typeof u.position === 'number' && u.position >= 0 && u.width > 0 && u.type !== 'end_panel');
  const validTalls  = talls.filter(t => typeof t.position === 'number' && t.position >= 0 && t.width > 0);

  // Sort by position
  const sortedBases  = [...validBases].sort((a, b) => a.position - b.position);
  const sortedUppers = [...validUppers].sort((a, b) => a.position - b.position);
  const sortedTalls  = [...validTalls].sort((a, b) => a.position - b.position);

  // ── TAG NUMBERING (sequential: talls → bases → uppers) ──
  let tagNum = tagStart;
  const taggedItems = [];
  sortedTalls.forEach(c => taggedItems.push({ ...c, _tag: tagNum++, _zone: 'tall' }));
  sortedBases.forEach(c => taggedItems.push({ ...c, _tag: tagNum++, _zone: 'base' }));
  sortedUppers.forEach(c => taggedItems.push({ ...c, _tag: tagNum++, _zone: 'upper' }));

  // ── BUILD UPPER SEGMENTS (for crown/light rail that skip hoods) ──
  function buildUpperSegments() {
    const allU = [...validUppers];
    if (hood) allU.push({ ...hood, _isHood: true });
    const sorted = allU
      .filter(c => typeof c.position === 'number' && c.width > 0)
      .sort((a, b) => a.position - b.position);

    const segs = [];
    let segS = null, segE = null;
    for (const cab of sorted) {
      const skip = cab._isHood || cab.role === 'range_hood' || cab.type === 'rangeHood'
        || (cab.applianceType || '') === 'microwave';
      if (skip) {
        if (segS !== null) { segs.push({ s: segS, e: segE }); segS = null; }
        continue;
      }
      const cs = cab.position;
      const ce = cab.position + (cab.width || 0);
      if (segS === null) { segS = cs; segE = ce; }
      else if (cs <= segE + 0.5) { segE = Math.max(segE, ce); }
      else { segs.push({ s: segS, e: segE }); segS = cs; segE = ce; }
    }
    if (segS !== null) segs.push({ s: segS, e: segE });
    return segs;
  }

  const upperSegs = buildUpperSegments();
  const totalH = cH + topMargin + botDim + 25;
  const totalW = wW + rightDim + leftMargin + 10;

  return (
    <svg viewBox={`${-leftMargin} -25 ${totalW} ${totalH + 30}`} data-pdf="elevation"
      style={{ width: '100%', height: 'auto', maxHeight: 620, background: C.bg, borderRadius: 4, marginBottom: 20 }}
      xmlns="http://www.w3.org/2000/svg">

      {/* ══════════ TITLE BLOCK (NKBA Ch.2 Fig 2.2 style) ══════════ */}
      <g>
        <text x={wW / 2} y={-8} fill={C.dimText} fontSize={10} fontWeight="700"
          fontFamily="Helvetica,Arial,sans-serif" textAnchor="middle">
          WALL {wallId} — ELEVATION
        </text>
        <line x1={0} y1={totalH + 16} x2={Math.min(wW, 200)} y2={totalH + 16}
          stroke={C.line} strokeWidth={0.6} />
        <text x={0} y={totalH + 13} fill={C.dimText} fontSize={4.5} fontWeight="700"
          fontFamily="Helvetica,Arial,sans-serif">
          ELEV. — KITCHEN WALL {wallId}
        </text>
        <text x={0} y={totalH + 22} fill={C.dimText} fontSize={3.5}
          fontFamily="Helvetica,Arial,sans-serif" opacity={0.6}>
          Scale: ½" = 1'-0" (approx)  |  Eclipse C3 Frameless
        </text>
      </g>

      {/* ══════════ STRUCTURAL LINES ══════════ */}
      {/* Ceiling (dashed) */}
      <line x1={-8} y1={ceilY} x2={wW + 8} y2={ceilY}
        stroke={C.dimLine} strokeWidth={0.5} strokeDasharray="5,2.5" />
      <text x={-12} y={ceilY + 1.5} fill={C.annotColor} fontSize={3}
        fontFamily="Helvetica,Arial,sans-serif" textAnchor="end">CLG</text>

      {/* Backsplash zone fill */}
      <rect x={0} y={upBotY} width={wW} height={ctrTopY - upBotY}
        fill={C.backsplash} stroke="none" opacity={0.2} />

      {/* Floor line (heavy) */}
      <line x1={-30} y1={floorY} x2={wW + 30} y2={floorY}
        stroke={C.floor} strokeWidth={2} />

      {/* Wall edge lines */}
      <line x1={0} y1={ceilY} x2={0} y2={floorY}
        stroke={C.line} strokeWidth={0.8} />
      <line x1={wW} y1={ceilY} x2={wW} y2={floorY}
        stroke={C.line} strokeWidth={0.8} />

      {/* ══════════ TOEKICK BAND ══════════ */}
      {validBases.length > 0 && (() => {
        const minX = Math.min(...sortedBases.map(b => b.position));
        const maxX = Math.max(...sortedBases.map(b => b.position + b.width));
        return (
          <rect x={minX * S} y={tkTopY} width={(maxX - minX) * S} height={TOEKICK * S}
            fill={C.toekick} stroke={C.floor} strokeWidth={0.4} />
        );
      })()}

      {/* ══════════ COUNTERTOP ══════════ */}
      {validBases.length > 0 && (() => {
        const minX = Math.min(...sortedBases.map(b => b.position));
        const maxX = Math.max(...sortedBases.map(b => b.position + b.width));
        return (
          <g>
            <rect x={minX * S} y={ctrTopY} width={(maxX - minX) * S} height={CTR_THICK * S}
              fill={C.ctrFill} stroke={C.line} strokeWidth={0.5} />
            {/* Countertop edge detail */}
            <line x1={minX * S} y1={baseTopY} x2={(maxX) * S} y2={baseTopY}
              stroke={C.line} strokeWidth={0.6} />
          </g>
        );
      })()}

      {/* ══════════ BASE CABINETS ══════════ */}
      {sortedBases.map((cab, i) => {
        const x = cab.position * S;
        const w = cab.width * S;
        const isApp = isAppliance(cab);
        const sku = cab.sku || '';
        const isCornerCab = cab.type === 'corner';
        const isFill = isFiller(cab);
        const isRepPanel = isREP(cab);

        // Vertical position
        const elev = cab._elev || {};
        let h, y;
        if (elev.yMount === 0 && elev.height) {
          h = elev.height * S;
          y = floorY - h;
        } else {
          h = BASE_BOX * S;
          y = tkTopY - h;
        }

        const { doors, drawers } = parseDoorDrawer(sku, cab.width);

        return (
          <g key={`b${i}`}>
            {isRepPanel ? (
              <REPPanel x={x} y={y} w={w} h={h} />
            ) : isFill ? (
              <FillerStrip x={x} y={y} w={w} h={h} label={cab.width <= FILLER_MIN ? '' : sku} />
            ) : isApp ? (
              <ApplianceSym x={x} y={y} w={w} h={h} aType={cab.applianceType || 'unknown'} />
            ) : (
              <CabFront x={x} y={y} w={w} h={h} doors={doors} drawers={drawers}
                isCorner={isCornerCab} cornerSide={cab._cornerSide} />
            )}
            {/* Appliance label ABOVE cabinet */}
            {isApp && (
              <text x={x + w / 2} y={y - 5} fill={C.dimText}
                fontSize={4.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="700" fontStyle="italic">
                {appLabel(cab.applianceType)}
              </text>
            )}
          </g>
        );
      })}

      {/* ══════════ UPPER CABINETS ══════════ */}
      {sortedUppers.map((cab, i) => {
        const x = cab.position * S;
        const w = cab.width * S;
        const uH = (cab.height || UPPER_H_DEF) * S;
        const y = upBotY - uH;
        const isFill = isFiller(cab);
        const isRepPanel = isREP(cab);
        const doors = cab.width > 24 ? 2 : 1;

        return (
          <g key={`u${i}`}>
            {isRepPanel ? (
              <REPPanel x={x} y={y} w={w} h={uH} />
            ) : isFill ? (
              <FillerStrip x={x} y={y} w={w} h={uH} />
            ) : (
              <CabFront x={x} y={y} w={w} h={uH} doors={doors} drawers={0} />
            )}
          </g>
        );
      })}

      {/* ══════════ TALL CABINETS & TALL APPLIANCES ══════════ */}
      {sortedTalls.map((cab, i) => {
        const x = (cab.position || 0) * S;
        const w = (cab.width || 18) * S;
        const tH = (cab._elev?.height || cab.height || TALL_H_DEF) * S;
        const y = floorY - tH;
        const isApp = isAppliance(cab);
        const isRepPanel = isREP(cab);
        const doors = cab.width > 24 ? 2 : 1;

        return (
          <g key={`t${i}`}>
            {isRepPanel ? (
              <REPPanel x={x} y={y} w={w} h={tH} />
            ) : isApp ? (
              <ApplianceSym x={x} y={y} w={w} h={tH} aType={cab.applianceType || 'unknown'} />
            ) : (
              <CabFront x={x} y={y} w={w} h={tH} doors={doors} drawers={0} />
            )}
            {/* Appliance label */}
            {isApp && (
              <text x={x + w / 2} y={y - 5} fill={C.dimText}
                fontSize={4.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="700" fontStyle="italic">
                {appLabel(cab.applianceType)}
              </text>
            )}
            {/* Height label for talls */}
            {!isApp && (
              <text x={x + w / 2} y={y - 3} fill={C.annotColor}
                fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="500">
                {fmt(cab._elev?.height || cab.height || TALL_H_DEF)} H
              </text>
            )}
          </g>
        );
      })}

      {/* ══════════ RANGE HOOD ══════════ */}
      {hood && typeof hood.position === 'number' && (() => {
        const x = hood.position * S;
        const w = (hood.width || 36) * S;
        const hH = (hood.height || 24) * S;
        const mountAFF = hood._hoodMountAFF || 66;
        const y = floorY - mountAFF * S;
        const taper = Math.min(5 * S, w * 0.1);
        return (
          <g>
            {/* Hood body (trapezoid) */}
            <polygon
              points={`${x},${y + hH} ${x + taper},${y} ${x + w - taper},${y} ${x + w},${y + hH}`}
              fill={C.hoodFill} stroke={C.line} strokeWidth={0.6} />
            {/* Grille lines inside hood */}
            {[0.3, 0.5, 0.7].map((f, i) => (
              <line key={`gl${i}`} x1={x + taper * (1 - f) + w * f * 0.08} y1={y + hH * f}
                x2={x + w - taper * (1 - f) - w * f * 0.08} y2={y + hH * f}
                stroke={C.thinLine} strokeWidth={0.2} opacity={0.4} />
            ))}
            {/* VENT HOOD label */}
            <text x={x + w / 2} y={y + hH * 0.55} fill={C.dimText}
              fontSize={4} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="700">VENT HOOD</text>
            {/* FIXED PANEL annotation if panels extend to ceiling */}
            {mountAFF + (hood.height || 24) < ceilH - 3 && (
              <g>
                <rect x={x + 2} y={y - (ceilH - mountAFF - (hood.height || 24)) * S + 1}
                  width={w - 4} height={(ceilH - mountAFF - (hood.height || 24)) * S - 2}
                  fill={C.repFill} stroke={C.line} strokeWidth={0.4} />
                <text x={x + w / 2} y={ceilY + (y - ceilY) / 2 + 2}
                  fill={C.annotColor} fontSize={3.2}
                  fontFamily="Helvetica,Arial,sans-serif"
                  textAnchor="middle" fontWeight="600">FIXED PANEL</text>
              </g>
            )}
          </g>
        );
      })()}

      {/* ══════════ CROWN MOLDING (profiled, skips hoods) ══════════ */}
      {trim.crown && upperSegs.map((seg, i) => (
        <CrownSegment key={`cr${i}`} x1={seg.s * S} x2={seg.e * S} y={upTopY - CROWN_H * S} />
      ))}

      {/* ══════════ LIGHT RAIL (skips hoods) ══════════ */}
      {trim.lightRail && upperSegs.map((seg, i) => (
        <LightRailSegment key={`lr${i}`} x1={seg.s * S} x2={seg.e * S} y={upBotY} />
      ))}

      {/* ══════════ LIGHT CONCEAL ANNOTATION ══════════ */}
      {trim.lightRail && upperSegs.length > 0 && upperSegs.map((seg, i) => (
        <text key={`lca${i}`} x={(seg.s + seg.e) / 2 * S} y={upBotY + LR_H * S + 5}
          fill={C.annotColor} fontSize={3.2}
          fontFamily="Helvetica,Arial,sans-serif"
          textAnchor="middle" fontWeight="500" fontStyle="italic">
          LIGHT CONCEAL
        </text>
      ))}

      {/* ══════════ SCRIBE ANNOTATIONS (wall terminals) ══════════ */}
      {/* Left wall scribe */}
      {validBases.length > 0 && (() => {
        const firstBase = sortedBases[0];
        if (firstBase && firstBase.position > 0 && firstBase.position <= 3) {
          return <ScribeAnnotation x={firstBase.position * S} y1={tkTopY - BASE_BOX * S} y2={tkTopY} side="left" />;
        }
        return <ScribeAnnotation x={0} y1={ceilY} y2={floorY} side="left" />;
      })()}
      {/* Right wall scribe */}
      {validBases.length > 0 && (() => {
        const lastBase = sortedBases[sortedBases.length - 1];
        const lastEnd = (lastBase.position + lastBase.width);
        if (lastEnd < wallLen && wallLen - lastEnd <= 3) {
          return <ScribeAnnotation x={lastEnd * S} y1={tkTopY - BASE_BOX * S} y2={tkTopY} side="right" />;
        }
        return <ScribeAnnotation x={wW} y1={ceilY} y2={floorY} side="right" />;
      })()}

      {/* ══════════ NKBA KD-PREFIX CIRCLE TAGS ══════════ */}
      {taggedItems.map((item, i) => {
        const cx = (item.position || 0) * S + (item.width || 0) * S / 2;
        let cy;
        if (item._zone === 'tall') cy = floorY - (item._elev?.height || item.height || TALL_H_DEF) * S - 14;
        else if (item._zone === 'upper') cy = upBotY - (item.height || UPPER_H_DEF) * S - 14;
        else cy = floorY + 46;
        return <CabTag key={`tag${i}`} cx={cx} cy={cy} num={item._tag} />;
      })}

      {/* ══════════ BOTTOM DIMENSION STRINGS ══════════ */}
      <g>
        {(() => {
          const allCabs = [...sortedBases, ...sortedTalls]
            .filter(c => typeof c.position === 'number' && c.width > 0)
            .sort((a, b) => a.position - b.position);
          if (allCabs.length === 0) return null;

          const els = [];
          const dimY1 = floorY + 20;   // per-cabinet dims
          const dimY2 = floorY + 36;   // overall wall dim

          // ── Per-cabinet dimension tick marks + labels ──
          allCabs.forEach((cab, i) => {
            const lx = cab.position * S;
            const rx = (cab.position + cab.width) * S;
            // Extension lines
            els.push(
              <line key={`eL${i}`} x1={lx} y1={floorY + 2} x2={lx} y2={dimY1 + 3}
                stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
            );
            els.push(
              <line key={`eR${i}`} x1={rx} y1={floorY + 2} x2={rx} y2={dimY1 + 3}
                stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
            );
            // Tick marks
            els.push(
              <line key={`tL${i}`} x1={lx} y1={dimY1 - 3} x2={lx} y2={dimY1 + 3}
                stroke={C.dimLine} strokeWidth={0.5} />
            );
            if (i === allCabs.length - 1) {
              els.push(
                <line key={`tR${i}`} x1={rx} y1={dimY1 - 3} x2={rx} y2={dimY1 + 3}
                  stroke={C.dimLine} strokeWidth={0.5} />
              );
            }
            // Dimension line segment
            els.push(
              <line key={`dl${i}`} x1={lx} y1={dimY1} x2={rx} y2={dimY1}
                stroke={C.dimLine} strokeWidth={0.4} />
            );
            // Width label
            els.push(
              <text key={`w${i}`} x={(lx + rx) / 2} y={dimY1 - 4} fill={C.dimText}
                fontSize={4.2} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="600">{fmt(cab.width)}</text>
            );
          });

          // ── Overall wall length (second line below) ──
          els.push(
            <line key="owL" x1={0} y1={floorY + 2} x2={0} y2={dimY2 + 3}
              stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
          );
          els.push(
            <line key="owR" x1={wW} y1={floorY + 2} x2={wW} y2={dimY2 + 3}
              stroke={C.dimLine} strokeWidth={0.25} strokeDasharray="1.5,1" />
          );
          els.push(
            <line key="owd" x1={0} y1={dimY2} x2={wW} y2={dimY2}
              stroke={C.dimLine} strokeWidth={0.55} />
          );
          els.push(
            <line key="owTL" x1={0} y1={dimY2 - 3} x2={0} y2={dimY2 + 3}
              stroke={C.dimLine} strokeWidth={0.5} />
          );
          els.push(
            <line key="owTR" x1={wW} y1={dimY2 - 3} x2={wW} y2={dimY2 + 3}
              stroke={C.dimLine} strokeWidth={0.5} />
          );
          els.push(
            <text key="owTxt" x={wW / 2} y={dimY2 - 4} fill={C.dimText}
              fontSize={5} fontFamily="Helvetica,Arial,sans-serif"
              textAnchor="middle" fontWeight="700">{fmt(wallLen)}</text>
          );

          return els;
        })()}

        {/* ── Upper cabinet dimension string (top) ── */}
        {sortedUppers.length > 0 && (() => {
          const els = [];
          const dimY = ceilY - 14;
          sortedUppers.forEach((cab, i) => {
            const lx = cab.position * S;
            const rx = (cab.position + cab.width) * S;
            const uTop = upBotY - (cab.height || UPPER_H_DEF) * S;
            // Extension lines from upper cabinet tops to dim line
            els.push(
              <line key={`ueL${i}`} x1={lx} y1={uTop} x2={lx} y2={dimY + 3}
                stroke={C.dimLine} strokeWidth={0.2} strokeDasharray="1.5,1" />
            );
            els.push(
              <line key={`ueR${i}`} x1={rx} y1={uTop} x2={rx} y2={dimY + 3}
                stroke={C.dimLine} strokeWidth={0.2} strokeDasharray="1.5,1" />
            );
            els.push(
              <line key={`utL${i}`} x1={lx} y1={dimY - 2} x2={lx} y2={dimY + 2}
                stroke={C.dimLine} strokeWidth={0.4} />
            );
            els.push(
              <line key={`ud${i}`} x1={lx} y1={dimY} x2={rx} y2={dimY}
                stroke={C.dimLine} strokeWidth={0.35} />
            );
            if (i === sortedUppers.length - 1) {
              els.push(
                <line key={`utR${i}`} x1={rx} y1={dimY - 2} x2={rx} y2={dimY + 2}
                  stroke={C.dimLine} strokeWidth={0.4} />
              );
            }
            els.push(
              <text key={`uw${i}`} x={(lx + rx) / 2} y={dimY - 3.5} fill={C.dimText}
                fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif"
                textAnchor="middle" fontWeight="500">{fmt(cab.width)}</text>
            );
          });
          return els;
        })()}
      </g>

      {/* ══════════ RIGHT-SIDE VERTICAL DIMENSIONS ══════════ */}
      <g>
        {/* Toekick dim */}
        <line x1={wW + 14} y1={floorY} x2={wW + 14} y2={tkTopY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={wW + 12} y1={floorY} x2={wW + 16} y2={floorY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={wW + 12} y1={tkTopY} x2={wW + 16} y2={tkTopY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <text x={wW + 20} y={(floorY + tkTopY) / 2 + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif">{fmt(TOEKICK)}</text>

        {/* Base box dim */}
        <line x1={wW + 14} y1={tkTopY} x2={wW + 14} y2={baseTopY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <line x1={wW + 12} y1={baseTopY} x2={wW + 16} y2={baseTopY}
          stroke={C.dimLine} strokeWidth={0.4} />
        <text x={wW + 20} y={(tkTopY + baseTopY) / 2 + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif">{fmt(BASE_BOX)}</text>

        {/* Counter height AFF callout */}
        <line x1={wW + 10} y1={ctrTopY} x2={wW + 38} y2={ctrTopY}
          stroke={C.dimLine} strokeWidth={0.3} strokeDasharray="2,1.5" />
        <text x={wW + 40} y={ctrTopY + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif" fontWeight="600">36" AFF</text>

        {/* Upper bottom callout */}
        {validUppers.length > 0 && (
          <>
            <line x1={wW + 10} y1={upBotY} x2={wW + 38} y2={upBotY}
              stroke={C.dimLine} strokeWidth={0.3} strokeDasharray="2,1.5" />
            <text x={wW + 40} y={upBotY + 1.5} fill={C.dimText}
              fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif" fontWeight="600">54" AFF</text>
          </>
        )}

        {/* Backsplash gap dim */}
        {validUppers.length > 0 && (
          <>
            <line x1={wW + 26} y1={ctrTopY} x2={wW + 26} y2={upBotY}
              stroke={C.dimLine} strokeWidth={0.4} />
            <line x1={wW + 24} y1={ctrTopY} x2={wW + 28} y2={ctrTopY}
              stroke={C.dimLine} strokeWidth={0.4} />
            <line x1={wW + 24} y1={upBotY} x2={wW + 28} y2={upBotY}
              stroke={C.dimLine} strokeWidth={0.4} />
            <text x={wW + 32} y={(ctrTopY + upBotY) / 2 + 1.5} fill={C.dimText}
              fontSize={3.5} fontFamily="Helvetica,Arial,sans-serif">{fmt(SPLASH_GAP)}</text>
          </>
        )}

        {/* Upper height dim */}
        {validUppers.length > 0 && (() => {
          const uH = validUppers[0].height || UPPER_H_DEF;
          return (
            <>
              <line x1={wW + 14} y1={upBotY} x2={wW + 14} y2={upTopY}
                stroke={C.dimLine} strokeWidth={0.4} />
              <line x1={wW + 12} y1={upBotY} x2={wW + 16} y2={upBotY}
                stroke={C.dimLine} strokeWidth={0.4} />
              <line x1={wW + 12} y1={upTopY} x2={wW + 16} y2={upTopY}
                stroke={C.dimLine} strokeWidth={0.4} />
              <text x={wW + 20} y={(upBotY + upTopY) / 2 + 1.5} fill={C.dimText}
                fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif">{fmt(uH)}</text>
            </>
          );
        })()}

        {/* Ceiling height callout */}
        <line x1={wW + 10} y1={ceilY} x2={wW + 38} y2={ceilY}
          stroke={C.dimLine} strokeWidth={0.3} strokeDasharray="2,1.5" />
        <text x={wW + 40} y={ceilY + 1.5} fill={C.dimText}
          fontSize={3.8} fontFamily="Helvetica,Arial,sans-serif" fontWeight="600">{fmt(ceilH)} CLG</text>

        {/* Full floor-to-ceiling dim (far right) */}
        <line x1={wW + 50} y1={floorY} x2={wW + 50} y2={ceilY}
          stroke={C.dimLine} strokeWidth={0.5} />
        <line x1={wW + 48} y1={floorY} x2={wW + 52} y2={floorY}
          stroke={C.dimLine} strokeWidth={0.45} />
        <line x1={wW + 48} y1={ceilY} x2={wW + 52} y2={ceilY}
          stroke={C.dimLine} strokeWidth={0.45} />
        <text x={wW + 56} y={(floorY + ceilY) / 2 + 1.5} fill={C.dimText}
          fontSize={4.2} fontFamily="Helvetica,Arial,sans-serif" fontWeight="700">{fmt(ceilH)}</text>
      </g>

      {/* ══════════ DEBUG OVERLAY ══════════ */}
      {debug && (
        <g className="debug-overlay" opacity={0.7}>
          <rect x={0} y={baseTopY} width={wW} height={BASE_BOX * S}
            fill="rgba(66,133,244,0.08)" stroke="none" />
          <rect x={0} y={ceilY} width={wW} height={(ceilH - 54) * S}
            fill="rgba(52,168,83,0.08)" stroke="none" />
          <text x={-50} y={(tkTopY + baseTopY) / 2}
            fill="#4285F4" fontSize={3.5} fontFamily="monospace" fontWeight="700">BASE</text>
          <text x={-50} y={(upBotY + upTopY) / 2}
            fill="#34A853" fontSize={3.5} fontFamily="monospace" fontWeight="700">UPPER</text>

          {validBases.map((cab, i) => {
            const cx = cab.position * S;
            const cw = cab.width * S;
            return (
              <g key={`db${i}`}>
                <line x1={cx} y1={floorY + 2} x2={cx} y2={floorY + 14}
                  stroke="#E91E63" strokeWidth={0.4} />
                <text x={cx + 1} y={floorY + 10} fill="#E91E63"
                  fontSize={2.8} fontFamily="monospace">{cab.position}"</text>
                <line x1={cx + cw} y1={floorY + 2} x2={cx + cw} y2={floorY + 14}
                  stroke="#E91E63" strokeWidth={0.4} />
                <text x={cx + cw / 2} y={floorY + 20} fill="#333"
                  fontSize={2.5} fontFamily="monospace" textAnchor="middle">
                  {cab._elev?.zone || '?'} {cab.sku || cab.applianceType || ''}
                </text>
              </g>
            );
          })}

          <text x={0} y={totalH + 28} fill="#666" fontSize={3.5} fontFamily="monospace">
            DEBUG: {validBases.length} bases, {validUppers.length} uppers, {validTalls.length} talls | Wall {wallId}: {wallLen}"
          </text>
        </g>
      )}
    </svg>
  );
}


// ═══════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════

export default function ElevationView({ solverResult, trim = {}, debug = false }) {
  if (!solverResult) return null;

  const wallLayouts  = solverResult.walls || [];
  const upperLayouts = solverResult.uppers || [];
  const tallCabs     = solverResult.talls || [];
  const corners      = solverResult.corners || [];
  const inputWalls   = solverResult._inputWalls || [];

  const wallData = useMemo(() => {
    const data = {};
    inputWalls.forEach(w => {
      data[w.id] = {
        id: w.id, length: w.length,
        ceilingHeight: w.ceilingHeight || 96,
        bases: [], uppers: [], talls: [], hood: null,
      };
    });

    // 1. Base cabinets + appliances from wallLayouts
    wallLayouts.forEach(wl => {
      const wid = wl.wallId;
      if (!wid || !data[wid]) return;
      (wl.cabinets || []).forEach(cab => {
        if (typeof cab.position !== 'number' || isNaN(cab.position)) return;
        if (!cab.width || cab.width <= 0) return;

        const appType = (cab.applianceType || '').toLowerCase();
        const isTall = cab._elev?.zone === 'TALL' || appType === 'refrigerator'
          || appType === 'freezer' || appType === 'winecolumn';

        if (isTall) {
          data[wid].talls.push(cab);
        } else {
          data[wid].bases.push(cab);
        }
      });
    });

    // 2. Corner cabinets → assign to wallA
    corners.forEach(corner => {
      const wid = corner.wallA;
      if (!wid || !data[wid]) return;
      const wl = wallLayouts.find(w => w.wallId === wid);
      const pos = wl ? wl.wallLength - corner.size : 0;
      data[wid].bases.push({
        sku: corner.sku,
        type: 'corner',
        width: corner.size,
        position: Math.max(0, pos),
        _elev: corner._elev || { zone: 'BASE', yMount: 4.5, height: 30 },
        _cornerSide: 'right',  // corner is at end of wallA = right side
      });
    });

    // 3. Tall cabinets
    tallCabs.forEach(tall => {
      const wid = tall.wall;
      if (!wid || !data[wid]) return;
      if (typeof tall.position !== 'number' || isNaN(tall.position)) return;
      data[wid].talls.push(tall);
    });

    // 4. Upper cabinets + hood
    upperLayouts.forEach(ul => {
      const wid = ul.wallId;
      if (!wid || !data[wid]) return;
      (ul.cabinets || []).forEach(cab => {
        if (typeof cab.position !== 'number' || isNaN(cab.position)) return;
        if (!cab.width || cab.width <= 0) return;
        if (cab.type === 'rangeHood' || cab.role === 'range_hood'
          || (cab.applianceType || '').toLowerCase() === 'hood') {
          data[wid].hood = cab;
        } else {
          data[wid].uppers.push(cab);
        }
      });
    });

    return Object.values(data);
  }, [wallLayouts, upperLayouts, tallCabs, corners, inputWalls]);

  // Sequential tag numbers across all walls
  let globalTag = 1;

  return (
    <div>
      {wallData.map(wd => {
        const start = globalTag;
        const tallCount  = wd.talls.filter(t => typeof t.position === 'number' && t.width > 0).length;
        const baseCount  = wd.bases.filter(b => typeof b.position === 'number' && b.width > 0).length;
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
