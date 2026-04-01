/**
 * Eclipse Cabinet Designer — Elevation + Floorplan Renderer (Phase 4)
 * =====================================================================
 * Generates dimensioned SVG output from solve() results:
 *   - Floor plan (top-down view with dimensions)
 *   - Wall elevations (front-facing view per wall, bases + uppers + talls)
 *   - Bill of materials (structured BOM)
 *
 * All SVG is returned as strings — caller decides to embed or write to disk.
 *
 * Coordinate convention:
 *   Floor plan: X = horizontal, Y = vertical (top-down, Y increases downward)
 *   Elevation:  X = horizontal along wall, Y = vertical (0 = floor, up = positive)
 */

import { DIMS, TRIM_ACCESSORIES } from './constraints.js';
import { VERTICAL_ZONES, DEPTH_TIERS } from './spatial-model.js';

// ─── SVG CONSTANTS ──────────────────────────────────────────────────────────

const SCALE = 5;          // 1 inch = 5 SVG units
const STROKE = '#444';
const STROKE_LIGHT = '#bbb';
const STROKE_CAB = '#555';          // dark line for cabinet outlines (Cyncly uses dark lines)
const DIM_COLOR = '#1a56db';        // blue dimension lines
const DIM_ARROW_COLOR = '#1a56db';
const FILL_BASE = '#ffffff';        // WHITE - cabinets are white in Cyncly line drawings
const FILL_UPPER = '#ffffff';       // WHITE
const FILL_TALL = '#ffffff';        // WHITE
const FILL_CORNER = '#ffffff';
const FILL_ISLAND = '#e4edd4';      // keep for floor plan
const FILL_APPLIANCE = '#f8f8f8';   // very light gray for appliances
const FILL_FILLER = '#ffffff';
const FILL_WALL = '#fafafa';
const FILL_TOE_KICK = '#e8e8e8';    // light gray toe kick (not dark)
const FILL_CROWN = '#f0f0f0';
const FILL_LIGHT_RAIL = '#f0f0f0';
const FILL_COUNTER = '#e0e0e0';     // light gray countertop

// Appliance fills (all light gray for clean line drawing)
const APPLIANCE_FILLS = {
  range: '#f8f8f8',
  cooktop: '#f8f8f8',
  refrigerator: '#f8f8f8',
  freezer: '#f8f8f8',
  wineColumn: '#f8f8f8',
  sink: '#f8f8f8',
  dishwasher: '#f8f8f8',
  wallOven: '#f8f8f8',
  speedOven: '#f8f8f8',
  steamOven: '#f8f8f8',
  hood: '#f8f8f8',
  microwave: '#f8f8f8',
  warmingDrawer: '#f8f8f8',
  wineCooler: '#f8f8f8',
  beverageCenter: '#f8f8f8',
  iceMaker: '#f8f8f8',
};
const FILL_GLASS = '#eef4fa';       // very subtle blue tint for glass cabinets
const FONT_SIZE = 11;
const DIM_OFFSET = 18;              // offset for dimension lines from cabinet edges
const DIM_TICK = 4;                 // tick mark size on dimension lines

// ─── HELPERS ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function s(inches) {
  return Math.round(inches * SCALE * 100) / 100;
}

function formatDim(inches) {
  if (inches == null) return '';
  const whole = Math.floor(inches);
  const frac = inches - whole;
  if (frac < 0.03125) return `${whole}"`;
  if (Math.abs(frac - 0.25) < 0.03) return `${whole}¼"`;
  if (Math.abs(frac - 0.5) < 0.03) return `${whole}½"`;
  if (Math.abs(frac - 0.75) < 0.03) return `${whole}¾"`;
  if (Math.abs(frac - 0.125) < 0.03) return `${whole}⅛"`;
  if (Math.abs(frac - 0.375) < 0.03) return `${whole}⅜"`;
  if (Math.abs(frac - 0.625) < 0.03) return `${whole}⅝"`;
  if (Math.abs(frac - 0.875) < 0.03) return `${whole}⅞"`;
  return `${Math.round(inches * 100) / 100}"`;
}

function cabinetFill(placement) {
  const { type, role, sku, applianceType } = placement;
  if (type === 'appliance' || role === 'appliance') {
    // Use appliance-type-specific fill if available
    if (applianceType && APPLIANCE_FILLS[applianceType]) return APPLIANCE_FILLS[applianceType];
    return FILL_APPLIANCE;
  }
  if (type === 'corner' || role === 'corner') return FILL_CORNER;
  if (role === 'filler' || role === 'corner-filler') return FILL_FILLER;
  if (type === 'upper' || role === 'upper') return FILL_UPPER;
  if (type === 'tall' || role === 'tall') return FILL_TALL;
  if ((sku || '').startsWith('REP') || role === 'rep') return FILL_FILLER;
  return FILL_BASE;
}

function islandFill() { return FILL_ISLAND; }

// ─── ELEVATION SVG DEFINITIONS ──────────────────────────────────────────────
// (No gradients or patterns needed for clean Cyncly-style line drawings)


// ─── FLOOR PLAN SVG ────────────────────────────────────────────────────────

/**
 * Generate a top-down floor plan SVG from a solve() result.
 *
 * @param {Object} layout - Result from solve()
 * @param {Object} [opts] - Options: { title, showDimensions, showSkus, margin }
 * @returns {string} SVG markup string
 */
