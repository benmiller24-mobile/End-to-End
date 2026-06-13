#!/usr/bin/env node
/**
 * pronorm spec-book ingest → tenant package.
 * ==========================================
 * pronorm is a European modular system: metric (mm), German order numbers
 * (HSP 60-201-602), and PRICE-GROUP pricing — each cabinet carries ~10 prices
 * (columns N,0-8,10); the chosen front range selects the column. This runner
 * uses the generic column-aware `parsePriceGroupPage` parser (ingestCore) plus
 * the front-range→group map read from the books' own range pages, and emits a
 * package the registry's generic price-group capability prices through. No
 * pronorm logic lives in app code — only here (a build script) and in data.
 *
 *   node tools/ingest-pronorm.mjs
 *
 * Reads the two books from ~/Desktop/Brochures & Catalogs/ and writes
 * eclipse-pricing/src/tenants/packages/pronorm.package.json
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import { parsePriceGroupPage } from '../eclipse-pricing/src/tenants/ingestCore.js';

const require = createRequire(import.meta.url);
const pdfjs = await import(require.resolve('pdfjs-dist/legacy/build/pdf.mjs', { paths: [join(dirname(fileURLToPath(import.meta.url)), '../frontend')] }));

const HERE = dirname(fileURLToPath(import.meta.url));
const BOOKS = [
  { file: '/Users/benjaminmiller/Desktop/Brochures & Catalogs/Gesamt-PDF_GB_proline-classic 09-2025.pdf', tag: 'proline/classicline' },
  { file: '/Users/benjaminmiller/Desktop/Brochures & Catalogs/14Gesamt-PDF_GB_Y-line-X-line 09-2025.pdf', tag: 'Y-line/X-line' },
];
const GROUPS = ['N', '0', '1', '2', '3', '4', '5', '6', '7', '8', '10'];

function positioned(tc) {
  return tc.items.filter(t => t.str && t.str.trim()).map(t => ({ s: t.str.trim(), x: t.transform[4], y: t.transform[5] }));
}
function reflow(items) {
  const byY = new Map();
  for (const it of items) { const y = Math.round(it.y / 2) * 2; (byY.get(y) || byY.set(y, []).get(y)).push(it); }
  return [...byY.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map(t => t.s).join(' '));
}

// Front range → price group, read from the range pages ("… Price group N").
function rangeMap(pagesText) {
  const map = {};
  let cur = null;
  for (const txt of pagesText) {
    for (const l of txt) {
      const g = l.match(/Price group ([0-9]{1,2})\b/);
      if (g) cur = g[1];
      const m = l.match(/^[0-9]{2,4}[a-z]? ([A-Z]{2,3})(?: ([A-Z]{2,3}))? /);
      if (m && cur != null) for (const r of [m[1], m[2]]) if (r && /^[A-Z]{2,3}$/.test(r)) map[r] = cur;
    }
  }
  return map;
}

const typeOf = (sku) => {
  // pronorm encodes the unit type as a letter in the prefix: H Hochschrank
  // (tall), O Oberschrank (wall), U Unterschrank (base) — possibly behind a
  // function letter (P=pull-out, D=…, A=larder). Panels/worktops first.
  const prefix = (sku.match(/^[A-Z]+/) || [''])[0];
  if (/^(WP|WN|SS|AB|PA|BL|AP|FP|SP|WS)/.test(sku)) return 'F';  // panels / fillers / plinths
  if (prefix.includes('H')) return 'T';
  if (prefix.includes('O')) return 'W';
  if (prefix.includes('U')) return 'B';
  return 'X';
};

const all = new Map();    // order-no → row (dedup across books; first wins)
const frontRanges = {};
let totalRows = 0;
const parserStats = [];

for (const { file, tag } of BOOKS) {
  if (!fs.existsSync(file)) { console.error('MISSING', file); continue; }
  process.stdout.write(`\n${tag}: opening…`);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
  process.stdout.write(` ${doc.numPages} pages\n`);

  // 1. range→group map (scan the first ~140 pages where the range register lives)
  const rangePagesText = [];
  for (let pn = 1; pn <= Math.min(doc.numPages, 160); pn++) {
    const tc = await (await doc.getPage(pn)).getTextContent();
    rangePagesText.push(reflow(positioned(tc)));
  }
  Object.assign(frontRanges, rangeMap(rangePagesText));

  // 2. price tables across the whole book (column geometry carried forward)
  const carry = {};
  let bookRows = 0, bookPages = 0;
  for (let pn = 1; pn <= doc.numPages; pn++) {
    const tc = await (await doc.getPage(pn)).getTextContent();
    const { rows } = parsePriceGroupPage(positioned(tc), { groups: GROUPS, defaultGroup: '3' }, pn, carry);
    if (rows.length) { bookPages++; }
    for (const r of rows) {
      r.t = typeOf(r.s); r.r = 'PRONORM'; delete r._page;
      if (!all.has(r.s)) { all.set(r.s, r); bookRows++; }
    }
    if (pn % 100 === 0) process.stdout.write(`  …page ${pn}/${doc.numPages} (${all.size} unique rows)\n`);
  }
  parserStats.push({ book: tag, newRows: bookRows, pagesWithRows: bookPages, pages: doc.numPages });
  totalRows += bookRows;
}

const rows = [...all.values()];
// quality gates
const problems = [];
const bad = rows.filter(r => !r.s || !(r.p > 0) || !r.pg);
if (bad.length) problems.push(`${bad.length} rows missing price/pg`);
const groupCounts = {};
for (const r of rows) groupCounts[Object.keys(r.pg).length] = (groupCounts[Object.keys(r.pg).length] || 0) + 1;

const pkg = {
  id: 'pronorm',
  branding: {
    displayName: 'Eclipse Kitchen Designer',
    manufacturerName: 'pronorm Einbauküchen GmbH',
    lineLabel: 'pronorm',
    lineSub: 'European frameless (metric)',
    lineDescriptor: 'pronorm proline / Y-line (128mm system)',
    companyName: 'Pinnacle Sales',
    formCodePrefix: 'PRO',
    scheduleHeader: 'pronorm proline · Y-line',
    catalogNote: 'Ingested from the pronorm GB sales manuals (09/2025). Metric (mm), price-group priced — select the front range to set the price group. Verify against pronorm order confirmations before ordering.',
  },
  locale: { units: 'mm', currency: 'EUR' },
  capabilities: { autoSolve: false, units: 'mm', priceGroups: true },
  constructions: ['pronorm_frameless'],
  defaultConstruction: 'pronorm_frameless',
  validation: { styleCompat: false },
  pricing: {
    fallbackTenant: null,
    priceGroups: GROUPS,
    defaultGroup: '3',
    frontRanges,
  },
  catalog: {
    sections: {},
    typeNames: { B: 'Base (Unterschrank)', W: 'Wall (Oberschrank)', T: 'Tall (Hochschrank)', F: 'Panels/Fillers', X: 'Other' },
    rows,
  },
  _meta: { source: BOOKS.map(b => b.tag).join(' + '), rowCount: rows.length, parserStats, groupCounts },
};

const out = join(HERE, '../eclipse-pricing/src/tenants/packages/pronorm.package.json');
fs.writeFileSync(out, JSON.stringify(pkg, null, 0));
console.log(`\n✓ pronorm package: ${rows.length} unique SKUs · ${Object.keys(frontRanges).length} front ranges`);
console.log('  byType:', Object.entries(rows.reduce((a, r) => ((a[r.t] = (a[r.t] || 0) + 1), a), {})).map(([k, v]) => `${k}:${v}`).join(' '));
console.log('  price-group counts (cols→rows):', JSON.stringify(groupCounts));
console.log('  parserStats:', JSON.stringify(parserStats));
if (problems.length) console.log('  PROBLEMS:', problems.join(' | '));
console.log('  written:', out, `(${(fs.statSync(out).size / 1e6).toFixed(1)}MB)`);
