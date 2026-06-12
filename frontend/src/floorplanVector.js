/**
 * Deterministic design-PDF importer (Cyncly / 2020 ".kit" exports).
 * ==================================================================
 * Text-layer design drawings carry everything needed to rebuild the kitchen:
 * the PLAN page prints every cabinet label at its plan position plus the
 * overall wall dimension chains. This module recovers walls + placed cabinets
 * from those positioned glyphs — no AI, no key, byte-deterministic — which is
 * what makes the competitive re-quote workflow trustworthy.
 *
 * Pure functions take "positioned pages" ([{pageNo, items:[{s,x,y}]}]) so the
 * node eval harness exercises the exact code the browser runs; the only
 * browser-bound export is extractPositionedPages (lazy pdf.js).
 *
 * Validated against the Mautz (.kit, 3 walls + island) and Christiansen
 * drawing sets — see evals/floorplan/.
 */
import { skuInfo } from './manualDesign.js';

// ── Label recognition ────────────────────────────────────────────────────────
// Cyncly prints W.W.-style codes verbatim ("U22 1/293R", "W28.539",
// "FREP3/4 93FTK24L"). A token is a cabinet label when it looks like a code
// AND we can derive a width for it.
const LABEL_RE = /^F?C?-?[A-Z]{1,6}\s?[\d/]/;
const NOT_LABELS = /^(PLAN|FRIDGE|SINK|RANGE|ISLAND|ELEVATION|Drawing|Note|Designed|Printed)/i;
// Cabinet families the drawing software prints (W.W./Cyncly nomenclature).
// Appliance model numbers (MEDS302WS, CIT367YGS, MD24WS…) must NOT pass —
// they ride on prose notes, not cabinet boxes.
const FAMILY_RE = /^(F?C?-?)(B{1,2}C?|SB|DSB|SBA|VSB|BL|BWDM[WAB]|BWS|BWC|BO|BD|B\dD|BEP|BPOS|BTD|BKI|W|SW{1,2}C?|RW|WSE|WBC|MWS?|AW|AEW|U[VT]?|OC|PW|BK|T[SPC]?|V[BD]?|F\d|FREP|REP|WEP|VEP|TEP|IWS|NTK|DB|PB|LD|FIO|EDG|PNL)\s?[\d/]/;

/** Width/zone straight from the label text (Cyncly conventions), falling back
 *  to the studio's catalog-aware skuInfo. Returns null when not a cabinet. */