export function renderFloorPlan(layout, opts = {}) {
  const {
    title = 'Floor Plan',
    showDimensions = true,
    showSkus = true,
    margin = 60,
  } = opts;

  // _inputWalls has original wall defs (id, length); layout.walls has wallLayouts (wallId, cabinets)
  const inputWalls = layout._inputWalls || [];
  const wallLayouts = layout.walls || [];
  const corners = layout.corners || [];
  const { island, peninsula, layoutType } = layout;
  const wallConfig = buildWallConfig(inputWalls, layoutType);

  // Collect all rectangles for bounding box computation
  const rects = [];

  // Draw walls as thick lines + cabinets as rectangles
  const elements = [];

  // ── Perimeter walls ──
  for (const wall of inputWalls) {
    const cfg = wallConfig[wall.id];
    if (!cfg) continue;

    // Wall line
    const { ox, oy, dx, dy } = cfg;
    const len = wall.length;
    const ex = ox + dx * len;
    const ey = oy + dy * len;

    elements.push(`<line x1="${s(ox)}" y1="${s(oy)}" x2="${s(ex)}" y2="${s(ey)}" stroke="${STROKE}" stroke-width="3" />`);

    // Wall dimension (Rec #1: NKBA-standard dimension chain)
    if (showDimensions) {
      const mx = (ox + ex) / 2;
      const my = (oy + ey) / 2;
      // offset label away from cabinets
      const nx = -dy; // normal vector (perpendicular to wall, into room)
      const ny = dx;

      // Overall dimension at top
      const lx = mx + nx * (DIMS.baseDepth + DIM_OFFSET * 2);
      const ly = my + ny * (DIMS.baseDepth + DIM_OFFSET * 2);
      elements.push(dimText(lx, ly, formatDim(wall.length)));

      // Chained dimension line along wall with per-cabinet labels (NKBA style)
      const wallLayout = wallLayouts.find(wl => wl.wallId === wall.id);
      if (wallLayout && wallLayout.cabinets && wallLayout.cabinets.length > 0) {
        const dimDist = DIMS.baseDepth + DIM_OFFSET;

        // Per-cabinet dimension segments with labels
        let runPos = 0;
        const leftCorner = corners.find(c => c.wallB === wall.id);
        if (leftCorner) runPos = leftCorner.wallBConsumption || 0;

        const isHorizontal = Math.abs(dx) === 1 && dy === 0;

        for (const cab of wallLayout.cabinets) {
          const cabW = cab.width || 0;
          if (cabW <= 0) continue;

          // Start and end points offset perpendicular to wall
          const sx = ox + dx * runPos + nx * dimDist;
          const sy = oy + dy * runPos + ny * dimDist;
          const ex2 = ox + dx * (runPos + cabW) + nx * dimDist;
          const ey2 = oy + dy * (runPos + cabW) + ny * dimDist;

          if (cabW >= 6) {
            if (isHorizontal) {
              elements.push(dimLine(sx, sy, ex2, ey2, formatDim(cabW)));
            } else {
              elements.push(dimLineVert(sx, sy, ex2, ey2, formatDim(cabW)));
            }
          }

          runPos += cabW;
        }
      }
    }

    rects.push({ x: Math.min(ox, ex), y: Math.min(oy, ey), w: Math.abs(ex - ox) || 2, h: Math.abs(ey - oy) || 2 });
  }

  // ── Base cabinets along walls ──
  for (const wall of inputWalls) {
    const cfg = wallConfig[wall.id];
    if (!cfg) continue;

    const wallLayout = wallLayouts.find(wl => wl.wallId === wall.id);
    if (!wallLayout) continue;

    let runPos = 0;
    // Account for corner consumption at left
    const leftCorner = corners.find(c => c.wallB === wall.id);
    if (leftCorner) runPos = leftCorner.wallBConsumption || 0;

    for (const cab of wallLayout.cabinets) {
      const w = cab.width || 0;
      if (w <= 0) continue;
      const depth = (cab.type === 'upper' || cab.role === 'upper') ? DIMS.upperDepth : DIMS.baseDepth;
      const rect = cabinetRectOnWall(cfg, runPos, w, depth);
      const fill = cabinetFill(cab);
      elements.push(svgRect(rect, fill));
      // Appliance symbol overlay
      if ((cab.type === 'appliance' || cab.role === 'appliance') && cab.applianceType) {
        elements.push(applianceSymbol(rect, cab.applianceType));
      }
      if (showSkus && cab.sku) {
        elements.push(svgLabel(rect, cab.sku));
      }
      rects.push(rect);

      // ── Depth overhang callout: appliances that protrude past cabinet depth ──
      if (cab._depthOverhang > 0) {
        // Draw a dashed outline showing the extra depth
        const overhangDepth = cab._depthOverhang;
        const overhangRect = cabinetRectOnWall(cfg, runPos, w, depth + overhangDepth);
        elements.push(`<rect x="${s(overhangRect.x)}" y="${s(overhangRect.y)}" width="${s(overhangRect.w)}" height="${s(overhangRect.h)}" fill="none" stroke="#c44" stroke-width="1.5" stroke-dasharray="4,2" />`);
        // Small warning label
        const cx = overhangRect.x + overhangRect.w / 2;
        const cy = overhangRect.y + overhangRect.h + 3;
        elements.push(`<text x="${s(cx)}" y="${s(cy)}" text-anchor="middle" style="font-size:7px;fill:#c44;font-weight:bold;">+${overhangDepth}" depth</text>`);
      }

      runPos += w;
    }
  }

  // ── Corner cabinets ──
  for (const corner of corners) {
    const cfgA = wallConfig[corner.wallA];
    const cfgB = wallConfig[corner.wallB];
    if (!cfgA || !cfgB) continue;
    const size = corner.size || 36;
    const wallALen = inputWalls.find(w => w.id === corner.wallA)?.length || 0;

    // Junction point: where wall A ends and wall B starts
    const jx = cfgA.ox + cfgA.dx * wallALen;
    const jy = cfgA.oy + cfgA.dy * wallALen;

    // Corner cabinet occupies the last portion of wall A and first portion of wall B.
    // It should sit against both walls, extending into the room from the corner.
    // The correct position is: from the junction, go back along wall A by wallAConsumption,
    // and along wall B by wallBConsumption, creating an L-shaped footprint.
    // For simplified rendering, we draw it as a square at the corner junction,
    // aligned to the walls (not centered on the junction).
    const depth = DIMS.baseDepth;
    const consumeA = corner.wallAConsumption || size;
    const consumeB = corner.wallBConsumption || size;

    // Calculate corner rect position: it sits inside the room at the junction
    // For L-shape (wall A goes right, wall B goes down):
    //   corner occupies (jx - consumeA, jy) → (jx, jy + depth) along wall A
    //   and (jx, jy) → (jx + depth, jy + consumeB) along wall B
    // Draw as a compound shape: a square at the junction point,
    // positioned so it touches both wall runs.
    const cornerSize = Math.max(consumeA, consumeB, depth);
    let rect;

    // Draw corner as TWO rectangles forming an L-shape at the junction.
    // Each leg runs along its respective wall with cabinet depth into the room.
    // Wall A leg: from (jx - consumeA) along wall A direction, depth into room
    // Wall B leg: from junction along wall B direction, depth into room
    // They share the junction corner, creating a proper L-shaped footprint.
    let rectA, rectB;

    if (cfgA.dx === 1 && cfgB.dy === 1) {
      // Wall A goes right, Wall B goes down
      // Wall A leg: extends left from junction, depth downward
      rectA = { x: jx - consumeA, y: jy, w: consumeA, h: depth };
      // Wall B leg: extends down from junction, depth leftward (into room)
      rectB = { x: jx - depth, y: jy, w: depth, h: consumeB };
    } else if (cfgA.dx === 1 && cfgB.dy === -1) {
      // Wall A goes right, Wall B goes up
      rectA = { x: jx - consumeA, y: jy - depth, w: consumeA, h: depth };
      rectB = { x: jx - depth, y: jy - consumeB, w: depth, h: consumeB };
    } else if (cfgA.dy === 1 && cfgB.dx === -1) {
      // Wall A goes down, Wall B goes left
      rectA = { x: jx - depth, y: jy - consumeA, w: depth, h: consumeA };
      rectB = { x: jx - consumeB, y: jy - depth, w: consumeB, h: depth };
    } else if (cfgA.dy === 1 && cfgB.dx === 1) {
      // Wall A goes down, Wall B goes right
      rectA = { x: jx, y: jy - consumeA, w: depth, h: consumeA };
      rectB = { x: jx, y: jy, w: consumeB, h: depth };
    } else {
      // Fallback: single rect at junction
      rectA = { x: jx - consumeA, y: jy, w: consumeA, h: depth };
      rectB = null;
    }

    // Draw both legs with a darker stroke to show the L shape
    elements.push(svgRect(rectA, FILL_CORNER));
    rects.push(rectA);
    if (rectB) {
      elements.push(svgRect(rectB, FILL_CORNER));
      rects.push(rectB);
    }

    // Draw a diagonal line inside the corner to indicate lazy susan rotation
    if (corner.type === 'lazySusan' || corner.type === 'diagonalLazy') {
      const cx = rectA.x + rectA.w;
      const cy = rectA.y + rectA.h;
      const diagX = rectB ? rectB.x : cx - depth;
      const diagY = rectB ? rectB.y : cy;
      elements.push(`<line x1="${s(cx - depth * 0.8)}" y1="${s(cy - depth * 0.1)}" x2="${s(cx - depth * 0.1)}" y2="${s(cy + depth * 0.8)}" stroke="${STROKE_CAB}" stroke-width="0.5" stroke-dasharray="3,2" />`);
    }

    if (showSkus && corner.sku) {
      // Label at the junction point (center of the L-shape overlap area)
      const labelRect = rectA;
      elements.push(svgLabel(labelRect, corner.sku));
    }
  }

  // ── Tall cabinets on floor plan ──
  const talls = layout.talls || [];
  for (const tall of talls) {
    if (!tall.wall || tall.wall === 'fridge') continue; // fridge panels handled separately
    const cfg = wallConfig[tall.wall];
    if (!cfg) continue;

    const wallDef = inputWalls.find(w => w.id === tall.wall);
    if (!wallDef) continue;

    const w = tall.width || 24;
    const d = tall.depth || DIMS.baseDepth;

    // Position tall at the wall end (talls typically go at wall terminals or near fridge zone)
    // If tall has a position, use it; otherwise default to end of wall
    let runPos = typeof tall.position === 'number' ? tall.position : (wallDef.length - w);

    // Check if a corner consumes the right end of this wall
    const rightCorner = corners.find(c => c.wallA === tall.wall);
    if (rightCorner && runPos + w > wallDef.length - (rightCorner.wallAConsumption || 0)) {
      // Place tall at the LEFT end of the wall instead
      const leftCorner = corners.find(c => c.wallB === tall.wall);
      const leftConsumed = leftCorner ? (leftCorner.wallBConsumption || 0) : 0;
      runPos = leftConsumed; // place just after corner
    }

    const rect = cabinetRectOnWall(cfg, runPos, w, d);
    elements.push(svgRect(rect, FILL_TALL));
    if (showSkus && tall.sku) {
      elements.push(svgLabel(rect, tall.sku));
    }
    rects.push(rect);
  }

  // ── Fridge zone rendering on floor plan ──
  // Render fridge panels and above-fridge cab as a grouped unit
  const fridgeTalls = talls.filter(t => t.wall === 'fridge');
  if (fridgeTalls.length > 0) {
    // Find which wall the fridge would be on — look for a 'refrigerator' in appliances
    const fridgeApp = (layout.placements || []).find(p => p.applianceType === 'refrigerator');
    const fridgeWall = fridgeApp?.wall || inputWalls[0]?.id;
    const cfg = wallConfig[fridgeWall];

    if (cfg) {
      const wallDef = inputWalls.find(w => w.id === fridgeWall);
      // Place fridge zone at end of wall
      const totalFridgeWidth = fridgeTalls.reduce((sum, t) => sum + (t.width || 0), 0);
      const runPos = (wallDef?.length || 120) - totalFridgeWidth;
      let x = runPos;
      for (const ft of fridgeTalls) {
        const w = ft.width || 36;
        const d = ft.depth || 27;
        const rect = cabinetRectOnWall(cfg, x, w, d);
        const fill = ft.role === 'fridge_panel' ? FILL_FILLER : APPLIANCE_FILLS.refrigerator;
        elements.push(svgRect(rect, fill));
        if (showSkus && ft.sku) {
          elements.push(svgLabel(rect, ft.sku));
        }
        rects.push(rect);
        x += w;
      }
    }
  }

  // ── Island ──
  if (island && layout.island) {
    const il = layout.island;
    // Position island centered below wall A
    const wallA = inputWalls[0];
    const cfgA = wallConfig[wallA?.id];
    const islandX = cfgA ? cfgA.ox + (wallA.length / 2) - ((island.length || 96) / 2) : 48;
    const islandY = (cfgA ? cfgA.oy : 0) + DIMS.baseDepth + 42; // 42" clearance
    const islandW = island.length || 96;
    const islandD = DIMS.baseDepth * 2; // work side + back side depth

    const rect = { x: islandX, y: islandY, w: islandW, h: islandD };
    elements.push(svgRect(rect, FILL_ISLAND));
    elements.push(svgLabel(rect, 'ISLAND'));

    if (showDimensions) {
      elements.push(dimLine(islandX, islandY + islandD + DIM_OFFSET, islandX + islandW, islandY + islandD + DIM_OFFSET, formatDim(islandW)));
    }
    rects.push(rect);
  }

  // ── Solver warning overlays ──
  const solverWarnings = (layout.validation && layout.validation.solverWarnings) || [];
  if (solverWarnings.length > 0) {
    // Group warnings by type and render a warning banner below the floor plan
    const warningTexts = solverWarnings
      .filter(w => w.type === 'no_space' || w.type === 'overlap' || w.type === 'island_overflow' || w.type === 'island_appliance_too_wide')
      .map(w => w.message || `${w.type}: ${w.applianceType || 'unknown'}`);

    if (warningTexts.length > 0) {
      // We'll render a small warning panel below the floor plan after bounding box is computed
      // Store them for post-bounding-box rendering
      layout._rendererWarnings = warningTexts;
    }
  }

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 200; maxY = 200; }

  // Build color legend for appliance types
  const legendEntries = [
    { label: 'Range/Cooktop', fill: APPLIANCE_FILLS.range },
    { label: 'Refrigeration', fill: APPLIANCE_FILLS.refrigerator },
    { label: 'Sink/DW', fill: APPLIANCE_FILLS.sink },
    { label: 'Oven', fill: APPLIANCE_FILLS.wallOven },
    { label: 'Hood', fill: APPLIANCE_FILLS.hood },
    { label: 'Wine/Bev', fill: APPLIANCE_FILLS.wineCooler },
    { label: 'Warming/MW', fill: APPLIANCE_FILLS.microwave },
    { label: 'Cabinet', fill: FILL_BASE },
    { label: 'Island', fill: FILL_ISLAND },
  ];
  const legendH = 18;
  const svgW = s(maxX - minX) + margin * 2;
  const svgH = s(maxY - minY) + margin * 2 + 30 + legendH; // 30 for title + legend

  const translateX = margin - s(minX);
  const translateY = margin + 24 - s(minY);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="background:white">\n`;
  svg += `<style>text{font-family:'Helvetica Neue',Arial,sans-serif;font-size:${FONT_SIZE}px;fill:#333;}</style>\n`;
  svg += `<text x="${svgW / 2}" y="18" text-anchor="middle" style="font-size:14px;font-weight:bold;">${esc(title)}</text>\n`;
  svg += `<g transform="translate(${translateX},${translateY})">\n`;

  for (const el of elements) {
    svg += `  ${el}\n`;
  }

  svg += `</g>\n`;

  // ── Color legend ──
  const legendY = svgH - legendH - 2;
  let legendX = 8;
  for (const entry of legendEntries) {
    svg += `<rect x="${legendX}" y="${legendY}" width="8" height="8" rx="1" fill="${entry.fill}" stroke="#999" stroke-width="0.5" />`;
    svg += `<text x="${legendX + 11}" y="${legendY + 7}" style="font-size:7px;fill:#666;">${esc(entry.label)}</text>`;
    legendX += 11 + entry.label.length * 4.2 + 6;
  }

  // ── Solver warning panel ──
  const rendererWarnings = layout._rendererWarnings || [];
  if (rendererWarnings.length > 0) {
    const warnY = svgH - 4;
    svg += `<text x="8" y="${warnY}" style="font-size:7px;fill:#c44;font-weight:bold;">⚠ Solver Warnings:</text>`;
    rendererWarnings.forEach((msg, i) => {
      svg += `<text x="8" y="${warnY + 10 + i * 9}" style="font-size:6.5px;fill:#c44;">${esc(msg)}</text>`;
    });
    // Extend SVG height to accommodate warnings
    const extraH = rendererWarnings.length * 9 + 14;
    svg = svg.replace(`height="${svgH}"`, `height="${svgH + extraH}"`);
    svg = svg.replace(`0 0 ${svgW} ${svgH}`, `0 0 ${svgW} ${svgH + extraH}`);
  }

  svg += `\n</svg>`;
  return svg;
}


// ─── WALL ELEVATION SVG ────────────────────────────────────────────────────

/**
 * Generate a front-facing wall elevation SVG for a single wall.
 * Renders Cyncly Flex-style output with molding, cabinet door details,
 * blue dimension lines, toe kick, crown, and light rail.
 *
 * @param {Object} layout - Result from solve()
 * @param {string} wallId - Wall ID to render (e.g., "A")
 * @param {Object} [opts] - Options: { title, showDimensions, showSkus, margin, ceilingHeight, trim }
 * @returns {string} SVG markup string
 */
