/**
 * Floorplan vector importer — golden fixtures from real Cyncly drawing sets.
 * The Mautz plan must reconstruct to its known kitchen (the same order our
 * pricing regression locks to the penny); the Christiansen set has no cabinet
 * labels in its text layer and must be ROUTED AWAY from the vector path.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { suite } from '../_lib.mjs';
import { parseDesignPdf, looksLikeDesignPdf, labelDims, parseDims } from '../../frontend/src/floorplanVector.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(HERE, 'fixtures', f), 'utf8'));

export default async function run() {
  const s = suite('floorplan vector importer');

  // ── label parsing unit facts (the Cyncly conventions) ──
  const cases = [
    ['W3624', 36, 'upper'], ['RW3624', 36, 'upper'], ['W1239R', 12, 'upper'],
    ['W28.539', 28.5, 'upper'], ['WSE2430-39R', 24, 'upper'],
    ['U22 1/293R', 22.5, 'tall'], ['B24-2D', 24, 'base'], ['B3D15', 15, 'base'],
    ['BBC45R', 45, 'base'], ['BL36-PHR', 36, 'base'], ['SB36', 36, 'base'],
    ['IWS30', 30, 'base'], ['BWDMW18', 18, 'base'], ['F393', 3, 'tall'],
    ['F339', 3, 'upper'], ['F634 1/2', 6, 'base'],
    ['FREP3/4 93FTK24L', 0.75, 'tall'], ['BEP3/4L-FTK', 0.75, 'base'],
  ];
  for (const [label, w, z] of cases) {
    const d = labelDims(label);
    s.ok(`${label} → ${w}" ${z}`, !!d && Math.abs(d.width - w) < 0.01 && d.zone === z);
  }
  // appliance model numbers must NOT read as cabinets
  for (const not of ['MEDS302WS', 'CIT367YGS', 'MD24WS', 'AK9434BS HOOD LINER', 'PLAN', '36" INDUCTION COOKTOP']) {
    s.ok(`${not} rejected`, labelDims(not) === null);
  }

  // ── fraction reassembly ──
  const dims = parseDims([
    { s: '125', x: 387, y: 168 }, { s: '1', x: 406, y: 173 }, { s: '8', x: 406, y: 168 }, { s: '"', x: 411, y: 168 },
    { s: '64"', x: 325, y: 213 },
    { s: '102', x: 233, y: 351 }, { s: '3', x: 228, y: 369 }, { s: '4', x: 234, y: 369 }, { s: '"', x: 233, y: 374 },
  ]);
  const vals = dims.map(d => d.v).sort((a, b) => a - b);
  s.ok('reassembles 64 / 102.75 / 125.125', JSON.stringify(vals) === JSON.stringify([64, 102.75, 125.125]));

  // ── Mautz golden reconstruction ──
  const mautz = load('mautz-drawings-pages.json');
  s.ok('Mautz classified as design PDF', looksLikeDesignPdf(mautz, 'eclipse'));
  const r = parseDesignPdf(mautz, 'eclipse');
  s.eq('3 walls', r.walls.length, 3);
  const lens = r.walls.map(w => w.length).sort((a, b) => a - b);
  s.ok('printed wall lengths 102.75 / 112.5 / 125.125', JSON.stringify(lens) === JSON.stringify([102.75, 112.5, 125.125]));
  s.eq('u-shape', r.layoutType, 'u-shape');
  s.ok('no false island', r.island === null);
  s.ok('≥ 20 cabinets recovered', r.wallItems.length >= 20);
  for (const id of Object.keys(r.report.edges)) {
    s.ok(`wall ${id} width-sum sanity (${r.report.edges[id].cabinetSum}" vs ${r.report.edges[id].printedDim}")`, r.report.edges[id].match !== false);
  }
  for (const must of ['RW3624', 'U22 1/293R', 'BBC45R', 'BL36-PHR', 'W28.539', 'IWS30']) {
    s.ok(`recovered ${must}`, r.wallItems.some(it => it.sku === must));
  }
  s.ok('no dim glyphs polluting SKUs', r.wallItems.every(it => !/\s\d+\s\d+$/.test(it.sku)));
  s.ok('zero problems', r.report.problems.length === 0);

  // ── Christiansen routes to the vision path ──
  const chr = load('christiansen-drawings-pages.json');
  s.ok('Christiansen NOT classified as design PDF (no cabinet labels in text layer)', !looksLikeDesignPdf(chr, 'eclipse'));

  return s.done();
}
