/**
 * Eclipse Kitchen Designer — Design Package Generator
 * =====================================================
 * Generates a professional HTML design package using the full pipeline:
 *   configureProject() → solve + price → renderLayout() → HTML
 *
 * Outputs a single clean HTML document with:
 *   1. Cover page (project summary + floor plan preview)
 *   2. Floor plan (top-down with NKBA dimension chains)
 *   3. Wall elevations (NKBA clockwise order with cabinet faces + trim)
 *   4. Specification sheet (per-wall line items with C3 pricing)
 *   5. Bill of materials
 *
 * Usage:
 *   node generate-design-package.js
 */

import { writeFileSync } from 'fs';
import { configureProject } from './src/configurator.js';
import { renderLayout } from './src/renderer.js';

// ─── SAMPLE PROJECT: Lofton Residence ────────────────────────────────────────

const quote = configureProject({
  room: {
    layoutType: 'l-shape',
    roomType: 'kitchen',
    walls: [
      { id: 'A', length: 156, role: 'range', ceilingHeight: 96 },
      { id: 'B', length: 120, role: 'sink', ceilingHeight: 96 },
    ],
    appliances: [
      { type: 'range', width: 30, wall: 'A' },
      { type: 'sink', width: 36, wall: 'B' },
      { type: 'dishwasher', width: 24, wall: 'B' },
      { type: 'refrigerator', width: 36, wall: 'A', position: 'end' },
      { type: 'hood', width: 30, wall: 'A' },
    ],
    prefs: {
      cornerTreatment: 'auto',
      preferDrawerBases: true,
      sophistication: 'high',
    },
  },
  materials: {
    species: 'Walnut',
    construction: 'Plywood',
    doorStyle: 'Napa VG FP',
    drawerType: '5/8" Hdwd Dovetail',
    drawerGuide: 'Blum FEG Guide',
  },
  options: {
    projectName: 'Lofton Residence Kitchen Renovation',
    clientName: 'Sarah & Michael Lofton',
    touchUpKit: 'TUK-STAIN',
    includeEstimate: true,
  },
});

// Extract the raw solver layout from the quote
const layout = quote._raw.solverOutput;

// Inject project metadata
layout.clientName = 'Sarah & Michael Lofton';
layout.designerName = 'Benjamin Miller — Pinnacle Sales';

// ─── BUILD PER-SKU PRICING MAP ──────────────────────────────────────────────
// Map SKU → unit price from the C3 pricing output so the spec sheet can display it

const skuPricing = {};
if (quote.pricing && quote.pricing.specs) {
  for (const spec of quote.pricing.specs) {
    for (const item of (spec.pricedItems || [])) {
      if (item.sku && item.totalPrice != null) {
        // Store the total priced amount per SKU (after species + construction upcharges)
        skuPricing[item.sku] = Math.round(item.totalPrice * 100) / 100;
      }
    }
  }
}

// ─── RENDER ALL VIEWS ───────────────────────────────────────────────────────

const result = renderLayout(layout, {
  projectName: 'Lofton Residence Kitchen Renovation',
  clientName: 'Sarah & Michael Lofton',
  designerName: 'Benjamin Miller — Pinnacle Sales',
  showDimensions: true,
  showSkus: true,
  trim: { toeKick: true, crown: true, lightRail: true, countertopEdge: true },
  pricing: skuPricing,
});

// ─── BUILD HTML DOCUMENT ────────────────────────────────────────────────────

const wallIds = Object.keys(result.elevations);
const projectTotal = quote.pricing?.projectTotal || 0;
const speciesName = quote.materials?.species || 'White Oak';

let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Eclipse Design Package — Lofton</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #eee;
      color: #333;
    }
    .page {
      background: white;
      max-width: 11in;
      margin: 0 auto 24px;
      padding: 0;
      border-radius: 4px;
      box-shadow: 0 1px 6px rgba(0,0,0,0.1);
      overflow: hidden;
      page-break-after: always;
    }
    .page-inner {
      padding: 24px;
    }
    .page-header {
      background: #1a3c6e;
      color: white;
      padding: 10px 24px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .page-header .page-num { opacity: 0.7; font-weight: 400; }
    h2 {
      color: #1a3c6e;
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #1a56db;
    }
    .svg-container {
      text-align: center;
      overflow-x: auto;
    }
    .svg-container svg {
      max-width: 100%;
      height: auto;
    }
    .bom-container svg {
      max-width: 100%;
      height: auto;
    }
    @media print {
      body { background: white; padding: 0; }
      .page { box-shadow: none; margin: 0; border-radius: 0; }
    }
  </style>
</head>
<body>

<!-- PAGE 1: Cover Page -->
<div class="page">
  ${result.coverPage}
</div>

<!-- PAGE 2: Floor Plan -->
<div class="page">
  <div class="page-header">
    <span>Eclipse Cabinetry — Lofton Residence</span>
    <span class="page-num">Page 2</span>
  </div>
  <div class="page-inner">
    <h2>Floor Plan</h2>
    <div class="svg-container">
      ${result.floorPlan}
    </div>
  </div>
</div>

<!-- PAGES 3+: Wall Elevations -->
`;

let pageNum = 3;
for (const wid of wallIds) {
  html += `<div class="page">
  <div class="page-header">
    <span>Eclipse Cabinetry — Lofton Residence</span>
    <span class="page-num">Page ${pageNum++}</span>
  </div>
  <div class="page-inner">
    <h2>Wall ${wid} Elevation</h2>
    <div class="svg-container">
      ${result.elevations[wid]}
    </div>
  </div>
</div>
`;
}

// Specification Sheet
html += `<div class="page">
  <div class="page-header">
    <span>Eclipse Cabinetry — Lofton Residence</span>
    <span class="page-num">Page ${pageNum++}</span>
  </div>
  <div class="page-inner">
    <h2>Cabinet Specification Sheet</h2>
    ${result.specSheet}
  </div>
</div>
`;

// Bill of Materials
html += `<div class="page">
  <div class="page-header">
    <span>Eclipse Cabinetry — Lofton Residence</span>
    <span class="page-num">Page ${pageNum++}</span>
  </div>
  <div class="page-inner">
    <h2>Bill of Materials</h2>
    <div class="bom-container">
      ${result.bom.svgTable}
    </div>
  </div>
</div>
`;

html += `</body>
</html>`;

writeFileSync('../design-package-test.html', html);
console.log(`✅ Design package written to design-package-test.html (${(html.length / 1024).toFixed(1)} KB)`);
console.log(`   Pages: ${pageNum - 1} (cover + floor plan + ${wallIds.length} elevations + spec sheet + BOM)`);
console.log(`   Walls: ${wallIds.join(', ')}`);
console.log(`   Cabinets: ${quote.layout.totalCabinets}`);
console.log(`   Species: ${speciesName} | Construction: ${quote.materials.construction}`);
console.log(`   Project Total: $${projectTotal.toFixed(2)}`);
console.log(`   SKUs with pricing: ${Object.keys(skuPricing).length}`);