export function renderElevation(layout, wallId, opts = {}) {
  const {
    title,
    showDimensions = true,
    showSkus = true,
    margin = 50,
    ceilingHeight,
    trim = {},   // { crown, lightRail, toeKick, traditionalTrim, countertopEdge }
    allWalls = [],
    layoutType = 'single-wall',
  } = opts;

  const wall = (layout.walls || []).find(wl => wl.wallId === wallId);
  const wallDef = (layout._inputWalls || []).find(w => w.id === wallId) ||
                  { id: wallId, length: 0, ceilingHeight: ceilingHeight || DIMS.standardCeiling };
  const ceil = ceilingHeight || wallDef.ceilingHeight || DIMS.standardCeiling;
  const wallLength = wallDef.length || (wall ? wall.cabinets.reduce((sum, c) => sum + (c.width || 0), 0) : 120);

  const uppers = (layout.uppers || []).find(ul => ul.wallId === wallId);
  const corners = (layout.corners || []).filter(c => c.wallA === wallId || c.wallB === wallId);
  const talls = (layout.talls || []).filter(t => t.wall === wallId);

  // Map wall ID to cardinal direction (N, E, S, W for NKBA clockwise ordering)
  const wallDirMap = {
    'north': 'North', 'N': 'North', 'top': 'North',
    'east': 'East', 'E': 'East', 'right': 'East',
    'south': 'South', 'S': 'South', 'bottom': 'South',
    'west': 'West', 'W': 'West', 'left': 'West',
  };
  const wallDir = wallDirMap[wallId.toLowerCase()] || '';
  const elevTitle = title || `${wallDir ? wallDir + ' ' : ''}Wall ${wallId} Elevation`;
  const elements = [];

  // Wall background (Cyncly style: white with thin border)
  elements.push(`<rect x="0" y="0" width="${s(wallLength)}" height="${s(ceil)}" fill="white" stroke="#999" stroke-width="0.6" />`);

  // Counter line (light gray horizontal line at counter height)
  const counterY = ceil - DIMS.counterHeight;
  elements.push(`<line x1="0" y1="${s(counterY)}" x2="${s(wallLength)}" y2="${s(counterY)}" stroke="${STROKE_CAB}" stroke-width="0.7" />`);

  // ── Compute left corner offset for coordinate normalization ──
  // Bases are drawn sequentially from x=0 within the available zone.
  // Uppers and talls use absolute positions from the solver (which include corner offset).
  // Subtract leftConsumed from absolute positions to align uppers above their bases.
  let leftConsumed = 0;
  for (const corner of corners) {
    if (corner.wallB === wallId) {
      leftConsumed += (corner.wallBConsumption || corner.size || 0);
    }
  }

  // ── Base cabinets ──
  let baseRunX = 0;
  if (wall && wall.cabinets) {
    for (const cab of wall.cabinets) {
      const w = cab.width || 0;
      if (w <= 0) continue;

      const isUpper = cab.type === 'upper' || cab.role === 'upper';
      if (isUpper) { baseRunX += w; continue; } // skip uppers here, drawn separately

      // ── 3D-AWARE VERTICAL POSITIONING ──
      // Use _elev spatial data for precise Y positioning when available.
      // _elev.yMount = bottom of cabinet from floor (in real inches)
      // SVG Y is inverted: 0 = top of wall, ceil = floor
      let h, y;
      if (cab._elev) {
        h = cab._elev.height;
        y = ceil - cab._elev.yMount - h;  // SVG Y from _elev data
      } else {
        // Fallback: old logic
        h = DIMS.baseHeight;
        if (cab.type === 'appliance' && cab.applianceType) {
          const at = cab.applianceType;
          if (at === 'refrigerator' || at === 'freezer' || at === 'wineColumn') h = 84;
          else if (at === 'wallOven' || at === 'speedOven' || at === 'steamOven') h = 54;
          else if (at === 'hood') h = 24;
        }
        y = ceil - h;
      }

      const fill = cabinetFill(cab);
      const isHood = cab.type === 'appliance' && cab.applianceType === 'hood';

      if (isHood) {
        // ── Hood: render using _elev position or fallback ──
        const hoodH = cab._elev?.height || 24;
        const hoodMount = cab._elev?.yMount || DIMS.upperBottom;
        const hoodY = ceil - hoodMount - hoodH;
        elements.push(drawCabinetFace(baseRunX, hoodY, w, hoodH, cab, APPLIANCE_FILLS.hood || fill));
        if (cab.applianceType) elements.push(elevApplianceSymbol(baseRunX, hoodY, w, hoodH, cab.applianceType));
        if (showSkus && cab.sku) {
          elements.push(elevLabel(baseRunX, hoodY, w, hoodH, cab.sku));
        }

      } else {
        elements.push(drawCabinetFace(baseRunX, y, w, h, cab, fill));
        // Elevation appliance symbol overlay
        if ((cab.type === 'appliance' || cab.role === 'appliance') && cab.applianceType) {
          elements.push(elevApplianceSymbol(baseRunX, y, w, h, cab.applianceType));
        }
        if (showSkus && cab.sku) {
          elements.push(elevLabel(baseRunX, y, w, h, cab.sku));
        }
      }

      if (showDimensions && w >= 12) {
        elements.push(dimText(baseRunX + w / 2, ceil + DIM_OFFSET, formatDim(w)));
      }

      // ── Depth overhang indicator in elevation view ──
      if (cab._depthOverhang > 0) {
        // Red dashed border around the appliance and small warning text
        elements.push(`<rect x="${s(baseRunX)}" y="${s(y)}" width="${s(w)}" height="${s(h)}" fill="none" stroke="#c44" stroke-width="2" stroke-dasharray="4,2" />`);
        elements.push(`<text x="${s(baseRunX + w / 2)}" y="${s(y - 3)}" text-anchor="middle" style="font-size:7px;fill:#c44;font-weight:bold;">depth +${cab._depthOverhang}"</text>`);
      }

      baseRunX += w;
    }
  }

  // ── PROJECT 4: Professional elevation renderer ──
  const baseEndX_p4 = baseRunX; // right edge of base cabinet run
  const hasBases_p4 = baseEndX_p4 > 0;

  // ── Backsplash zone (3D spatial model: 36"–54" clear zone) ──
  // Draw a subtle indicator showing the backsplash zone between counter and upper cabinets.
  // This matches Cyncly's approach: light fill showing the protected zone.
  if (hasBases_p4) {
    const bsBottom = VERTICAL_ZONES.BACKSPLASH.yMin; // 36"
    const bsTop = VERTICAL_ZONES.BACKSPLASH.yMax;    // 54"
    const bsH = bsTop - bsBottom;                     // 18"
    const bsYsvg = ceil - bsTop;                       // SVG Y (inverted)
    // Subtle light gray fill for backsplash zone
    elements.push(`<rect x="0" y="${s(bsYsvg)}" width="${s(baseEndX_p4)}" height="${s(bsH)}" fill="#f8f8f8" stroke="none" />`);
    // Thin dashed lines marking zone boundaries
    elements.push(`<line x1="0" y1="${s(bsYsvg)}" x2="${s(baseEndX_p4)}" y2="${s(bsYsvg)}" stroke="#ddd" stroke-width="0.4" stroke-dasharray="3,3" />`);
    elements.push(`<line x1="0" y1="${s(ceil - bsBottom)}" x2="${s(baseEndX_p4)}" y2="${s(ceil - bsBottom)}" stroke="#ddd" stroke-width="0.4" stroke-dasharray="3,3" />`);
  }

  // ── Depth setback indicator for upper cabinets ──
  // In elevation view, show a thin line inset from the base cabinet face
  // to indicate that uppers sit 11" back from the base fronts.
  const depthSetback = DEPTH_TIERS.BASE_FRONT - DEPTH_TIERS.UPPER_FRONT; // 11"

  // ── Upper cabinets (position-based, not sequential) ──
  let upperRunX = 0;
  if (uppers && uppers.cabinets) {
    for (const cab of uppers.cabinets) {
      const w = cab.width || 0;
      if (w <= 0) continue;

      // ── 3D-AWARE: Use _elev for precise vertical positioning ──
      // _elev.yMount = bottom of cabinet from floor (e.g., 54" for standard uppers, 84" for RW above fridge)
      const upperH = cab._elev?.height || cab.height || 36;
      const upperMount = cab._elev?.yMount ?? DIMS.upperBottom;  // ?? preserves 0
      const y = ceil - upperMount - upperH;

      // Use actual position if available, otherwise sequential.
      // Subtract leftConsumed to normalize absolute positions into the
      // same 0-based coordinate space used by the sequential base cabinets.
      const x = typeof cab.position === 'number' ? (cab.position - leftConsumed) : upperRunX;

      const isGlass = cab._glassFrontFlanking || cab.type === 'wall_glass_display' ||
                       (cab.modifications || []).some(m => m.mod === 'GFD');

      elements.push(drawCabinetFace(x, y, w, upperH, cab, FILL_UPPER));

      // ── Depth setback indicator (3D spatial model) ──
      // Draw a thin inset line on the left edge showing the 11" depth difference
      // between base fronts (24") and upper fronts (13"). This visual cue
      // matches how Cyncly shows the plane change in elevation drawings.
      if (depthSetback > 0 && hasBases_p4) {
        const setbackScale = Math.min(depthSetback * 0.3, 4); // proportional indicator, max 4px
        elements.push(`<line x1="${s(x) + setbackScale}" y1="${s(y)}" x2="${s(x) + setbackScale}" y2="${s(y + upperH)}" stroke="#bbb" stroke-width="0.4" stroke-dasharray="2,2" />`);
        elements.push(`<line x1="${s(x + w) - setbackScale}" y1="${s(y)}" x2="${s(x + w) - setbackScale}" y2="${s(y + upperH)}" stroke="#bbb" stroke-width="0.4" stroke-dasharray="2,2" />`);
      }

      if (showSkus && cab.sku) {
        elements.push(elevLabel(x, y, w, upperH, cab.sku));
      }
      if (showDimensions && w >= 12) {
        elements.push(dimText(x + w / 2, y - 6, formatDim(w)));
      }

      // Hardware (bar pulls) drawn by drawCabinetFace

      upperRunX = Math.max(upperRunX, x + w);
    }
  }

  // ── Tall cabinets ──
  for (const tall of talls) {
    const w = tall.width || 24;
    // Use _elev 3D spatial data for precise height and mounting position
    const h = tall._elev?.height || tall.height || 84;
    const yMount = tall._elev?.yMount || 0;
    // Normalize absolute position by subtracting leftConsumed (same as uppers)
    const rawX = typeof tall.position === 'number' ? tall.position : (tall._elevX || (wallLength - w));
    const x = rawX - leftConsumed;
    const y = ceil - yMount - h;

    elements.push(drawCabinetFace(x, y, w, h, tall, FILL_TALL));
    if (showSkus && tall.sku) {
      elements.push(elevLabel(x, y, w, h, tall.sku));
    }
  }

  // ── MOLDING & TRIM (Cyncly Flex style) ──
  // Determine base and upper run extents for molding placement
  const baseEndX = baseRunX;   // right edge of last base cabinet
  const upperEndX = upperRunX; // right edge of last upper cabinet
  const hasBases = baseEndX > 0;
  const hasUppers = upperEndX > 0;

  // Auto-detect trim preferences from layout or opts
  const trimPrefs = {
    toeKick: trim.toeKick !== false,     // default ON
    crown: trim.crown !== false && hasUppers,
    lightRail: trim.lightRail !== false && hasUppers,
    countertopEdge: trim.countertopEdge !== false && hasBases,
    traditionalTrim: trim.traditionalTrim || false, // explicit opt-in
  };

  // 1) Toe kick — thin line at floor level under base cabinets
  if (trimPrefs.toeKick && hasBases) {
    const tkY = ceil - 4.5; // standard Eclipse toe kick height
    elements.push(`<line x1="0" y1="${s(tkY)}" x2="${s(baseEndX)}" y2="${s(tkY)}" stroke="${STROKE_CAB}" stroke-width="0.5" />`);
  }

  // 2) Countertop edge — thin line at counter height
  if (trimPrefs.countertopEdge && hasBases) {
    // Counter line already drawn above
  }

  // 3) Light rail — thin horizontal line under upper cabinets
  if (trimPrefs.lightRail && hasUppers) {
    const upperBottom = DIMS.upperBottom; // 54" AFF
    const lrY = ceil - upperBottom;  // bottom of upper cabs
    elements.push(`<line x1="0" y1="${s(lrY)}" x2="${s(upperEndX)}" y2="${s(lrY)}" stroke="${STROKE_CAB}" stroke-width="0.5" />`);
  }

  // 4) Crown molding — thin horizontal line at top of upper cabinets
  if (trimPrefs.crown && hasUppers) {
    const upperH = (uppers && uppers.cabinets && uppers.cabinets[0]) ? (uppers.cabinets[0].height || 36) : 36;
    const upperTop = ceil - DIMS.upperBottom - upperH; // top of upper cabinets
    elements.push(`<line x1="0" y1="${s(upperTop)}" x2="${s(upperEndX)}" y2="${s(upperTop)}" stroke="${STROKE_CAB}" stroke-width="0.5" />`);
  }

  // ── Dimension lines: overall wall (Cyncly blue style) ──
  if (showDimensions) {
    // Top overall dimension (Cyncly puts it at top, not bottom)
    const topDimY = -DIM_OFFSET;
    elements.push(dimLine(0, topDimY, wallLength, topDimY, formatDim(wallLength)));

    // Bottom per-cabinet dimensions
    const botDimY = ceil + DIM_OFFSET * 1.5;
    let dimRunX = 0;
    if (wall && wall.cabinets) {
      for (const cab of wall.cabinets) {
        const w = cab.width || 0;
        if (w <= 0) continue;
        const isUpper = cab.type === 'upper' || cab.role === 'upper';
        if (isUpper) { dimRunX += w; continue; }
        if (w >= 6) {
          // Extension lines from cabinet edges
          elements.push(`<line x1="${s(dimRunX)}" y1="${s(ceil)}" x2="${s(dimRunX)}" y2="${s(botDimY + DIM_TICK / SCALE)}" stroke="${DIM_COLOR}" stroke-width="0.3" stroke-dasharray="2,2" />`);
          elements.push(dimLine(dimRunX, botDimY, dimRunX + w, botDimY, formatDim(w)));
        }
        dimRunX += w;
      }
      // Final extension line
      elements.push(`<line x1="${s(dimRunX)}" y1="${s(ceil)}" x2="${s(dimRunX)}" y2="${s(botDimY + DIM_TICK / SCALE)}" stroke="${DIM_COLOR}" stroke-width="0.3" stroke-dasharray="2,2" />`);
    }

    // Left side height dimension
    const dimX = -DIM_OFFSET;
    elements.push(dimLineVert(dimX, 0, dimX, ceil, formatDim(ceil)));

    // RIGHT SIDE: Vertical dimension chains with 3D zone labels
    const rightDimX = wallLength + DIM_OFFSET;
    const rightLabelX = wallLength + DIM_OFFSET + 10;
    const counterH = DIMS.counterHeight || 36;
    const baseZoneH = VERTICAL_ZONES.BASE.yMax - VERTICAL_ZONES.BASE.yMin;  // 30"
    const toeKickH = VERTICAL_ZONES.TOE_KICK.yMax;  // 4.5"
    const backsplashZoneH = VERTICAL_ZONES.BACKSPLASH.yMax - VERTICAL_ZONES.BACKSPLASH.yMin;  // 18"
    const upperH = (uppers && uppers.cabinets && uppers.cabinets[0]) ? (uppers.cabinets[0]._elev?.height || uppers.cabinets[0].height || 36) : 36;
    const ceilingClearanceH = ceil - VERTICAL_ZONES.UPPER.yMin - upperH;

    // Floor to counter (includes toe kick + base zone + counter)
    elements.push(dimLineVert(rightDimX, ceil - counterH, rightDimX, ceil, formatDim(counterH)));
    // Zone label: BASE (right of dim chain)
    const baseMidY = ceil - counterH / 2;
    elements.push(`<text x="${s(rightLabelX)}" y="${s(baseMidY)}" style="font-size:6px;fill:#888;font-style:italic;" dominant-baseline="middle">BASE 24"d</text>`);

    // Counter to upper bottom (backsplash zone)
    const backsplashY = ceil - VERTICAL_ZONES.UPPER.yMin;
    elements.push(dimLineVert(rightDimX, backsplashY, rightDimX, ceil - counterH, formatDim(backsplashZoneH)));
    // Zone label: BACKSPLASH
    const bsMidY = (backsplashY + ceil - counterH) / 2;
    elements.push(`<text x="${s(rightLabelX)}" y="${s(bsMidY)}" style="font-size:6px;fill:#c88;font-style:italic;" dominant-baseline="middle">CLEAR</text>`);

    // Upper cabinet height
    const upperTopY = ceil - VERTICAL_ZONES.UPPER.yMin - upperH;
    elements.push(dimLineVert(rightDimX, upperTopY, rightDimX, backsplashY, formatDim(upperH)));
    // Zone label: UPPER
    const upperMidY = (upperTopY + backsplashY) / 2;
    elements.push(`<text x="${s(rightLabelX)}" y="${s(upperMidY)}" style="font-size:6px;fill:#888;font-style:italic;" dominant-baseline="middle">UPPER 13"d</text>`);

    // Ceiling clearance (if any)
    if (ceilingClearanceH > 0) {
      elements.push(dimLineVert(rightDimX, 0, rightDimX, upperTopY, formatDim(ceilingClearanceH)));
    }

    // Scale notation in footer (Rec #1)
    const scaleTextX = wallLength / 2;
    const scaleTextY = ceil + DIM_OFFSET * 2;
    elements.push(`<text x="${s(scaleTextX)}" y="${s(scaleTextY)}" text-anchor="middle" style="font-size:7px;fill:#666;font-style:italic;">Scale: ½" = 1'-0" (NKBA)</text>`);
  }

  // Compute SVG size (extra space for dims on all sides)
  const svgW = s(wallLength) + margin * 2 + (showDimensions ? 60 : 0);
  const svgH = s(ceil) + margin * 2 + (showDimensions ? 70 : 0);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="background:white">\n`;
  svg += `<style>text{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:${FONT_SIZE}px;fill:#333;}</style>\n`;
  // Title
  svg += `<text x="${svgW / 2}" y="20" text-anchor="middle" style="font-size:14px;font-weight:600;fill:#222;">${esc(elevTitle)}</text>\n`;
  svg += `<g transform="translate(${margin + (showDimensions ? 20 : 0)},${margin + 14})">\n`;

  for (const el of elements) {
    svg += `  ${el}\n`;
  }

  // KEY PLAN INSET (Rec #5) — top-right corner
  if (allWalls && allWalls.length > 0) {
    const keyPlanSize = 120;
    const keyPlanX = svgW - keyPlanSize - 30;
    const keyPlanY = 30;

    svg += `</g>\n`;
    svg += `<g transform="translate(${keyPlanX}, ${keyPlanY})">\n`;
    svg += `<rect width="${keyPlanSize}" height="${keyPlanSize}" fill="white" stroke="#999" stroke-width="1.5" />\n`;

    // Build miniature floor plan showing wall lines
    // Find bounding box for walls
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const wallConfigs = [];
    const buildWallConfigForKeyPlan = buildWallConfig(allWalls, layoutType);

    for (const wall of allWalls) {
      const cfg = buildWallConfigForKeyPlan[wall.id];
      if (!cfg) continue;
      wallConfigs.push({ wall, cfg });
      const endX = cfg.ox + cfg.dx * wall.length;
      const endY = cfg.oy + cfg.dy * wall.length;
      minX = Math.min(minX, cfg.ox, endX);
      minY = Math.min(minY, cfg.oy, endY);
      maxX = Math.max(maxX, cfg.ox, endX);
      maxY = Math.max(maxY, cfg.oy, endY);
    }

    // Calculate scale to fit in key plan
    const kpPadding = 5;
    const kpWidth = keyPlanSize - kpPadding * 2;
    const kpHeight = keyPlanSize - kpPadding * 2;
    const wallBboxW = maxX - minX || 1;
    const wallBboxH = maxY - minY || 1;
    const kpScale = Math.min(kpWidth / wallBboxW, kpHeight / wallBboxH);

    // Draw walls in key plan
    for (const { wall, cfg } of wallConfigs) {
      const isCurrentWall = wall.id === wallId;
      const startX = (cfg.ox - minX) * kpScale + kpPadding;
      const startY = (cfg.oy - minY) * kpScale + kpPadding;
      const endX = startX + cfg.dx * wall.length * kpScale;
      const endY = startY + cfg.dy * wall.length * kpScale;

      const lineStroke = isCurrentWall ? '#1a56db' : '#ddd';
      const lineWidth = isCurrentWall ? 3 : 1;
      svg += `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${lineStroke}" stroke-width="${lineWidth}" />\n`;
    }

    svg += `<text x="${keyPlanSize / 2}" y="${keyPlanSize + 12}" text-anchor="middle" style="font-size:7px;fill:#666;font-weight:bold;">KEY PLAN</text>\n`;
    svg += `</g>\n`;
    svg += `<g transform="translate(${margin + (showDimensions ? 20 : 0)},${margin + 14})">\n`;
  } else {
    svg += `</g>\n`;
    svg += `<g transform="translate(${margin + (showDimensions ? 20 : 0)},${margin + 14})">\n`;
  }

  // Cyncly-style footer: design note + branding
  const footerY = s(ceil) + margin + 30;
  svg += `</g>\n`;
  svg += `<text x="10" y="${svgH - 12}" style="font-size:7px;fill:#999;font-style:italic;">Note: This drawing is an artistic interpretation of the general appearance of the design.</text>\n`;
  svg += `<text x="${svgW - 10}" y="${svgH - 12}" text-anchor="end" style="font-size:7px;fill:#999;">Eclipse Kitchen Designer</text>\n`;

  svg += `</svg>`;
  return svg;
}


// ─── BILL OF MATERIALS ─────────────────────────────────────────────────────

/**
 * Generate a structured bill of materials from a solve() result.
 *
 * @param {Object} layout - Result from solve()
 * @returns {Object} { items: [...], summary, svgTable }
 */
export function generateBOM(layout, bomOpts = {}) {
  const placements = layout.placements || [];

  // Aggregate by SKU
  const skuMap = new Map();

  for (const p of placements) {
    const sku = p.sku || p.applianceType || 'UNKNOWN';
    if (!skuMap.has(sku)) {
      skuMap.set(sku, {
        sku,
        description: descriptionFromPlacement(p),
        type: p.type || p.role || 'cabinet',
        width: p.width || 0,
        height: p.height || null,
        qty: 0,
        walls: new Set(),
        mods: [],
      });
    }
    const entry = skuMap.get(sku);
    entry.qty++;
    if (p.wall) entry.walls.add(p.wall);
    if (p.mods && Array.isArray(p.mods)) {
      entry.mods.push(...p.mods);
    }
  }

  // ── Auto-add trim/molding accessories based on layout ──
  const trimPrefs = bomOpts.trim || layout._trimPrefs || {};
  const wallCount = (layout.walls || []).length;
  const hasUppers = (layout.uppers || []).some(u => u.cabinets && u.cabinets.length > 0);
  const totalUpperRun = (layout.uppers || []).reduce((sum, u) =>
    sum + (u.cabinets || []).reduce((s, c) => s + (c.width || 0), 0), 0);
  const totalBaseRun = (layout.walls || []).reduce((sum, w) =>
    sum + (w.cabinets || []).reduce((s, c) => s + (c.width || 0), 0), 0);

  // Toe kick (included with order, no extra charge)
  if (trimPrefs.toeKick !== false) {
    const tkPieces = Math.ceil(totalBaseRun / 96); // 8' pieces
    if (tkPieces > 0) {
      skuMap.set('TK-N/C', {
        sku: 'TK-N/C', description: 'Toe Kick N/C (Inc w/ Order)',
        type: 'trim', width: 96, height: null, qty: tkPieces,
        walls: new Set(), mods: [],
      });
    }
  }

  // Crown molding
  if (trimPrefs.crown !== false && hasUppers) {
    const crownPieces = Math.ceil(totalUpperRun / 120); // 10' pieces
    if (crownPieces > 0) {
      const crownSku = trimPrefs.crownProfile === 'furniture' ? "3FCR -10'" : "3 1/2CRN -10'";
      const crownDesc = trimPrefs.crownProfile === 'furniture' ? 'Furniture Crown Mould @10\'' : 'Crown Mould @10\'';
      skuMap.set(crownSku, {
        sku: crownSku, description: crownDesc,
        type: 'trim', width: 120, height: null, qty: crownPieces,
        walls: new Set(), mods: [],
      });
    }
  }

  // Light rail
  if (trimPrefs.lightRail !== false && hasUppers) {
    const lrPieces = Math.ceil(totalUpperRun / 96); // 8' pieces
    if (lrPieces > 0) {
      skuMap.set('1 3/4 UCA', {
        sku: '1 3/4 UCA', description: 'Under Cabinet Light Rail @96"',
        type: 'trim', width: 96, height: null, qty: lrPieces,
        walls: new Set(), mods: [],
      });
    }
  }

  // Traditional trim (if specified)
  if (trimPrefs.traditionalTrim) {
    const tdPieces = Math.ceil(totalBaseRun / 96);
    if (tdPieces > 0) {
      skuMap.set("7/8TD -8'", {
        sku: "7/8TD -8'", description: 'Traditional Trim @8\'',
        type: 'trim', width: 96, height: null, qty: tdPieces,
        walls: new Set(), mods: [],
      });
    }
  }

  const items = Array.from(skuMap.values()).map(e => ({
    sku: e.sku,
    description: e.description,
    type: e.type,
    width: e.width,
    height: e.height,
    qty: e.qty,
    walls: Array.from(e.walls).join(', '),
    mods: e.mods.length > 0 ? e.mods : undefined,
  }));

  // Sort: corners first, then bases, uppers, talls, accessories
  const typeOrder = { corner: 0, base: 1, appliance: 2, upper: 3, tall: 4, accessory: 5, filler: 6, rep: 7, trim: 8 };
  items.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9) || a.sku.localeCompare(b.sku));

  const summary = {
    totalLineItems: items.length,
    totalPieces: items.reduce((sum, i) => sum + i.qty, 0),
    byType: {},
  };
  for (const item of items) {
    if (!summary.byType[item.type]) summary.byType[item.type] = { count: 0, qty: 0 };
    summary.byType[item.type].count++;
    summary.byType[item.type].qty += item.qty;
  }

  // Generate SVG table
  const svgTable = renderBOMTable(items, summary);

  return { items, summary, svgTable };
}


