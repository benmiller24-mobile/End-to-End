/**
 * Live-vision corpus runner.
 * ==========================
 * The faithful "upload a floor plan to the app" path: each real floor-plan IMAGE
 * is run through the SAME Claude-vision extractor the app uses (netlify/lib/
 * floorplanCore.runExtraction), the extracted room is fed into the solver,
 * realized for metric tenants, and scored on the 5 metrics in Eclipse, Shiloh
 * AND pronorm. Costs real ANTHROPIC_API_KEY calls (one Opus-vision call/image),
 * so it's a separate runner from the offline corpus — invoke deliberately.
 *
 *   ANTHROPIC_API_KEY=… node evals/si/run-vision.mjs <dir-of-images> [--json out]
 *
 * <dir-of-images> holds .png/.jpg/.jpeg floor plans. Per image it prints the
 * extraction confidence and the 3-brand pass/fail, then an aggregate.
 */
import fs from 'fs';
import path from 'path';
import { runExtraction } from '../../netlify/lib/floorplanCore.js';
import { solve } from '../../eclipse-engine/src/index.js';
import { realizeInTenant } from '../../eclipse-engine/src/tenantRealize.js';
import { getTenant } from '../../eclipse-pricing/src/tenants/index.js';
import { scoreKitchen } from './scoreKitchen.mjs';

const BRANDS = ['eclipse', 'shiloh', 'pronorm'];
const LAYOUT_MAP = { 'single-wall': 'single', galley: 'galley', 'l-shape': 'L', 'u-shape': 'U', 'g-shape': 'U' };
const MEDIA = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

// Vision extraction → solver input. Keep printed/scaled wall lengths; the solver
// places appliances unless the extraction printed positions.
export function extractionToRoom(ext) {
  const ceil = ext.ceilingHeightIn && ext.ceilingHeightIn > 60 ? ext.ceilingHeightIn : 96;
  const walls = (ext.walls || [])
    .filter(w => w.lengthIn > 12)
    .map(w => ({ id: w.id, length: Math.round(w.lengthIn), ceilingHeight: ceil, role: w.role }));
  const appliances = (ext.appliances || [])
    .filter(a => /range|cooktop|wall_oven|refrigerator|dishwasher|sink/.test(a.type))
    .map(a => ({ type: a.type === 'wall_oven' ? 'wall_oven' : a.type, wall: a.wall,
      // Honor the width the plan shows (the solver otherwise bumps to its own
      // standard, which overruns the wall when the appliance is pinned at the
      // plan's position). Guard against absurd values.
      ...(a.widthIn >= 12 && a.widthIn <= 84 ? { width: Math.round(a.widthIn) } : {}),
      ...(typeof a.positionIn === 'number' ? { position: Math.round(a.positionIn) } : {}) }));
  const island = ext.island ? { length: Math.round(ext.island.lengthIn), depth: Math.round(ext.island.depthIn || 42) } : null;
  // Domain guard: this tool designs RESIDENTIAL cabinetry. Reject commercial /
  // institutional / building-scale plans (a 100-ft "wall", duplicate sinks /
  // fridges / ranges) — they are out of scope, not design failures. The vision
  // model already extracted them; we just decline to auto-design them.
  const maxWall = walls.reduce((m, w) => Math.max(m, w.length), 0);
  const count = (re) => appliances.filter(a => re.test(a.type)).length;
  let outOfDomain = null;
  if (maxWall > 360) outOfDomain = `wall ${maxWall}" > 30ft (building/commercial scale)`;
  else if (count(/refriger/) > 1) outOfDomain = `${count(/refriger/)} refrigerators (commercial)`;
  else if (count(/sink/) > 2) outOfDomain = `${count(/sink/)} sinks (commercial)`;
  else if (count(/range|cooktop/) > 2) outOfDomain = `${count(/range|cooktop/)} cooktops/ranges (commercial)`;
  return {
    layoutType: LAYOUT_MAP[ext.layoutType] || 'L',
    walls, appliances, island, ceiling: ceil,
    scaleStatus: ext.scaleStatus, notes: ext.notes, outOfDomain,
  };
}

function runBrands(room) {
  const out = {};
  // Auto-design from the extracted ROOM: give the solver the walls + appliance
  // TYPES and WIDTHS and let it lay out the kitchen professionally
  // (applyApplianceRec). The extracted appliance POSITIONS are review hints, not
  // hard pins — the solver re-flows the run anyway, and hard-pinning a noisy
  // (often guessed-scale) position makes the run overrun the wall. The 5 metrics
  // score design QUALITY, which free layout optimises.
  const appliances = room.appliances.map(({ type, wall, width }) => ({ type, wall, ...(width ? { width } : {}) }));
  for (const brand of BRANDS) {
    const tenant = getTenant(brand);
    try {
      const input = {
        layoutType: room.layoutType, roomType: 'kitchen',
        walls: room.walls.map(w => ({ id: w.id, length: w.length, ceilingHeight: w.ceilingHeight })),
        appliances, prefs: { ceilingHeight: room.ceiling },
        applyApplianceRec: true,
        ...(room.island ? { island: room.island } : {}),
      };
      const result = solve(input);
      if (tenant?.realize) realizeInTenant(result, tenant, tenant.pricing?.defaultGroup ?? '0');
      out[brand] = scoreKitchen(result, { brand, room, prefs: input.prefs, priceGroup: tenant?.pricing?.defaultGroup });
    } catch (e) {
      out[brand] = { pass: false, overall: 0, failed: ['crash'], metrics: {}, error: e.message };
    }
  }
  return out;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Resilient extraction: retry transient API/stream errors (429/500/529/network)
// so one blip doesn't abort a long batch. Terminal errors (credit, 400) re-throw.
async function extractWithRetry(args, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try { return await runExtraction(args); }
    catch (e) {
      const msg = String(e?.message || e);
      if (/credit balance|invalid_request|too large|400/.test(msg) && !/429|529|500|502|503|overloaded/i.test(msg)) throw e;
      lastErr = e; await sleep(2000 * (i + 1));
    }
  }
  throw lastErr;
}

