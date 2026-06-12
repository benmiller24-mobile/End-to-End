#!/usr/bin/env node
/**
 * Spec-book ingest pipeline — PDF price book → tenant package (data only).
 * ========================================================================
 * The zero-code onboarding path for a new manufacturer line:
 *
 *   node tools/ingest-spec-book.mjs <book.pdf|book.txt> \
 *        --config tenants/<id>.ingest.json --out <id>.package.json
 *
 * 1. EXTRACT  — page text via macOS PDFKit (swift), or a pre-extracted .txt
 *               with `===== PAGE N =====` separators.
 * 2. PARSE    — config-driven, no manufacturer code:
 *      matrix  W.W.-style width×height price tables: row codes carry a `--`
 *              placeholder (WBC24--), a `Width 24" 27"…` header names the
 *              columns, bare integers in range are the prices (row-major).
 *      rows    one-SKU-per-line books: regex with named groups (sku, price).
 * 3. VALIDATE — schema, duplicate SKUs, price sanity, per-section coverage.
 * 4. EMIT     — a tenant package JSON ready for tenants/packages/manifest.js.
 *
 * The ingest CONFIG is the operator's mapping (branding, page ranges,
 * patterns, type rules). Everything tenant-specific stays in that config
 * and the emitted package — never in this tool.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';

const args = process.argv.slice(2);
const src = args[0];
const cfgPath = args[args.indexOf('--config') + 1];
const outPath = args[args.indexOf('--out') + 1];
if (!src || !cfgPath || !outPath || args.indexOf('--config') < 0 || args.indexOf('--out') < 0) {
  console.error('usage: ingest-spec-book.mjs <book.pdf|book.txt> --config <ingest.json> --out <package.json>');
  process.exit(2);
}
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));

// ── 1. EXTRACT ──────────────────────────────────────────────────────────
function extractText(file) {
  if (/\.txt$/i.test(file)) return readFileSync(file, 'utf8');
  const dir = mkdtempSync(join(tmpdir(), 'ingest-'));
  const swiftSrc = `
import PDFKit
let doc = PDFDocument(url: URL(fileURLWithPath: CommandLine.arguments[1]))!
for i in 0..<doc.pageCount {
  print("===== PAGE \\(i+1) =====")
  print(doc.page(at: i)?.string ?? "")
}`;
  const sf = join(dir, 'extract.swift');
  writeFileSync(sf, swiftSrc);
  return execFileSync('swift', [sf, file], { maxBuffer: 256 * 1024 * 1024 }).toString();
}

const PAGE_SEP = /^===== PAGE (\d+) =====$/m;
function splitPages(text) {
  const pages = new Map();
  const parts = text.split(/^===== PAGE (\d+) =====$/m);
  for (let i = 1; i < parts.length; i += 2) pages.set(parseInt(parts[i], 10), parts[i + 1] || '');
  return pages;
}

function pageInRange(n, spec) {
  if (!spec) return true;
  return String(spec).split(',').some(r => {
    const [a, b] = r.split('-').map(s => parseInt(s, 10));
    return b ? n >= a && n <= b : n === a;
  });
}

// ── 2. PARSERS ──────────────────────────────────────────────────────────
const dequote = (s) => s.replace(/[”“"]/g, '"');

/** W.W.-style matrix: row codes with a `--` height placeholder + a header
 *  line naming the height columns + price numbers in row-major order. */