// ─── RENDER ORCHESTRATOR ───────────────────────────────────────────────────

/**
 * Render all views for a solve() result — floor plan, all elevations, and BOM.
 *
 * @param {Object} layout - Result from solve()
 * @param {Object} [opts] - Render options
 * @returns {Object} { floorPlan, elevations: { [wallId]: svgString }, bom }
 */
// ─── SPECIFICATION SHEET (Rec #3) ──────────────────────────────────────────
/**
 * Generate a professional specification sheet as HTML.
 * @param {Object} layout - Result from solve()
 * @param {Object} pricing - Optional pricing data
 * @returns {string} HTML markup
 */
export function renderSpecSheet(layout, pricing = null) {
  const placements = layout.placements || [];
  const inputWalls = layout._inputWalls || [];

  // Group by wall
  const byWall = {};
  for (const p of placements) {
    const wallId = p.wall || p.wallId || 'Island';
    if (!byWall[wallId]) byWall[wallId] = [];
    byWall[wallId].push(p);
  }

  let html = `<div class="spec-sheet" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#333;">
  <div style="background:#1a3c6e;color:white;padding:14px 20px;text-align:center;margin-bottom:16px;">
    <div style="font-size:18px;font-weight:600;">Eclipse Cabinetry — Cabinet Specification Sheet</div>
  </div>

  <div style="background:#f5eed8;border-left:4px solid #1a3c6e;padding:10px 14px;margin-bottom:16px;font-size:12px;">
    <p style="margin:3px 0;"><strong>Client:</strong> ${esc(layout.clientName || 'TBD')}</p>
    <p style="margin:3px 0;"><strong>Designer:</strong> ${esc(layout.designerName || 'TBD')}</p>
    <p style="margin:3px 0;"><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
    <p style="margin:3px 0;"><strong>Layout Type:</strong> ${esc(layout.layoutType || 'Single-Wall')}</p>
  </div>
`;

  let lineNo = 1;
  let grandTotal = 0;

  // Process each wall
  const wallOrder = ['north', 'east', 'south', 'west'];
  const sortedWalls = Object.keys(byWall).sort((a, b) => {
    const aIdx = wallOrder.indexOf(a.toLowerCase());
    const bIdx = wallOrder.indexOf(b.toLowerCase());
    return (aIdx >= 0 ? aIdx : 999) - (bIdx >= 0 ? bIdx : 999);
  });

  for (const wallId of sortedWalls) {
    const placements = byWall[wallId];
    const wallDef = inputWalls.find(w => w.id === wallId);
    const wallName = wallDef ? `Wall ${wallId}${wallDef.length ? ` (${formatDim(wallDef.length)})` : ''}` : wallId;

    html += `
  <div style="margin-top:16px;">
    <h3 style="color:#1a3c6e;font-size:13px;margin:12px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px;">${esc(wallName)}</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px;">
      <tr>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Line#</th>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Qty</th>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">SKU</th>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Description</th>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">W×H×D</th>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Door Style</th>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Modifications</th>
        <th style="background:#e0d8c8;text-align:right;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Unit Price</th>
        <th style="background:#e0d8c8;text-align:right;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Ext. Price</th>
      </tr>
`;

    let wallSubtotal = 0;
    for (const p of placements) {
      const desc = descriptionFromPlacement(p);
      const width = p.width ? formatDim(p.width) : '—';
      const height = p.height ? formatDim(p.height) : '—';
      const depth = (p.type === 'upper' || p.role === 'upper') ? formatDim(DIMS.upperDepth) : formatDim(DIMS.baseDepth);
      const dims = `${width}×${height}×${depth}`;
      const doorStyle = (p.sku && p.sku.includes('3D')) ? '3-Drawer' : (p.sku && p.sku.includes('SB')) ? 'Sink' : (p.width >= 30) ? 'Double' : 'Single';
      const mods = (p.mods && p.mods.length) ? p.mods.join(', ') : '—';
      const unitPrice = pricing && pricing[p.sku] ? pricing[p.sku] : '—';
      const qty = 1;  // Each placement is a single cabinet
      const extPrice = (typeof unitPrice === 'number') ? (unitPrice * qty).toFixed(2) : '—';

      if (typeof extPrice === 'string' && extPrice !== '—') {
        wallSubtotal += parseFloat(extPrice);
        grandTotal += parseFloat(extPrice);
      }

      const rowBg = lineNo % 2 === 0 ? '#f9f7f3' : '#fff';
      html += `
      <tr style="background:${rowBg};">
        <td style="padding:5px 8px;border-bottom:1px solid #eee;">${lineNo++}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;">1</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;font-weight:500;">${esc(p.sku || '—')}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;">${esc(desc)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;">${esc(dims)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;">${esc(doorStyle)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;">${esc(mods)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;">${typeof unitPrice === 'number' ? '$' + unitPrice.toFixed(2) : unitPrice}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:right;">${extPrice !== '—' ? '$' + extPrice : '—'}</td>
      </tr>
`;
    }

    html += `
      <tr style="background:#e0d8c8;font-weight:600;">
        <td colspan="8" style="padding:6px 8px;text-align:right;">Wall Subtotal:</td>
        <td style="padding:6px 8px;text-align:right;">${wallSubtotal > 0 ? '$' + wallSubtotal.toFixed(2) : '—'}</td>
      </tr>
    </table>
  </div>
`;
  }

  // Accessories section
  html += `
  <div style="margin-top:16px;">
    <h3 style="color:#1a3c6e;font-size:13px;margin:12px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px;">Accessories & Trim</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:11px;">
      <tr>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Line#</th>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Qty</th>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">SKU</th>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Description</th>
        <th style="background:#e0d8c8;text-align:left;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;" colspan="4">—</th>
        <th style="background:#e0d8c8;text-align:right;padding:6px 8px;border-bottom:2px solid #1a3c6e;font-weight:600;">Ext. Price</th>
      </tr>
      <tr>
        <td colspan="9" style="text-align:center;color:#999;padding:16px;font-style:italic;">Trim and molding included with order (toe kick, crown, light rail)</td>
      </tr>
    </table>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-top:15px;font-size:11px;">
    <tr style="background:#1a3c6e;color:white;font-weight:700;font-size:12px;">
      <td style="padding:8px;text-align:right;color:white;" colspan="8">GRAND TOTAL:</td>
      <td style="padding:8px;text-align:right;color:white;">${grandTotal > 0 ? '$' + grandTotal.toFixed(2) : '—'}</td>
    </tr>
  </table>

  <div style="font-size:9px;color:#999;margin-top:16px;border-top:1px solid #ddd;padding-top:8px;text-align:center;font-style:italic;">
    Pricing subject to final dealer confirmation. Generated by Eclipse Kitchen Designer.
  </div>
</div>`;

  return html;
}


