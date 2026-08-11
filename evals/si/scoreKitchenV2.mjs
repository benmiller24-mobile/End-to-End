/**
 * Scorer v2 — the designer-grade rubric (AD-1 of the Auto-Design Rebuild Plan).
 * =============================================================================
 * v1 (scoreKitchen.mjs) is a CRASH-FREEDOM floor: it cannot see composition,
 * landings, slivers, or seams, and a kitchen with zero base cabinets scored
 * 94/100. v2 is built from the 28-item professional rubric (NKBA hard numbers
 * + designer craft, docs/Auto-Design-Rebuild-Plan.md §3) and is calibrated so
 * that a REAL designed kitchen (Mautz) passes while today's auto output fails
 * for stated reasons.
 *
 * Contract:
 *   scoreKitchenV2(result, { room }) →
 *     { pass, score, hardFails[], metrics[{id,label,applicable,pass,detail}] }
 * - HARD gates failing ⇒ pass=false regardless of craft score.
 * - CRAFT items are scored as a fraction; pass needs ≥ CRAFT_PASS_FRACTION of
 *   the APPLICABLE ones.
 * - Deterministic, engine-output only, no tenant/pricing dependencies.
 * - Every metric that doesn't apply (no hood → no hood-centering) is excluded
 *   from the denominator — a metric never awards free points for absent data.
 */

const FILLER_RE = /^(FC-)?(OVF|F)\d/;
const SINKBASE_RE = /^(FC-)?(SB|VSB|DSB|BLSB|IWS|FLVSB)\d/;
const DRAWER_RE = /^(FC-)?(B[234]D|B2TD|B2HD|DB)\d/;
const PULLOUT_RE = /^(FC-)?(BWDM|BSP|TRAY|F\d|OVF)/;   // legitimate narrow units
const CORNER_RE = /^(FC-)?(BL|BBC|DSB36|BLSB)/;
const HOOD_RE = /^(FC-)?P?RH\d|HOOD/i;

const near = (a, b, tol) => Math.abs(a - b) <= tol;

// A run item list for one wall: positioned base-zone objects sorted by position.
function baseRun(result, wallId) {
  const wl = (result.walls || []).find(w => (w.wallId || w.id) === wallId);
  return ((wl && wl.cabinets) || [])
    .filter(c => typeof c.position === 'number' && (c.width || 0) > 0)
    .sort((a, b) => a.position - b.position);
}
function upperRun(result, wallId) {
  const ul = (result.uppers || []).find(u => u.wallId === wallId);
  return ((ul && ul.cabinets) || [])
    .filter(c => typeof c.position === 'number' && (c.width || 0) > 0)
    .sort((a, b) => a.position - b.position);
}
const wallIds = (result) => (result.walls || []).map(w => w.wallId || w.id).filter(Boolean);
const wallLen = (result, wallId) => {
  const wl = (result.walls || []).find(w => (w.wallId || w.id) === wallId);
  return (wl && (wl.wallLength || wl.length)) || 0;
};

// Counter-bearing span: bases + counter-height appliances (DW, sink) provide
// landing/prep surface; fridges, ranges and talls do not.
const COUNTER_APPLIANCES = new Set(['dishwasher', 'sink', 'winecooler', 'beveragecenter']);
const normType = (s) => String(s || '').replace(/[^a-z]/gi, '').toLowerCase();
function isCounterBearing(c) {
  if (c.type === 'base') return !(c._elev && c._elev.zone === 'TALL');
  if (c.type === 'appliance') return COUNTER_APPLIANCES.has(normType(c.applianceType));
  return false;
}

// Contiguous counter length on one side of an anchor (position range) —
// walks outward while consecutive counter-bearing items stay contiguous.
// NKBA landings may continue AROUND an inside corner: when the walk reaches a
// run end that terminates in a corner unit (or the wall junction itself holds
// one), the adjacent leg's counter keeps counting — credited as 24".
function counterBeside(run, edge, dir, opts = {}) {
  let len = 0, at = edge;
  const eps = 1.0;
  for (;;) {
    const nxt = run.find(c => dir > 0
      ? near(c.position, at, eps)
      : near(c.position + c.width, at, eps));
    if (!nxt || !isCounterBearing(nxt)) {
      if (nxt && CORNER_RE.test(String(nxt.sku || ''))) len += 24;   // corner unit = counter continues
      else if (!nxt && opts.cornerAt != null && near(at, opts.cornerAt, 2)) len += 24;
      break;
    }
    if (CORNER_RE.test(String(nxt.sku || ''))) { len += nxt.width + 24; break; }
    len += nxt.width;
    at = dir > 0 ? nxt.position + nxt.width : nxt.position;
  }
  return len;
}

