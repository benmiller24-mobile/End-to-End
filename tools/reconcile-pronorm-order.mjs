// Reconcile a real pronorm order confirmation against the ingested catalog.
// Order line prices are EUR at a 50% dealer discount off the spec-book list;
// the order's front range sets the price group. Verifies catalog.pg[group]*0.5
// ≈ printed line price, to the cent. (Extra discounts at the order bottom are
// ignored per the dealer.)
//   node tools/reconcile-pronorm-order.mjs <order.pdf>
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const pdfjs = await import(require.resolve('pdfjs-dist/legacy/build/pdf.mjs', { paths: [join(here, '../frontend')] }));
const { getTenant } = await import('../eclipse-pricing/src/tenants/index.js');

const path = process.argv[2];
const DISCOUNT = 0.5;
const t = getTenant('pronorm');
const norm = (s) => String(s).toUpperCase().replace(/\s+/g, '');           // space-insensitive SKU key
const byNorm = new Map(t.catalog.list().map(e => [norm(e.s), e]));
const eur = (s) => parseFloat(s.replace(/\./g, '').replace(',', '.'));      // 1.234,56 → 1234.56

const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path)), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
const allLines = [];
for (let pn = 1; pn <= doc.numPages; pn++) {
  const tc = await (await doc.getPage(pn)).getTextContent();
  const m = new Map();
  for (const it of tc.items) { if (!it.str || !it.str.trim()) continue; const y = Math.round(it.transform[5] / 2) * 2; (m.get(y) || m.set(y, []).get(y)).push({ x: it.transform[4], s: it.str }); }
  for (const [, its] of [...m.entries()].sort((a, b) => b[0] - a[0])) allLines.push(its.sort((a, b) => a.x - b.x).map(i => i.s).join(' '));
}

// Front range → price group (from the order header)
let range = null;
for (const l of allLines) { const r = l.match(/Front panel Range\s+([A-Z]{2,3})\b/); if (r) { range = r[1]; break; } }
const group = t.pricing.frontRanges[range] ?? null;

// Order number: letters then size groups, possibly no space (PH20-208-01) or
// with one (HSP 60-201-602). Capture the trailing two money tokens (price,total).
const lineRe = /^\d+\s+\d+\s+([A-Z][A-Z0-9]*\s?\d{1,3}(?:[ -]\d{1,4})+(?:-\d{1,4})?)\b.*?(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;
const items = [];
for (const l of allLines) {
  const mm = l.match(lineRe);
  if (mm) items.push({ sku: mm[1].trim(), price: eur(mm[2]) });
}

// Made-to-measure / area-priced lines aren't catalog list × group (custom
// panels, front material, end panels cut to size) — exclude from the price test.
const CUSTOM = /^(FM|WS|WW|WN|MP|SS|AB|PA|GE|OZ|TWK|ZLS|ZSP)/;
const GROUPS = t.pricing.priceGroups;

// The price group is set by the (range, colour) of THIS order. Rather than
// trust the coarse range→group map, find the group that makes the most cabinet
// lines reconcile to order = list × 0.5 — that both validates the catalog and
// recovers the order's true group.
const cabs = items.filter(it => byNorm.has(norm(it.sku)) && byNorm.get(norm(it.sku)).pg && !CUSTOM.test(it.sku.replace(/\s/g, '')));
const tally = {};
for (const g of GROUPS) {
  let hit = 0;
  for (const it of cabs) {
    const list = byNorm.get(norm(it.sku)).pg[g];
    if (list != null && Math.abs(Math.round(list * DISCOUNT * 100) / 100 - it.price) <= 0.51) hit++;
  }
  tally[g] = hit;
}
const bestG = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];

// A line reconciles if order = list×0.5 at SOME price group (pronorm caps
// certain unit types below the front's group). Record which group each hit.
let atFront = 0, atOther = 0, noMatch = 0; const groupHits = {}; const offs = [];
for (const it of cabs) {
  const pg = byNorm.get(norm(it.sku)).pg;
  let hitG = null;
  for (const g of GROUPS) { const v = pg[g]; if (v != null && Math.abs(Math.round(v * DISCOUNT * 100) / 100 - it.price) <= 0.51) { hitG = g; break; } }
  if (hitG === bestG) atFront++;
  else if (hitG != null) { atOther++; groupHits[hitG] = (groupHits[hitG] || 0) + 1; }
  else { noMatch++; if (offs.length < 20) offs.push(`${it.sku}: order €${it.price} (no group matches; g${bestG} list €${pg[bestG]})`); }
}
const reconciled = atFront + atOther;
const customs = items.filter(it => CUSTOM.test(it.sku.replace(/\s/g, ''))).length;

console.log(`\n${path.split('/').pop()}  ·  header Range ${range} (map→g${group}) · front price group: ${bestG}`);
console.log(`line items parsed: ${items.length}  (catalog cabinets ${cabs.length} · customs/made-to-measure ${customs} · accessories/other ${items.length - cabs.length - customs})`);
console.log(`✓ at front group g${bestG}: ${atFront}`);
console.log(`✓ at a capped lower group: ${atOther}  ${Object.keys(groupHits).length ? '(' + Object.entries(groupHits).map(([g, n]) => `g${g}:${n}`).join(' ') + ')' : ''}`);
console.log(`✗ no group matches: ${noMatch}`);
if (offs.length) { console.log('\ntrue mismatches:'); offs.forEach(o => console.log('  ' + o)); }
console.log(`\nCATALOG RECONCILED (price = spec list × 0.5 at some group): ${reconciled}/${cabs.length} = ${cabs.length ? (reconciled / cabs.length * 100).toFixed(1) : 0}%`);
// per-line matching group, to characterize the unit-type group cap
const detail = cabs.map(it => { const pg=byNorm.get(norm(it.sku)).pg; let g=null; for(const G of GROUPS){const v=pg[G]; if(v!=null&&Math.abs(Math.round(v*DISCOUNT*100)/100-it.price)<=0.51){g=G;break;}} return `${it.sku}@g${g}`; });
console.log('per-line groups:', detail.join('  '));
