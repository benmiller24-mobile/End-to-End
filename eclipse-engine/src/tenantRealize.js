/**
 * Realize a solved (W.W.-inch) kitchen in another tenant's catalogue.
 * ===================================================================
 * The layout solver designs in W.W. Wood inch vocabulary (proven, NKBA-aware) —
 * it is the lingua franca every layout is expressed in. For a line that doesn't
 * share that vocabulary — notably a metric, price-group line like pronorm
 * (mm, German order numbers, U/O/H families) — this pass keeps the solved
 * GEOMETRY exactly (positions, widths; the floor plan / elevations / 3D / NKBA
 * all unchanged) and swaps each placed cabinet's SKU to the nearest equivalent
 * product in the target tenant's catalogue, so the EXISTING price-group path
 * reprices it correctly.
 *
 * No brand names live here. The W.W.→target nomenclature is read from the
 * tenant's own `realize` config block (tenant data, not code):
 *
 *   realize: {
 *     base: { plain:'U', sink:'US', corner:'UG', height:76 },
 *     wall: { plain:'O', corner:'OG', heights:[38,51,57,64,70,76,89,90] },
 *     tall: { plain:'H', corner:'HG', heights:[195,201,208,214,220,227] },
 *   }
 *
 *   realizeInTenant(result, getTenant('pronorm'), '6')
 */

const IN_PER_CM = 0.393701;
const norm = (s) => String(s).toUpperCase().replace(/\s+/g, '');

// W.W. SKU / placement → { zone, kind } | null (null = leave as-is: trim, filler,
// true appliance opening). The source side is the fixed W.W. vocabulary.
function classify(cab) {
  const t = cab.type;
  if (t === 'filler' || t === 'end_panel' || t === 'panel' || t === 'toe' ||
      t === 'scribe' || t === 'molding' || t === 'rangeHood' || t === 'valance') return null;
  const sku = cab.sku || '';
  const role = `${cab.role || ''}`.toLowerCase();
  // A sink BASE only — NOT "sinkAdjacent" flankers, which are plain bases.
  const isSink = cab.applianceType === 'sink' || /sink[-\s]?base|^sink$/.test(role) || /^SB/.test(sku);
  // A "sink" appliance backed by a cabinet SKU is a sink BASE (a real cabinet);
  // every other appliance (fridge/range/dishwasher/oven/cooktop) is an opening.
  if (t === 'appliance') { if (isSink && sku) { /* fallthrough as base sink */ } else return null; }
  if (!sku && !isSink) return null;
  const zone = cab._elev?.zone || (t === 'tall' ? 'TALL' : t === 'wall' ? 'UPPER' : 'BASE');
  const isCorner = /BBC|BLC|BDC|WDC|WEC|WLC|EZR|BLIND|CORNER|LSB|DCW|\bBL\b/.test(sku);
  const Z = zone === 'UPPER' || zone === 'ABOVE_TALL' ? 'wall'
          : zone === 'TALL' && t !== 'base' && t !== 'appliance' ? 'tall'
          : t === 'tall' ? 'tall' : 'base';
  const kind = isSink ? 'sink' : isCorner ? 'corner' : 'plain';
  return { zone: Z, kind };
}

// Catalogue rows of an exact family (prefix immediately followed by a digit, so
// 'U' matches U60- but not US/UY/UG), indexed by carcase width (cm).
function familyRows(rows, prefix) {
  const out = [];
  for (const e of rows) {
    if (!e.pg || !(e.w > 0)) continue;
    const n = norm(e.s);
    if (!n.startsWith(prefix)) continue;
    const c = n[prefix.length];
    if (c < '0' || c > '9') continue;                       // next char must be a digit
    const m = n.slice(prefix.length).match(/^(\d{1,3})-(\d{1,3})(?:-(\d{1,4}))?/);
    out.push({ e, w: e.w, h: m ? +m[2] : 0, v: m && m[3] ? m[3] : '' });
  }
  return out;
}

