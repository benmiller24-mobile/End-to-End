/**
 * Re-price an extracted cabinet order in every line (Eclipse, Shiloh, pronorm).
 * The dealer's real-world ask: "here's my design — what does it cost, and is it
 * orderable, in each of our lines?" Eclipse/Shiloh price through the W.W. catalog
 * (calculateLayoutPrice); pronorm realizes each W.W. cabinet to its nearest
 * metric equivalent and prices it at the chosen front's price group.
 *
 *   node tools/price-order.mjs /tmp/creek_order.json
 */
import fs from 'fs';
import { getTenant, setActiveTenant, setTenantPriceGroup } from '../eclipse-pricing/src/tenants/index.js';
import { calculateLayoutPrice } from '../eclipse-pricing/src/pricingEngine.js';
import { findSkuNormalized, setPricingBrand } from '../frontend/src/skuResolver.js';
import { crosswalk, dims } from './orderCrosswalk.mjs';

const order = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const kitchen = order.areas.find(a => /kitchen/i.test(a.area)) || order.areas[0];
// Real orderable cabinets: qty>=1, exclude pure modifiers (qty 0) and bulk trim
// sold by the linear foot (crown/scribe/toe/filler) which price separately.
const TRIM = /^(MCB|MTK|MPS|MOCL|BF\d|TF\d|WF\d|BP\d|TEP|RTK|WWD|BWD|WRBF|FCB|BDD)/i;
const lines = kitchen.lineItems.filter(li => (li.qty || 0) >= 1);
const cabs = lines.filter(li => !TRIM.test(li.productCode.replace(/\s/g, '')));
const trim = lines.filter(li => TRIM.test(li.productCode.replace(/\s/g, '')));

console.log(`\nOrder: ${kitchen.area} — ${kitchen.doorStyle} / ${kitchen.finish}`);
console.log(`${cabs.length} cabinet lines + ${trim.length} trim/panel lines\n`);

// ── Eclipse / Shiloh: native W.W. catalog pricing ──
function priceWW(brand, config) {
  setPricingBrand(brand);
  const placements = cabs.map(li => ({ sku: crosswalk(li.productCode), _orig: li.productCode, qty: li.qty }));
  const res = calculateLayoutPrice(placements, config, findSkuNormalized);
  let exact = 0, normalized = 0, substituted = 0, missing = 0;
  for (const it of res.items) {
    if (it.error) { missing++; continue; }
    if (it._resolution === 'substituted') substituted++;
    else if (it._resolution === 'normalized') normalized++;
    else exact++;
  }
  return { brand, subtotal: Math.round(res.subtotal), exact, normalized, substituted, missing, items: res.items };
}

// ── pronorm: realize each W.W. cabinet → nearest metric equivalent at a group ──
const IN_PER_CM = 0.393701;
function pricePronorm(group = '6') {
  const t = getTenant('pronorm');
  setActiveTenant('pronorm'); setTenantPriceGroup('pronorm', group);
  const rows = t.catalog.list();
  const fam = (letter, wcm, wantSink, wantCorner) => {
    const cand = rows.filter(e => {
      if (!e.pg || !(e.w > 0)) return false;
      const n = String(e.s).toUpperCase().replace(/\s+/g, '');
      if (!n.startsWith(letter)) return false; const c = n[letter.length];
      return c >= '0' && c <= '9' && e.pg[group] != null;
    });
    let pool = cand;
    if (wantSink) { const s = cand.filter(e => /^US/.test(String(e.s).toUpperCase().replace(/\s/g, ''))); if (s.length) pool = s; }
    if (!pool.length) return null;
    let best = pool[0], bd = Infinity;
    for (const e of pool) { const d = Math.abs(e.w - wcm); if (d < bd) { bd = d; best = e; } }
    return best;
  };
  let total = 0, matched = 0, unmatched = 0; const detail = [];
  for (const li of cabs) {
    const canon = crosswalk(li.productCode);
    const { widthIn, zone } = dims(canon);
    if (!(widthIn > 0)) { unmatched += li.qty; detail.push({ sku: li.productCode, to: '—', price: 0 }); continue; }
    const letter = zone === 'wall' ? 'O' : zone === 'tall' ? 'H' : 'U';
    const wantSink = /^SB|^BS|sink/i.test(canon) || /sink/i.test(li.description);
    const row = fam(wantSink ? 'US' : letter, Math.round(widthIn / IN_PER_CM), wantSink);
    if (!row) { unmatched += li.qty; detail.push({ sku: li.productCode, to: '—', price: 0 }); continue; }
    const p = row.pg[group];
    total += p * li.qty; matched += li.qty;
    detail.push({ sku: li.productCode, w: widthIn, to: row.s, price: p, qty: li.qty });
  }
  return { brand: 'pronorm', group, subtotal: Math.round(total), matched, unmatched, detail };
}

const ecl = priceWW('eclipse', { species: 'Paint Grade', construction: 'Standard', door: 'Slab', drawerFront: 'DF-Slab', drawerBox: '5/8-STD', profile: 'frameless' });
const shi = priceWW('shiloh', { species: 'Paint Grade', construction: 'Standard', door: 'Slab', drawerFront: 'DF-Slab', drawerBox: '5/8-STD', profile: 'inset' });
const pn = pricePronorm('6');

const grade = (r) => `exact ${r.exact} · normalized ${r.normalized} · substituted ${r.substituted} · missing ${r.missing}`;
console.log('── ECLIPSE ──   $' + ecl.subtotal.toLocaleString() + '   (' + grade(ecl) + ')');
console.log('── SHILOH  ──   $' + shi.subtotal.toLocaleString() + '   (' + grade(shi) + ')');
console.log('── PRONORM ──   €' + pn.subtotal.toLocaleString() + '   (group ' + pn.group + ' list; matched ' + pn.matched + ', unmatched ' + pn.unmatched + ')');

console.log('\nPer-line (Eclipse resolution):');
for (const it of ecl.items) console.log(`  ${String(it.qty).padStart(2)} × ${(it.sku||'').padEnd(12)} → ${it.error ? 'NOT FOUND' : (it.s||'').padEnd(14)+' $'+Math.round(it.totalPrice).toString().padStart(6)+'  ['+(it._resolution||'')+(it._fallback?'/fb:'+it._fallback:'')+']'}`);
console.log('\nPer-line (pronorm realization):');
for (const d of pn.detail) console.log(`  ${(d.sku||'').padEnd(12)} ${d.w?('w'+d.w+'in').padEnd(7):'       '} → ${d.to.padEnd(14)} ${d.price?('€'+d.price):'unmatched'}`);
