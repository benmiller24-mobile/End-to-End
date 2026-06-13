/**
 * Price a 2020-Design / Cyncly export in all three lines.
 * =======================================================
 * Reads every cabinet label off the design PDF, decodes its dimensions
 * (decode2020), maps it to each line's catalogue by FUNCTION+SIZE, and prices it:
 *   • Eclipse / Shiloh — W.W. catalogue via calculateLayoutPrice, with the order's
 *     actual door / finish / construction options applied (gap a).
 *   • pronorm — realized to the nearest metric body at STANDARD carcase heights
 *     (base 76 / wall priced-nearest / tall ≥195) at the chosen front group (gap c).
 *
 *   node tools/price-2020.mjs <design.pdf> [--door=Slab --species="Paint Grade" --group=6]
 */
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const here = new URL('.', import.meta.url).pathname;
const pdfjs = await import(require.resolve('pdfjs-dist/legacy/build/pdf.mjs', { paths: [here + '../frontend'] }));
const { getTenant, setActiveTenant, setTenantPriceGroup } = await import('../eclipse-pricing/src/tenants/index.js');
const { calculateLayoutPrice } = await import('../eclipse-pricing/src/pricingEngine.js');
const { findSkuNormalized, setPricingBrand } = await import('../frontend/src/skuResolver.js');
const { decode2020 } = await import('./decode2020.mjs');

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const path = process.argv[2];
const group = arg('group', '6');
const config = {
  species: arg('species', 'Paint Grade'), construction: arg('construction', 'Standard'),
  door: arg('door', 'Slab'), drawerFront: 'DF-' + arg('door', 'Slab'), drawerBox: '5/8-STD', profile: arg('profile', 'frameless'),
};

// ── read every cabinet label off the floor plan ──
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path)), useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
const labels = [];
for (let pn = 1; pn <= doc.numPages; pn++) {
  const tc = await (await doc.getPage(pn)).getTextContent();
  for (const it of tc.items) { const s = (it.str || '').trim(); if (/^[A-Z][A-Z0-9.\-x/]{3,}$/.test(s) && /\d/.test(s) && !/^DRAWING|^EL\b/i.test(s)) labels.push(s); }
}
const decoded = labels.map(decode2020);
const cabs = decoded.filter(d => !d.isAppliance && !d.panel && d.widthIn > 0);
const apps = decoded.filter(d => d.isAppliance);

// ── function+size → canonical W.W. SKU ──
const std = (w, set) => set.reduce((a, b) => Math.abs(b - w) < Math.abs(a - w) ? b : a);
const BW = [9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 42, 48];
function canonical(d) {
  const w = Math.round(d.widthIn);
  if (d.zone === 'wall') { const ww = std(w, [12, 15, 18, 21, 24, 27, 30, 33, 36, 42]); const h = std(d.heightIn || 30, [12, 15, 18, 24, 30, 36, 42]); return d.corner ? `WBC2442` : `W${ww}${h}`; }
  if (d.zone === 'tall') { const ww = std(w, [12, 15, 18, 24, 30, 33, 36]); return `U${ww}`; }
  if (d.sink && d.corner) return `BLSB${std(w, [33, 36])}-PH`;
  if (d.corner) return `BLSB${std(w, [33, 36])}-PH`;
  if (d.sink) return `SB${std(w, [18, 21, 24, 27, 30, 33, 36, 42, 48])}`;
  if (d.drawers >= 1) return `B${d.drawers >= 4 ? 4 : 3}D${std(w, BW)}`;
  return `B${std(w, BW)}`;
}

function priceWW(brand) {
  setPricingBrand(brand);
  const placements = cabs.map(d => ({ sku: canonical(d), _from: d.sku, qty: 1 }));
  const res = calculateLayoutPrice(placements, config, findSkuNormalized);
  let exact = 0, normalized = 0, substituted = 0, missing = 0;
  for (const it of res.items) { if (it.error) missing++; else if (it._resolution === 'substituted') substituted++; else if (it._resolution === 'normalized') normalized++; else exact++; }
  return { brand, subtotal: Math.round(res.subtotal), exact, normalized, substituted, missing, items: res.items };
}

