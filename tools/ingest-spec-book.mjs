#!/usr/bin/env node
/**
 * Spec-book ingest pipeline — PDF price book → tenant package (data only).
 * Thin CLI over the shared core (eclipse-pricing/src/tenants/ingestCore.js),
 * which the in-app "Add product line" uploader uses too.
 *
 *   node tools/ingest-spec-book.mjs <book.pdf|book.txt> \
 *        --config tools/tenant-configs/<id>.ingest.json --out <id>.package.json
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { ingestPages } from '../eclipse-pricing/src/tenants/ingestCore.js';

const args = process.argv.slice(2);
const src = args[0];
const cfgPath = args[args.indexOf('--config') + 1];
const outPath = args[args.indexOf('--out') + 1];
if (!src || !cfgPath || !outPath || args.indexOf('--config') < 0 || args.indexOf('--out') < 0) {
  console.error('usage: ingest-spec-book.mjs <book.pdf|book.txt> --config <ingest.json> --out <package.json>');
  process.exit(2);
}
const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
cfg.sourceName = src.split('/').pop();

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

function splitPages(text) {
  const pages = new Map();
  const parts = text.split(/^===== PAGE (\d+) =====$/m);
  for (let i = 1; i < parts.length; i += 2) pages.set(parseInt(parts[i], 10), parts[i + 1] || '');
  return pages;
}

console.log(`extracting ${src} …`);
const pages = splitPages(extractText(src));
console.log(`${pages.size} pages of text`);

const { pkg, report } = ingestPages(pages, cfg);
for (const s of report.parserStats) console.log(`parser ${s.kind}: ${s.rows} rows from ${s.pages} pages`);
console.log(`extracted ${report.count} unique SKUs · by type: ${JSON.stringify(report.byType)}`);
console.log('samples:', report.samples.join(' | '));
if (report.problems.length) {
  console.error(`\n${report.problems.length} validation problem(s):`);
  report.problems.slice(0, 20).forEach(p => console.error('  ✗ ' + p));
  process.exit(1);
}
pkg._meta.generated = new Date().toISOString();
writeFileSync(outPath, JSON.stringify(pkg, null, 1));
console.log(`\n✓ tenant package written: ${outPath} (${report.count} SKUs)`);
console.log('next: add it to eclipse-pricing/src/tenants/packages/manifest.js and run the evals.');
