/**
 * Spec-book ingest CORE — pure functions shared by the CLI
 * (tools/ingest-spec-book.mjs) and the in-app "Add product line" uploader.
 * No filesystem, no manufacturer names: everything tenant-specific arrives
 * in the config object.
 *
 * Input: a Map of pageNumber → page text. Output: a validated tenant
 * package (the registry's zero-code onboarding format).
 */

const dequote = (s) => s.replace(/[”“"]/g, '"');

export function pageInRange(n, spec) {
  if (!spec) return true;
  return String(spec).split(',').some(r => {
    const [a, b] = r.split('-').map(s => parseInt(s, 10));
    return b ? n >= a && n <= b : n === a;
  });
}

/** W.W.-style matrix: row codes carry a `--` height placeholder (variant
 *  suffix allowed after it: `W24-- -2D`), a `Width 24" 27"…` header names
 *  the columns, bare integers in range are the prices in row-major order. */
export function parseMatrix(pageText, p = {}, pageNo = 0) {
  const text = dequote(pageText);
  const codeRe = new RegExp(p.codePattern || '\\b([A-Z]{1,8}\\d{1,2}(?: 1/2)?)--( ?-[A-Z0-9]{1,4})?', 'g');
  const codes = [...text.matchAll(codeRe)].map(m => ({ code: m[1], suffix: (m[2] || '').replace(/\s/g, '') }));
  if (codes.length < (p.minCodes ?? 2)) return [];
  // Header detection must survive both extractors: PDFKit keeps 'Width 24"…'
  // intact, pdf.js letter-spaces the keyword ('w idth 12" 15"…') and may
  // order the header line after the price rows.
  const kw = new RegExp((p.headerLabel || 'Width').split('').join('\\s?'), 'i');
  const lines = text.split('\n');
  const quotedDims = (l) => (l.match(/\d+(?: 1\/2)?"/g) || []).length;
  const headerLine = lines.find(l => kw.test(l) && quotedDims(l) >= 2)
    || lines.find(l => quotedDims(l) >= 3);
  if (!headerLine) return [];
  const heights = (headerLine.match(/(\d+(?: 1\/2)?)"/g) || []).map(h => h.replace(/"$/, '').replace(' 1/2', '.5'));
  if (heights.length < 2) return [];
  const scanPrices = (chunk) => [...chunk.matchAll(/(?<!["\d/])(\d{2,5})(?!["\d/])/g)]
    .map(m => parseInt(m[1], 10))
    .filter(n => n >= (p.minPrice ?? 50) && n <= (p.maxPrice ?? 20000));
  let nums = scanPrices(text.slice(text.indexOf(headerLine)));
  if (nums.length !== codes.length * heights.length) nums = scanPrices(text);   // header below rows
  if (nums.length !== codes.length * heights.length) return [];   // true shape mismatch → skip honestly
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

/** Line-per-SKU books: regex with named groups sku + price. */
export function parseRows(pageText, p, pageNo = 0) {
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

/**
 * European-modular price-group tables (pronorm and similar): each cabinet row
 * is `order-no` + a run of prices, one per price GROUP (columns N,0,1…8,10),
 * with the chosen front range later selecting which column applies. Robust
 * against dimension digits in the description by binding prices to the price
 * COLUMNS via their x-positions: a header row (the group labels) gives the
 * column centers; each row's integers are assigned to the nearest column, so
 * description/width/door numbers (far-left) never leak into the price vector.
 *
 * Input is positioned tokens, not flat text: pages = Map(n → [{s,x,y}]).
 * Config: { groups: ['N','0',…,'10'], orderPattern, columns?: [x…],
 *           headerLabels?: ['N','0',…], minPrice, maxPrice }.
 */
export function parsePriceGroupPage(items, p = {}, pageNo = 0, carry = {}) {
  const groups = p.groups || ['N', '0', '1', '2', '3', '4', '5', '6', '7', '8', '10'];
  const orderRe = new RegExp(p.orderPattern || '^[A-Z][A-Z0-9]{0,3} ?\\d{2,3}-\\d{2,4}(?:-\\d{2,4})?$');
  const byY = new Map();
  for (const it of items) { const y = Math.round(it.y / 2) * 2; (byY.get(y) || byY.set(y, []).get(y)).push(it); }

  // Column centers: the header row whose tokens are exactly the group labels.
  // Carried forward across pages (fixed template) when a page omits the header.
  let cols = carry.cols || null;
  for (const [, row] of byY) {
    const sorted = row.slice().sort((a, b) => a.x - b.x);
    const labels = sorted.map(t => t.s);
    const hit = labels.filter(s => groups.includes(s)).length;
    if (hit >= Math.min(groups.length, 8) && labels.length <= groups.length + 1) {
      cols = sorted.filter(t => groups.includes(t.s)).map(t => ({ g: t.s, x: t.x }));
      break;
    }
  }
  if (!cols) return { rows: [], cols: null };
  const firstColX = Math.min(...cols.map(c => c.x)) - 9;   // prices live at/after the first column
  carry.cols = cols;

  const rows = [];
  for (const [, row] of byY) {
    const sorted = row.slice().sort((a, b) => a.x - b.x);
    const orderTok = sorted.find(t => orderRe.test(t.s.trim()));
    if (!orderTok) continue;
    const sku = orderTok.s.trim().replace(/\s+/g, ' ');
    const pg = {};
    for (const t of sorted) {
      if (t.x < firstColX) continue;                       // skip description/width/door columns
      if (!/^\d{2,5}$/.test(t.s)) continue;
      const v = parseInt(t.s, 10);
      if (v < (p.minPrice ?? 30) || v > (p.maxPrice ?? 99999)) continue;
      // nearest price column by x
      let best = null, bd = Infinity;
      for (const c of cols) { const d = Math.abs(c.x - t.x); if (d < bd) { bd = d; best = c; } }
      if (best && bd <= 14) pg[best.g] = v;
    }
    const priced = Object.keys(pg).length;
    if (priced < 1) continue;
    // width from the order number's leading size group (cm), e.g. HSP 60-201 → 60
    const wm = sku.match(/[A-Z] ?(\d{2,3})-/);
    const width = wm ? parseInt(wm[1], 10) : 0;
    const def = p.defaultGroup && pg[p.defaultGroup] != null ? pg[p.defaultGroup]
      : pg['0'] ?? pg.N ?? pg[Object.keys(pg)[0]];
    rows.push({ s: sku, p: def, pg, w: width, _page: pageNo });
  }
  return { rows, cols };
}

/**
 * Run the configured parsers over the pages and assemble a tenant package.
 * Returns { pkg, report } — report carries counts, samples and PROBLEMS;
 * callers must treat problems as a failed ingest.
 */
export function ingestPages(pages, cfg) {
  let all = [];
  const parserStats = [];
  for (const parser of (cfg.extract?.parsers || [{ kind: 'matrix' }])) {
    let hits = 0, pagesHit = 0;
    const carry = {};   // price-group parser carries column geometry across pages
    for (const [n, page] of pages) {
      if (!pageInRange(n, parser.pages ?? cfg.extract?.pages)) continue;
      let rows;
      if (parser.kind === 'priceGroupRows') {
        // positioned tokens required (array of {s,x,y}); flat-text pages skipped
        rows = Array.isArray(page) ? parsePriceGroupPage(page, parser, n, carry).rows : [];
      } else if (parser.kind === 'rows') {
        rows = parseRows(page, parser, n);
      } else {
        rows = parseMatrix(page, parser, n);
      }
      if (rows.length) { pagesHit++; hits += rows.length; all.push(...rows); }
    }
    parserStats.push({ kind: parser.kind || 'matrix', rows: hits, pages: pagesHit });
  }

  const typeRules = (cfg.extract?.typeRules || DEFAULT_TYPE_RULES).map(r => [new RegExp(r.pattern), r.t]);
  for (const row of all) {
    row.t = (typeRules.find(([re]) => re.test(row.s)) || [])[1] || 'X';
    row.r = (cfg.id || 'tenant').toUpperCase();
    delete row._page;
  }

  const problems = [];
  const seen = new Map();
  for (const row of all) {
    if (!row.s || typeof row.p !== 'number' || !(row.p > 0)) problems.push(`bad row ${JSON.stringify(row)}`);
    if (seen.has(row.s) && seen.get(row.s) !== row.p) problems.push(`duplicate SKU with differing price: ${row.s} ${seen.get(row.s)} vs ${row.p}`);
    seen.set(row.s, row.p);
  }
  all = [...new Map(all.map(r => [r.s, r])).values()];
  if (all.length < (cfg.extract?.minRows ?? 10)) problems.push(`only ${all.length} rows extracted (< minRows ${cfg.extract?.minRows ?? 10})`);

  const byType = {};
  for (const r of all) byType[r.t] = (byType[r.t] || 0) + 1;

  const pkg = {
    id: cfg.id,
    branding: cfg.branding || {},
    locale: cfg.locale || { units: 'in', currency: 'USD' },
    constructions: cfg.constructions || ['eclipse_frameless'],
    defaultConstruction: cfg.defaultConstruction || (cfg.constructions || ['eclipse_frameless'])[0],
    validation: cfg.validation || { styleCompat: false },
    pricing: cfg.pricing || { fallbackTenant: null },
    coverFields: cfg.coverFields || undefined,
    coverSheet: cfg.coverSheet || undefined,
    catalog: {
      sections: cfg.sections || {},
      typeNames: cfg.typeNames || { B: 'Base', W: 'Wall', T: 'Tall', V: 'Vanity', A: 'Accessory', M: 'Moulding', F: 'Fillers', X: 'Other' },
      rows: all,
    },
    _meta: { source: cfg.sourceName || '', rowCount: all.length },
  };
  return {
    pkg,
    report: {
      parserStats, problems,
      count: all.length, byType,
      samples: all.slice(0, 6).map(r => `${r.s} $${r.p}`),
    },
  };
}

export const DEFAULT_TYPE_RULES = [
  { pattern: '^(WBC|SWC|WSC|RW|PW|PWA|AW|AEW|AAG|SWG|SGD|WGD|MWS|MW|W\\d|SW\\d)', t: 'W' },
  { pattern: '^(BBC|BL|BD|B\\d|SB|DB\\d|VSB|PB)', t: 'B' },
  { pattern: '^(U\\d|UT|UV|UVT|OC|O\\d|BK|TS|TSD|TSVA|TSVAD)', t: 'T' },
  { pattern: '^(V\\d|VB|VD)', t: 'V' },
  { pattern: '^(RH|A\\d)', t: 'A' },
  { pattern: '^F\\d', t: 'F' },
];
