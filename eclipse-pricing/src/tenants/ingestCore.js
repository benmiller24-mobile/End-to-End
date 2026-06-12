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
 * Run the configured parsers over the pages and assemble a tenant package.
 * Returns { pkg, report } — report carries counts, samples and PROBLEMS;
 * callers must treat problems as a failed ingest.
 */
export function ingestPages(pages, cfg) {
  let all = [];
  const parserStats = [];
  for (const parser of (cfg.extract?.parsers || [{ kind: 'matrix' }])) {
    let hits = 0, pagesHit = 0;
    for (const [n, text] of pages) {
      if (!pageInRange(n, parser.pages ?? cfg.extract?.pages)) continue;
      const rows = parser.kind === 'rows' ? parseRows(text, parser, n) : parseMatrix(text, parser, n);
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