export function labelDims(label, brand = 'eclipse') {
  // Strip trailing bare-integer runs — dimension glyphs pdf.js sometimes
  // joins onto the label's text run ("RW3624 125 1 8" → "RW3624").
  const s = String(label).trim().replace(/\s+/g, ' ').replace(/(\s+\d+)+$/, '');
  if (!LABEL_RE.test(s) || NOT_LABELS.test(s) || !FAMILY_RE.test(s)) return null;

  // Panels & skins: FREP3/4 93FTK24L, BEP3/4L-FTK, REP…  → thin verticals.
  if (/^F?(REP|BEP|WEP|VEP|TEP)/i.test(s)) {
    const tall = /^F?REP/i.test(s);
    return { width: 0.75, zone: tall ? 'tall' : 'base', height: tall ? 93 : 34.5, panel: true };
  }
  // Fillers: F393 → 3" x 93 tall · F339 → 3" x 39 upper · F634 1/2 → 6" x 34.5 base.
  const f = s.match(/^F(\d)(\d{2})(?: 1\/2)?$/);
  if (f) {
    const h = parseInt(f[2], 10) + (/ 1\/2$/.test(s) ? 0.5 : 0);
    return { width: parseInt(f[1], 10), height: h, zone: h > 84 ? 'tall' : h > 36 ? 'upper' : 'base', filler: true };
  }

  // General case: letters, then a digit run. Cyncly width encoding:
  //   2 digits → width (SB36, B24-2D, BBC45R, IWS30, BWDMW18)
  //   4 digits → width+height (W3624, RW3624, W1239R, WSE2430-39R)
  //   fraction → fractional width, then optional height digits
  //   ("U22 1/293R" → 22.5 x 93, "W28.539" → 28.5 x 39)
  // B3D15-style drawer stacks carry the count before D — width follows.
  const clean = s.replace(/^FC-?/, '');
  let prefix, width = 0, hDigits = null;
  const dd = clean.match(/^(B\d|FD\d?|VTSB\d)D(\d{2})/);
  const frac = clean.match(/^([A-Z]+)(\d{1,2})(?:\.5| 1\/2)(\d{2})?/);
  const run = clean.match(/^([A-Z]+)(\d{2,4})/);
  if (dd) { prefix = 'B'; width = parseInt(dd[2], 10); }
  else if (frac) { prefix = frac[1]; width = parseInt(frac[2], 10) + 0.5; hDigits = frac[3] || null; }
  else if (run) {
    prefix = run[1];
    const d = run[2];
    width = parseInt(d.slice(0, 2), 10);
    if (d.length === 4) hDigits = d.slice(2);
  } else {
    // Label conventions failed — last chance: the tenant catalog knows it.
    try {
      const info = skuInfo(s, brand);
      if (info && info.w > 0) return { width: info.w, height: info.h || 34.5, zone: info.zone || 'base' };
    } catch { /* not a cabinet */ }
    return null;
  }
  if (!(width > 0) || width > 60) return null;

  const zone = /^(W|RW|WSE|SW|MWS|AW)/.test(prefix) ? 'upper'
    : /^(U|UT|UV|T|OC|PW|BK)/.test(prefix) ? 'tall'
    : 'base';
  let height = hDigits ? parseInt(hDigits, 10)
    : zone === 'upper' ? 36 : zone === 'tall' ? 93 : 34.5;
  const dash = s.match(/-(\d{2})[LR]?$/);
  if (zone === 'upper' && dash) height = parseInt(dash[1], 10);
  // The label is ground truth for geometry — Cyncly prints the CUT width
  // (W28.539 = 28.5"), while the orderable SKU rounds up (W3039). Don't let
  // a catalog lookup overwrite it.
  return { width, height, zone };
}