// ─── COVER PAGE (Rec #4) ────────────────────────────────────────────────────
/**
 * Generate a professional cover page as an HTML fragment (div, NOT full document).
 * Embeds a miniature floor plan SVG instead of a broken isometric view.
 * @param {Object} layout - Result from solve()
 * @param {Object} opts - Options: { projectName, clientName, designerName }
 * @returns {string} HTML fragment (a <div>, NOT a full <!DOCTYPE html> document)
 */
export function renderCoverPage(layout, opts = {}) {
  const {
    projectName = 'Kitchen Design Package',
    clientName = layout.clientName || 'Client Name',
    designerName = layout.designerName || 'Designer Name',
  } = opts;

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Collect stats
  const totalCabinets = (layout.placements || []).length;
  const wallCount = (layout.walls || []).length;
  const totalLinearFeet = (layout._inputWalls || []).reduce((sum, w) => sum + (w.length || 0), 0) / 12;
  const layoutLabel = layout.layoutType ? layout.layoutType.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Single Wall';

  // Generate a clean miniature floor plan for the cover
  const miniFloorPlan = renderFloorPlan(layout, {
    title: '',
    showDimensions: false,
    showSkus: false,
    margin: 20,
  });

  return `<div class="cover-page" style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;background:white;max-width:8.5in;margin:0 auto;page-break-after:always;">
  <div style="background:#1a3c6e;color:white;padding:28px 40px;text-align:center;">
    <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:6px;opacity:0.85;">Eclipse Cabinetry</div>
    <div style="font-size:26px;font-weight:700;letter-spacing:0.5px;">Kitchen Design Package</div>
  </div>

  <div style="padding:36px 44px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:24px;font-weight:700;color:#1a3c6e;margin-bottom:6px;">${esc(projectName)}</div>
      <div style="font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase;">Design Documentation</div>
    </div>

    <div style="display:flex;gap:40px;margin-bottom:28px;">
      <div style="flex:1;">
        <table style="border-collapse:collapse;font-size:12px;width:100%;">
          <tr><td style="padding:6px 0;color:#888;width:80px;">Client</td><td style="padding:6px 0;font-weight:600;">${esc(clientName)}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">Designer</td><td style="padding:6px 0;font-weight:600;">${esc(designerName)}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">Date</td><td style="padding:6px 0;">${esc(today)}</td></tr>
          <tr><td style="padding:6px 0;color:#888;">Layout</td><td style="padding:6px 0;">${esc(layoutLabel)}</td></tr>
        </table>
      </div>
      <div style="flex:1;display:flex;gap:12px;justify-content:center;">
        <div style="text-align:center;padding:10px 16px;background:#f7f5f0;border-radius:6px;">
          <div style="font-size:28px;font-weight:700;color:#1a3c6e;">${totalCabinets}</div>
          <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Cabinets</div>
        </div>
        <div style="text-align:center;padding:10px 16px;background:#f7f5f0;border-radius:6px;">
          <div style="font-size:28px;font-weight:700;color:#1a3c6e;">${wallCount}</div>
          <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Walls</div>
        </div>
        <div style="text-align:center;padding:10px 16px;background:#f7f5f0;border-radius:6px;">
          <div style="font-size:28px;font-weight:700;color:#1a3c6e;">${totalLinearFeet.toFixed(0)}'</div>
          <div style="font-size:9px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Linear Ft</div>
        </div>
      </div>
    </div>

    <div style="border:1px solid #e0dcd4;border-radius:6px;padding:16px;background:#fafaf8;text-align:center;">
      <div style="font-size:9px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Floor Plan Preview</div>
      <div style="max-height:320px;overflow:hidden;">${miniFloorPlan}</div>
    </div>

    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e8e4dc;display:flex;justify-content:space-between;font-size:9px;color:#aaa;">
      <span>For precise measurements, refer to elevation and floor plan drawings.</span>
      <span>Eclipse Kitchen Designer</span>
    </div>
  </div>
</div>`;
}


export function renderLayout(layout, opts = {}) {
  const floorPlan = renderFloorPlan(layout, {
    title: opts.title || `${(layout.layoutType || 'Kitchen').replace(/-/g, ' ')} — Floor Plan`,
    showDimensions: opts.showDimensions !== false,
    showSkus: opts.showSkus !== false,
  });

  const elevations = {};
  const wallIds = (layout.walls || []).map(wl => wl.wallId);
  for (const wid of wallIds) {
    elevations[wid] = renderElevation(layout, wid, {
      showDimensions: opts.showDimensions !== false,
      showSkus: opts.showSkus !== false,
      trim: opts.trim || { toeKick: true, crown: true, lightRail: true, countertopEdge: true },
      allWalls: layout._inputWalls || [],
      layoutType: layout.layoutType || 'single-wall',
    });
  }

  const bom = generateBOM(layout);
  const specSheet = renderSpecSheet(layout, opts.pricing || null);
  const coverPage = renderCoverPage(layout, opts);

  return { coverPage, floorPlan, elevations, specSheet, bom };
}


// ─── PRIVATE SVG PRIMITIVES ────────────────────────────────────────────────