// Corner junctions for a wall: does its start (position 0) or end (wallLength)
// adjoin a resolved corner? (solver results carry corners[]; manual results
// are covered by the corner-unit check inside counterBeside.)
function cornerEnds(result, wallId) {
  const out = { start: null, end: null };
  for (const c of (result.corners || [])) {
    if (c.wallB === wallId) out.start = 0;
    if (c.wallA === wallId) out.end = wallLen(result, wallId);
  }
  return out;
}

/** Openings (windows) on a wall: [{position,width}] from the room input. */
function windowsOn(room, wallId) {
  const w = ((room && room.walls) || []).find(x => x.id === wallId);
  return ((w && w.openings) || []).filter(o => o.type === 'window');
}

export const CRAFT_PASS_FRACTION = 0.8;

export function scoreKitchenV2(result, { room = null } = {}) {
  const metrics = [];
  const M = (id, label, applicable, pass, detail = '') =>
    metrics.push({ id, label, applicable: !!applicable, pass: !!applicable && !!pass, detail });

  const ids = wallIds(result);
  const allBase = ids.flatMap(w => baseRun(result, w).map(c => ({ ...c, _wall: w })));
  const allUpper = ids.flatMap(w => upperRun(result, w).map(c => ({ ...c, _wall: w })));
  const placements = result.placements || [];
  const findApp = (t) => allBase.find(c => c.type === 'appliance' && normType(c.applianceType) === t);
  // Sink identification order matters: the placed appliance, then a PRIMARY
  // sink base (SB/VSB) — an island work sink (IWS) is secondary, never "the" sink.
  const sink = findApp('sink')
    || allBase.find(c => /^(FC-)?(SB|VSB)\d/.test(String(c.sku || '')))
    || allBase.find(c => SINKBASE_RE.test(String(c.sku || '')));
  const range = findApp('range') || findApp('cooktop');
  const fridge = findApp('refrigerator');
  const dw = findApp('dishwasher');

  // ════ HARD GATES ════
  const hardFails = [];
  const H = (id, label, pass, detail = '') => {
    metrics.push({ id, label, applicable: true, pass: !!pass, detail, hard: true });
    if (!pass) hardFails.push(`${id}: ${detail || label}`);
  };

  // H-errors: ANY validator error fails the kitchen — no rule-name filtering.
  const errs = (result.validation || []).filter(v => v.severity === 'error');
  H('hard-errors', 'no severity=error validation findings', errs.length === 0,
    errs.slice(0, 3).map(e => e.rule).join(', '));

  // H-cabinets: a kitchen with no base cabinetry is not a kitchen.
  const realBases = allBase.filter(c => c.type === 'base' && !FILLER_RE.test(String(c.sku || '')));
  const totalRun = ids.reduce((a, w) => a + wallLen(result, w), 0);
  H('hard-bases', 'real base cabinets exist for the wall run',
    realBases.length >= Math.max(2, Math.floor(totalRun / 120)),
    `${realBases.length} bases on ${Math.round(totalRun)}" of wall`);

  // H-overflow / integrity (AD-0 classes stay hard).
  let overflow = 0, undefPos = 0;
  for (const w of ids) {
    const run = baseRun(result, w);
    if (run.length && Math.max(...run.map(c => c.position + c.width)) > wallLen(result, w) + 0.6) overflow++;
  }
  for (const t of (result.talls || [])) if (typeof t.position !== 'number') undefPos++;
  H('hard-geometry', 'no wall overflow, no unpositioned talls', overflow === 0 && undefPos === 0,
    `${overflow} overflowing wall(s), ${undefPos} unpositioned tall(s)`);

  // H-sink-landing: 24"/18" of counter beside the sink (NKBA).
  if (sink) {
    const sw = sink._wall || sink.wall;
    const run = baseRun(result, sw);
    const ce = cornerEnds(result, sw);
    const L = counterBeside(run, sink.position, -1, { cornerAt: ce.start });
    const R = counterBeside(run, sink.position + sink.width, +1, { cornerAt: ce.end });
    H('hard-sink-landing', 'sink landings ≥24"/18"', Math.max(L, R) >= 24 - 0.6 && Math.min(L, R) >= 18 - 0.6,
      `sink landings ${Math.round(L)}"/${Math.round(R)}"`);
  }

  // H-range-landing: 15"/12" beside the cooking surface (NKBA).
  if (range) {
    const rw = range._wall || range.wall;
    const run = baseRun(result, rw);
    const ce = cornerEnds(result, rw);
    const L = counterBeside(run, range.position, -1, { cornerAt: ce.start });
    const R = counterBeside(run, range.position + range.width, +1, { cornerAt: ce.end });
    H('hard-range-landing', 'range landings ≥15"/12"', Math.max(L, R) >= 15 - 0.6 && Math.min(L, R) >= 12 - 0.6,
      `range landings ${Math.round(L)}"/${Math.round(R)}"`);
  }

  // H-dw: dishwasher edge within 36" of the sink edge (NKBA).
  if (dw && sink && (dw._wall || dw.wall) === (sink._wall || sink.wall)) {
    const gap = dw.position > sink.position
      ? dw.position - (sink.position + sink.width)
      : sink.position - (dw.position + dw.width);
    H('hard-dw-sink', 'dishwasher within 36" of sink', gap <= 36 + 0.6, `gap ${Math.round(gap)}"`);
  } else if (dw && sink) {
    H('hard-dw-sink', 'dishwasher on the sink run', false, 'dishwasher and sink on different walls');
  }

  // ════ CRAFT METRICS ════

  // C-slivers: no door/drawer cabinet under 12" unless a dedicated pull-out.
  const slivers = [...allBase, ...allUpper].filter(c =>
    c.sku && c.width < 12 - 0.01 && c.type !== 'appliance'
    && !FILLER_RE.test(c.sku) && !PULLOUT_RE.test(c.sku)
    && !/^(FC-)?(BEP|WEP|REP|FREP|UDEP|BDEP|EP)/.test(c.sku));
  M('sliver', 'no sliver cabinets (<12") outside pull-out families', true, slivers.length === 0,
    slivers.slice(0, 3).map(c => `${c.sku}@${c._wall}`).join(' '));

  // C-filler-budget: ≤6" of filler per wall, none mid-run.
  let fillerBad = [];
  for (const w of ids) {
    const run = baseRun(result, w);
    const fills = run.filter(c => FILLER_RE.test(String(c.sku || '')));
    const total = fills.reduce((a, c) => a + c.width, 0);
    if (total > 6.01) fillerBad.push(`${w}: ${total.toFixed(1)}" filler`);
    for (const f of fills) {
      const i = run.indexOf(f);
      if (i > 0 && i < run.length - 1 && run[i - 1].type !== 'appliance' && run[i + 1].type !== 'appliance'
        && !CORNER_RE.test(String(run[i + 1].sku || '')) && !CORNER_RE.test(String(run[i - 1].sku || '')))
        fillerBad.push(`${w}: ${f.sku} mid-run`);
    }
  }
  M('filler', 'fillers ≤6"/wall and never stranded mid-run', true, fillerBad.length === 0, fillerBad.slice(0, 2).join('; '));

  // C-width-ladder: every cabinet width on the 1.5" ladder (mods carry flags).
  const offLadder = [...allBase, ...allUpper].filter(c =>
    c.sku && c.type !== 'appliance' && !FILLER_RE.test(c.sku)
    && c.type !== 'end_panel' && c.type !== 'panel' && c.type !== 'trim'
    && !/^(FC-)?(BEP|WEP|REP|FREP|UDEP|BDEP|VDEP|EP|TS-)/.test(c.sku)
    && !c.modified && Math.abs((c.width * 2) % 3) > 0.02 && Math.abs(((c.width * 2) % 3) - 3) > 0.02);
  M('ladder', 'unmodified widths sit on the catalog 1.5" ladder', true, offLadder.length === 0,
    offLadder.slice(0, 3).map(c => `${c.sku}=${c.width}`).join(' '));

  // C-drawer-mix: sizeable kitchens carry drawer storage in the base run.
  const eligible = realBases.filter(c => !SINKBASE_RE.test(c.sku || '') && !CORNER_RE.test(c.sku || ''));
  const drawerW = eligible.filter(c => DRAWER_RE.test(c.sku || '') || /-RT\b|-\dDR/.test(c.sku || '')).reduce((a, c) => a + c.width, 0);
  const eligW = eligible.reduce((a, c) => a + c.width, 0);
  M('drawers', '≥25% of eligible base frontage is drawer storage', eligW >= 48,
    eligW > 0 && drawerW / eligW >= 0.25, `${Math.round((drawerW / Math.max(eligW, 1)) * 100)}% drawers`);

  // C-prep: ≥36" contiguous counter adjacent to the sink.
  if (sink) {
    const sw = sink._wall || sink.wall;
    const run = baseRun(result, sw);
    const ce = cornerEnds(result, sw);
    const L = counterBeside(run, sink.position, -1, { cornerAt: ce.start });
    const R = counterBeside(run, sink.position + sink.width, +1, { cornerAt: ce.end });
    M('prep', '≥36" contiguous prep counter beside the sink', true, Math.max(L, R) >= 36 - 0.6,
      `best side ${Math.round(Math.max(L, R))}"`);
  }

  // C-range-fridge: cooking never hard against refrigeration.
  if (range && fridge && (range._wall || range.wall) === (fridge._wall || fridge.wall)) {
    const gap = range.position > fridge.position
      ? range.position - (fridge.position + fridge.width)
      : fridge.position - (range.position + range.width);
    M('range-fridge', '≥15" of counter between range and fridge', true, gap >= 15 - 0.6, `gap ${Math.round(gap)}"`);
  }

  // C-talls-at-ends: talls (and fridge towers) anchor run ends, never split a counter.
  const midTalls = [];
  for (const w of ids) {
    const run = baseRun(result, w);
    for (let i = 0; i < run.length; i++) {
      const c = run[i];
      const isTall = (c._elev && c._elev.zone === 'TALL') || /^(FC-)?(U[TV]?\d|PBC|FIO)/.test(String(c.sku || ''));
      if (!isTall) continue;
      const leftRun = run.slice(0, i).filter(isCounterBearing).reduce((a, x) => a + x.width, 0);
      const rightRun = run.slice(i + 1).filter(isCounterBearing).reduce((a, x) => a + x.width, 0);
      if (leftRun >= 24 && rightRun >= 24) midTalls.push(`${c.sku}@${w}`);
    }
  }
  M('tall-ends', 'talls anchor run ends (never split a counter)', true, midTalls.length === 0, midTalls.slice(0, 2).join(' '));

  // C-hood-centered + C-flank-symmetry (only when a hood exists).
  const hood = allUpper.find(c => HOOD_RE.test(String(c.sku || '')));
  if (hood && range) {
    const hc = hood.position + hood.width / 2;
    const rc = range.position + range.width / 2;
    M('hood-center', 'hood centered over the range (≤1.5")', (hood._wall === (range._wall || range.wall)),
      near(hc, rc, 1.5), `offset ${Math.abs(hc - rc).toFixed(1)}"`);
    const ups = upperRun(result, hood._wall).filter(c => !HOOD_RE.test(String(c.sku || '')));
    const L = ups.filter(c => c.position + c.width <= hood.position + 0.6 && c.position >= hood.position - 42).reduce((a, c) => a + c.width, 0);
    const R = ups.filter(c => c.position >= hood.position + hood.width - 0.6 && c.position <= hood.position + hood.width + 42).reduce((a, c) => a + c.width, 0);
    M('flank-sym', 'upper flanks around the hood balance (min/max ≥0.5)', L > 0 || R > 0,
      Math.min(L, R) / Math.max(L, R, 1) >= 0.5, `flanks ${Math.round(L)}"/${Math.round(R)}"`);
  }

  // C-seams: upper vertical seams align to base seams / appliance edges.
  {
    let aligned = 0, seams = 0;
    for (const w of ids) {
      const bases = baseRun(result, w);
      const ups = upperRun(result, w);
      if (bases.length < 2 || ups.length < 2) continue;
      const baseEdges = bases.flatMap(c => [c.position, c.position + c.width]);
      for (let i = 0; i < ups.length - 1; i++) {
        const seam = ups[i].position + ups[i].width;
        if (!near(seam, ups[i + 1].position, 1)) continue;
        seams++;
        if (baseEdges.some(e => near(e, seam, 1))) aligned++;
      }
    }
    M('seams', '≥20% of upper seams align with base seams', seams >= 2,
      aligned / Math.max(seams, 1) >= 0.2, `${aligned}/${seams} aligned`);
  }

  // C-upper-coverage: no blank upper span >30" above a counter run (windows,
  // hood zones, and tall/fridge footprints are legitimate blanks).
  {
    const blanks = [];
    for (const w of ids) {
      const bases = baseRun(result, w).filter(isCounterBearing);
      if (!bases.length) continue;
      const ups = upperRun(result, w);
      const talls = baseRun(result, w).filter(c => (c._elev && c._elev.zone === 'TALL') || c.applianceType === 'refrigerator');
      const wins = windowsOn(room, w);
      const covered = (x) =>
        ups.some(c => x >= c.position - 0.5 && x <= c.position + c.width + 0.5)
        || talls.some(c => x >= c.position - 0.5 && x <= c.position + c.width + 0.5)
        || wins.some(o => x >= (o.position || 0) - 0.5 && x <= (o.position || 0) + (o.width || 0) + 0.5)
        || (range && (range._wall || range.wall) === w && x >= range.position - 6 && x <= range.position + range.width + 6);
      for (const b of bases) {
        let blankStart = null;
        for (let x = b.position + 1; x < b.position + b.width; x += 3) {
          if (!covered(x)) { if (blankStart == null) blankStart = x; }
          else if (blankStart != null) { if (x - blankStart > 30) blanks.push(`${w}@${Math.round(blankStart)}`); blankStart = null; }
        }
        if (blankStart != null && (b.position + b.width - blankStart) > 30) blanks.push(`${w}@${Math.round(blankStart)}`);
      }
    }
    M('coverage', 'no bare wall >30" above a counter run', allUpper.length > 0, blanks.length === 0, blanks.slice(0, 3).join(' '));
  }

  // C-window: never a full upper cabinet over a window (when the room says so).
  if (room) {
    const overWindow = [];
    for (const w of ids) {
      for (const o of windowsOn(room, w)) {
        const ox0 = o.position || 0, ox1 = ox0 + (o.width || 0);
        for (const c of upperRun(result, w)) {
          if (HOOD_RE.test(String(c.sku || ''))) continue;
          const ov = Math.min(c.position + c.width, ox1) - Math.max(c.position, ox0);
          if (ov > Math.min(6, (o.width || 0) / 3)) overWindow.push(`${c.sku}@${w}`);
        }
      }
    }
    const anyWindows = ids.some(w => windowsOn(room, w).length);
    M('window', 'no upper cabinet hung over a window', anyWindows, overWindow.length === 0, overWindow.slice(0, 2).join(' '));
  }

  // ════ VERDICT ════
  const craft = metrics.filter(m => !m.hard && m.applicable);
  const craftPass = craft.filter(m => m.pass).length;
  const hardAll = metrics.filter(m => m.hard);
  const hardPass = hardAll.every(m => m.pass);
  const craftFraction = craft.length ? craftPass / craft.length : 1;
  const pass = hardPass && craftFraction >= CRAFT_PASS_FRACTION;
  const score = Math.round((hardPass ? 60 : Math.round(40 * hardAll.filter(m => m.pass).length / Math.max(hardAll.length, 1)))
    + 40 * craftFraction);
  return { pass, score, hardFails, craftFraction: +craftFraction.toFixed(3), metrics };
}