// ── pronorm with STANDARD carcase heights (gap c) ──
const IN_PER_CM = 0.393701;
function pricePronorm() {
  const t = getTenant('pronorm'); setActiveTenant('pronorm'); setTenantPriceGroup('pronorm', group);
  const rows = t.catalog.list();
  const pick = (letter, wcm, hcmBand, wantSink) => {
    let pool = rows.filter(e => { if (!e.pg || !(e.w > 0) || e.pg[group] == null) return false; const n = String(e.s).toUpperCase().replace(/\s+/g, ''); const c = n[letter.length]; return n.startsWith(letter) && c >= '0' && c <= '9'; });
    if (wantSink) { const s = pool.filter(e => /^US/.test(String(e.s).toUpperCase().replace(/\s+/g, ''))); if (s.length) pool = s; }
    if (!pool.length) return null;
    // standard carcase height for the zone
    const hOf = (e) => { const m = String(e.s).toUpperCase().replace(/\s+/g, '').slice(letter.length).match(/^\d+-(\d+)/); return m ? +m[1] : 0; };
    if (hcmBand) { let bh = pool[0] && hOf(pool[0]), bd = Infinity; for (const e of pool) { const d = Math.abs(hOf(e) - hcmBand); if (d < bd) { bd = d; bh = hOf(e); } } pool = pool.filter(e => hOf(e) === bh); }
    let best = pool[0], bd = Infinity; for (const e of pool) { const d = Math.abs(e.w - wcm); if (d < bd) { bd = d; best = e; } }
    return best;
  };
  let total = 0, matched = 0, unmatched = 0; const detail = [];
  for (const d of cabs) {
    const letter = d.zone === 'wall' ? 'O' : d.zone === 'tall' ? 'H' : (d.sink ? 'US' : 'U');
    const hBand = d.zone === 'base' ? 76 : d.zone === 'tall' ? 208 : 0;   // standard base 76, tall ~208, wall nearest-priced
    const row = pick(letter, Math.round(d.widthIn / IN_PER_CM), hBand, d.sink);
    if (!row) { unmatched++; detail.push({ from: d.sku, to: '—', price: 0 }); continue; }
    total += row.pg[group]; matched++; detail.push({ from: d.sku, to: row.s, price: row.pg[group] });
  }
  return { subtotal: Math.round(total), matched, unmatched, detail };
}

const ecl = priceWW('eclipse'), shi = priceWW('shiloh'), pn = pricePronorm();
console.log(`\n${path.split('/').pop()}`);
console.log(`${cabs.length} cabinets + ${apps.length} appliances/fixtures (${apps.map(a => a.appliance).join(', ')})`);
console.log(`config: door ${config.door} · ${config.species} · ${config.construction} · pronorm group ${group}\n`);
const g = (r) => `exact ${r.exact} · norm ${r.normalized} · subst ${r.substituted} · missing ${r.missing}`;
console.log(`── ECLIPSE  $${ecl.subtotal.toLocaleString()}   (${g(ecl)})`);
console.log(`── SHILOH   $${shi.subtotal.toLocaleString()}   (${g(shi)})`);
console.log(`── PRONORM  €${pn.subtotal.toLocaleString()}   (matched ${pn.matched}, unmatched ${pn.unmatched})`);
console.log('\nEclipse mapping:');
for (const it of ecl.items) console.log(`  ${(it._from || '').padEnd(24)} → ${(it.error ? 'NOT FOUND' : (it.s || '')).padEnd(12)} $${Math.round(it.totalPrice || 0).toString().padStart(6)} [${it._resolution || it.error ? (it._resolution || 'missing') : ''}]`);