function svgRect(rect, fill) {
  return `<rect x="${s(rect.x)}" y="${s(rect.y)}" width="${s(rect.w)}" height="${s(rect.h)}" fill="${fill}" stroke="${STROKE_CAB}" stroke-width="0.6" />`;
}

function svgLabel(rect, text) {
  const cx = s(rect.x + rect.w / 2);
  const cy = s(rect.y + rect.h / 2);
  const maxChars = Math.max(3, Math.floor(rect.w / 3));
  const label = text.length > maxChars ? text.slice(0, maxChars) : text;
  const fontSize = Math.min(FONT_SIZE, Math.max(6, rect.w * SCALE / label.length * 0.8));
  return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" style="font-size:${Math.round(fontSize)}px;">${esc(label)}</text>`;
}

// ─── APPLIANCE SYMBOLS (floor plan overlays) ────────────────────────────────

/**
 * Generate SVG symbols for appliances in the floor plan.
 * These are drawn ON TOP of the colored rectangle to give visual identity.
 * @param {Object} rect - { x, y, w, h } in unscaled inches
 * @param {string} applianceType - e.g. 'range', 'sink', 'refrigerator', 'dishwasher', 'hood', etc.
 * @returns {string} SVG markup
 */
function applianceSymbol(rect, applianceType) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const elements = [];

  switch (applianceType) {
    case 'range':
    case 'cooktop': {
      // Burner circles — 4 burners for 30"+ ranges, scaled to width
      const burnerR = Math.min(rect.w, rect.h) * 0.14;
      const cols = rect.w >= 36 ? 3 : 2;
      const rows = 2;
      const spacingX = rect.w / (cols + 1);
      const spacingY = rect.h / (rows + 1);
      for (let r = 1; r <= rows; r++) {
        for (let c = 1; c <= cols; c++) {
          const bx = rect.x + spacingX * c;
          const by = rect.y + spacingY * r;
          elements.push(`<circle cx="${s(bx)}" cy="${s(by)}" r="${s(burnerR)}" fill="none" stroke="#999" stroke-width="0.6" />`);
          elements.push(`<circle cx="${s(bx)}" cy="${s(by)}" r="${s(burnerR * 0.4)}" fill="none" stroke="#bbb" stroke-width="0.4" />`);
        }
      }
      break;
    }
    case 'sink': {
      // Sink basin — double bowl with divider
      const pad = Math.min(rect.w, rect.h) * 0.12;
      const bx = rect.x + pad;
      const by = rect.y + pad;
      const bw = rect.w - pad * 2;
      const bh = rect.h - pad * 2;
      const bowlW = (bw - 1) / 2;
      elements.push(`<rect x="${s(bx)}" y="${s(by)}" width="${s(bowlW)}" height="${s(bh)}" rx="${s(2)}" fill="none" stroke="#999" stroke-width="0.6" />`);
      elements.push(`<rect x="${s(bx + bowlW + 1)}" y="${s(by)}" width="${s(bowlW)}" height="${s(bh)}" rx="${s(2)}" fill="none" stroke="#999" stroke-width="0.6" />`);
      // Drain dots
      elements.push(`<circle cx="${s(bx + bowlW / 2)}" cy="${s(by + bh / 2)}" r="${s(1)}" fill="#aaa" />`);
      elements.push(`<circle cx="${s(bx + bowlW + 1 + bowlW / 2)}" cy="${s(by + bh / 2)}" r="${s(1)}" fill="#aaa" />`);
      break;
    }
    case 'refrigerator':
    case 'freezer':
    case 'wineColumn': {
      // Floor plan: simple footprint with X cross (Cyncly style)
      // Door swings only shown on elevation views, not floor plans
      elements.push(`<line x1="${s(rect.x + 1)}" y1="${s(rect.y + 1)}" x2="${s(rect.x + rect.w - 1)}" y2="${s(rect.y + rect.h - 1)}" stroke="#bbb" stroke-width="0.5" />`);
      elements.push(`<line x1="${s(rect.x + rect.w - 1)}" y1="${s(rect.y + 1)}" x2="${s(rect.x + 1)}" y2="${s(rect.y + rect.h - 1)}" stroke="#bbb" stroke-width="0.5" />`);
      break;
    }
    case 'dishwasher': {
      // Floor plan: simple DW label (Cyncly style — no door profile on plan)
      elements.push(`<text x="${s(cx)}" y="${s(cy)}" text-anchor="middle" dominant-baseline="central" style="font-size:8px;fill:#888;font-weight:600;">DW</text>`);
      break;
    }
    case 'hood': {
      // Vent fan symbol — concentric circle with radiating lines
      const r = Math.min(rect.w, rect.h) * 0.3;
      elements.push(`<circle cx="${s(cx)}" cy="${s(cy)}" r="${s(r)}" fill="none" stroke="#999" stroke-width="0.5" />`);
      elements.push(`<circle cx="${s(cx)}" cy="${s(cy)}" r="${s(r * 0.4)}" fill="none" stroke="#bbb" stroke-width="0.4" />`);
      for (let a = 0; a < 360; a += 60) {
        const rad = a * Math.PI / 180;
        elements.push(`<line x1="${s(cx + Math.cos(rad) * r * 0.45)}" y1="${s(cy + Math.sin(rad) * r * 0.45)}" x2="${s(cx + Math.cos(rad) * r * 0.9)}" y2="${s(cy + Math.sin(rad) * r * 0.9)}" stroke="#bbb" stroke-width="0.4" />`);
      }
      break;
    }
    case 'wallOven':
    case 'speedOven':
    case 'steamOven': {
      // Floor plan: simple outline with "OVEN" label (door detail only on elevation)
      const pad = Math.min(rect.w, rect.h) * 0.12;
      elements.push(`<rect x="${s(rect.x + pad)}" y="${s(rect.y + pad)}" width="${s(rect.w - pad * 2)}" height="${s(rect.h - pad * 2)}" rx="${s(1)}" fill="none" stroke="#999" stroke-width="0.5" />`);
      break;
    }
    case 'wineCooler':
    case 'beverageCenter':
    case 'iceMaker': {
      // Horizontal shelf lines
      const pad = Math.min(rect.w, rect.h) * 0.15;
      const shelves = 3;
      const innerH = rect.h - pad * 2;
      for (let i = 1; i <= shelves; i++) {
        const sy = rect.y + pad + (innerH * i / (shelves + 1));
        elements.push(`<line x1="${s(rect.x + pad)}" y1="${s(sy)}" x2="${s(rect.x + rect.w - pad)}" y2="${s(sy)}" stroke="#bbb" stroke-width="0.4" />`);
      }
      break;
    }
    case 'warmingDrawer':
    case 'microwave': {
      // Horizontal lines (like heating waves)
      const waveCount = 3;
      const waveH = rect.h * 0.5;
      const startY = cy - waveH / 2;
      for (let i = 0; i < waveCount; i++) {
        const wy = startY + (waveH * i / (waveCount - 1));
        const amplitude = rect.w * 0.1;
        elements.push(`<path d="M ${s(rect.x + rect.w * 0.25)} ${s(wy)} Q ${s(cx - rect.w * 0.1)} ${s(wy - amplitude)} ${s(cx)} ${s(wy)} Q ${s(cx + rect.w * 0.1)} ${s(wy + amplitude)} ${s(rect.x + rect.w * 0.75)} ${s(wy)}" fill="none" stroke="#bbb" stroke-width="0.5" />`);
      }
      break;
    }
    default:
      break;
  }
  return elements.join('\n  ');
}

/**
 * Generate SVG for detailed, professional appliance symbols in elevation view.
 * @param {number} x - Left edge in inches
 * @param {number} y - Top edge in inches
 * @param {number} w - Width in inches
 * @param {number} h - Height in inches
 * @param {string} applianceType
 * @returns {string} SVG markup
 */
function elevApplianceSymbol(x, y, w, h, applianceType) {
  // CYNCLY STYLE: Clean line drawings showing essential appliance features
  // These overlay the cabinet outline — no filled shapes, just outline detail
  const cx = x + w / 2;
  const cy = y + h / 2;
  const elements = [];

  switch (applianceType) {
    case 'range':
    case 'cooktop': {
      // Burner/grate pattern: circles or grate lines
      const knobCount = w >= 36 ? 5 : 4;
      const knobR = 0.6;
      const topMargin = h * 0.15;
      for (let i = 0; i < knobCount; i++) {
        const kx = x + 2 + (w - 4) * (i + 0.5) / knobCount;
        const ky = y + topMargin;
        elements.push(`<circle cx="${s(kx)}" cy="${s(ky)}" r="${s(knobR)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.6" />`);
      }

      // Oven door window outline
      const doorPad = 1.5;
      const winY = y + h * 0.3;
      const winH = h * 0.35;
      elements.push(`<rect x="${s(x + doorPad)}" y="${s(winY)}" width="${s(w - doorPad * 2)}" height="${s(winH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.6" />`);
      break;
    }
    case 'refrigerator':
    case 'freezer':
    case 'wineColumn': {
      // Door seams and handle bars (vertical lines)
      const doorLineX = cx;
      const freezerLineY = y + h * 0.65;

      // Center vertical seam (door divider)
      elements.push(`<line x1="${s(doorLineX)}" y1="${s(y + 1)}" x2="${s(doorLineX)}" y2="${s(y + h - 1)}" stroke="${STROKE_CAB}" stroke-width="0.6" />`);

      // Horizontal freezer line
      elements.push(`<line x1="${s(x + 1)}" y1="${s(freezerLineY)}" x2="${s(x + w - 1)}" y2="${s(freezerLineY)}" stroke="${STROKE_CAB}" stroke-width="0.6" />`);

      // Left door handle (vertical bar)
      const handleL = doorLineX - w * 0.1;
      elements.push(`<line x1="${s(handleL)}" y1="${s(y + h * 0.25)}" x2="${s(handleL)}" y2="${s(y + h * 0.75)}" stroke="${STROKE_CAB}" stroke-width="0.7" stroke-linecap="round" />`);

      // Right door handle (vertical bar)
      const handleR = doorLineX + w * 0.1;
      elements.push(`<line x1="${s(handleR)}" y1="${s(y + h * 0.25)}" x2="${s(handleR)}" y2="${s(y + h * 0.75)}" stroke="${STROKE_CAB}" stroke-width="0.7" stroke-linecap="round" />`);
      break;
    }
    case 'dishwasher': {
      // Panel outline and top handle
      const panelPad = 1;
      elements.push(`<rect x="${s(x + panelPad)}" y="${s(y + panelPad)}" width="${s(w - panelPad * 2)}" height="${s(h - panelPad * 2)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.6" />`);

      // Handle bar at top
      const handleY = y + h * 0.1;
      elements.push(`<line x1="${s(x + w * 0.25)}" y1="${s(handleY)}" x2="${s(x + w * 0.75)}" y2="${s(handleY)}" stroke="${STROKE_CAB}" stroke-width="0.7" stroke-linecap="round" />`);
      break;
    }
    case 'hood': {
      // Hood: just text "HOOD BY OTHERS" centered in the zone
      elements.push(`<text x="${s(cx)}" y="${s(cy)}" text-anchor="middle" dominant-baseline="central" style="font-size:10px;fill:${STROKE_CAB};font-style:italic;">HOOD BY</text>`);
      elements.push(`<text x="${s(cx)}" y="${s(cy + 5)}" text-anchor="middle" dominant-baseline="central" style="font-size:10px;fill:${STROKE_CAB};font-style:italic;">OTHERS</text>`);
      break;
    }
    case 'wallOven':
    case 'speedOven':
    case 'steamOven': {
      // Double oven: two door outlines with divider
      const doorPad = 1;
      const dividerGap = 0.5;
      const halfH = (h - doorPad * 2 - dividerGap) / 2;

      // Top oven door outline
      elements.push(`<rect x="${s(x + doorPad)}" y="${s(y + doorPad)}" width="${s(w - doorPad * 2)}" height="${s(halfH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.6" />`);
      // Top oven window outline
      const winH = halfH * 0.35;
      elements.push(`<rect x="${s(x + doorPad + 1)}" y="${s(y + doorPad + 1)}" width="${s(w - doorPad * 2 - 2)}" height="${s(winH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.5" />`);

      // Bottom oven door outline
      const botY = y + doorPad + halfH + dividerGap;
      elements.push(`<rect x="${s(x + doorPad)}" y="${s(botY)}" width="${s(w - doorPad * 2)}" height="${s(halfH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.6" />`);
      // Bottom oven window outline
      elements.push(`<rect x="${s(x + doorPad + 1)}" y="${s(botY + 1)}" width="${s(w - doorPad * 2 - 2)}" height="${s(winH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.5" />`);
      break;
    }
    case 'sink': {
      // Sink: basin outline and faucet silhouette
      const pad = 2;
      const sinkW = w - pad * 2;
      const sinkH = h - pad * 2;

      // Basin outline
      elements.push(`<rect x="${s(x + pad)}" y="${s(y + pad)}" width="${s(sinkW)}" height="${s(sinkH * 0.7)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.6" />`);

      // Faucet (simple L-shape)
      const faucetX = cx;
      const faucetY = y + pad;
      const faucetH = sinkH * 0.4;
      elements.push(`<line x1="${s(faucetX)}" y1="${s(faucetY)}" x2="${s(faucetX)}" y2="${s(faucetY - faucetH)}" stroke="${STROKE_CAB}" stroke-width="0.6" stroke-linecap="round" />`);
      elements.push(`<line x1="${s(faucetX)}" y1="${s(faucetY - faucetH)}" x2="${s(faucetX + 2)}" y2="${s(faucetY - faucetH)}" stroke="${STROKE_CAB}" stroke-width="0.6" stroke-linecap="round" />`);
      break;
    }
    default:
      break;
  }
  return elements.join('\n  ');
}