export async function runVisionImage(file) {
  const ext = path.extname(file).toLowerCase();
  const mediaType = MEDIA[ext];
  if (!mediaType) return { file, skipped: 'unsupported type' };
  const image = fs.readFileSync(file).toString('base64');
  const extraction = await extractWithRetry({ image, mediaType });
  const room = extractionToRoom(extraction);
  if (!room.walls.length) return { file: path.basename(file), extraction, room, brands: {}, noRoom: true };
  if (room.outOfDomain) return { file: path.basename(file), extraction, room, brands: {}, outOfDomain: room.outOfDomain };
  const brands = runBrands(room);
  return { file: path.basename(file), extraction, room, brands };
}

// Re-score cached extractions (from a prior --json run) without calling the API.
function replay(jsonPath) {
  const prior = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const results = [];
  let pass = 0, total = 0;
  console.log(`\n══ Live-vision REPLAY (${jsonPath}) × ${BRANDS.length} brands ══\n`);
  let outDom = 0;
  for (const p of prior) {
    if (!p.extraction) { console.log(`• ${p.file}: ${p.error || p.skipped || 'no extraction'}`); continue; }
    const room = extractionToRoom(p.extraction);
    if (!room.walls.length) { console.log(`• ${p.file}: no kitchen walls`); results.push({ ...p, noRoom: true }); continue; }
    if (room.outOfDomain) { console.log(`• ${p.file}: out-of-domain — ${room.outOfDomain}`); results.push({ ...p, room, outOfDomain: room.outOfDomain }); outDom++; continue; }
    const brands = runBrands(room);
    const ws = room.walls.map(w => `${w.id}${w.length}`).join('/');
    const allPass = BRANDS.every(b => brands[b].pass);
    pass += allPass ? 1 : 0; total++;
    const line = BRANDS.map(b => `${b[0].toUpperCase()}:${brands[b].pass ? '✓' : '✗(' + (brands[b].failed || []).join(',') + ')'}`).join(' ');
    console.log(`• ${p.file} [${p.extraction.layoutType} ${ws} scale=${p.extraction.scaleStatus}] ${line}`);
    results.push({ ...p, room, brands });
  }
  console.log(`\n══ ${pass}/${total} residential kitchens pass in ALL 3 brands (${outDom} out-of-domain rejected) ══`);
  return results;
}

async function main() {
  // A stray transient rejection from the streaming SDK must not abort the batch
  // (Node 24 exits on unhandledRejection by default).
  process.on('unhandledRejection', (e) => console.error('  [unhandledRejection ignored]', e?.message || e));
  const replayArg = process.argv.indexOf('--replay');
  if (replayArg > -1 && process.argv[replayArg + 1]) { replay(process.argv[replayArg + 1]); return; }
  const dir = process.argv[2];
  if (!dir || !fs.existsSync(dir)) { console.error('usage: node evals/si/run-vision.mjs <dir> [--json out] | --replay <json>'); process.exit(1); }
  if (!process.env.ANTHROPIC_API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1); }
  const files = fs.readdirSync(dir).filter(f => MEDIA[path.extname(f).toLowerCase()]).map(f => path.join(dir, f)).sort();
  const jsonArg = process.argv.indexOf('--json');
  const jsonPath = jsonArg > -1 ? process.argv[jsonArg + 1] : null;
  // Resume: load any prior cache and skip files already extracted (crash-safe —
  // the cache is rewritten after every image, so re-running never re-pays).
  const results = jsonPath && fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : [];
  const done = new Set(results.map(r => r.file));
  const save = () => { if (jsonPath) fs.writeFileSync(jsonPath, JSON.stringify(results, null, 1)); };
  let pass = 0, total = 0;
  console.log(`\n══ Live-vision corpus: ${files.length} images × ${BRANDS.length} brands (${done.size} cached) ══\n`);
  for (const f of files) {
    if (done.has(path.basename(f))) continue;
    process.stdout.write(`• ${path.basename(f)} … `);
    let r;
    try { r = await runVisionImage(f); } catch (e) { console.log(`EXTRACTION FAILED: ${e.message}`); results.push({ file: path.basename(f), error: e.message }); save(); continue; }
    if (r.noRoom) { console.log('no kitchen walls extracted'); results.push(r); save(); continue; }
    if (r.outOfDomain) { console.log(`out-of-domain — ${r.outOfDomain}`); results.push(r); save(); continue; }
    const ws = r.room.walls.map(w => `${w.id}${w.length}`).join('/');
    const line = BRANDS.map(b => `${b[0].toUpperCase()}:${r.brands[b].pass ? '✓' : '✗(' + (r.brands[b].failed || []).join(',') + ')'}`).join(' ');
    const allPass = BRANDS.every(b => r.brands[b].pass);
    pass += allPass ? 1 : 0; total++;
    console.log(`[${r.extraction.layoutType} ${ws} scale=${r.extraction.scaleStatus}] ${line}`);
    results.push(r); save();
  }
  console.log(`\n══ this run: ${pass}/${total} newly-scored kitchens pass; cache now ${results.length} entries ══`);
  save();
}

if (import.meta.url === `file://${process.argv[1]}`) main();