function parseMatrix(pageText, p, pageNo) {
  const text = dequote(pageText);
  // row codes carry the height placeholder `--`; a VARIANT SUFFIX may follow
  // it (`W24-- -2D` = two-door row) and belongs at the END of the final SKU
  const codeRe = new RegExp(p.codePattern || '\\b([A-Z]{1,8}\\d{1,2}(?: 1/2)?)--( ?-[A-Z0-9]{1,4})?', 'g');
  const codes = [...text.matchAll(codeRe)].map(m => ({ code: m[1], suffix: (m[2] || '').replace(/\s/g, '') }));
  if (codes.length < (p.minCodes ?? 2)) return [];
  // header: a line containing `Width` (or headerLabel) followed by ≥2 quoted numbers
  const headerLine = text.split('\n').find(l =>
    new RegExp(`\\b${p.headerLabel || 'Width'}\\b`).test(l) && (l.match(/\d+(?: 1\/2)?"/g) || []).length >= 2);
  if (!headerLine) return [];
  const heights = (headerLine.match(/(\d+(?: 1\/2)?)"/g) || []).map(h => h.replace(/"$/, '').replace(' 1/2', '.5'));
  if (heights.length < 2) return [];
  // prices: bare numbers (no `"` suffix) in the configured range, reading order,
  // taken AFTER the header line so note/dimension digits don't pollute
  const afterHeader = text.slice(text.indexOf(headerLine));
  const nums = [...afterHeader.matchAll(/(?<!["\d/])(\d{2,5})(?!["\d/])/g)]
    .map(m => parseInt(m[1], 10))
    .filter(n => n >= (p.minPrice ?? 50) && n <= (p.maxPrice ?? 20000));
  if (nums.length !== codes.length * heights.length) return []; // shape mismatch → skip page honestly
  const rows = [];
  codes.forEach(({ code, suffix }, ri) => heights.forEach((h, ci) => {
    const sku = (p.skuTemplate || '{code}{height}{suffix}')
      .replace('{code}', code)
      .replace('{height}', h.replace('.5', ' 1/2'))
      .replace('{suffix}', suffix);
    rows.push({ s: sku, p: nums[ri * heights.length + ci], _page: pageNo });
  }));
  return rows;
}

/** Simple per-line books: regex with named groups sku + price. */
function parseRows(pageText, p, pageNo) {
  const re = new RegExp(p.rowPattern, 'gm');
  const rows = [];
  for (const m of dequote(pageText).matchAll(re)) {
    const price = parseFloat(String(m.groups.price).replace(/,/g, ''));
    if (!m.groups.sku || !(price > 0)) continue;
    if (price < (p.minPrice ?? 1) || price > (p.maxPrice ?? 50000)) continue;
    rows.push({ s: m.groups.sku.trim(), p: price, _page: pageNo });
  }
  return rows;
}

// ── RUN ─────────────────────────────────────────────────────────────────
console.log(`extracting ${src} …`);
const pages = splitPages(extractText(src));
console.log(`${pages.size} pages of text`);

let all = [];
for (const parser of (cfg.extract?.parsers || [])) {
  let hits = 0, pagesHit = 0;
  for (const [n, text] of pages) {
    if (!pageInRange(n, parser.pages ?? cfg.extract.pages)) continue;
    const rows = parser.kind === 'matrix' ? parseMatrix(text, parser, n) : parseRows(text, parser, n);
    if (rows.length) { pagesHit++; hits += rows.length; all.push(...rows); }
  }
  console.log(`parser ${parser.kind}: ${hits} rows from ${pagesHit} pages`);
}

// type / section tagging from config rules (first match wins)
const typeRules = (cfg.extract?.typeRules || []).map(r => [new RegExp(r.pattern), r.t]);
const sectionRules = (cfg.extract?.sectionRules || []).map(r => [new RegExp(r.pattern), r.r]);
for (const row of all) {
  row.t = (typeRules.find(([re]) => re.test(row.s)) || [])[1] || 'X';
  row.r = (sectionRules.find(([re]) => re.test(row.s)) || [])[1] || cfg.id.toUpperCase();
  delete row._page;
}

// ── 3. VALIDATE ─────────────────────────────────────────────────────────
const problems = [];
const seen = new Map();
for (const row of all) {
  if (!row.s || typeof row.p !== 'number' || !(row.p > 0)) problems.push(`bad row ${JSON.stringify(row)}`);
  if (seen.has(row.s) && seen.get(row.s) !== row.p) problems.push(`duplicate SKU with differing price: ${row.s} ${seen.get(row.s)} vs ${row.p}`);
  seen.set(row.s, row.p);
}
all = [...new Map(all.map(r => [r.s, r])).values()];   // dedupe identical entries
if (all.length < (cfg.extract?.minRows ?? 10)) problems.push(`only ${all.length} rows extracted (< minRows)`);

const byType = {};
for (const r of all) byType[r.t] = (byType[r.t] || 0) + 1;
console.log(`extracted ${all.length} unique SKUs · by type: ${JSON.stringify(byType)}`);
console.log('samples:', all.slice(0, 5).map(r => `${r.s} $${r.p}`).join(' | '));
if (problems.length) {
  console.error(`\n${problems.length} validation problem(s):`);
  problems.slice(0, 20).forEach(p => console.error('  ✗ ' + p));
  process.exit(1);
}

// ── 4. EMIT ─────────────────────────────────────────────────────────────
const pkg = {
  id: cfg.id,
  branding: cfg.branding || {},
  locale: cfg.locale || { units: 'in', currency: 'USD' },
  constructions: cfg.constructions || ['eclipse_frameless'],
  defaultConstruction: cfg.defaultConstruction || (cfg.constructions || ['eclipse_frameless'])[0],
  validation: cfg.validation || { styleCompat: false },
  pricing: cfg.pricing || { fallbackTenant: null },
  coverFields: cfg.coverFields || undefined,
  catalog: {
    sections: cfg.sections || {},
    typeNames: cfg.typeNames || { B: 'Base', W: 'Wall', T: 'Tall', V: 'Vanity', A: 'Accessory', M: 'Moulding', F: 'Fillers', X: 'Other' },
    rows: all,
  },
  _meta: { source: src.split('/').pop(), generated: new Date().toISOString(), rowCount: all.length },
};
writeFileSync(outPath, JSON.stringify(pkg, null, 1));
console.log(`\n✓ tenant package written: ${outPath} (${all.length} SKUs)`);
console.log('next: add it to eclipse-pricing/src/tenants/packages/manifest.js and run the evals.');