function drawCabinetFace(x, y, w, h, cab, fill) {
  const els = [];
  const sku = cab ? (cab.sku || '') : '';
  const type = cab ? (cab.type || cab.role) : '';

  // CYNCLY STYLE: White cabinet with dark outline, clean line drawing (no gradients, no shadows)
  // Outer cabinet box
  els.push(`<rect x="${s(x)}" y="${s(y)}" width="${s(w)}" height="${s(h)}" fill="${fill}" stroke="${STROKE_CAB}" stroke-width="0.7" />`);

  // Cabinet-type-specific detail rendering
  if (w >= 9 && h >= 12) {
    // Determine cabinet type from SKU
    let drawerCount = 0;
    let isSinkBase = false;
    let isWasteTilt = false;
    let isDoubleDoor = false;
    let isSingleDoor = false;
    let isGlass = false;

    if (sku.includes('3D') || sku.includes('B3D') || sku.includes('4D') || sku.includes('B4D') || sku.includes('2HD')) {
      // Extract drawer count from SKU
      const match = sku.match(/[B]?(\d)D|(\d)HD/);
      drawerCount = match ? parseInt(match[1] || match[2] || '3') : 3;
    } else if (sku.includes('BPOS')) {
      drawerCount = 2; // BPOS is 2-drawer base with false front
    } else if (sku.startsWith('SB') || sku.startsWith('SBA')) {
      isSinkBase = true;
    } else if (sku.includes('BWDM')) {
      isWasteTilt = true;
    } else if ((sku.match(/GFD|WGD/) || type === 'wall_glass_display')) {
      isGlass = true;
    } else if (w >= 24 && sku.includes('B') && !sku.match(/[234]D|WD|BWDM/)) {
      isDoubleDoor = true;
    } else if (w < 24 && sku.includes('B') && !sku.match(/[234]D|WD|BWDM/)) {
      isSingleDoor = true;
    } else if (sku.startsWith('W') || type === 'upper' || type === 'wall') {
      // Upper cabinets follow door logic
      if (w >= 24) {
        isDoubleDoor = true;
      } else {
        isSingleDoor = true;
      }
    }

    // DRAWER BASES: Horizontal lines dividing drawers, each with centered bar pull
    if (drawerCount > 0) {
      const inset = 2;  // inset from cabinet edges to inner panel
      const usableH = h - inset * 2;
      const drawerH = usableH / drawerCount;

      for (let d = 0; d < drawerCount; d++) {
        const dy = y + inset + d * drawerH;

        // Inner panel rect (simple rectangle inset ~2")
        if (drawerH > 0.5) {
          els.push(`<rect x="${s(x + inset)}" y="${s(dy)}" width="${s(w - inset * 2)}" height="${s(drawerH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.7" />`);
        }

        // Horizontal bar pull (4-5" long, centered on each drawer)
        const pullW = Math.min(5, w - inset * 4);
        const pullX = x + w / 2;
        const pullY = dy + drawerH / 2;
        els.push(`<line x1="${s(pullX - pullW / 2)}" y1="${s(pullY)}" x2="${s(pullX + pullW / 2)}" y2="${s(pullY)}" stroke="${STROKE_CAB}" stroke-width="0.8" stroke-linecap="round" />`);
      }
    }
    // SINK BASE: False front at top, two door panels below
    else if (isSinkBase) {
      const falseFrontH = 3;  // 3" false front
      const inset = 2;

      // False front panel (no hardware)
      els.push(`<rect x="${s(x + inset)}" y="${s(y + inset)}" width="${s(w - inset * 2)}" height="${s(falseFrontH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.7" />`);

      // Two equal door panels below (with center stile)
      const stileW = 0.75;
      const doorStartY = y + inset + falseFrontH + 0.3;
      const doorH = h - inset * 2 - falseFrontH - 0.3;
      const doorW = (w - inset * 2 - stileW) / 2;

      // Left door
      if (doorW > 0 && doorH > 0) {
        els.push(`<rect x="${s(x + inset)}" y="${s(doorStartY)}" width="${s(doorW)}" height="${s(doorH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.7" />`);
      }

      // Right door
      if (doorW > 0 && doorH > 0) {
        els.push(`<rect x="${s(x + inset + doorW + stileW)}" y="${s(doorStartY)}" width="${s(doorW)}" height="${s(doorH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.7" />`);
      }

      // Center stile
      els.push(`<line x1="${s(x + inset + doorW)}" y1="${s(doorStartY)}" x2="${s(x + inset + doorW)}" y2="${s(doorStartY + doorH)}" stroke="${STROKE_CAB}" stroke-width="0.7" />`);
    }
    // WASTE/TILT-OUT: Tilt-out panel at top + door panel below
    else if (isWasteTilt) {
      const tiltH = 6;  // 6" tilt-out panel
      const inset = 2;

      // Tilt-out panel
      els.push(`<rect x="${s(x + inset)}" y="${s(y + inset)}" width="${s(w - inset * 2)}" height="${s(tiltH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.7" />`);

      // Door panel below
      const doorStartY = y + inset + tiltH + 0.3;
      const doorH = h - inset * 2 - tiltH - 0.3;

      if (doorH > 0) {
        els.push(`<rect x="${s(x + inset)}" y="${s(doorStartY)}" width="${s(w - inset * 2)}" height="${s(doorH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.7" />`);
      }
    }
    // GLASS FRONT: Cabinet with mullion grid pattern
    else if (isGlass) {
      const inset = 2;
      const innerW = w - inset * 2;
      const innerH = h - inset * 2;

      // Outer frame
      els.push(`<rect x="${s(x + inset)}" y="${s(y + inset)}" width="${s(innerW)}" height="${s(innerH)}" fill="${FILL_GLASS}" stroke="${STROKE_CAB}" stroke-width="0.7" />`);

      // Mullion grid (typical 3x3 with 2 vertical and 2 horizontal dividers)
      const vertCount = 2;  // vertical mullions
      const horizCount = 2; // horizontal mullions

      // Vertical mullions
      for (let i = 1; i <= vertCount; i++) {
        const mx = x + inset + (innerW * i / (vertCount + 1));
        els.push(`<line x1="${s(mx)}" y1="${s(y + inset)}" x2="${s(mx)}" y2="${s(y + h - inset)}" stroke="${STROKE_CAB}" stroke-width="0.6" />`);
      }

      // Horizontal mullions
      for (let i = 1; i <= horizCount; i++) {
        const my = y + inset + (innerH * i / (horizCount + 1));
        els.push(`<line x1="${s(x + inset)}" y1="${s(my)}" x2="${s(x + w - inset)}" y2="${s(my)}" stroke="${STROKE_CAB}" stroke-width="0.6" />`);
      }
    }
    // DOUBLE-DOOR: Two door panels with center stile
    else if (isDoubleDoor) {
      const inset = 2;
      const stileW = 0.75;
      const doorW = (w - inset * 2 - stileW) / 2;
      const doorH = h - inset * 2;

      // Left door
      if (doorW > 0) {
        els.push(`<rect x="${s(x + inset)}" y="${s(y + inset)}" width="${s(doorW)}" height="${s(doorH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.7" />`);

        // Bar pull on left door (near center, ~4" long)
        const pullW = 4;
        const pullY = y + doorH * 0.45;
        els.push(`<line x1="${s(x + inset + doorW - 2.5)}" y1="${s(pullY)}" x2="${s(x + inset + doorW - 0.5)}" y2="${s(pullY)}" stroke="${STROKE_CAB}" stroke-width="0.8" stroke-linecap="round" />`);
      }

      // Right door
      if (doorW > 0) {
        els.push(`<rect x="${s(x + inset + doorW + stileW)}" y="${s(y + inset)}" width="${s(doorW)}" height="${s(doorH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.7" />`);

        // Bar pull on right door (near center, ~4" long)
        const pullW = 4;
        const pullY = y + doorH * 0.45;
        els.push(`<line x1="${s(x + inset + doorW + stileW + 0.5)}" y1="${s(pullY)}" x2="${s(x + inset + doorW + stileW + 2.5)}" y2="${s(pullY)}" stroke="${STROKE_CAB}" stroke-width="0.8" stroke-linecap="round" />`);
      }

      // Center stile
      els.push(`<line x1="${s(x + inset + doorW)}" y1="${s(y + inset)}" x2="${s(x + inset + doorW)}" y2="${s(y + h - inset)}" stroke="${STROKE_CAB}" stroke-width="0.7" />`);
    }
    // SINGLE-DOOR: One door panel with bar pull
    else if (isSingleDoor) {
      const inset = 2;
      const doorW = w - inset * 2;
      const doorH = h - inset * 2;

      // Outer frame
      els.push(`<rect x="${s(x + inset)}" y="${s(y + inset)}" width="${s(doorW)}" height="${s(doorH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.7" />`);

      // Bar pull (centered, ~4-5" long)
      const pullW = Math.min(5, doorW - 4);
      const pullX = x + w / 2;
      const pullY = y + doorH * 0.45; // slightly above center
      els.push(`<line x1="${s(pullX - pullW / 2)}" y1="${s(pullY)}" x2="${s(pullX + pullW / 2)}" y2="${s(pullY)}" stroke="${STROKE_CAB}" stroke-width="0.8" stroke-linecap="round" />`);
    }
    // FALLBACK: Simple cabinet outline
    else {
      const inset = 2;
      const doorCount = w >= 30 ? 2 : 1;
      const stileW = doorCount > 1 ? 0.75 : 0;
      const doorW = (w - inset * 2 - stileW) / doorCount;
      const doorH = h - inset * 2;

      for (let d = 0; d < doorCount; d++) {
        const dx = x + inset + d * (doorW + stileW);
        const dy = y + inset;

        // Door outline
        els.push(`<rect x="${s(dx)}" y="${s(dy)}" width="${s(doorW)}" height="${s(doorH)}" fill="none" stroke="${STROKE_CAB}" stroke-width="0.7" />`);
      }

      // Center stile if double-door
      if (doorCount > 1 && doorW > 0) {
        els.push(`<line x1="${s(x + inset + doorW)}" y1="${s(y + inset)}" x2="${s(x + inset + doorW)}" y2="${s(y + h - inset)}" stroke="${STROKE_CAB}" stroke-width="0.7" />`);
      }
    }
  }

  return els.join('\n  ');
}

function elevRect(x, y, w, h, fill, opts = {}) {
  // Legacy wrapper for compatibility — delegates to drawCabinetFace with minimal cabinet info
  return drawCabinetFace(x, y, w, h, { sku: '', type: 'base' }, fill);
}

function elevLabel(x, y, w, h, text) {
  const cx = s(x + w / 2);
  const cy = s(y + h / 2);
  const maxChars = Math.max(3, Math.floor(w / 2.5));
  const label = text.length > maxChars ? text.slice(0, maxChars) : text;
  const fontSize = Math.min(FONT_SIZE, Math.max(6, w * SCALE / label.length * 0.7));
  return `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" style="font-size:${Math.round(fontSize)}px;">${esc(label)}</text>`;
}