function pickRow(rows, prefix, widthCm, heightCm, group, cache) {
  const key = prefix;
  let full = cache.get(key);
  if (!full) { full = familyRows(rows, prefix); cache.set(key, full); }
  if (!full.length) return null;
  // Only bodies that actually carry a price at the ACTIVE group are eligible —
  // some carcase heights (e.g. 90cm walls) are dashed for the premium veneer
  // groups, so this also steers height selection to a priced standard body.
  const pricedPool = full.filter(r => r.e.pg[group] != null);
  const pool = pricedPool.length ? pricedPool : full;
  // nearest carcase height first (keeps standard bodies, not 12cm drawer oddities)
  let bestH = pool[0].h, hd = Infinity;
  if (heightCm > 0) for (const r of pool) { const d = Math.abs(r.h - heightCm); if (d < hd) { hd = d; bestH = r.h; } }
  let atH = heightCm > 0 ? pool.filter(r => r.h === bestH) : pool;
  // nearest carcase width
  let bestW = atH[0].w, wd = Infinity;
  for (const r of atH) { const d = Math.abs(r.w - widthCm); if (d < wd) { wd = d; bestW = r.w; } }
  let cand = atH.filter(r => r.w === bestW);
  // prefer the plain '-01' door body; else the median-priced body (avoid the
  // cheapest, which is a stripped/degenerate unit, and the dearest, loaded one)
  const plain = cand.filter(r => r.v === '01' || r.v === '1');
  if (plain.length) cand = plain;
  cand.sort((a, b) => (a.e.pg[group] ?? a.e.p ?? 1e9) - (b.e.pg[group] ?? b.e.p ?? 1e9));
  return cand[Math.floor((cand.length - 1) / 2)].e;
}

export function realizeInTenant(result, tenant, group) {
  const cfg = tenant?.realize;
  if (!cfg || !tenant?.catalog || !tenant.pricing?.priceGroups) return result;
  const g = group != null ? String(group) : (tenant.pricing.activeGroup ?? tenant.pricing.defaultGroup ?? '0');
  const rows = tenant.catalog.list();
  const cache = new Map();
  let swapped = 0, priced = 0, skipped = 0;

  const remap = (cab) => {
    if (!cab) return;
    const cls = classify(cab);
    if (!cls) { skipped++; return; }
    const zc = cfg[cls.zone]; if (!zc) { skipped++; return; }
    const prefix = zc[cls.kind] || zc.plain;
    const widthCm = Math.round(cab.width / IN_PER_CM);
    const heightCm = cls.zone === 'base' ? (zc.height || 76)
      : nearest(zc.heights, Math.round((cab.height || cab._elev?.height || 0) / IN_PER_CM));
    const row = pickRow(rows, prefix, widthCm, heightCm, g, cache);
    if (!row) { skipped++; return; }
    cab._wwSku = cab._wwSku || cab.sku;
    cab.sku = row.s;
    const p = row.pg[g] ?? row.pg.N ?? row.p;
    if (p != null) { cab._price = p; cab._priceGroup = g; priced++; }
    swapped++;
  };

  for (const wl of (result.walls || [])) for (const c of (wl.cabinets || [])) remap(c);
  for (const ul of (result.uppers || [])) for (const c of (ul.cabinets || [])) remap(c);
  for (const t of (result.talls || [])) remap(t);
  for (const c of (result.placements || [])) remap(c);            // the pricing source
  for (const c of ((result.island && result.island.workSide) || [])) remap(c);
  for (const c of ((result.island && result.island.cabinets) || [])) remap(c);

  result._realizedTenant = tenant.id;
  result._realizeReport = { swapped, priced, skipped, group: g };
  return result;
}

function nearest(arr, x) {
  if (!arr || !arr.length || !(x > 0)) return 0;
  let best = arr[0], bd = Infinity;
  for (const v of arr) { const d = Math.abs(v - x); if (d < bd) { bd = d; best = v; } }
  return best;
}