// ── Dimension reassembly ─────────────────────────────────────────────────────
// Cyncly fragments "125 1/8\"" into separate glyph runs: whole, numerator,
// denominator, quote — stacked or side-by-side depending on text rotation.
// Pair proper fractions (den ∈ 2/4/8/16/32, num < den) with the nearest whole.
export function parseDims(items) {
  const toks = items
    .map(t => ({ ...t, n: /^\d+$/.test(t.s) ? parseInt(t.s, 10) : null, q: /^\d+(?: \d+\/\d+)?"$/.test(t.s) || t.s === '"' }))
    .filter(t => t.n !== null || t.q);
  const used = new Set();
  const dims = [];

  // Complete printed dims first: 64" / 36 3/4" as a single token.
  for (const t of toks) {
    const m = t.s.match(/^(\d+)(?: (\d+)\/(\d+))?"$/);
    if (m) { dims.push({ v: parseInt(m[1], 10) + (m[2] ? m[2] / m[3] : 0), x: t.x, y: t.y }); used.add(t); }
  }
  // Fraction pairs.
  const ints = toks.filter(t => t.n !== null && !used.has(t));
  for (let i = 0; i < ints.length; i++) for (let j = 0; j < ints.length; j++) {
    const num = ints[i], den = ints[j];
    if (i === j || used.has(num) || used.has(den)) continue;
    if (![2, 4, 8, 16, 32].includes(den.n) || num.n >= den.n) continue;
    if (Math.abs(num.x - den.x) > 10 || Math.abs(num.y - den.y) > 10) continue;
    // Stacked: numerator above; side-by-side: numerator first (left).
    if (Math.abs(num.x - den.x) <= 2 ? num.y <= den.y : num.x >= den.x) continue;
    // Nearest unused whole within reach (can carry its own trailing quote).
    let whole = null, best = 36;
    for (const w of ints) {
      if (w === num || w === den || used.has(w)) continue;
      const d = Math.hypot(w.x - num.x, w.y - num.y);
      if (d < best) { best = d; whole = w; }
    }
    used.add(num); used.add(den);
    if (whole) {
      used.add(whole);
      dims.push({ v: whole.n + num.n / den.n, x: whole.x, y: whole.y });
    } else {
      dims.push({ v: num.n / den.n, x: num.x, y: num.y });
    }
  }
  // Remaining bare ints that sit next to a lone quote glyph.
  for (const t of ints) {
    if (used.has(t)) continue;
    const q = toks.find(o => o.s === '"' && !used.has(o) && Math.hypot(o.x - t.x, o.y - t.y) < 30);
    if (q) { used.add(t); used.add(q); dims.push({ v: t.n, x: t.x, y: t.y }); }
  }
  return dims;
}

// ── Plan-page reconstruction ─────────────────────────────────────────────────
export function looksLikeDesignPdf(pagesPos, brand = 'eclipse') {
  let hits = 0;
  for (const p of pagesPos) for (const it of p.items) if (labelDims(it.s, brand)) hits++;
  return hits >= 5;
}

/**
 * pagesPos: [{pageNo, items: [{s, x, y}]}]  (PDF user space, y up)
 * Returns { walls, wallItems, island, islandItems, layoutType, report } —
 * walls in app shape, items ready to seed the Design Studio.
 */
export function parseDesignPdf(pagesPos, brand = 'eclipse') {
  // The PLAN page: the page whose top/bottom margin says PLAN, else the page
  // with the most recognizable labels.
  const score = (p) => p.items.filter(it => labelDims(it.s, brand)).length;
  const plan = pagesPos.find(p => p.items.some(it => it.s === 'PLAN' && it.y < 20))
    || [...pagesPos].sort((a, b) => score(b) - score(a))[0];
  if (!plan) return { walls: [], wallItems: [], island: null, islandItems: [], report: { problems: ['no plan page found'] } };

  // pdf.js can join adjacent labels into one run ("F339 W28.539") — split
  // wherever a new code starts mid-token.
  const split = [];
  for (const it of plan.items) {
    const parts = it.s.split(/\s+(?=F?C?-?[A-Z]{1,6}\d)/);
    let dx = 0;
    for (const part of parts) {
      // "FREP3/4 93FTK24L" splits wrongly at "93FTK…" — re-join code tails.
      if (split.length && /^\d/.test(part)) { split[split.length - 1].s += ` ${part}`; continue; }
      split.push({ s: part, x: it.x + dx, y: it.y });
      dx += part.length * 5;
    }
  }
  const labels = split
    .map(it => ({ ...it, dims: labelDims(it.s, brand) }))
    .filter(it => it.dims);
  const dims = parseDims(plan.items.filter(it => it.y > 20));   // skip title block
  if (labels.length < 3) return { walls: [], wallItems: [], island: null, islandItems: [], report: { problems: [`only ${labels.length} cabinet labels on the plan page`] } };

  // Label cloud bounding box → assign each label to its nearest edge; labels
  // far from every edge are island cabinetry.
  const xs = labels.map(l => l.x), ys = labels.map(l => l.y);
  const box = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
  const edgeDist = (l) => ({
    left: l.x - box.x0, right: box.x1 - l.x,
    bottom: l.y - box.y0, top: box.y1 - l.y,
  });
  const INTERIOR = 0.30;   // farther than 30% of the span from every edge → island
  const spanX = Math.max(1, box.x1 - box.x0), spanY = Math.max(1, box.y1 - box.y0);
  for (const l of labels) {
    const d = edgeDist(l);
    const rel = [['left', d.left / spanX], ['right', d.right / spanX], ['bottom', d.bottom / spanY], ['top', d.top / spanY]]
      .sort((a, b) => a[1] - b[1]);
    l.edge = rel[0][1] > INTERIOR ? 'island' : rel[0][0];
  }

  // Wall length per edge: the largest dim lying beyond that edge of the cloud.
  const beyond = {
    left: (d) => d.x < box.x0 - 5, right: (d) => d.x > box.x1 + 5,
    bottom: (d) => d.y < box.y0 - 5, top: (d) => d.y > box.y1 + 5,
  };
  const wallLenFor = (edge) => {
    const cands = dims.filter(d => beyond[edge](d) && d.v >= 36 && d.v <= 480);
    return cands.length ? Math.max(...cands.map(d => d.v)) : null;
  };

  // A stub edge (no printed wall dim, a couple of tall/panel labels) is the
  // END of an adjacent wall seen in plan — e.g. the pantry capping the fridge
  // run — not a wall of its own. Fold its labels into the nearest real edge.
  const ORDER = ['bottom', 'left', 'top', 'right'];
  for (const edge of ORDER) {
    const onEdge = labels.filter(l => l.edge === edge);
    if (!onEdge.length || wallLenFor(edge)) continue;
    const others = labels.filter(l => l.edge !== edge && l.edge !== 'island' && wallLenFor(l.edge));
    if (onEdge.length <= 3 && others.length) {
      for (const l of onEdge) {
        let best = null, bd = Infinity;
        for (const o of others) {
          const d = Math.hypot(o.x - l.x, o.y - l.y);
          if (d < bd) { bd = d; best = o; }
        }
        l.edge = best.edge;
      }
    }
  }
  const walls = [];
  const wallItems = [];
  const report = { problems: [], edges: {} };
  for (const edge of ORDER) {
    const onEdge = labels.filter(l => l.edge === edge);
    if (!onEdge.length) continue;
    const id = String.fromCharCode(65 + walls.length);
    // Order along the wall in walking direction.
    onEdge.sort((a, b) =>
      edge === 'bottom' ? a.x - b.x : edge === 'left' ? b.y - a.y
        : edge === 'top' ? a.x - b.x : a.y - b.y);
    const printed = wallLenFor(edge);
    // Per-zone cumulative placement from label order + widths.
    const cursors = { base: 0, upper: 0, tall: 0 };
    const sums = { base: 0, upper: 0, tall: 0 };
    for (const l of onEdge) {
      const z = l.dims.zone;
      wallItems.push({
        sku: l.s.replace(/\s+/g, ' ').replace(/(\s+\d+)+$/, '').trim(), wall: id, zone: z,
        width: l.dims.width, height: l.dims.height,
        position: cursors[z],
        ...(z === 'upper' ? { yMount: 54 } : {}),
      });
      cursors[z] += l.dims.width;
      sums[z] += l.dims.width;
    }
    const widest = Math.max(sums.base, sums.upper, sums.tall);
    const length = printed || Math.ceil(widest);
    walls.push({ id, length: Math.round(length * 8) / 8, role: 'general', openings: [] });
    report.edges[id] = {
      edge, printedDim: printed, cabinetSum: +widest.toFixed(2),
      labels: onEdge.map(l => l.s),
      match: printed ? Math.abs(printed - widest) <= Math.max(6, printed * 0.4) : null,
    };
  }

  const islandLabels = labels.filter(l => l.edge === 'island');
  let island = null;
  const islandItems = [];
  if (islandLabels.length) {
    islandLabels.sort((a, b) => a.x - b.x);
    let cur = 0, sum = 0;
    for (const l of islandLabels) {
      islandItems.push({ sku: l.s.replace(/\s+/g, ' ').replace(/(\s+\d+)+$/, '').trim(), zone: l.dims.zone === 'upper' ? 'base' : l.dims.zone, width: l.dims.width, height: l.dims.height, position: cur });
      cur += l.dims.width; sum += l.dims.width;
    }
    // Island footprint: interior dims when printed, else the cabinet run + 1" overhangs.
    const interior = dims.filter(d => !Object.values(beyond).some(fn => fn(d)) && d.v >= 24 && d.v <= 144)
      .map(d => d.v).sort((a, b) => b - a);
    island = {
      length: Math.round((interior[0] || sum + 2) * 8) / 8,
      depth: Math.round((interior.find(v => v < (interior[0] || 999) * 0.8) || 39) * 8) / 8,
    };
  }

  if (!walls.length) report.problems.push('no wall edges with cabinetry recognized');
  const layoutType = walls.length >= 3 ? 'u-shape' : walls.length === 2 ? 'l-shape' : 'single-wall';
  return { walls, wallItems, island, islandItems, layoutType, report };
}

// ── Browser extraction (same line logic as the spec-book uploader) ──────────
export async function extractPositionedPages(file, onProgress) {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    pages.push({
      pageNo: i,
      items: tc.items.filter(t => t.str && t.str.trim())
        .map(t => ({ s: t.str.trim(), x: t.transform[4], y: t.transform[5] })),
    });
    if (onProgress) onProgress(i, doc.numPages);
  }
  return pages;
}