function dimText(x, y, label) {
  return `<text x="${s(x)}" y="${s(y)}" text-anchor="middle" style="font-size:${FONT_SIZE - 1}px;fill:${DIM_COLOR};font-weight:500;">${esc(label)}</text>`;
}

function dimLine(x1, y1, x2, y2, label) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const arrowSize = 3 / SCALE;
  return [
    // Main dimension line
    `<line x1="${s(x1)}" y1="${s(y1)}" x2="${s(x2)}" y2="${s(y2)}" stroke="${DIM_COLOR}" stroke-width="0.6" />`,
    // Extension lines (vertical ticks)
    `<line x1="${s(x1)}" y1="${s(y1 - DIM_TICK / SCALE)}" x2="${s(x1)}" y2="${s(y1 + DIM_TICK / SCALE)}" stroke="${DIM_COLOR}" stroke-width="0.6" />`,
    `<line x1="${s(x2)}" y1="${s(y2 - DIM_TICK / SCALE)}" x2="${s(x2)}" y2="${s(y2 + DIM_TICK / SCALE)}" stroke="${DIM_COLOR}" stroke-width="0.6" />`,
    // Arrowheads (small filled triangles)
    `<polygon points="${s(x1)},${s(y1)} ${s(x1 + arrowSize)},${s(y1 - arrowSize * 0.6)} ${s(x1 + arrowSize)},${s(y1 + arrowSize * 0.6)}" fill="${DIM_COLOR}" />`,
    `<polygon points="${s(x2)},${s(y2)} ${s(x2 - arrowSize)},${s(y2 - arrowSize * 0.6)} ${s(x2 - arrowSize)},${s(y2 + arrowSize * 0.6)}" fill="${DIM_COLOR}" />`,
    // Label with white background for readability
    `<rect x="${s(mx) - 18}" y="${s(my - 4)}" width="36" height="12" fill="white" opacity="0.85" />`,
    `<text x="${s(mx)}" y="${s(my + 3)}" text-anchor="middle" style="font-size:${FONT_SIZE - 1}px;fill:${DIM_COLOR};font-weight:500;">${esc(label)}</text>`,
  ].join('\n    ');
}

function dimLineVert(x1, y1, x2, y2, label) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const arrowSize = 3 / SCALE;
  return [
    `<line x1="${s(x1)}" y1="${s(y1)}" x2="${s(x2)}" y2="${s(y2)}" stroke="${DIM_COLOR}" stroke-width="0.6" />`,
    `<line x1="${s(x1 - DIM_TICK / SCALE)}" y1="${s(y1)}" x2="${s(x1 + DIM_TICK / SCALE)}" y2="${s(y1)}" stroke="${DIM_COLOR}" stroke-width="0.6" />`,
    `<line x1="${s(x2 - DIM_TICK / SCALE)}" y1="${s(y2)}" x2="${s(x2 + DIM_TICK / SCALE)}" y2="${s(y2)}" stroke="${DIM_COLOR}" stroke-width="0.6" />`,
    // Arrowheads
    `<polygon points="${s(x1)},${s(y1)} ${s(x1 - arrowSize * 0.6)},${s(y1 + arrowSize)} ${s(x1 + arrowSize * 0.6)},${s(y1 + arrowSize)}" fill="${DIM_COLOR}" />`,
    `<polygon points="${s(x2)},${s(y2)} ${s(x2 - arrowSize * 0.6)},${s(y2 - arrowSize)} ${s(x2 + arrowSize * 0.6)},${s(y2 - arrowSize)}" fill="${DIM_COLOR}" />`,
    `<text x="${s(mx + 4)}" y="${s(my)}" text-anchor="start" style="font-size:${FONT_SIZE - 1}px;fill:${DIM_COLOR};font-weight:500;" transform="rotate(-90 ${s(mx + 4)} ${s(my)})">${esc(label)}</text>`,
  ].join('\n    ');
}


// ─── FLOOR PLAN WALL CONFIG ────────────────────────────────────────────────

/**
 * Build a 2D wall configuration for floor plan rendering.
 * Maps each wall ID to { ox, oy, dx, dy } where:
 *   ox/oy = origin of wall in 2D floor plan coords
 *   dx/dy = unit direction vector along the wall
 *   nx/ny = normal vector (perpendicular, into room)
 */
function buildWallConfig(walls, layoutType) {
  const config = {};

  if (layoutType === 'single-wall' && walls.length >= 1) {
    config[walls[0].id] = { ox: 0, oy: 0, dx: 1, dy: 0 };
  } else if (layoutType === 'l-shape' && walls.length >= 2) {
    config[walls[0].id] = { ox: 0, oy: 0, dx: 1, dy: 0 };   // Wall A runs right
    config[walls[1].id] = { ox: walls[0].length, oy: 0, dx: 0, dy: 1 }; // Wall B runs down
  } else if (layoutType === 'u-shape' && walls.length >= 3) {
    config[walls[0].id] = { ox: 0, oy: 0, dx: 1, dy: 0 };
    config[walls[1].id] = { ox: walls[0].length, oy: 0, dx: 0, dy: 1 };
    config[walls[2].id] = { ox: walls[0].length, oy: walls[1].length, dx: -1, dy: 0 };
  } else if ((layoutType === 'galley' || layoutType === 'galley-peninsula') && walls.length >= 2) {
    config[walls[0].id] = { ox: 0, oy: 0, dx: 1, dy: 0 };
    config[walls[1].id] = { ox: 0, oy: DIMS.baseDepth + 42, dx: 1, dy: 0 }; // 42" walkway
  } else if (layoutType === 'g-shape' && walls.length >= 4) {
    config[walls[0].id] = { ox: 0, oy: 0, dx: 1, dy: 0 };
    config[walls[1].id] = { ox: walls[0].length, oy: 0, dx: 0, dy: 1 };
    config[walls[2].id] = { ox: walls[0].length, oy: walls[1].length, dx: -1, dy: 0 };
    config[walls[3].id] = { ox: walls[0].length - walls[2].length, oy: walls[1].length, dx: 0, dy: -1 };
  } else {
    // Fallback: arrange walls sequentially turning right
    let ox = 0, oy = 0, dx = 1, dy = 0;
    for (const wall of walls) {
      config[wall.id] = { ox, oy, dx, dy };
      ox += dx * wall.length;
      oy += dy * wall.length;
      // Turn right: (dx,dy) → (dy, -dx) for floor plan (Y down)
      [dx, dy] = [-dy, dx];
    }
  }

  return config;
}


/**
 * Convert a cabinet position on a wall to a floor-plan rectangle.
 */
function cabinetRectOnWall(cfg, runPos, width, depth) {
  const { ox, oy, dx, dy } = cfg;
  // Position along wall
  const x = ox + dx * runPos;
  const y = oy + dy * runPos;
  // Normal direction (perpendicular, into room)
  const nx = -dy;
  const ny = dx;

  // Rectangle: from wall face (x,y) extending depth into room
  if (dx === 1 && dy === 0) {
    // Wall runs right: cabinets extend downward (+Y)
    return { x: x, y: y, w: width, h: depth };
  } else if (dx === 0 && dy === 1) {
    // Wall runs down: cabinets extend left (-X)
    return { x: x - depth, y: y, w: depth, h: width };
  } else if (dx === -1 && dy === 0) {
    // Wall runs left: cabinets extend upward (-Y)
    return { x: x - width, y: y - depth, w: width, h: depth };
  } else if (dx === 0 && dy === -1) {
    // Wall runs up: cabinets extend right (+X)
    return { x: x, y: y - width, w: depth, h: width };
  }
  // Fallback
  return { x: x, y: y, w: width, h: depth };
}


// ─── BOM TABLE SVG ──────────────────────────────────────────────────────────

function renderBOMTable(items, summary) {
  const rowH = 20;
  const headerH = 28;
  const colWidths = [120, 200, 60, 60, 60, 100]; // SKU, Desc, Type, W, Qty, Walls
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const totalH = headerH + items.length * rowH + rowH + 10; // +1 row for summary

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW + 20}" height="${totalH + 40}" viewBox="0 0 ${totalW + 20} ${totalH + 40}" style="background:white">\n`;
  svg += `<style>text{font-family:'Helvetica Neue',Arial,sans-serif;font-size:10px;fill:#333;}</style>\n`;
  svg += `<text x="${(totalW + 20) / 2}" y="16" text-anchor="middle" style="font-size:13px;font-weight:bold;">Bill of Materials</text>\n`;
  svg += `<g transform="translate(10,30)">\n`;

  // Header
  const headers = ['SKU', 'Description', 'Type', 'Width', 'Qty', 'Wall(s)'];
  let hx = 0;
  svg += `  <rect x="0" y="0" width="${totalW}" height="${headerH}" fill="#e0d8c8" stroke="${STROKE}" stroke-width="0.5" />\n`;
  for (let i = 0; i < headers.length; i++) {
    svg += `  <text x="${hx + 6}" y="${headerH / 2 + 4}" style="font-weight:bold;">${headers[i]}</text>\n`;
    hx += colWidths[i];
  }

  // Rows
  let ry = headerH;
  for (const item of items) {
    const fill = ry % (rowH * 2) === 0 ? '#faf8f4' : '#fff';
    svg += `  <rect x="0" y="${ry}" width="${totalW}" height="${rowH}" fill="${fill}" stroke="${STROKE_LIGHT}" stroke-width="0.25" />\n`;
    let cx = 0;
    const vals = [
      item.sku,
      (item.description || '').slice(0, 30),
      item.type,
      item.width ? formatDim(item.width) : '',
      String(item.qty),
      (item.walls || '').slice(0, 14),
    ];
    for (let i = 0; i < vals.length; i++) {
      svg += `  <text x="${cx + 6}" y="${ry + rowH / 2 + 4}">${esc(vals[i])}</text>\n`;
      cx += colWidths[i];
    }
    ry += rowH;
  }

  // Summary row
  svg += `  <rect x="0" y="${ry}" width="${totalW}" height="${rowH}" fill="#e0d8c8" stroke="${STROKE}" stroke-width="0.5" />\n`;
  svg += `  <text x="6" y="${ry + rowH / 2 + 4}" style="font-weight:bold;">TOTAL: ${summary.totalLineItems} line items, ${summary.totalPieces} pieces</text>\n`;

  svg += `</g>\n</svg>`;
  return svg;
}


// ─── DESCRIPTION HELPER ─────────────────────────────────────────────────────

function descriptionFromPlacement(p) {
  const sku = p.sku || '';
  const role = p.role || p.type || '';

  // Appliance descriptions
  if (p.type === 'appliance') return `${p.applianceType || 'Appliance'} (${p.model || p.brand || 'std'})`;

  // Cabinet type expansion map (Rec #3)
  const skuDescMap = {
    'B3D': '3-Drawer Base',
    'BWDMA': 'Waste Basket Modified Access',
    'SB': 'Sink Base',
    'SBA': 'Sink Base',
    'BL': 'Lazy Susan Base',
    'W': 'Wall Cabinet',
    'WPD-H': 'Hutch Pocket Door',
    'BPOS': 'Pull-Out Shelf Base',
    'FD2HD': 'File Drawer / Half-Door',
    'B-FHD': 'Full-Height Door Base',
  };

  // Look for matching SKU prefix
  for (const [prefix, desc] of Object.entries(skuDescMap)) {
    if (sku.toUpperCase().startsWith(prefix)) {
      return `${desc} ${formatDim(p.width || 0)}"W x ${p.height ? formatDim(p.height) + '"H' : ''}`.trim();
    }
  }

  // Fallback descriptions
  if (role === 'corner' || role === 'corner-filler') return `Corner ${p.type || ''} ${sku}`.trim();
  if (sku.startsWith('W') || role === 'upper') return `Wall Cabinet ${formatDim(p.width || 0)}"W`;
  if (sku.startsWith('B')) return `Base Cabinet ${formatDim(p.width || 0)}"W`;
  if (sku.startsWith('REP') || role === 'rep') return `Refrigerator End Panel`;
  if (sku.startsWith('F') && (role === 'filler' || role === 'corner-filler')) return `Filler ${formatDim(p.width || 0)}"`;
  if (role === 'tall') return `Tall Cabinet ${formatDim(p.width || 0)}"W x ${formatDim(p.height || 84)}"H`;
  if (role === 'accessory' || role === 'toe-kick' || role === 'trim') return `Accessory/Trim`;

  return `${role || 'Cabinet'} ${formatDim(p.width || 0)}"W`;
}
